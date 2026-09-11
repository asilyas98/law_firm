import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

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
    .replace(/^\d+[.)]\s+/, '')
    .replace(/\|/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .trim();
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function looksLikeSectionHeading(line: string) {
  const trimmed = line.trim();
  if (trimmed.length < 8 || trimmed.length > 90) return false;
  if (/[:.;,]$/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  return letters.length >= 6 && letters === letters.toUpperCase();
}

function inlineRuns(input: string): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) runs.push(new TextRun({ text: input.slice(lastIndex, match.index) }));
    const token = match[0];
    if (token.startsWith('**')) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true, color: '0F172A' }));
    } else {
      runs.push(new TextRun({ text: token.slice(1, -1), font: 'Courier New', color: '334155' }));
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < input.length) runs.push(new TextRun({ text: input.slice(lastIndex) }));
  return runs.length ? runs : [new TextRun({ text: '' })];
}

function legalParagraph(text: string, options: { heading?: any; bullet?: boolean; number?: number; bold?: boolean; color?: string } = {}) {
  const clean = options.heading ? stripMarkdown(text) : text;
  return new Paragraph({
    heading: options.heading,
    bullet: options.bullet ? { level: 0 } : undefined,
    numbering: options.number ? { reference: 'legal-numbering', level: 0 } : undefined,
    spacing: { before: options.heading ? 240 : 80, after: options.heading ? 160 : 80, line: 276 },
    children: options.bold
      ? [new TextRun({ text: stripMarkdown(clean), bold: true, color: options.color || '0F172A' })]
      : inlineRuns(clean),
  });
}

function tableFromMarkdown(headerLine: string, bodyLines: string[]): Table {
  const header = splitTableRow(headerLine);
  const rows = bodyLines.map(splitTableRow);
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({
        children: header.map((cell) => new TableCell({
          shading: { fill: 'EAF2FF' },
          margins: { top: 140, bottom: 140, left: 140, right: 140 },
          children: [new Paragraph({ children: [new TextRun({ text: stripMarkdown(cell), bold: true, color: '1D4ED8' })] })],
        })),
      }),
      ...rows.map((row) => new TableRow({
        children: header.map((_, index) => new TableCell({
          margins: { top: 120, bottom: 120, left: 140, right: 140 },
          children: [new Paragraph({ children: inlineRuns(row[index] || '') })],
        })),
      })),
    ],
  });
}

function markdownToDocChildren(markdown: string): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i += 1; continue; }

    if (line.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      const body: string[] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        body.push(lines[i]);
        i += 1;
      }
      children.push(tableFromMarkdown(line, body));
      children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
      continue;
    }

    if (/^#\s+/.test(line)) children.push(legalParagraph(line, { heading: HeadingLevel.HEADING_1 }));
    else if (/^##\s+/.test(line)) children.push(legalParagraph(line, { heading: HeadingLevel.HEADING_2 }));
    else if (/^###\s+/.test(line)) children.push(legalParagraph(line, { heading: HeadingLevel.HEADING_3 }));
    else if (/^[-*]\s+/.test(line)) children.push(legalParagraph(line.replace(/^[-*]\s+/, ''), { bullet: true }));
    else if (/^\d+[.)]\s+/.test(line)) children.push(legalParagraph(line.replace(/^\d+[.)]\s+/, ''), { number: 1 }));
    else if (looksLikeSectionHeading(line)) children.push(legalParagraph(line, { bold: true, color: '1D4ED8' }));
    else children.push(legalParagraph(line));
    i += 1;
  }
  return children.length ? children : [new Paragraph('')];
}

export async function createDocxBuffer(markdown: string, title = 'Document'): Promise<Buffer> {
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'legal-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }],
      }],
    },
    styles: {
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: '0F172A' }, paragraph: { spacing: { before: 320, after: 160 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: '1D4ED8' }, paragraph: { spacing: { before: 280, after: 140 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: '334155' }, paragraph: { spacing: { before: 220, after: 100 } } },
      ],
    },
    sections: [{
      properties: {
        page: { margin: { top: 1080, right: 900, bottom: 900, left: 900 } },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          children: [new TextRun({ text: title, bold: true, size: 36, color: '0F172A' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 340 },
          children: [new TextRun({ text: 'Pending Attorney Review', bold: true, color: 'B45309', size: 22 })],
        }),
        ...markdownToDocChildren(markdown),
      ],
    }],
  });
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

type PdfLine = { text: string; style: 'heading' | 'subheading' | 'body' | 'bullet' | 'meta' };

function pushWrappedLine(out: PdfLine[], text: string, style: PdfLine['style'], width: number) {
  const clean = stripMarkdown(text).trim();
  if (!clean) { out.push({ text: '', style: 'body' }); return; }
  let current = '';
  for (const word of clean.split(/\s+/)) {
    if ((current + ' ' + word).trim().length > width) {
      out.push({ text: current.trim(), style });
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) out.push({ text: current, style });
}

function pdfLines(markdown: string): PdfLine[] {
  const result: PdfLine[] = [];
  for (const rawLine of markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) { result.push({ text: '', style: 'body' }); continue; }
    if (line.includes('|') || isTableSeparator(line)) {
      pushWrappedLine(result, line.replace(/\|/g, '  '), 'meta', 96);
    } else if (/^#{1,2}\s+/.test(line) || looksLikeSectionHeading(line)) {
      pushWrappedLine(result, line, 'heading', 76);
    } else if (/^###\s+/.test(line)) {
      pushWrappedLine(result, line, 'subheading', 86);
    } else if (/^[-*]\s+/.test(line)) {
      pushWrappedLine(result, `• ${line.replace(/^[-*]\s+/, '')}`, 'bullet', 88);
    } else if (/^\d+[.)]\s+/.test(line)) {
      pushWrappedLine(result, line, 'bullet', 88);
    } else if (/^[A-Za-z][A-Za-z\s/.-]{1,42}:\s+/.test(line)) {
      pushWrappedLine(result, line, 'meta', 88);
    } else {
      pushWrappedLine(result, line, 'body', 92);
    }
  }
  return result;
}

export function createSimplePdfBuffer(markdown: string, title = 'Document'): Buffer {
  const lines = pdfLines(markdown);
  const pages: PdfLine[][] = [];
  const linesPerPage = 42;
  for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));
  if (pages.length === 0) pages.push([{ text: '', style: 'body' }]);

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageObjectNumbers = pages.map((_, index) => 3 + index * 2);
  objects.push(`<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`);

  pages.forEach((pageLines, pageIndex) => {
    const pageObjNum = 3 + pageIndex * 2;
    const contentObjNum = pageObjNum + 1;
    const commands: string[] = [];
    commands.push('0.06 0.09 0.16 rg 0 742 612 50 re f');
    commands.push(`1 1 1 rg BT /F2 18 Tf 48 762 Td (${escapePdfText(title)}) Tj ET`);
    commands.push('0.96 0.98 1 rg 48 724 516 1 re f');
    let y = 704;
    for (const line of pageLines) {
      if (!line.text) { y -= 10; continue; }
      if (line.style === 'heading') {
        commands.push(`0.11 0.30 0.62 rg BT /F2 12 Tf 48 ${y} Td (${escapePdfText(line.text)}) Tj ET`);
        y -= 17;
      } else if (line.style === 'subheading') {
        commands.push(`0.20 0.25 0.33 rg BT /F2 11 Tf 48 ${y} Td (${escapePdfText(line.text)}) Tj ET`);
        y -= 15;
      } else if (line.style === 'bullet') {
        commands.push(`0.09 0.12 0.18 rg BT /F1 10 Tf 58 ${y} Td (${escapePdfText(line.text)}) Tj ET`);
        y -= 14;
      } else if (line.style === 'meta') {
        commands.push(`0.20 0.25 0.33 rg BT /F2 10 Tf 48 ${y} Td (${escapePdfText(line.text)}) Tj ET`);
        y -= 14;
      } else {
        commands.push(`0.09 0.12 0.18 rg BT /F1 10 Tf 48 ${y} Td (${escapePdfText(line.text)}) Tj ET`);
        y -= 14;
      }
    }
    commands.push(`0.45 0.50 0.58 rg BT /F1 8 Tf 48 32 Td (${escapePdfText(`Page ${pageIndex + 1} of ${pages.length} • Pending Attorney Review`)}) Tj ET`);
    const text = commands.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjNum} 0 R >>`);
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
