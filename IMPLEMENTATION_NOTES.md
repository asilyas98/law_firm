# Implementation Notes

This version upgrades the original demo into a private law-firm software starter.

## Architectural decisions

- The model does not memorize legal documents.
- Templates and source files live in Supabase tables.
- Embeddings make approved materials searchable at runtime.
- Only approved templates are available to the generation endpoint.
- Only approved source documents are returned by source-document search.
- Firm instructions are injected into chat and generation prompts.
- Chat conversations are saved in `chat_conversations` and `chat_messages`.
- Every generated document is saved as `pending_attorney_review` by default.
- Attorney/admin roles are required for template approval, source approval, and review status changes.
- Audit logs capture major operations.

## Server-side access control

`lib/serverAuth.ts` reads the Bearer token from the request, validates it through Supabase Auth, fetches the user's active firm membership, and enforces role thresholds.

Local demo mode returns a deterministic demo owner when `DEMO_MODE=true` and no Bearer token is present.

## Vector search

The schema includes two firm-scoped search functions:

```sql
match_template_chunks(query_embedding, target_firm_id, match_count)
match_source_document_chunks(query_embedding, target_firm_id, match_count)
```

Both filter to the current firm and only approved materials.


## Chatbot flow

`app/api/chat/route.ts` is the chat-first RAG endpoint. It accepts a message, optional conversation ID, optional matter ID, and matter-name fallback. For each user turn it:

1. Authenticates the firm user.
2. Loads recent conversation history if a conversation is selected.
3. Creates a new conversation if needed.
4. Embeds the current user message.
5. Retrieves matching approved source-document chunks.
6. Retrieves matching approved template chunks.
7. Adds active firm instructions and approved vault inventory.
8. Adds selected matter context when provided.
9. Calls OpenAI with strict grounding instructions.
10. Saves the user and assistant messages with source metadata.
11. Writes an audit log entry.

The endpoint is designed to answer only from firm-controlled data. If the vault does not contain enough approved context, the model is instructed to say what is missing rather than inventing an answer.

`app/api/chat-conversations/route.ts` lists, opens, creates, renames, and archives chat conversations.

## Document generation

`app/api/generate-document/route.ts` combines:

- selected or auto-detected approved template
- matter/client facts
- structured JSON input
- active firm instructions
- similar approved templates
- similar approved source documents

The response is saved to `generated_documents`, a review event is created, and an audit log is written.

## File ingestion

The MVP supports text ingestion. Production should add extraction for DOCX/PDF and save original files to private storage.

## Not included yet

- Email sending
- Court filing
- Payment processing
- DMS connector sync
- Full PDF/DOCX extraction
- Multi-matter permission assignments beyond firm-level membership
- Production SSO integration

## Web/general chatbot mode

This version adds three chat modes:

- **Vault only**: retrieves from approved firm templates, source files, firm instructions, matter data, and chat history only.
- **Vault + web**: uses approved firm materials first and may use OpenAI's hosted web search tool for public/current background.
- **General web**: answers general questions with web search enabled and does not claim firm-specific facts unless they are in the vault context.

Legal-work-product safety rules still apply in every mode. Client-facing drafts and legal work product should remain **Pending Attorney Review**.

The backend uses the OpenAI Responses API `web_search_preview` hosted tool when either web-enabled mode is selected. No extra environment variable is required beyond `OPENAI_API_KEY`, but the API account must have access/quota for web search tool calls.
