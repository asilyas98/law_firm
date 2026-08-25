import { NextRequest, NextResponse } from 'next/server';
import { createDocxBuffer, createSimplePdfBuffer, slugify } from '@/lib/exportUtils';
import { apiError, requireFirmUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requireFirmUser(request, 'viewer');
    const body = await request.json();
    const content = String(body.content || '').trim();
    const title = String(body.title || 'Chat Answer').trim();
    const format = String(body.format || 'docx').toLowerCase();

    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });
    if (!['docx', 'pdf'].includes(format)) return NextResponse.json({ error: 'format must be docx or pdf' }, { status: 400 });

    const buffer = format === 'pdf' ? createSimplePdfBuffer(content, title) : await createDocxBuffer(content, title);
    const filename = `${slugify(title)}.${format}`;

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
