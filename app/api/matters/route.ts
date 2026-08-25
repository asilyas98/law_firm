import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('matters')
      .select('id, matter_name, matter_type, description, deadline, status, responsible_attorney, assigned_to, metadata, created_at, updated_at, clients(id, name, contact_name, contact_email)')
      .eq('firm_id', user.firmId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ matters: data || [] });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'intake');
    const body = await request.json();
    if (!body.matter_name || !body.client_name) {
      return NextResponse.json({ error: 'matter_name and client_name are required' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: client, error: clientError } = await supabase.from('clients').insert({
      firm_id: user.firmId,
      name: String(body.client_name),
      contact_name: body.client_contact_name ? String(body.client_contact_name) : null,
      contact_email: body.client_contact_email ? String(body.client_contact_email) : null,
      phone: body.client_phone ? String(body.client_phone) : null,
      metadata: {},
    }).select('*').single();
    if (clientError) throw clientError;

    const { data: matter, error: matterError } = await supabase.from('matters').insert({
      firm_id: user.firmId,
      client_id: client.id,
      matter_name: String(body.matter_name),
      matter_type: String(body.matter_type || 'General'),
      description: body.description ? String(body.description) : null,
      deadline: body.deadline ? String(body.deadline) : null,
      status: body.status && ['intake', 'open', 'waiting_on_client', 'attorney_review', 'closed', 'archived'].includes(body.status) ? body.status : 'intake',
      responsible_attorney: body.responsible_attorney ? String(body.responsible_attorney) : null,
      assigned_to: body.assigned_to ? String(body.assigned_to) : null,
      metadata: { client_goals: body.client_goals || '' },
      created_by: user.userId,
    }).select('id, matter_name, matter_type, description, deadline, status, responsible_attorney, assigned_to, metadata, created_at, updated_at, clients(id, name, contact_name, contact_email)').single();
    if (matterError) throw matterError;

    await writeAudit(supabase, user, 'matter_created', {
      matterId: matter.id,
      matterName: matter.matter_name,
      outputPreview: `Opened ${matter.matter_name} for ${client.name}`,
      metadata: { client_id: client.id, matter_type: matter.matter_type },
    });
    return NextResponse.json({ matter });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'paralegal');
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    for (const key of ['matter_name', 'matter_type', 'description', 'deadline', 'responsible_attorney', 'assigned_to']) {
      if (body[key] !== undefined) updates[key] = String(body[key]);
    }
    if (body.status && ['intake', 'open', 'waiting_on_client', 'attorney_review', 'closed', 'archived'].includes(body.status)) updates.status = body.status;
    if (body.metadata !== undefined && typeof body.metadata === 'object') updates.metadata = body.metadata;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('matters').update(updates).eq('id', id).eq('firm_id', user.firmId).select('*').single();
    if (error) throw error;
    await writeAudit(supabase, user, 'matter_updated', {
      matterId: data.id,
      matterName: data.matter_name,
      outputPreview: `Updated matter ${data.matter_name}`,
      metadata: { status: data.status },
    });
    return NextResponse.json({ matter: data });
  } catch (error: unknown) {
    return apiError(error);
  }
}
