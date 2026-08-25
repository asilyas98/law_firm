export type TemplateLike = {
  template_key: string;
  name: string;
  body_markdown: string;
  required_fields?: unknown;
};

const TEMPLATE_KEYWORDS: Array<{ key: string; words: string[] }> = [
  { key: 'client_welcome_email', words: ['welcome', 'client email', 'new client', 'intro email', 'intake email', 'greeting'] },
  { key: 'missing_documents_request', words: ['missing document', 'documents request', 'request documents', 'upload documents', 'doc request'] },
  { key: 'business_contract_review_checklist', words: ['contract review', 'vendor agreement', 'saas', 'purchase order', 'commercial lease', 'checklist'] },
  { key: 'paralegal_task_list', words: ['paralegal', 'task list', 'tasks', 'to do', 'todo', 'workplan'] },
  { key: 'attorney_review_policy_summary', words: ['attorney review', 'policy', 'legal advice', 'demand letter', 'settlement', 'court filing', 'redline'] },
];

export function inferTemplateKey(command: string): string | null {
  const lower = command.toLowerCase();
  let best: { key: string; score: number } | null = null;
  for (const candidate of TEMPLATE_KEYWORDS) {
    const score = candidate.words.reduce((count, word) => count + (lower.includes(word) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { key: candidate.key, score };
  }
  return best?.key ?? null;
}

export function normalizeFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') return item.name;
      return '';
    })
    .filter(Boolean);
}

export function humanizeField(field: string): string {
  return field.replace(/_/g, ' ').replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.map((item) => `- ${String(item)}`).join('\n') : '';
  if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2);
  return String(value ?? '');
}

export function getMissingRequiredFields(template: TemplateLike, inputData: Record<string, unknown>): string[] {
  return normalizeFields(template.required_fields).filter((field) => !hasValue(inputData[field]));
}

export function renderTemplate(template: TemplateLike, inputData: Record<string, unknown>): string {
  return template.body_markdown.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, field: string) => {
    if (hasValue(inputData[field])) return formatValue(inputData[field]);
    return `[${humanizeField(field)}]`;
  });
}

export function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function buildSourceList(template: TemplateLike, extraTitles: string[] = []): string[] {
  return Array.from(new Set([template.name, ...extraTitles].filter(Boolean)));
}
