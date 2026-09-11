-- Optional production bootstrap helper.
-- 1. Create/invite a user in Supabase Auth.
-- 2. Copy that user's auth.users.id and email into the values below.
-- 3. Run this once to create the first firm and owner membership.

insert into public.firms (id, name, slug, allowed_email_domain)
values ('00000000-0000-0000-0000-000000000010', 'Your Law Firm', 'your-law-firm', 'yourfirm.com')
on conflict (id) do update set name = excluded.name, slug = excluded.slug, allowed_email_domain = excluded.allowed_email_domain;

insert into public.profiles (id, email, full_name)
values ('REPLACE_WITH_AUTH_USER_ID', 'owner@yourfirm.com', 'Firm Owner')
on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;

insert into public.firm_memberships (firm_id, user_id, email, role, status)
values ('00000000-0000-0000-0000-000000000010', 'REPLACE_WITH_AUTH_USER_ID', 'owner@yourfirm.com', 'owner', 'active')
on conflict (firm_id, user_id) do update set role = excluded.role, status = excluded.status, email = excluded.email;
