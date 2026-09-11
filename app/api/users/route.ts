import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError, defaultPersonaForRole, requireFirmUser, roleAtLeast, type FirmRole } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const VALID_ROLES: FirmRole[] = ['owner', 'admin', 'attorney', 'paralegal', 'intake', 'viewer'];
const VALID_STATUSES = ['active', 'pending', 'disabled'];

type MembershipBaseRow = {
  id: string;
  firm_id: string;
  user_id: string;
  email: string;
  role: FirmRole;
  status: string;
  created_at: string;
};

type FirmUserResponse = MembershipBaseRow & {
  display_name: string | null;
  practice_area: string | null;
  chatbot_persona: string | null;
};

function cleanString(value: unknown, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function normalizeRole(value: unknown): FirmRole {
  const role = cleanString(value, 'viewer') as FirmRole;
  return VALID_ROLES.includes(role) ? role : 'viewer';
}

function normalizeStatus(value: unknown) {
  const status = cleanString(value, 'active');
  return VALID_STATUSES.includes(status) ? status : 'active';
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string, fallback = '') {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

async function findAuthUserIdByEmail(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const normalized = email.toLowerCase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle();
  if (profile?.id) return profile.id as string;

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((authUser) => authUser.email?.toLowerCase() === normalized)?.id || null;
}

async function getAuthMetadataByUserId(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const byId = new Map<string, Record<string, unknown>>();
  for (const authUser of data.users) {
    byId.set(authUser.id, (authUser.user_metadata || {}) as Record<string, unknown>);
  }
  return byId;
}

function mergeMembershipWithMetadata(row: MembershipBaseRow, metadata?: Record<string, unknown>): FirmUserResponse {
  const displayName = metadataString(metadata, 'display_name', metadataString(metadata, 'full_name', row.email));
  const practiceArea = metadataString(metadata, 'practice_area', 'General');
  const persona = metadataString(metadata, 'chatbot_persona', defaultPersonaForRole(row.role));
  return {
    ...row,
    display_name: displayName,
    practice_area: practiceArea,
    chatbot_persona: persona,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'admin');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('firm_memberships')
      .select('id, firm_id, user_id, email, role, status, created_at')
      .eq('firm_id', user.firmId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const metadataById = await getAuthMetadataByUserId(supabase);
    const users = ((data || []) as MembershipBaseRow[]).map((row) => mergeMembershipWithMetadata(row, metadataById.get(row.user_id)));
    return NextResponse.json({ users });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'admin');
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const email = cleanString(body.email).toLowerCase();
    const password = cleanString(body.password);
    const fullName = cleanString(body.full_name || body.fullName, email);
    const displayName = cleanString(body.display_name || body.displayName, fullName);
    const practiceArea = cleanString(body.practice_area || body.practiceArea, 'General');
    const chatbotPersona = cleanString(body.chatbot_persona || body.chatbotPersona, defaultPersonaForRole(normalizeRole(body.role)));
    const role = normalizeRole(body.role);
    const status = normalizeStatus(body.status);

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password is required and must be at least 8 characters for a new or reset user.' }, { status: 400 });
    }
    if (role === 'owner' && user.role !== 'owner') {
      return NextResponse.json({ error: 'Only an owner can create another owner.' }, { status: 403 });
    }

    let authUserId = await findAuthUserIdByEmail(supabase, email);
    const userMetadata = {
      full_name: fullName,
      display_name: displayName,
      practice_area: practiceArea,
      chatbot_persona: chatbotPersona,
    };

    if (!authUserId) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });
      if (createError) throw createError;
      authUserId = created.user.id;
    } else {
      const { error: updateUserError } = await supabase.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: userMetadata,
      });
      if (updateUserError) throw updateUserError;
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authUserId,
      email,
      full_name: fullName,
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { data: membership, error: membershipError } = await supabase.from('firm_memberships').upsert({
      firm_id: user.firmId,
      user_id: authUserId,
      email,
      role,
      status,
    }, { onConflict: 'firm_id,user_id' }).select('id, firm_id, user_id, email, role, status, created_at').single();
    if (membershipError) throw membershipError;

    await supabase.from('audit_logs').insert({
      firm_id: user.firmId,
      actor_id: user.userId,
      actor_email: user.email,
      action: 'firm_user_created_or_updated',
      output_preview: `${email} added/updated as ${role}.`,
      metadata: { target_user_id: authUserId, role, status, practice_area: practiceArea },
    });

    return NextResponse.json({ user: mergeMembershipWithMetadata(membership as MembershipBaseRow, userMetadata) });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'admin');
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const userId = cleanString(body.user_id || body.userId);
    if (!userId) return NextResponse.json({ error: 'user_id is required.' }, { status: 400 });

    const role = normalizeRole(body.role);
    const status = normalizeStatus(body.status);
    if (role === 'owner' && user.role !== 'owner') {
      return NextResponse.json({ error: 'Only an owner can assign owner role.' }, { status: 403 });
    }
    if (!roleAtLeast(user.role, 'owner') && userId === user.userId && status !== 'active') {
      return NextResponse.json({ error: 'Admins cannot disable themselves.' }, { status: 403 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('firm_memberships')
      .select('id, firm_id, user_id, email, role, status, created_at')
      .eq('firm_id', user.firmId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: 'User membership not found.' }, { status: 404 });

    const displayName = cleanString(body.display_name || body.displayName, existing.email);
    const practiceArea = cleanString(body.practice_area || body.practiceArea, 'General');
    const chatbotPersona = cleanString(body.chatbot_persona || body.chatbotPersona, defaultPersonaForRole(role));
    const userMetadata = {
      display_name: displayName,
      practice_area: practiceArea,
      chatbot_persona: chatbotPersona,
    };

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, { user_metadata: userMetadata });
    if (updateAuthError) throw updateAuthError;

    const { data, error } = await supabase
      .from('firm_memberships')
      .update({ role, status })
      .eq('firm_id', user.firmId)
      .eq('user_id', userId)
      .select('id, firm_id, user_id, email, role, status, created_at')
      .single();
    if (error) throw error;

    await supabase.from('audit_logs').insert({
      firm_id: user.firmId,
      actor_id: user.userId,
      actor_email: user.email,
      action: 'firm_user_role_or_persona_updated',
      output_preview: `${data.email} updated as ${data.role} / ${data.status}.`,
      metadata: { target_user_id: userId, role: data.role, status: data.status, practice_area: practiceArea },
    });

    return NextResponse.json({ user: mergeMembershipWithMetadata(data as MembershipBaseRow, userMetadata) });
  } catch (error: unknown) {
    return apiError(error);
  }
}
