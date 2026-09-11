import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';

export const runtime = 'nodejs';

function titleFromInput(input: unknown) {
  const value = String(input || 'New chat').replace(/\s+/g, ' ').trim();
  return value.length > 80 ? `${value.slice(0, 77)}...` : value || 'New chat';
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const supabase = getSupabaseAdmin();
    const id = request.nextUrl.searchParams.get('id');

    if (id) {
      const { data: conversation, error: conversationError } = await supabase
        .from('chat_conversations')
        .select('id, title, matter_id, status, created_by_email, created_at, updated_at')
        .eq('firm_id', user.firmId)
        .eq('id', id)
        .single();
      if (conversationError) throw conversationError;

      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('id, role, content, sources, created_at')
        .eq('firm_id', user.firmId)
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (messagesError) throw messagesError;

      return NextResponse.json({ conversation, messages: messages || [] });
    }

    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, title, matter_id, status, created_by_email, created_at, updated_at')
      .eq('firm_id', user.firmId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(40);
    if (error) throw error;

    return NextResponse.json({ conversations: data || [] });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        firm_id: user.firmId,
        matter_id: body.matterId || null,
        title: titleFromInput(body.title),
        created_by: user.userId,
        created_by_email: user.email,
      })
      .select('id, title, matter_id, status, created_by_email, created_at, updated_at')
      .single();
    if (error) throw error;

    await writeAudit(supabase, user, 'chat_conversation_created', { metadata: { conversation_id: data.id, title: data.title } });
    return NextResponse.json({ conversation: data, messages: [] });
  } catch (error: unknown) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = titleFromInput(body.title);
    if (body.status && ['active', 'archived'].includes(body.status)) updates.status = body.status;
    if (body.matterId !== undefined) updates.matter_id = body.matterId || null;

    const { data, error } = await supabase
      .from('chat_conversations')
      .update(updates)
      .eq('firm_id', user.firmId)
      .eq('id', id)
      .select('id, title, matter_id, status, created_by_email, created_at, updated_at')
      .single();
    if (error) throw error;

    await writeAudit(supabase, user, 'chat_conversation_updated', { metadata: { conversation_id: data.id, updates } });
    return NextResponse.json({ conversation: data });
  } catch (error: unknown) {
    return apiError(error);
  }
}
