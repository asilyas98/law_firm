import OpenAI from 'openai';

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing-openai-key' });

export const CHAT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
export const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

export async function embedText(input: string): Promise<number[]> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Cannot embed empty text.');
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed.slice(0, 12000),
  });
  return response.data[0].embedding;
}
