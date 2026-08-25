import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';

export type FirmRole = 'owner' | 'admin' | 'attorney' | 'paralegal' | 'intake' | 'viewer';

export type RequestUser = {
  userId: string;
  email: string;
  firmId: string;
  role: FirmRole;
  displayName: string;
  practiceArea: string;
  chatbotPersona: string;
  isDemo: boolean;
};

const ROLE_RANK: Record<FirmRole, number> = {
  viewer: 0,
  intake: 1,
  paralegal: 2,
  attorney: 3,
  admin: 4,
  owner: 5,
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function roleAtLeast(role: FirmRole, minimum: FirmRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function defaultPersonaForRole(role: FirmRole) {
  switch (role) {
    case 'owner':
    case 'admin':
      return 'Treat this user as a firm administrator. Prioritize governance, auditability, configuration, and safe rollout guidance.';
    case 'attorney':
      return 'Treat this user as an attorney. Provide more detailed legal drafting support, issue spotting, and review-oriented analysis while keeping final outputs marked Pending Attorney Review where appropriate.';
    case 'paralegal':
      return 'Treat this user as a paralegal. Focus on checklists, intake completeness, document collection, procedural organization, and attorney-review handoff.';
    case 'intake':
      return 'Treat this user as intake staff. Use plain language, focus on client-facing questions, missing documents, matter opening, and avoid legal conclusions.';
    default:
      return 'Treat this user as a viewer. Keep answers high-level and avoid drafting privileged or client-facing legal work unless the user has a higher role.';
  }
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function stringFromMetadata(metadata: Record<string, unknown> | undefined, key: string, fallback = '') {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function demoUser(minimumRole: FirmRole = 'viewer'): RequestUser {
  const role: FirmRole = (process.env.DEMO_USER_ROLE as FirmRole) || 'owner';
  if (!roleAtLeast(role, minimumRole)) throw new ApiError('Demo user does not have the required role.', 403);
  return {
    userId: process.env.DEMO_USER_ID || '00000000-0000-0000-0000-000000000002',
    email: process.env.DEMO_USER_EMAIL || 'demo-admin@examplelawfirm.com',
    firmId: process.env.DEMO_FIRM_ID || '00000000-0000-0000-0000-000000000001',
    role,
    displayName: process.env.DEMO_USER_DISPLAY_NAME || 'Demo Admin',
    practiceArea: process.env.DEMO_USER_PRACTICE_AREA || 'General',
    chatbotPersona: process.env.DEMO_USER_CHATBOT_PERSONA || defaultPersonaForRole(role),
    isDemo: true,
  };
}

export async function requireFirmUser(request: NextRequest, minimumRole: FirmRole = 'viewer'): Promise<RequestUser> {
  const token = getBearerToken(request);

  if (!token && process.env.DEMO_MODE === 'true') {
    return demoUser(minimumRole);
  }

  if (!token) throw new ApiError('Authentication required.', 401);

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new ApiError('Invalid or expired session.', 401);

  const requestedFirmId = request.headers.get('x-firm-id');
  let query = supabase
    .from('firm_memberships')
    .select('firm_id, role, status')
    .eq('user_id', userData.user.id)
    .eq('status', 'active');

  if (requestedFirmId) query = query.eq('firm_id', requestedFirmId);

  const { data: memberships, error: membershipError } = await query.order('created_at', { ascending: true }).limit(1);
  if (membershipError) throw membershipError;
  const membership = memberships?.[0] as { firm_id: string; role: FirmRole; status: string } | undefined;
  if (!membership) throw new ApiError('No active firm membership found for this user.', 403);
  if (!roleAtLeast(membership.role, minimumRole)) throw new ApiError(`Requires ${minimumRole} role or higher.`, 403);

  const metadata = (userData.user.user_metadata || {}) as Record<string, unknown>;
  const fullName = stringFromMetadata(metadata, 'full_name', userData.user.email || 'Firm User');
  const displayName = stringFromMetadata(metadata, 'display_name', fullName);
  const practiceArea = stringFromMetadata(metadata, 'practice_area', 'General');
  const chatbotPersona = stringFromMetadata(metadata, 'chatbot_persona', defaultPersonaForRole(membership.role));

  await supabase.from('profiles').upsert({
    id: userData.user.id,
    email: userData.user.email || '',
    full_name: fullName,
  });

  return {
    userId: userData.user.id,
    email: userData.user.email || '',
    firmId: membership.firm_id,
    role: membership.role,
    displayName,
    practiceArea,
    chatbotPersona,
    isDemo: false,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [maybe.message, maybe.details, maybe.hint, maybe.code]
      .filter((part) => typeof part === 'string' && part.trim()) as string[];
    if (parts.length) return parts.join(' | ');
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }
  return 'Unknown error';
}

export function apiError(error: unknown) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = getErrorMessage(error);
  console.error('[API error]', message, error);
  return NextResponse.json({ error: message }, { status });
}

export async function writeAudit(
  supabase: SupabaseClient,
  user: RequestUser,
  action: string,
  fields: {
    matterId?: string | null;
    matterName?: string | null;
    prompt?: string | null;
    outputPreview?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from('audit_logs').insert({
    firm_id: user.firmId,
    actor_id: user.userId,
    actor_email: user.email,
    action,
    matter_id: fields.matterId || null,
    matter_name: fields.matterName || null,
    prompt: fields.prompt || null,
    output_preview: fields.outputPreview || null,
    metadata: fields.metadata || {},
  });
}
