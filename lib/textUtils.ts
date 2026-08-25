export function chunkText(text: string, maxChars = 1800): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const block = paragraph.trim();
    if (!block) continue;
    if ((current + '\n\n' + block).trim().length <= maxChars) {
      current = (current + '\n\n' + block).trim();
      continue;
    }
    if (current) chunks.push(current);
    if (block.length <= maxChars) {
      current = block;
    } else {
      for (let index = 0; index < block.length; index += maxChars) {
        chunks.push(block.slice(index, index + maxChars));
      }
      current = '';
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function cleanMarkdownPreview(input: string, maxLength = 500): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
