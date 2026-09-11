# Setup fix notes

This patched package fixes two setup issues:

1. `supabase/schema.sql` had a duplicated `created_at` line in `template_chunks`, which could cause the SQL setup to stop before creating chatbot tables and search functions.
2. API errors now return Supabase/OpenAI error details instead of only `Unknown error`.

For a clean local database setup, run:

```sql
-- First run supabase/reset_and_create.sql if this is only a test project and you can delete existing app data.
-- Then run supabase/schema.sql.
```

Then restart the Next.js dev server and click **Seed demo workspace**.

## Source file upload fix

This build adds server-side text extraction for Source Files uploads:

- TXT / MD / CSV / text files: decoded as UTF-8 text
- PDF: extracted with `pdf-parse`
- DOCX: extracted with `mammoth`
- PAGES and legacy DOC files: rejected with a clear message asking the user to export to DOCX, PDF, or TXT

After deploying this update to Vercel, run `npm install` locally or let Vercel install dependencies. The new dependencies are listed in `package.json` and `package-lock.json`.

Workflow:

1. Push the updated code to GitHub.
2. Vercel redeploys or you click Redeploy.
3. Open Source Files.
4. Upload a PDF/DOCX/TXT.
5. Save as `needs_review` or `approved`.
6. Click Approve if needed so the app creates embeddings and the chatbot can retrieve the file.
