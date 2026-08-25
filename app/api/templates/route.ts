import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { embedText } from '@/lib/openai';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';
import { asStringArray, cleanMarkdownPreview } from '@/lib/textUtils';

export const runtime = 'nodejs';

async function reindexTemplate(supabase: ReturnType<typeof getSupabaseAdmin>, template: Record<string, any>) {
  await supabase.from('template_chunks').delete().eq('template_id', template.id);
  if (template.status !== 'approved') return;
  const embedding = await embedText(`${template.name}\n${template.practice_area}\n${template.doc_type}\n${template.body_markdown}`);
  const { error } = await supabase.from('template_chunks').insert({
    firm_id: template.firm_id,
    template_id: template.id,
    template_key: template.template_key,
    name: template.name,
    content: template.body_markdown,
    embedding,
  });
  if (error) throw error;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('templates')
      .select('id, template_key, name, practice_area, doc_type, jurisdiction, status, version, body_markdown, required_fields, optional_fields, review_required, approved_by, approved_at, updated_at')
      .eq('firm_id', user.firmId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ templates: data || [] });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'attorney');
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (!body.name || !body.body_markdown) {
      return NextResponse.json({ error: 'name and body_markdown are required' }, { status: 400 });
    }

    const templateKey = String(body.template_key || body.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80);

    const status = ['draft', 'approved', 'needs_review', 'do_not_use'].includes(body.status) ? body.status : 'draft';

    const insert = {
      firm_id: user.firmId,
      template_key: templateKey,
      name: String(body.name),
      practice_area: String(body.practice_area || 'General'),
      doc_type: String(body.doc_type || 'Template'),
      jurisdiction: String(body.jurisdiction || 'General'),
      status,
      version: String(body.version || '1.0.0'),
      body_markdown: String(body.body_markdown),
      required_fields: asStringArray(body.required_fields),
      optional_fields: asStringArray(body.optional_fields),
      review_required: body.review_required !== false,
      approved_by: status === 'approved' ? user.email : null,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      created_by: user.userId,
    };

    const { data, error } = await supabase.from('templates').insert(insert).select('*').single();
    if (error) throw error;
    await reindexTemplate(supabase, data);
    await writeAudit(supabase, user, 'template_created', {
      outputPreview: cleanMarkdownPreview(insert.body_markdown),
      metadata: { template_id: data.id, template_key: data.template_key, status: data.status },
    });
    return NextResponse.json({ template: data });
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
    const supabase = getSupabaseAdmin();

    const updates: Record<string, unknown> = {};
    for (const key of ['name', 'practice_area', 'doc_type', 'jurisdiction', 'version', 'body_markdown']) {
      if (body[key] !== undefined) updates[key] = String(body[key]);
    }
    if (body.required_fields !== undefined) updates.required_fields = asStringArray(body.required_fields);
    if (body.optional_fields !== undefined) updates.optional_fields = asStringArray(body.optional_fields);
    if (body.review_required !== undefined) updates.review_required = Boolean(body.review_required);
    if (body.status && ['draft', 'approved', 'needs_review', 'do_not_use'].includes(body.status)) {
      updates.status = body.status;
      updates.approved_by = body.status === 'approved' ? user.email : null;
      updates.approved_at = body.status === 'approved' ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id)
      .eq('firm_id', user.firmId)
      .select('*')
      .single();
    if (error) throw error;
    await reindexTemplate(supabase, data);
    await writeAudit(supabase, user, 'template_updated', {
      outputPreview: `Updated ${data.name} (${data.status})`,
      metadata: { template_id: data.id, template_key: data.template_key, status: data.status },
    });
    return NextResponse.json({ template: data });
  } catch (error: unknown) {
    return apiError(error);
  }
}
