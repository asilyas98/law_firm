# Clean GitHub/Vercel deployment steps

This package is the law-firm AI vault app with document upload support.

It supports source uploads for:

- `.txt`
- `.md`
- `.csv`
- `.pdf`
- `.docx`

Apple Pages files are not supported directly. Export Pages files to DOCX or PDF first.

## Important

Run Git commands from this exact extracted folder: the folder that contains `package.json`, `app/`, `lib/`, `supabase/`, and `types/`.

Do **not** push `node_modules`, `.next`, `.env`, or `.env.local`.

## Clean push to your existing GitHub repo

```powershell
git init
git branch -M main
git remote remove origin 2>$null
git remote add origin https://github.com/asilyas98/law_firm.git
git add -A
git commit -m "Deploy law firm AI vault with PDF DOCX uploads"
git push origin main --force
```

## Vercel settings

In Vercel, set the Root Directory to blank/default or `./`.

Make sure your GitHub repo root directly contains:

- `package.json`
- `app/`
- `lib/`
- `supabase/`
- `types/`

## Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
DEMO_MODE=true
ENABLE_DEMO_SEED=true
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
DEMO_FIRM_ID=00000000-0000-0000-0000-000000000001
DEMO_USER_ID=00000000-0000-0000-0000-000000000002
DEMO_USER_EMAIL=demo-admin@examplelawfirm.com
```

Then redeploy without build cache.
