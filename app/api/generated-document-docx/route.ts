import { NextRequest, NextResponse } from 'next/server';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
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

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'generated-document';
}

function stripMarkdown(input: string): string {
  return input.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*/g, '').trim();
}

function paragraphForLine(line: string): Paragraph {
  const trimmed = line.trim();
  if (!trimmed) return new Paragraph({ text: '' });
  if (trimmed.startsWith('# ')) return new Paragraph({ text: stripMarkdown(trimmed), heading: HeadingLevel.HEADING_1 });
  if (trimmed.startsWith('## ')) return new Paragraph({ text: stripMarkdown(trimmed), heading: HeadingLevel.HEADING_2 });
  if (trimmed.startsWith('### ')) return new Paragraph({ text: stripMarkdown(trimmed), heading: HeadingLevel.HEADING_3 });
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return new Paragraph({ text: stripMarkdown(trimmed), bullet: { level: 0 } });
  return new Paragraph({ children: [new TextRun(stripMarkdown(trimmed))] });
}

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
    const doc = new Document({ sections: [{ properties: {}, children: row.output_markdown.split('\n').map(paragraphForLine) }] });
    const buffer = await Packer.toBuffer(doc);
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
