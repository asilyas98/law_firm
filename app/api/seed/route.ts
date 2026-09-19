import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { embedText } from '@/lib/openai';
import { sampleDocs } from '@/lib/sampleDocs';
import { sampleTemplates } from '@/lib/sampleTemplates';
import { sampleInstructions } from '@/lib/sampleInstructions';
import { chunkText } from '@/lib/textUtils';
import { apiError, requireFirmUser, writeAudit } from '@/lib/serverAuth';

export const runtime = 'nodejs';

async function indexSourceDocument(supabase: ReturnType<typeof getSupabaseAdmin>, doc: { id: string; title: string; practice_area?: string | null; doc_type?: string | null; content: string; status: string }, firmId: string) {
  if (doc.status !== 'approved') return;
  await supabase.from('source_document_chunks').delete().eq('firm_id', firmId).eq('source_document_id', doc.id);
  for (const content of chunkText(doc.content)) {
    const embedding = await embedText(`${doc.title}\n${doc.practice_area || ''}\n${doc.doc_type || ''}\n${content}`);
    const { error: chunkError } = await supabase.from('source_document_chunks').insert({
      firm_id: firmId,
      source_document_id: doc.id,
      title: doc.title,
      content,
      embedding,
    });
    if (chunkError) throw chunkError;
  }
}

async function indexTemplate(supabase: ReturnType<typeof getSupabaseAdmin>, template: { id: string; firm_id: string; template_key: string; name: string; practice_area: string; doc_type: string; body_markdown: string; status: string }) {
  if (template.status !== 'approved') return;
  await supabase.from('template_chunks').delete().eq('firm_id', template.firm_id).eq('template_id', template.id);
  const embedding = await embedText(`${template.name}\n${template.practice_area}\n${template.doc_type}\n${template.body_markdown}`);
  const { error: chunkError } = await supabase.from('template_chunks').insert({
    firm_id: template.firm_id,
    template_id: template.id,
    template_key: template.template_key,
    name: template.name,
    content: template.body_markdown,
    embedding,
  });
  if (chunkError) throw chunkError;
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.ENABLE_DEMO_SEED !== 'true') {
      return NextResponse.json({ error: 'Demo seeding is disabled. Set ENABLE_DEMO_SEED=true for local/dev use.' }, { status: 403 });
    }

    const user = await requireFirmUser(request, 'admin');
    const supabase = getSupabaseAdmin();

    await supabase.from('firms').upsert({
      id: user.firmId,
      name: 'Example Law Firm',
      slug: 'example-law-firm',
      allowed_email_domain: 'examplelawfirm.com',
    }, { onConflict: 'id' });

    await supabase.from('profiles').upsert({
      id: user.userId,
      email: user.email,
      full_name: user.displayName || 'Demo Admin',
    }, { onConflict: 'id' });

    await supabase.from('firm_memberships').upsert({
      firm_id: user.firmId,
      user_id: user.userId,
      email: user.email,
      role: user.role,
      status: 'active',
    }, { onConflict: 'firm_id,user_id' });

    let instructionCount = 0;
    for (const instruction of sampleInstructions) {
      const { data: existingInstruction, error: lookupError } = await supabase
        .from('firm_instructions')
        .select('id')
        .eq('firm_id', user.firmId)
        .eq('title', instruction.title)
        .maybeSingle();
      if (lookupError) throw lookupError;
      const payload = {
        firm_id: user.firmId,
        ...instruction,
        created_by: user.userId,
      };
      const result = existingInstruction?.id
        ? await supabase.from('firm_instructions').update(payload).eq('id', existingInstruction.id)
        : await supabase.from('firm_instructions').insert(payload);
      if (result.error) throw result.error;
      instructionCount += 1;
    }

    let documentCount = 0;
    for (const doc of sampleDocs) {
      const { data: existingDoc, error: lookupError } = await supabase
        .from('source_documents')
        .select('id')
        .eq('firm_id', user.firmId)
        .eq('title', doc.title)
        .maybeSingle();
      if (lookupError) throw lookupError;
      const payload = {
        firm_id: user.firmId,
        title: doc.title,
        practice_area: doc.practice_area,
        doc_type: doc.doc_type,
        source_kind: doc.doc_type.toLowerCase().includes('policy') ? 'policy' : 'sample',
        status: doc.status,
        content: doc.content,
        uploaded_by: user.userId,
      };
      const { data: savedDoc, error: docError } = existingDoc?.id
        ? await supabase.from('source_documents').update(payload).eq('id', existingDoc.id).select('id, title, practice_area, doc_type, status, content').single()
        : await supabase.from('source_documents').insert(payload).select('id, title, practice_area, doc_type, status, content').single();
      if (docError) throw docError;
      await indexSourceDocument(supabase, savedDoc, user.firmId);
      documentCount += 1;
    }

    let templateCount = 0;
    for (const template of sampleTemplates) {
      const { data: savedTemplate, error: templateError } = await supabase.from('templates').upsert({
        firm_id: user.firmId,
        ...template,
        review_required: true,
        created_by: user.userId,
      }, { onConflict: 'firm_id,template_key' }).select('id, firm_id, template_key, name, practice_area, doc_type, status, body_markdown').single();
      if (templateError) throw templateError;
      await indexTemplate(supabase, savedTemplate);
      templateCount += 1;
    }

    const { data: existingClient, error: existingClientError } = await supabase
      .from('clients')
      .select('*')
      .eq('firm_id', user.firmId)
      .eq('name', 'Northstar Operations LLC')
      .maybeSingle();
    if (existingClientError) throw existingClientError;

    const { data: client, error: clientError } = existingClient?.id
      ? await supabase.from('clients').update({
          contact_name: 'Jordan Smith',
          contact_email: 'jordan@northstar.example',
        }).eq('id', existingClient.id).select('*').single()
      : await supabase.from('clients').insert({
          firm_id: user.firmId,
          name: 'Northstar Operations LLC',
          contact_name: 'Jordan Smith',
          contact_email: 'jordan@northstar.example',
        }).select('*').single();
    if (clientError) throw clientError;

    const { data: existingMatter, error: existingMatterError } = await supabase
      .from('matters')
      .select('id')
      .eq('firm_id', user.firmId)
      .eq('matter_name', 'Apex Vendor Agreement Review')
      .maybeSingle();
    if (existingMatterError) throw existingMatterError;

    const matterPayload = {
      firm_id: user.firmId,
      client_id: client.id,
      matter_name: 'Apex Vendor Agreement Review',
      matter_type: 'Business contract review',
      description: 'Review of the Apex Vendor Services agreement before signature.',
      deadline: 'May 17, 2026',
      status: 'intake',
      responsible_attorney: 'Demo Supervising Attorney',
      assigned_to: user.email,
      metadata: { client_goals: 'Identify business and legal risk before signature and request negotiable revisions if needed.' },
      created_by: user.userId,
    };
    const matterResult = existingMatter?.id
      ? await supabase.from('matters').update(matterPayload).eq('id', existingMatter.id)
      : await supabase.from('matters').insert(matterPayload);
    if (matterResult.error) throw matterResult.error;

    await writeAudit(supabase, user, 'seed_private_law_firm_workspace', {
      matterName: 'Demo Setup',
      outputPreview: `Seeded/updated demo records without deleting uploaded firm documents. Demo records: ${documentCount} source documents, ${templateCount} templates, ${instructionCount} firm instructions, and one demo matter.`,
      metadata: { document_count: documentCount, template_count: templateCount, instruction_count: instructionCount, preserves_uploaded_documents: true },
    });

    return NextResponse.json({
      ok: true,
      documentCount,
      templateCount,
      instructionCount,
      preservedUploads: true,
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
