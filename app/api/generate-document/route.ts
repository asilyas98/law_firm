import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { CHAT_MODEL, embedText, openai } from '@/lib/openai';
import { buildSourceList, getMissingRequiredFields, inferTemplateKey, renderTemplate, safeRecord } from '@/lib/templateEngine';
import { buildMatterInputData } from '@/lib/clientMatter';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';
import { cleanMarkdownPreview } from '@/lib/textUtils';

export const runtime = 'nodejs';

type TemplateRow = {
  id: string;
  firm_id: string;
  template_key: string;
  name: string;
  practice_area: string;
  doc_type: string;
  jurisdiction: string;
  status: string;
  version: string;
  body_markdown: string;
  required_fields: unknown;
  optional_fields: unknown;
  review_required: boolean;
};

type TemplateMatch = {
  template_id: string;
  template_key: string;
  name: string;
  content: string;
  similarity: number;
};

type SourceMatch = {
  source_document_id: string;
  title: string;
  content: string;
  similarity: number;
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirmUser(request, 'intake');
    const { command, matterName, matterId, templateKey, inputData } = await request.json();
    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'command is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let matter: Record<string, unknown> | null = null;
    if (matterId) {
      const { data: matterData, error: matterError } = await supabase
        .from('matters')
        .select('id, matter_name, matter_type, description, deadline, status, responsible_attorney, assigned_to, metadata, clients(id, name, contact_name, contact_email)')
        .eq('id', matterId)
        .eq('firm_id', user.firmId)
        .maybeSingle();
      if (matterError) throw matterError;
      matter = matterData as Record<string, unknown> | null;
    }

    const data = {
      ...buildMatterInputData(matter),
      ...safeRecord(inputData),
    };

    const resolvedMatterName = String(matter?.matter_name || matterName || data.matter_name || 'Unassigned Matter');

    const { data: approvedTemplates, error: templatesError } = await supabase
      .from('templates')
      .select('id, firm_id, template_key, name, practice_area, doc_type, jurisdiction, status, version, body_markdown, required_fields, optional_fields, review_required')
      .eq('firm_id', user.firmId)
      .eq('status', 'approved')
      .order('name', { ascending: true });
    if (templatesError) throw templatesError;
    if (!approvedTemplates || approvedTemplates.length === 0) {
      return NextResponse.json({ error: 'No approved templates found. Seed the vault or add and approve a template first.' }, { status: 400 });
    }

    const searchText = `${command}\n${resolvedMatterName}\n${JSON.stringify(data)}`;
    const queryEmbedding = await embedText(searchText);

    const { data: templateMatchesRaw, error: templateMatchError } = await supabase.rpc('match_template_chunks', {
      query_embedding: queryEmbedding,
      target_firm_id: user.firmId,
      match_count: 4,
    });
    if (templateMatchError) throw templateMatchError;

    const { data: sourceMatchesRaw, error: sourceMatchError } = await supabase.rpc('match_source_document_chunks', {
      query_embedding: queryEmbedding,
      target_firm_id: user.firmId,
      match_count: 6,
    });
    if (sourceMatchError) throw sourceMatchError;

    const vectorTemplateMatches = (templateMatchesRaw ?? []) as TemplateMatch[];
    const sourceMatches = (sourceMatchesRaw ?? []) as SourceMatch[];

    let selectedKey = templateKey && templateKey !== 'auto' ? String(templateKey) : inferTemplateKey(command);
    if (!selectedKey) selectedKey = vectorTemplateMatches[0]?.template_key || null;

    const templates = approvedTemplates as TemplateRow[];
    const template = templates.find((item) => item.template_key === selectedKey) || templates[0];
    const renderedTemplate = renderTemplate(template, data);
    const missingFields = getMissingRequiredFields(template, data);

    const { data: instructions, error: instructionsError } = await supabase
      .from('firm_instructions')
      .select('title, instruction_type, priority, content')
      .eq('firm_id', user.firmId)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .limit(12);
    if (instructionsError) throw instructionsError;

    const instructionContext = (instructions || [])
      .map((item: { title: string; instruction_type: string; priority: number; content: string }, index: number) => `FIRM INSTRUCTION ${index + 1}: ${item.title} (${item.instruction_type}, priority ${item.priority})\n${item.content}`)
      .join('\n\n');

    const selectedAndRelatedTemplates = [
      `SELECTED TEMPLATE: ${template.name} (${template.template_key}, version ${template.version})\n${template.body_markdown}`,
      ...vectorTemplateMatches
        .filter((match) => match.template_key !== template.template_key)
        .map((match, index) => `RELATED TEMPLATE SOURCE ${index + 1}: ${match.name}\n${match.content}`),
    ].join('\n\n---\n\n');

    const sourceContext = sourceMatches
      .map((match, index) => `APPROVED SOURCE DOCUMENT ${index + 1}: ${match.title}\n${match.content}`)
      .join('\n\n---\n\n');

    const response = await openai.responses.create({
      model: CHAT_MODEL,
      instructions: `You are a controlled private law-firm document assembly assistant.\n\nMandatory rules:\n- Use the selected approved template as the controlling structure.\n- Use firm instructions and approved source documents only.\n- Preserve attorney-review, conflict-check, confidentiality, and secure-upload language when relevant.\n- Do not provide final legal advice, fee quotes, guarantees, legal conclusions, settlement authority, or filing-ready work product.\n- If information is missing, keep bracketed placeholders instead of inventing facts.\n- Client-facing or legal-work-product drafts must remain labeled Pending Attorney Review unless the system says an attorney approved them.\n- Produce one complete Markdown draft.\n- End with a short section titled "Template sources used" listing the selected template name/version and relevant source titles.`,
      input: `Firm user: ${user.email} (${user.role})\nMatter name: ${resolvedMatterName}\n\nUser command:\n${command}\n\nStructured matter/client data:\n${JSON.stringify(data, null, 2)}\n\nMissing required fields:\n${missingFields.length ? missingFields.join(', ') : 'None'}\n\nRendered template skeleton:\n${renderedTemplate}\n\nActive firm instructions:\n${instructionContext || 'No active firm instructions found.'}\n\nApproved template context:\n${selectedAndRelatedTemplates}\n\nApproved source-document context:\n${sourceContext || 'No matching source documents found.'}`,
    });

    const output = response.output_text || renderedTemplate;
    const { data: generated, error: insertError } = await supabase
      .from('generated_documents')
      .insert({
        firm_id: user.firmId,
        matter_id: matterId || null,
        matter_name: resolvedMatterName,
        template_id: template.id,
        template_version: template.version,
        draft_type: template.doc_type,
        prompt: command,
        input_data: data,
        output_markdown: output,
        status: 'pending_attorney_review',
        created_by: user.userId,
        created_by_email: user.email,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    await supabase.from('review_events').insert({
      firm_id: user.firmId,
      generated_document_id: generated.id,
      event_type: 'created',
      actor_id: user.userId,
      actor_email: user.email,
      notes: 'Generated by controlled document assembly workflow.',
    });

    const sourceTitles = buildSourceList(template, [
      ...vectorTemplateMatches.filter((match) => match.template_key !== template.template_key).map((match) => match.name),
      ...sourceMatches.map((match) => match.title),
    ]);

    await writeAudit(supabase, user, 'controlled_document_generated', {
      matterId: matterId || null,
      matterName: resolvedMatterName,
      prompt: command,
      outputPreview: cleanMarkdownPreview(output),
      metadata: {
        generated_document_id: generated.id,
        template_id: template.id,
        template_key: template.template_key,
        template_version: template.version,
        missing_fields: missingFields,
        source_titles: sourceTitles,
      },
    });

    return NextResponse.json({
      generatedDocument: generated,
      output,
      template: { id: template.id, template_key: template.template_key, name: template.name, version: template.version, doc_type: template.doc_type },
      missingFields,
      sourceTitles,
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
