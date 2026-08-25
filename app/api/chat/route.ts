import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { CHAT_MODEL, embedText, openai } from '@/lib/openai';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';
import { cleanMarkdownPreview } from '@/lib/textUtils';

export const runtime = 'nodejs';

type SourceMatch = {
  id: string;
  source_document_id: string;
  title: string;
  content: string;
  similarity: number;
};

type TemplateMatch = {
  id: string;
  template_id: string;
  template_key: string;
  name: string;
  content: string;
  similarity: number;
};

type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: ChatSource[] | null;
  created_at?: string;
};

type ChatSource = {
  type: 'source_document' | 'template';
  id: string;
  title: string;
  similarity: number;
};

type ChatMode = 'vault' | 'vault_web' | 'general_web';

function normalizeChatMode(input: unknown): ChatMode {
  if (input === 'vault_web' || input === 'general_web') return input;
  return 'vault';
}

type FirmInstruction = {
  title: string;
  instruction_type: string;
  priority: number;
  content: string;
};

type TemplateInventory = {
  id: string;
  name: string;
  template_key: string;
  practice_area: string;
  doc_type: string;
  jurisdiction: string;
  version: string;
  status: string;
};

type SourceInventory = {
  id: string;
  title: string;
  practice_area: string | null;
  doc_type: string | null;
  source_kind: string;
  status: string;
};

function compactTitle(message: string) {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  return cleaned.length > 70 ? `${cleaned.slice(0, 67)}...` : cleaned || 'New chat';
}

function formatHistory(messages: ChatMessage[]) {
  return messages
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'viewer');
    const body = await request.json();
    const message = String(body.message || body.question || '').trim();
    const actingUser = body.actingUser && typeof body.actingUser === 'object' ? body.actingUser as Record<string, unknown> : null;
    const matterId = body.matterId ? String(body.matterId) : null;
    const matterName = body.matterName ? String(body.matterName) : 'Unassigned Matter';
    const chatMode = normalizeChatMode(body.chatMode);
    const webEnabled = chatMode === 'vault_web' || chatMode === 'general_web';
    const retrieveVault = chatMode === 'vault' || chatMode === 'vault_web';
    let conversationId = body.conversationId ? String(body.conversationId) : null;
    const saveHistory = body.saveHistory !== false;
    const actingUserEmail = typeof actingUser?.email === 'string' && actingUser.email ? String(actingUser.email) : user.email;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let conversation: { id: string; title: string; matter_id: string | null; created_by_email?: string | null } | null = null;
    let history: ChatMessage[] = [];

    if (conversationId) {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, title, matter_id, created_by_email')
        .eq('id', conversationId)
        .eq('firm_id', user.firmId)
        .eq('created_by_email', actingUserEmail)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        conversationId = null;
        conversation = null;
        history = [];
      } else {
        conversation = data;

        const { data: messages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id, role, content, sources, created_at')
          .eq('conversation_id', conversationId)
          .eq('firm_id', user.firmId)
          .order('created_at', { ascending: true })
          .limit(30);
        if (messagesError) throw messagesError;
        history = (messages || []) as ChatMessage[];
      }
    }

    if (!conversationId && saveHistory) {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          firm_id: user.firmId,
          matter_id: matterId,
          title: compactTitle(message),
          created_by: user.userId,
          created_by_email: actingUserEmail,
        })
        .select('id, title, matter_id, created_by_email')
        .single();
      if (error) throw error;
      conversation = data;
      conversationId = data.id;
    }

    let sourceMatches: SourceMatch[] = [];
    let templateMatches: TemplateMatch[] = [];

    if (retrieveVault) {
      const queryEmbedding = await embedText(message);
      const [sourceResult, templateResult] = await Promise.all([
        supabase.rpc('match_source_document_chunks', {
          query_embedding: queryEmbedding,
          target_firm_id: user.firmId,
          match_count: 8,
        }),
        supabase.rpc('match_template_chunks', {
          query_embedding: queryEmbedding,
          target_firm_id: user.firmId,
          match_count: 6,
        }),
      ]);

      if (sourceResult.error) throw sourceResult.error;
      if (templateResult.error) throw templateResult.error;
      sourceMatches = (sourceResult.data || []) as SourceMatch[];
      templateMatches = (templateResult.data || []) as TemplateMatch[];
    }

    const [instructionsResult, templateInventoryResult, sourceInventoryResult, matterResult] = await Promise.all([
      supabase
        .from('firm_instructions')
        .select('title, instruction_type, priority, content')
        .eq('firm_id', user.firmId)
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .limit(10),
      supabase
        .from('templates')
        .select('id, name, template_key, practice_area, doc_type, jurisdiction, version, status')
        .eq('firm_id', user.firmId)
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('source_documents')
        .select('id, title, practice_area, doc_type, source_kind, status')
        .eq('firm_id', user.firmId)
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(50),
      matterId
        ? supabase
            .from('matters')
            .select('id, matter_name, matter_type, description, deadline, status, responsible_attorney, assigned_to, metadata, clients(name, contact_name, contact_email)')
            .eq('id', matterId)
            .eq('firm_id', user.firmId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (instructionsResult.error) throw instructionsResult.error;
    if (templateInventoryResult.error) throw templateInventoryResult.error;
    if (sourceInventoryResult.error) throw sourceInventoryResult.error;
    if (matterResult.error) throw matterResult.error;

    const instructions = (instructionsResult.data || []) as FirmInstruction[];
    const templateInventory = (templateInventoryResult.data || []) as TemplateInventory[];
    const sourceInventory = (sourceInventoryResult.data || []) as SourceInventory[];
    const matter = matterResult.data;

    const sources: ChatSource[] = [
      ...sourceMatches.map((match) => ({
        type: 'source_document' as const,
        id: match.source_document_id,
        title: match.title,
        similarity: match.similarity,
      })),
      ...templateMatches.map((match) => ({
        type: 'template' as const,
        id: match.template_id,
        title: match.name,
        similarity: match.similarity,
      })),
    ];

    const uniqueSources = sources.filter((source, index, array) => (
      array.findIndex((candidate) => candidate.type === source.type && candidate.id === source.id) === index
    ));

    const sourceContext = sourceMatches
      .map((match, index) => `SOURCE DOCUMENT ${index + 1}\nTitle: ${match.title}\nSimilarity: ${match.similarity}\nContent:\n${match.content}`)
      .join('\n\n---\n\n');

    const templateContext = templateMatches
      .map((match, index) => `APPROVED TEMPLATE ${index + 1}\nName: ${match.name}\nTemplate key: ${match.template_key}\nSimilarity: ${match.similarity}\nTemplate body:\n${match.content}`)
      .join('\n\n---\n\n');

    const instructionContext = instructions
      .map((item, index) => `FIRM INSTRUCTION ${index + 1}\nTitle: ${item.title}\nType: ${item.instruction_type}\nPriority: ${item.priority}\nContent:\n${item.content}`)
      .join('\n\n---\n\n');

    const inventoryContext = [
      `APPROVED TEMPLATE INVENTORY:\n${templateInventory.map((item) => `- ${item.name} (${item.template_key}, ${item.doc_type}, ${item.practice_area}, ${item.jurisdiction}, v${item.version})`).join('\n') || '- No approved templates found.'}`,
      `APPROVED SOURCE DOCUMENT INVENTORY:\n${sourceInventory.map((item) => `- ${item.title} (${item.doc_type || 'Reference'}, ${item.practice_area || 'General'}, ${item.source_kind})`).join('\n') || '- No approved source documents found.'}`,
    ].join('\n\n');

    const matterContext = matter
      ? `SELECTED MATTER:\n${JSON.stringify(matter, null, 2)}`
      : `SELECTED MATTER:\n${matterName}`;

    const effectiveUser = {
      email: actingUserEmail,
      displayName: typeof actingUser?.displayName === 'string' && actingUser.displayName ? actingUser.displayName : user.displayName,
      role: typeof actingUser?.role === 'string' && actingUser.role ? actingUser.role : user.role,
      practiceArea: typeof actingUser?.practiceArea === 'string' && actingUser.practiceArea ? actingUser.practiceArea : user.practiceArea,
      chatbotPersona: typeof actingUser?.chatbotPersona === 'string' && actingUser.chatbotPersona ? actingUser.chatbotPersona : user.chatbotPersona,
    };

    const currentUserContext = `CURRENT USER PROFILE FOR THIS CHAT:
Email: ${effectiveUser.email}
Display name: ${effectiveUser.displayName}
Role: ${effectiveUser.role}
Practice area: ${effectiveUser.practiceArea}
User-specific chatbot behavior: ${effectiveUser.chatbotPersona || 'Use the default behavior for this role.'}`;

    if (chatMode === 'vault' && !instructions.length && !sourceMatches.length && !templateMatches.length && !templateInventory.length && !sourceInventory.length) {
      const answer = 'I do not have any approved firm instructions, templates, or source documents in the vault yet. Upload firm materials, approve them, and then ask again.';
      if (conversationId) {
        await supabase.from('chat_messages').insert([
          { firm_id: user.firmId, conversation_id: conversationId, role: 'user', content: message, created_by: user.userId },
          { firm_id: user.firmId, conversation_id: conversationId, role: 'assistant', content: answer, sources: [], created_by: user.userId },
        ]);
      }
      return NextResponse.json({ answer, sources: [], conversationId, conversation, messages: [...history, { role: 'user', content: message }, { role: 'assistant', content: answer, sources: [] }] });
    }

    const modeLabel = chatMode === 'vault'
      ? 'Vault only'
      : chatMode === 'vault_web'
        ? 'Vault plus web'
        : 'General web answer';

    const groundingRules = chatMode === 'vault'
      ? `Grounding rules:
- Answer using only the provided firm instructions, approved template context, approved source-document context, selected matter data, and chat history.
- Do not rely on outside legal knowledge for firm-specific statements or legal conclusions.
- If the answer is not supported by the approved firm vault, say exactly what is missing from the vault.`
      : chatMode === 'vault_web'
        ? `Grounding rules:
- Use approved firm vault materials first for firm-specific questions, templates, client/matter facts, and internal policies.
- You may use web search for general background, current information, public legal/government information, or questions not answered by the vault.
- Clearly distinguish firm-vault information from general web information.
- Do not claim a firm template, matter, policy, client, or deadline exists unless it appears in the vault context.`
        : `Grounding rules:
- Answer general questions conversationally and use web search when the answer may depend on current public information.
- Do not claim access to firm templates, client matters, policies, or source documents unless they appear in the provided vault inventory/context.
- If the user asks for firm-specific work product, tell them to switch to Vault only or Vault plus web mode and use approved vault materials.`;

    const responseRequest = {
      model: CHAT_MODEL,
      ...(webEnabled ? { tools: [{ type: 'web_search_preview' }], tool_choice: 'auto' } : {}),
      instructions: `You are a private law-firm AI chatbot running inside a firm-controlled vault.

Mode: ${modeLabel}.

${groundingRules}

User-specific behavior:
- Adjust depth, tone, and workflow guidance based on the CURRENT USER block.
- Owners/admins may receive configuration, audit, permission, and governance guidance.
- Attorneys may receive deeper issue-spotting and drafting support.
- Paralegals should receive checklist, intake, document collection, and attorney handoff guidance.
- Intake users should receive plain-English client intake and missing-document guidance and avoid legal conclusions.
- Viewers should receive high-level summaries and should not receive sensitive drafting instructions.

Legal safety rules:
- For client-facing drafts or legal-work-product drafts, label them "Pending Attorney Review".
- Do not give final legal advice, settlement recommendations, court-filing instructions, fee quotes, or final legal conclusions. Provide general information, drafting support, and issue-spotting unless firm materials and attorney review support more.
- Be conversational and useful, like a chatbot.
- End with a short "Sources used" section. List firm source/template titles from the provided context when used. If web search was used, include the relevant public source names or links the model used when available. If no matching approved firm source was relevant, say "No matching approved firm source was found."`,
      input: `CHAT HISTORY:
${formatHistory(history) || 'No prior messages in this chat.'}

${currentUserContext}

${matterContext}

FIRM INSTRUCTIONS:
${instructionContext || 'No active firm instructions found.'}

${inventoryContext}

TOP MATCHING APPROVED TEMPLATES:
${templateContext || 'No matching approved templates found.'}

TOP MATCHING APPROVED SOURCE DOCUMENTS:
${sourceContext || 'No matching approved source documents found.'}

USER MESSAGE:
${message}`,
    };

    const response = await openai.responses.create(responseRequest as any);

    const answer = response.output_text || 'No response generated.';

    let savedMessages: ChatMessage[] = [...history, { role: 'user', content: message }, { role: 'assistant', content: answer, sources: uniqueSources }];

    if (conversationId) {
      const { error: insertError } = await supabase.from('chat_messages').insert([
        { firm_id: user.firmId, conversation_id: conversationId, role: 'user', content: message, sources: [], created_by: user.userId },
        { firm_id: user.firmId, conversation_id: conversationId, role: 'assistant', content: answer, sources: uniqueSources, created_by: user.userId },
      ]);
      if (insertError) throw insertError;

      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString(), matter_id: matterId || conversation?.matter_id || null })
        .eq('id', conversationId)
        .eq('firm_id', user.firmId);

      const { data: latestMessages, error: latestMessagesError } = await supabase
        .from('chat_messages')
        .select('id, role, content, sources, created_at')
        .eq('conversation_id', conversationId)
        .eq('firm_id', user.firmId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (latestMessagesError) throw latestMessagesError;
      savedMessages = (latestMessages || []) as ChatMessage[];
    }

    await writeAudit(supabase, user, 'chat_answer_generated', {
      matterId,
      matterName,
      prompt: message,
      outputPreview: cleanMarkdownPreview(answer),
      metadata: {
        conversation_id: conversationId,
        chat_mode: chatMode,
        acting_user: actingUser || null,
        web_enabled: webEnabled,
        source_count: sourceMatches.length,
        template_count: templateMatches.length,
        sources: uniqueSources,
      },
    });

    return NextResponse.json({
      answer,
      sources: uniqueSources,
      conversationId,
      conversation,
      messages: savedMessages,
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
