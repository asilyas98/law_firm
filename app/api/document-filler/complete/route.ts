import { NextRequest, NextResponse } from 'next/server';
import { apiError, requireFirmUser } from '@/lib/serverAuth';
import { createDocxBuffer, createSimplePdfBuffer, slugify } from '@/lib/exportUtils';
import { fillOriginalDocxBuffer, fillOriginalPdfBuffer } from '@/lib/originalFormFill';

export const runtime = 'nodejs';

type Field = {
  id: string;
  label: string;
  normalizedKey: string;
  required?: boolean;
  repeatedOf?: string | null;
  section?: string;
  itemNumber?: string;
  helpText?: string;
  conditionalKey?: string | null;
  conditionalValues?: string[] | null;
  answerType?: string;
  options?: string[];
};

function fillText(sourceText: string, fields: Field[], answers: Record<string, string>) {
  const answerById = new Map<string, string>();

  for (const field of fields) {
    const resolvedAnswer = answers[field.id] || (field.repeatedOf ? answers[field.repeatedOf] : '') || '';
    answerById.set(field.id, resolvedAnswer);
  }

  const appendix = fields
    .map((field) => {
      const value = answerById.get(field.id) || '';
      const prefix = [field.section, field.itemNumber ? `Item ${field.itemNumber}` : ''].filter(Boolean).join(' - ');
      return `- ${prefix ? `${prefix}: ` : ''}${field.label}: ${value || '[Not answered]'}`;
    })
    .join('\n');

  return `Completed guided answer summary\n${appendix}\n\n---\n\nOriginal extracted text for review\n${sourceText}`;
}

function base64ToBuffer(input: unknown) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const cleaned = input.includes(',') ? input.split(',').pop() || '' : input;
  return Buffer.from(cleaned, 'base64');
}

function normalizeExtension(filename: string, fallback = '') {
  const fromName = filename.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return fromName || fallback.toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    await requireFirmUser(request, 'viewer');
    const body = await request.json();
    const title = String(body.title || 'Filled Document');
    const sourceText = String(body.sourceText || '');
    const format = String(body.format || 'docx').toLowerCase();
    const fields = Array.isArray(body.fields) ? body.fields as Field[] : [];
    const answers = typeof body.answers === 'object' && body.answers ? body.answers as Record<string, string> : {};
    const exactLayout = body.exactLayout === true;
    const originalFilename = String(body.originalFilename || title || 'uploaded-document');
    const originalExtension = normalizeExtension(originalFilename, String(body.originalExtension || ''));
    const formType = String(body.formType || '');
    const originalBuffer = base64ToBuffer(body.originalBase64);

    if (!fields.length) return NextResponse.json({ error: 'fields are required' }, { status: 400 });
    if (!['docx', 'pdf'].includes(format)) return NextResponse.json({ error: 'format must be docx or pdf' }, { status: 400 });

    if (exactLayout && originalBuffer) {
      if (format === 'pdf' && originalExtension === 'pdf') {
        const buffer = await fillOriginalPdfBuffer(originalBuffer, { title, formType, fields, answers });
        const filename = `${slugify(title)}-filled-original-layout.pdf`;
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }
      if (format === 'docx' && originalExtension === 'docx') {
        const buffer = await fillOriginalDocxBuffer(originalBuffer, { title, formType, fields, answers });
        const filename = `${slugify(title)}-filled-original-layout.docx`;
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }
      return NextResponse.json({ error: 'Exact-layout export must match the uploaded file type: PDF to PDF or DOCX to DOCX.' }, { status: 400 });
    }

    if (!sourceText.trim()) return NextResponse.json({ error: 'sourceText is required for review-packet export' }, { status: 400 });
    const filled = fillText(sourceText, fields, answers);
    const header = `Pending Attorney Review\n\nThis automated fill was generated from user-provided answers. Review every answer against the original form before filing, signing, or sending.\n\n`;
    const buffer = format === 'pdf' ? createSimplePdfBuffer(`${header}${filled}`, title) : await createDocxBuffer(`${header}${filled}`, title);
    const filename = `${slugify(title)}-filled-review-packet.${format}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
