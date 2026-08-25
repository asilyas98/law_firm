# User Management and Role-Based Chatbot Behavior

This build adds a **Users** tab for owners/admins.

## What it does

- Creates Supabase Auth users with email + password.
- Adds each user to `firm_memberships` with a role.
- Stores per-user chatbot behavior fields:
  - `display_name`
  - `practice_area`
  - `chatbot_persona`
- Sends the current user's role/persona to the chatbot on every request.

## Roles

Supported roles:

- `owner`
- `admin`
- `attorney`
- `paralegal`
- `intake`
- `viewer`

The chatbot adjusts style and depth by role. For example, attorneys receive deeper issue-spotting and drafting support; paralegals receive checklist and handoff support; intake users receive plain-English intake and missing-document guidance; viewers receive higher-level summaries.

## Setup

After deploying this version, run the updated `supabase/schema.sql` in Supabase so the new membership columns are present:

```sql
alter table public.firm_memberships add column if not exists display_name text;
alter table public.firm_memberships add column if not exists practice_area text not null default 'General';
alter table public.firm_memberships add column if not exists chatbot_persona text;
```

Then log in as an owner/admin, open **Users**, create users, and give them temporary passwords.

## Production note

Keep passwords out of GitHub and chat. Use Vercel environment variables for secrets, and ask users to change temporary passwords after first login.
