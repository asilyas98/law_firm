-- Development helper: WARNING this deletes app data. Run schema.sql afterwards.
drop table if exists public.chat_messages cascade;
drop table if exists public.chat_conversations cascade;
drop table if exists public.review_events cascade;
drop table if exists public.generated_documents cascade;
drop table if exists public.source_document_chunks cascade;
drop table if exists public.source_documents cascade;
drop table if exists public.template_chunks cascade;
drop table if exists public.templates cascade;
drop table if exists public.firm_instructions cascade;
drop table if exists public.matters cascade;
drop table if exists public.clients cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.firm_memberships cascade;
drop table if exists public.profiles cascade;
drop table if exists public.firms cascade;
