import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'document';
}

export function stripMarkdown(input: string): string {
  return input
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .trim();
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

export async function createDocxBuffer(markdown: string, title = 'Document'): Promise<Buffer> {
  const lines = [`# ${title}`, '', ...markdown.split('\n')];
  const doc = new Document({ sections: [{ properties: {}, children: lines.map(paragraphForLine) }] });
  return Packer.toBuffer(doc);
}

function escapePdfText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\u0000-\u001f\u007f-\uffff]/g, (char) => {
      if (char === '\n' || char === '\r' || char === '\t') return ' ';
      return '?';
    });
}

function wrapPdfLines(input: string, width = 92): string[] {
  const result: string[] = [];
  for (const rawLine of input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    const line = stripMarkdown(rawLine).trim();
    if (!line) {
      result.push('');
      continue;
    }
    let current = '';
    for (const word of line.split(/\s+/)) {
      if ((current + ' ' + word).trim().length > width) {
        result.push(current.trim());
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current) result.push(current);
  }
  return result;
}

export function createSimplePdfBuffer(markdown: string, title = 'Document'): Buffer {
  const lines = wrapPdfLines(`${title}\n\n${markdown}`);
  const pages: string[][] = [];
  const linesPerPage = 47;
  for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));
  if (pages.length === 0) pages.push(['']);

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageObjectNumbers = pages.map((_, index) => 3 + index * 2);
  objects.push(`<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`);

  pages.forEach((pageLines, pageIndex) => {
    const pageObjNum = 3 + pageIndex * 2;
    const contentObjNum = pageObjNum + 1;
    const text = pageLines
      .map((line, index) => `BT /F1 10 Tf 50 ${760 - index * 15} Td (${escapePdfText(line)}) Tj ET`)
      .join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObjNum} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(text, 'utf8')} >>\nstream\n${text}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
