-- Optional user-persona migration.
-- The current app no longer requires these columns because user persona data is stored in Supabase Auth metadata.
-- You may still run this if you want the columns available for reporting/backwards compatibility.

alter table public.firm_memberships add column if not exists display_name text;
alter table public.firm_memberships add column if not exists practice_area text not null default 'General';
alter table public.firm_memberships add column if not exists chatbot_persona text;

notify pgrst, 'reload schema';
