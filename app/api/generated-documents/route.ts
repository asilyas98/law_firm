import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('generated_documents')
      .select('id, matter_id, matter_name, template_id, template_version, draft_type, prompt, input_data, output_markdown, status, created_by_email, reviewed_by_email, reviewed_at, created_at, updated_at')
      .eq('firm_id', user.firmId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ documents: data || [] });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'attorney');
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    const body = await request.json();
    const status = body.status;
    if (!['pending_attorney_review', 'attorney_approved', 'sent_to_client', 'archived'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = { status };
    if (status === 'attorney_approved' || status === 'sent_to_client') {
      updates.reviewed_by = user.userId;
      updates.reviewed_by_email = user.email;
      updates.reviewed_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('generated_documents')
      .update(updates)
      .eq('id', id)
      .eq('firm_id', user.firmId)
      .select('*')
      .single();
    if (error) throw error;

    const eventType = status === 'attorney_approved' ? 'approved' : status === 'sent_to_client' ? 'sent_to_client' : status === 'archived' ? 'archived' : 'reopened';
    await supabase.from('review_events').insert({
      firm_id: user.firmId,
      generated_document_id: id,
      event_type: eventType,
      actor_id: user.userId,
      actor_email: user.email,
      notes: body.notes || null,
    });
    await writeAudit(supabase, user, 'generated_document_status_updated', {
      matterId: data.matter_id,
      matterName: data.matter_name,
      outputPreview: `Updated ${data.draft_type} to ${status}`,
      metadata: { generated_document_id: id, status, notes: body.notes || null },
    });
    return NextResponse.json({ document: data });
  } catch (error: unknown) {
    return apiError(error);
  }
}
