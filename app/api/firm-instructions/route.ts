import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';
import { cleanMarkdownPreview } from '@/lib/textUtils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('firm_instructions')
      .select('id, title, instruction_type, status, priority, content, updated_at')
      .eq('firm_id', user.firmId)
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ instructions: data || [] });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'admin');
    const body = await request.json();
    if (!body.title || !body.content) return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const instructionType = ['generation_rule', 'review_rule', 'tone_rule', 'security_rule'].includes(body.instruction_type) ? body.instruction_type : 'generation_rule';
    const status = ['active', 'inactive'].includes(body.status) ? body.status : 'active';
    const { data, error } = await supabase.from('firm_instructions').insert({
      firm_id: user.firmId,
      title: String(body.title),
      instruction_type: instructionType,
      status,
      priority: Number(body.priority || 50),
      content: String(body.content),
      created_by: user.userId,
    }).select('*').single();
    if (error) throw error;
    await writeAudit(supabase, user, 'firm_instruction_created', {
      outputPreview: cleanMarkdownPreview(data.content),
      metadata: { instruction_id: data.id, title: data.title },
    });
    return NextResponse.json({ instruction: data });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'admin');
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    for (const key of ['title', 'content']) if (body[key] !== undefined) updates[key] = String(body[key]);
    if (body.instruction_type && ['generation_rule', 'review_rule', 'tone_rule', 'security_rule'].includes(body.instruction_type)) updates.instruction_type = body.instruction_type;
    if (body.status && ['active', 'inactive'].includes(body.status)) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = Number(body.priority);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('firm_instructions').update(updates).eq('id', id).eq('firm_id', user.firmId).select('*').single();
    if (error) throw error;
    await writeAudit(supabase, user, 'firm_instruction_updated', {
      outputPreview: `Updated ${data.title} (${data.status})`,
      metadata: { instruction_id: data.id, status: data.status },
    });
    return NextResponse.json({ instruction: data });
  } catch (error: unknown) {
    return apiError(error);
  }
}
