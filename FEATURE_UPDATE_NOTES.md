# Feature update: simplified UI, chat exports, and document filler

This build keeps the law-firm AI chatbot and document upload workflow, while simplifying the visible UI.

## Visible tabs

- Chat
- Generate Docs
- Document Filler
- Matters
- Source Files
- Users
- Audit

The Template Vault, Firm Instructions, and Review Queue tabs are no longer visible in the main navigation. Their underlying API/database support remains in place because the chatbot and generator still use approved templates/instructions behind the scenes.

## Chat answer exports

Each assistant answer now includes:

- Send as DOCX
- Send as PDF

These call `/api/export-answer` and download the answer as a Word document or simple PDF.

## Document Filler

The new Document Filler tab supports uploads of:

- `.pdf`
- `.docx`
- `.txt`
- `.md`
- `.csv`

Workflow:

1. Upload a document.
2. Click **Analyze document**.
3. The app extracts likely questions/fields.
4. The user answers each unique question.
5. Repeated questions reuse the earlier answer.
6. Export a filled DOCX or PDF packet.

Important: the filled output is marked **Pending Attorney Review**. It should be reviewed against the original before filing, signing, or sending.

## New API routes

- `POST /api/export-answer`
- `POST /api/document-filler/analyze`
- `POST /api/document-filler/complete`

## Push reminder

Push the contents of this folder itself to GitHub. Your GitHub repo root should show `app`, `lib`, `supabase`, `types`, and `package.json` directly.
