# Law Firm AI Private Vault

A private law-firm software starter with a chatbot-style interface over firm-owned templates, source files, matter facts, and firm instructions.

This is not a model-memory system. The database is the firm memory. The app stores the firm's templates, policies, checklists, source files, matters, generated drafts, review events, and audit logs. The AI retrieves relevant approved materials at chat or document-generation time and responds from those sources.

## What is included

- Supabase Auth-compatible private app shell
- Local demo mode for development
- Firm/user/role schema
- Template vault with status, version, required fields, approval metadata, and pgvector search
- Source document vault with text ingestion and chunk embeddings
- Firm instructions layer for generation rules, review rules, tone rules, and security rules
- Client and matter records
- Chat-first interface with saved conversations
- Source-grounded chat endpoint over approved templates, source files, firm instructions, and matter context
- Controlled document-generation endpoint
- Generated document review lifecycle
- DOCX export
- Audit logs
- Row Level Security policy examples

## Core workflow

```text
Firm user signs in
  -> uploads or approves templates/source files
  -> defines firm instructions
  -> creates client + matter
  -> asks questions in the chatbot or commands the system to draft
  -> AI retrieves approved firm materials
  -> chatbot responds with sources or saved draft is created as pending_attorney_review
  -> attorney reviews/approves/sends/archives
  -> audit log records the chain
```

## Quick start

```bash
unzip lawfirm-ai-private-vault.zip
cd lawfirm-ai-demo-mvp
cp .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Supabase setup

1. Create a Supabase project.
2. Enable the `vector` extension if it is not already available.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Copy your project URL, anon key, and service role key into `.env.local`.
5. Add your OpenAI API key to `.env.local`.
6. For local development, keep:

```text
DEMO_MODE=true
ENABLE_DEMO_SEED=true
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
```

7. Start the app and click **Seed demo workspace**.

## Production settings

For production, change these values:

```text
DEMO_MODE=false
ENABLE_DEMO_SEED=false
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
```

Then invite actual firm users through Supabase Auth and create rows in `firm_memberships` for each authorized user. A starter SQL helper is included at `supabase/bootstrap_admin.sql`; replace the placeholder user ID with the real Supabase Auth user ID before running it.

Example roles:

```text
owner
admin
attorney
paralegal
intake
viewer
```

The API routes enforce minimum roles server-side. The SQL file also includes RLS policies for direct Supabase access.

## Environment variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
DEMO_MODE=false
ENABLE_DEMO_SEED=false
DEMO_FIRM_ID=
DEMO_USER_ID=
DEMO_USER_EMAIL=
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
```

The service role key is used only in server-side route handlers. Never expose it in client code.

## Main pages in the app

- **Chat**: ask questions and give drafting commands against approved firm templates, source files, instructions, and matter data. Conversations are saved.
- **Generate Docs**: create a saved draft from approved templates, matter data, firm instructions, and approved source files.
- **Matters**: create clients and matters.
- **Template Vault**: add, approve, disable, and index templates.
- **Source Files**: paste/upload text material and approve it for retrieval.
- **Firm Instructions**: define rules the AI must follow.
- **Review Queue**: approve, mark sent, archive, and export generated drafts.
- **Audit**: review recent system activity.


## How the chatbot works

The **Chat** tab is the primary user experience. A firm user can ask questions like:

```text
What intake checklist should staff use for a new vendor agreement review?
Draft a missing-documents request for the selected matter.
What does our attorney-review policy require before sending a client-facing draft?
Which approved templates do we currently have for business contract review?
```

For every message, the backend:

```text
1. Authenticates the user and firm membership.
2. Embeds the user message.
3. Retrieves matching approved source-document chunks.
4. Retrieves matching approved template chunks.
5. Adds active firm instructions and selected matter data.
6. Sends only that controlled context to OpenAI.
7. Saves the user/assistant messages and source metadata.
8. Logs the action in audit_logs.
```

The chatbot should say what is missing if the approved vault does not contain enough information to answer. It should not treat the model as the database.

## Important MVP limitation

The upload UI reads text-like files in the browser using `file.text()`. For production-grade PDF/DOCX ingestion, add a server-side extraction pipeline such as:

```text
DOCX -> mammoth or LibreOffice conversion
PDF -> trusted PDF parser or OCR fallback
Scanned PDFs -> OCR with attorney/admin review before approval
DMS files -> connector sync with metadata and permissions
```

The app already has the ingestion table, chunking, approval, and embedding flow. The extraction step can be swapped in later.

## Database tables

```text
firms
profiles
firm_memberships
clients
matters
firm_instructions
templates
template_chunks
source_documents
source_document_chunks
generated_documents
review_events
audit_logs
chat_conversations
chat_messages
```

## API routes

```text
GET    /api/me
POST   /api/seed
GET    /api/templates
POST   /api/templates
PATCH  /api/templates?id=...
GET    /api/source-documents
POST   /api/source-documents
PATCH  /api/source-documents?id=...
GET    /api/firm-instructions
POST   /api/firm-instructions
PATCH  /api/firm-instructions?id=...
GET    /api/matters
POST   /api/matters
PATCH  /api/matters?id=...
POST   /api/generate-document
GET    /api/generated-documents
PATCH  /api/generated-documents?id=...
GET    /api/generated-document-docx?id=...
POST   /api/chat
GET    /api/chat-conversations
POST   /api/chat-conversations
PATCH  /api/chat-conversations?id=...
GET    /api/audit
```

## Legal workflow guardrails

The default seeded instructions tell the AI:

- Use approved firm templates and source documents only.
- Do not invent firm policy, fees, deadlines, or legal conclusions.
- Keep missing facts as bracketed placeholders.
- Mark client-facing work as **Pending Attorney Review**.
- Require attorney review before final legal advice, settlement language, demand letters, filings, fee quotes, redlines, or client-facing conclusions.

These are configurable in the **Firm Instructions** tab.

## Deployment checklist

Before real firm use:

- Disable demo mode and demo seed.
- Create real firm rows and memberships.
- Invite users through Supabase Auth or SSO.
- Confirm RLS policies.
- Use a production OpenAI API key stored server-side.
- Use private storage for original files.
- Add PDF/DOCX extraction pipeline.
- Add backups and retention rules.
- Decide what audit data to retain.
- Have an attorney approve the templates and rules.

## Chat answer modes

The Chat tab now includes an **Answer mode** selector:

1. **Vault only - approved firm data**: safest default for confidential firm work.
2. **Vault + web - firm data first**: uses approved vault content first, then web search for public/current background such as agency pages or general legal information.
3. **General web - broad questions**: lets the chatbot answer general questions without requiring matching firm vault documents.

Use Vault only for confidential firm-specific drafting. Use Vault + web or General web only when you want public information included. The app still labels legal work product as Pending Attorney Review.

## Mandamus Builder

This build includes a Mandamus Builder tab for USCIS delay matters. It collects case-specific facts, hardships, administrative contacts, processing-time data, and exhibits, then generates attorney-review drafts of a demand letter, mandamus complaint, exhibit list, and filing/service checklist.
