import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { apiError, requireFirmUser } from '@/lib/serverAuth';
import { slugify } from '@/lib/exportUtils';

export const runtime = 'nodejs';

type PdfFieldLike = {
  getName: () => string;
  constructor: { name: string };
  setText?: (value: string) => void;
  check?: () => void;
  uncheck?: () => void;
  select?: (value: string) => void;
};

function base64ToBuffer(input: unknown) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const cleaned = input.includes(',') ? input.split(',').pop() || '' : input;
  return Buffer.from(cleaned, 'base64');
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanFilename(input: string) {
  const base = input.replace(/\.pdf$/i, '').trim() || 'edited-document';
  return `${slugify(base)}-edited.pdf`;
}

function findPdfField(fields: PdfFieldLike[], requestedName: string) {
  const needle = requestedName.trim().toLowerCase();
  if (!needle) return null;
  return fields.find((field) => field.getName().toLowerCase() === needle)
    || fields.find((field) => field.getName().toLowerCase().includes(needle))
    || null;
}

async function setPdfFormField(pdfDoc: PDFDocument, fieldName: string, newValue: string) {
  if (!fieldName.trim()) return false;
  const form = pdfDoc.getForm();
  const field = findPdfField(form.getFields() as unknown as PdfFieldLike[], fieldName);
  if (!field) return false;

  const type = field.constructor.name;
  if (type.includes('TextField') && field.setText) field.setText(newValue);
  else if (type.includes('CheckBox')) {
    if (/^(yes|true|checked|x|1)$/i.test(newValue)) field.check?.();
    else if (/^(no|false|unchecked|0)$/i.test(newValue)) field.uncheck?.();
    else field.check?.();
  } else if ((type.includes('Dropdown') || type.includes('RadioGroup')) && field.select) {
    field.select(newValue);
  } else if (field.setText) {
    field.setText(newValue);
  } else {
    return false;
  }

  try { form.updateFieldAppearances(); } catch {}
  return true;
}

export async function POST(request: NextRequest) {
  try {
    await requireFirmUser(request, 'viewer');
    const body = await request.json();
    const originalBuffer = base64ToBuffer(body.originalBase64);
    const originalFilename = String(body.originalFilename || 'edited-document.pdf');
    const newValue = String(body.newValue || '').trim();
    const fieldName = String(body.fieldName || '').trim();

    if (!originalBuffer) return NextResponse.json({ error: 'originalBase64 is required' }, { status: 400 });
    if (!newValue) return NextResponse.json({ error: 'newValue is required' }, { status: 400 });

    const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
    const usedFormField = await setPdfFormField(pdfDoc, fieldName, newValue);

    if (!usedFormField) {
      const pages = pdfDoc.getPages();
      const pageNumber = Math.max(1, Math.min(pages.length, Math.floor(safeNumber(body.pageNumber, 1))));
      const page = pages[pageNumber - 1];
      const x = safeNumber(body.x, 100);
      const yTop = safeNumber(body.yTop, 100);
      const width = Math.max(1, safeNumber(body.width, 220));
      const height = Math.max(1, safeNumber(body.height, 18));
      const fontSize = Math.max(4, safeNumber(body.fontSize, 10));
      const whiteOut = body.whiteOut !== false;
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const y = page.getHeight() - yTop - height;

      if (whiteOut) {
        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: rgb(1, 1, 1),
          opacity: 1,
        });
      }

      page.drawText(newValue.slice(0, 130), {
        x: x + 2,
        y: y + Math.max(2, (height - fontSize) / 2),
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: width - 4,
      });
    }

    const buffer = Buffer.from(await pdfDoc.save());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cleanFilename(originalFilename)}"`,
        'X-PDF-Quick-Edit-Mode': usedFormField ? 'form-field' : 'overlay',
      },
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
