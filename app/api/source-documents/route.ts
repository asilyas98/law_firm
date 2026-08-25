import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { embedText } from '@/lib/openai';
import { apiError, requireFirmUser, roleAtLeast, writeAudit } from '@/lib/serverAuth';
import { chunkText, cleanMarkdownPreview } from '@/lib/textUtils';
import { extractTextFromUpload } from '@/lib/fileExtract';

export const runtime = 'nodejs';

async function reindexSourceDocument(supabase: ReturnType<typeof getSupabaseAdmin>, document: Record<string, any>) {
  await supabase.from('source_document_chunks').delete().eq('source_document_id', document.id);
  if (document.status !== 'approved') return;
  const chunks = chunkText(document.content);
  for (const content of chunks) {
    const embedding = await embedText(`${document.title}\n${document.practice_area || ''}\n${document.doc_type || ''}\n${content}`);
    const { error } = await supabase.from('source_document_chunks').insert({
      firm_id: document.firm_id,
      source_document_id: document.id,
      title: document.title,
      content,
      embedding,
    });
    if (error) throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('source_documents')
      .select('id, title, practice_area, doc_type, source_kind, status, content, created_at, updated_at')
      .eq('firm_id', user.firmId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ documents: data || [] });
  } catch (error: unknown) {
    return apiError(error);
  }
}

async function parseSourceDocumentRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    const titleFromForm = String(form.get('title') || '').trim();
    const practiceArea = String(form.get('practice_area') || 'General');
    const docType = String(form.get('doc_type') || 'Reference');
    const sourceKind = String(form.get('source_kind') || 'uploaded_text');
    const status = String(form.get('status') || 'needs_review');
    const pastedContent = String(form.get('content') || '').trim();

    if (file && file instanceof File && file.size > 0) {
      const extracted = await extractTextFromUpload(file);
      return {
        title: titleFromForm || extracted.filename,
        practice_area: practiceArea,
        doc_type: docType,
        source_kind: sourceKind || extracted.sourceKind,
        status,
        content: extracted.text,
        upload_metadata: {
          filename: extracted.filename,
          extension: extracted.extension,
          mime_type: extracted.mimeType,
          extracted_characters: extracted.text.length,
        },
      };
    }

    return {
      title: titleFromForm,
      practice_area: practiceArea,
      doc_type: docType,
      source_kind: sourceKind,
      status,
      content: pastedContent,
      upload_metadata: { pasted: true },
    };
  }

  return request.json();
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'paralegal');
    const body = await parseSourceDocumentRequest(request);
    const supabase = getSupabaseAdmin();
    if (!body.title || !body.content) {
      return NextResponse.json({ error: 'title and readable file content are required' }, { status: 400 });
    }
    const requestedStatus = ['approved', 'needs_review', 'do_not_use'].includes(body.status) ? body.status : 'needs_review';
    const status = requestedStatus === 'approved' && !roleAtLeast(user.role, 'attorney') ? 'needs_review' : requestedStatus;
    const { data, error } = await supabase.from('source_documents').insert({
      firm_id: user.firmId,
      title: String(body.title),
      practice_area: String(body.practice_area || 'General'),
      doc_type: String(body.doc_type || 'Reference'),
      source_kind: ['uploaded_text', 'template_reference', 'policy', 'sample', 'other'].includes(body.source_kind) ? body.source_kind : 'uploaded_text',
      status,
      content: String(body.content),
      uploaded_by: user.userId,
    }).select('*').single();
    if (error) throw error;
    await reindexSourceDocument(supabase, data);
    await writeAudit(supabase, user, 'source_document_uploaded', {
      outputPreview: cleanMarkdownPreview(data.content),
      metadata: { source_document_id: data.id, title: data.title, status: data.status, upload: body.upload_metadata || null },
    });
    return NextResponse.json({ document: data });
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
    for (const key of ['title', 'practice_area', 'doc_type', 'source_kind', 'content']) {
      if (body[key] !== undefined) updates[key] = String(body[key]);
    }
    if (body.status && ['approved', 'needs_review', 'do_not_use'].includes(body.status)) updates.status = body.status;
    const { data, error } = await supabase.from('source_documents').update(updates).eq('id', id).eq('firm_id', user.firmId).select('*').single();
    if (error) throw error;
    await reindexSourceDocument(supabase, data);
    await writeAudit(supabase, user, 'source_document_updated', {
      outputPreview: `Updated ${data.title} (${data.status})`,
      metadata: { source_document_id: data.id, status: data.status },
    });
    return NextResponse.json({ document: data });
  } catch (error: unknown) {
    return apiError(error);
  }
}
