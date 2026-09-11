import { NextRequest, NextResponse } from 'next/server';
import { createDocxBuffer, slugify } from '@/lib/exportUtils';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';

export const runtime = 'nodejs';

type GeneratedDocumentRow = {
  id: string;
  matter_id: string | null;
  matter_name: string;
  draft_type: string;
  output_markdown: string;
  status: string;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('generated_documents')
      .select('id, matter_id, matter_name, draft_type, output_markdown, status, created_at')
      .eq('id', id)
      .eq('firm_id', user.firmId)
      .single();
    if (error) throw error;
    const row = data as GeneratedDocumentRow;
    const title = `${row.matter_name} — ${row.draft_type}`;
    const buffer = await createDocxBuffer(row.output_markdown, title);
    const filename = `${slugify(row.matter_name)}-${slugify(row.draft_type)}.docx`;
    await writeAudit(supabase, user, 'generated_document_docx_exported', {
      matterId: row.matter_id,
      matterName: row.matter_name,
      outputPreview: `Exported ${filename}`,
      metadata: { generated_document_id: row.id, filename },
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
