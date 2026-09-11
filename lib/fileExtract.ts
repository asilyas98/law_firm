import mammoth from 'mammoth';

const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;
const MIN_EXTRACTED_CHARS = 25;

type ExtractedFile = {
  text: string;
  sourceKind: 'uploaded_text';
  filename: string;
  extension: string;
  mimeType: string;
};

function normalizeExtractedText(input: string) {
  return input
    .replace(/\u0000/g, ' ')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \u00a0]{2,}/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function extensionFromName(name: string) {
  const lower = name.toLowerCase();
  const match = lower.match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // pdf-parse is CommonJS in the stable 1.x line; require avoids fragile default-import typing.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse') as (dataBuffer: Buffer) => Promise<{ text?: string }>;

  if (typeof pdfParse !== 'function') {
    throw new Error('PDF parser could not be loaded.');
  }

  const parsed = await pdfParse(buffer);
  return parsed?.text ?? '';
}

async function extractDocx(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

export async function extractTextFromUpload(file: File): Promise<ExtractedFile> {
  const filename = file.name || 'uploaded-file';
  const mimeType = file.type || 'application/octet-stream';
  const extension = extensionFromName(filename);

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large. Maximum supported upload is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let text = '';

  if (['txt', 'md', 'markdown', 'csv', 'rtf', 'html', 'htm'].includes(extension) || mimeType.startsWith('text/')) {
    text = buffer.toString('utf8');
  } else if (extension === 'pdf' || mimeType === 'application/pdf') {
    text = await extractPdf(buffer);
  } else if (extension === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    text = await extractDocx(buffer);
  } else if (extension === 'pages') {
    throw new Error('Apple Pages files are not supported directly. Export the file as DOCX, PDF, or TXT, then upload again.');
  } else if (extension === 'doc') {
    throw new Error('Legacy .doc files are not supported. Save/export as DOCX or PDF, then upload again.');
  } else {
    throw new Error(`Unsupported file type${extension ? ` .${extension}` : ''}. Upload TXT, MD, CSV, PDF, or DOCX.`);
  }

  const normalized = normalizeExtractedText(text);
  if (normalized.length < MIN_EXTRACTED_CHARS) {
    throw new Error('No readable text could be extracted from this file. Try OCR, copy/paste the text, or upload a text-searchable PDF/DOCX.');
  }

  return { text: normalized, sourceKind: 'uploaded_text', filename, extension, mimeType };
}
