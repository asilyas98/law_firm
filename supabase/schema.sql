-- Law Firm AI Private Vault schema
-- Run this in the Supabase SQL Editor.
-- This schema is designed for a private, firm-only app with template vault, source document ingestion,
-- matter records, firm instructions, generated drafts, attorney review, audit logging, and pgvector search.

create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- Core firm and access-control tables
-- -----------------------------------------------------------------------------

create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  allowed_email_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.firm_memberships (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null,
  email text not null,
  display_name text,
  practice_area text not null default 'General',
  chatbot_persona text,
  role text not null check (role in ('owner', 'admin', 'attorney', 'paralegal', 'intake', 'viewer')),
  status text not null default 'active' check (status in ('active', 'pending', 'disabled')),
  created_at timestamptz not null default now(),
  unique(firm_id, user_id)
);

-- Rerun-safe additions for user-specific chatbot behavior.
alter table public.firm_memberships add column if not exists display_name text;
alter table public.firm_memberships add column if not exists practice_area text not null default 'General';
alter table public.firm_memberships add column if not exists chatbot_persona text;

-- -----------------------------------------------------------------------------
-- Client and matter tables
-- -----------------------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  name text not null,
  contact_name text,
  contact_email text,
  phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  matter_name text not null,
  matter_type text not null default 'General',
  description text,
  deadline text,
  status text not null default 'intake' check (status in ('intake', 'open', 'waiting_on_client', 'attorney_review', 'closed', 'archived')),
  responsible_attorney text,
  assigned_to text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Firm instructions and controlled template vault
-- -----------------------------------------------------------------------------

create table if not exists public.firm_instructions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  title text not null,
  instruction_type text not null check (instruction_type in ('generation_rule', 'review_rule', 'tone_rule', 'security_rule')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  priority int not null default 50,
  content text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  template_key text not null,
  name text not null,
  practice_area text not null default 'General',
  doc_type text not null,
  jurisdiction text not null default 'General',
  status text not null default 'draft' check (status in ('draft', 'approved', 'needs_review', 'do_not_use')),
  version text not null default '1.0.0',
  body_markdown text not null,
  required_fields jsonb not null default '[]'::jsonb,
  optional_fields jsonb not null default '[]'::jsonb,
  review_required boolean not null default true,
  approved_by text,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(firm_id, template_key)
);

create table if not exists public.template_chunks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  template_key text not null,
  name text not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists template_chunks_embedding_idx
on public.template_chunks
using hnsw (embedding extensions.vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- Source document vault. These are reference files, policies, checklists, sample docs, etc.
-- -----------------------------------------------------------------------------

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  title text not null,
  practice_area text,
  doc_type text,
  source_kind text not null default 'uploaded_text' check (source_kind in ('uploaded_text', 'template_reference', 'policy', 'sample', 'other')),
  status text not null default 'needs_review' check (status in ('approved', 'needs_review', 'do_not_use')),
  content text not null,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_document_chunks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  title text not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists source_document_chunks_embedding_idx
on public.source_document_chunks
using hnsw (embedding extensions.vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- Generated work product and review lifecycle
-- -----------------------------------------------------------------------------

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  matter_name text not null default 'Unassigned Matter',
  template_id uuid references public.templates(id),
  template_version text not null,
  draft_type text not null,
  prompt text not null,
  input_data jsonb not null default '{}'::jsonb,
  output_markdown text not null,
  output_docx_path text,
  status text not null default 'pending_attorney_review' check (status in ('pending_attorney_review', 'attorney_approved', 'sent_to_client', 'archived')),
  created_by uuid,
  created_by_email text,
  reviewed_by uuid,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  generated_document_id uuid not null references public.generated_documents(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'submitted_for_review', 'approved', 'sent_to_client', 'archived', 'reopened', 'note')),
  actor_id uuid,
  actor_email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  actor_id uuid,
  actor_email text,
  action text not null,
  matter_id uuid,
  matter_name text,
  prompt text,
  output_preview text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- Chatbot conversations. This is the chat-first interface over approved firm data.
-- -----------------------------------------------------------------------------

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  title text not null default 'New chat',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_firm_updated_idx
on public.chat_conversations (firm_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_idx
on public.chat_messages (conversation_id, created_at asc);

-- -----------------------------------------------------------------------------
-- Updated-at trigger
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists firms_set_updated_at on public.firms;
create trigger firms_set_updated_at before update on public.firms for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();

drop trigger if exists matters_set_updated_at on public.matters;
create trigger matters_set_updated_at before update on public.matters for each row execute function public.set_updated_at();

drop trigger if exists firm_instructions_set_updated_at on public.firm_instructions;
create trigger firm_instructions_set_updated_at before update on public.firm_instructions for each row execute function public.set_updated_at();

drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at before update on public.templates for each row execute function public.set_updated_at();

drop trigger if exists source_documents_set_updated_at on public.source_documents;
create trigger source_documents_set_updated_at before update on public.source_documents for each row execute function public.set_updated_at();

drop trigger if exists generated_documents_set_updated_at on public.generated_documents;
create trigger generated_documents_set_updated_at before update on public.generated_documents for each row execute function public.set_updated_at();


drop trigger if exists chat_conversations_set_updated_at on public.chat_conversations;
create trigger chat_conversations_set_updated_at before update on public.chat_conversations for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Vector search functions scoped to a firm
-- -----------------------------------------------------------------------------

create or replace function public.match_source_document_chunks(
  query_embedding extensions.vector(1536),
  target_firm_id uuid,
  match_count int default 5
)
returns table (id uuid, source_document_id uuid, title text, content text, similarity float)
language sql
stable
as $$
  select sdc.id, sdc.source_document_id, sdc.title, sdc.content, 1 - (sdc.embedding <=> query_embedding) as similarity
  from public.source_document_chunks sdc
  join public.source_documents sd on sd.id = sdc.source_document_id
  where sdc.firm_id = target_firm_id and sd.status = 'approved'
  order by sdc.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_template_chunks(
  query_embedding extensions.vector(1536),
  target_firm_id uuid,
  match_count int default 5
)
returns table (id uuid, template_id uuid, template_key text, name text, content text, similarity float)
language sql
stable
as $$
  select tc.id, tc.template_id, tc.template_key, tc.name, tc.content, 1 - (tc.embedding <=> query_embedding) as similarity
  from public.template_chunks tc
  join public.templates t on t.id = tc.template_id
  where tc.firm_id = target_firm_id and t.status = 'approved'
  order by tc.embedding <=> query_embedding
  limit match_count;
$$;

-- -----------------------------------------------------------------------------
-- RLS helper and policies. Server routes use the service role key, but these policies
-- protect direct browser/client access if you choose to query Supabase from the client.
-- -----------------------------------------------------------------------------

create or replace function public.current_role_for_firm(target_firm_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select fm.role
  from public.firm_memberships fm
  where fm.firm_id = target_firm_id
    and fm.user_id = auth.uid()
    and fm.status = 'active'
  limit 1;
$$;

create or replace function public.role_at_least(role text, minimum text)
returns boolean
language sql
immutable
as $$
  select case role
    when 'owner' then 5
    when 'admin' then 4
    when 'attorney' then 3
    when 'paralegal' then 2
    when 'intake' then 1
    else 0
  end >= case minimum
    when 'owner' then 5
    when 'admin' then 4
    when 'attorney' then 3
    when 'paralegal' then 2
    when 'intake' then 1
    else 0
  end;
$$;

alter table public.firms enable row level security;
alter table public.profiles enable row level security;
alter table public.firm_memberships enable row level security;
alter table public.clients enable row level security;
alter table public.matters enable row level security;
alter table public.firm_instructions enable row level security;
alter table public.templates enable row level security;
alter table public.template_chunks enable row level security;
alter table public.source_documents enable row level security;
alter table public.source_document_chunks enable row level security;
alter table public.generated_documents enable row level security;
alter table public.review_events enable row level security;
alter table public.audit_logs enable row level security;

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

-- Drop/recreate policies so rerunning this file is safe enough for development.
drop policy if exists firms_member_select on public.firms;
create policy firms_member_select on public.firms for select using (public.current_role_for_firm(id) is not null);

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id = auth.uid());

drop policy if exists memberships_member_select on public.firm_memberships;
create policy memberships_member_select on public.firm_memberships for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists clients_member_select on public.clients;
create policy clients_member_select on public.clients for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists clients_staff_insert on public.clients;
create policy clients_staff_insert on public.clients for insert with check (public.role_at_least(public.current_role_for_firm(firm_id), 'intake'));

drop policy if exists clients_staff_update on public.clients;
create policy clients_staff_update on public.clients for update using (public.role_at_least(public.current_role_for_firm(firm_id), 'paralegal'));

drop policy if exists matters_member_select on public.matters;
create policy matters_member_select on public.matters for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists matters_staff_insert on public.matters;
create policy matters_staff_insert on public.matters for insert with check (public.role_at_least(public.current_role_for_firm(firm_id), 'intake'));

drop policy if exists matters_staff_update on public.matters;
create policy matters_staff_update on public.matters for update using (public.role_at_least(public.current_role_for_firm(firm_id), 'paralegal'));

drop policy if exists instructions_member_select on public.firm_instructions;
create policy instructions_member_select on public.firm_instructions for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists instructions_admin_write on public.firm_instructions;
create policy instructions_admin_write on public.firm_instructions for all using (public.role_at_least(public.current_role_for_firm(firm_id), 'admin')) with check (public.role_at_least(public.current_role_for_firm(firm_id), 'admin'));

drop policy if exists templates_member_select on public.templates;
create policy templates_member_select on public.templates for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists templates_attorney_write on public.templates;
create policy templates_attorney_write on public.templates for all using (public.role_at_least(public.current_role_for_firm(firm_id), 'attorney')) with check (public.role_at_least(public.current_role_for_firm(firm_id), 'attorney'));

drop policy if exists template_chunks_member_select on public.template_chunks;
create policy template_chunks_member_select on public.template_chunks for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists source_docs_member_select on public.source_documents;
create policy source_docs_member_select on public.source_documents for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists source_docs_staff_write on public.source_documents;
create policy source_docs_staff_write on public.source_documents for all using (public.role_at_least(public.current_role_for_firm(firm_id), 'paralegal')) with check (public.role_at_least(public.current_role_for_firm(firm_id), 'paralegal'));

drop policy if exists source_chunks_member_select on public.source_document_chunks;
create policy source_chunks_member_select on public.source_document_chunks for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists generated_docs_member_select on public.generated_documents;
create policy generated_docs_member_select on public.generated_documents for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists generated_docs_staff_insert on public.generated_documents;
create policy generated_docs_staff_insert on public.generated_documents for insert with check (public.role_at_least(public.current_role_for_firm(firm_id), 'intake'));

drop policy if exists generated_docs_attorney_update on public.generated_documents;
create policy generated_docs_attorney_update on public.generated_documents for update using (public.role_at_least(public.current_role_for_firm(firm_id), 'attorney'));

drop policy if exists review_events_member_select on public.review_events;
create policy review_events_member_select on public.review_events for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists audit_attorney_select on public.audit_logs;
create policy audit_attorney_select on public.audit_logs for select using (public.role_at_least(public.current_role_for_firm(firm_id), 'attorney'));


drop policy if exists chat_conversations_member_select on public.chat_conversations;
create policy chat_conversations_member_select on public.chat_conversations for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists chat_conversations_member_insert on public.chat_conversations;
create policy chat_conversations_member_insert on public.chat_conversations for insert with check (public.current_role_for_firm(firm_id) is not null);

drop policy if exists chat_conversations_member_update on public.chat_conversations;
create policy chat_conversations_member_update on public.chat_conversations for update using (public.current_role_for_firm(firm_id) is not null) with check (public.current_role_for_firm(firm_id) is not null);

drop policy if exists chat_messages_member_select on public.chat_messages;
create policy chat_messages_member_select on public.chat_messages for select using (public.current_role_for_firm(firm_id) is not null);

drop policy if exists chat_messages_member_insert on public.chat_messages;
create policy chat_messages_member_insert on public.chat_messages for insert with check (public.current_role_for_firm(firm_id) is not null);
