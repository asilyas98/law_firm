# UX and data safety fixes

This build includes the following fixes:

1. **User persona error fixed**
   - The app no longer requires `display_name`, `practice_area`, or `chatbot_persona` columns on `firm_memberships`.
   - User-specific chatbot behavior is stored in Supabase Auth `user_metadata`.
   - This avoids `PGRST204` schema-cache errors in older databases.

2. **Seed demo workspace no longer deletes uploaded files**
   - The seed route now upserts demo records instead of deleting all templates, source documents, instructions, clients, matters, generated documents, and audit logs.
   - User-uploaded documents remain intact.

3. **Cleaner UI/UX**
   - Updated visual design, spacing, cards, inputs, chat layout, and buttons.
   - Removed duplicated Role field in the Users tab.

4. **Document filler clarification**
   - The filler is form-aware for I-130-style PDFs and creates a review-ready filled DOCX/PDF packet.
   - Exact original-layout output is possible only for fillable PDFs or DOCX templates with placeholders/content controls. Flat PDFs require coordinate-level field mapping.

5. **Optional database migration**
   - `supabase/user_persona_optional_migration.sql` is included if you still want persona columns for compatibility.


## Latest chat UI cleanup
- Removed the visible Seed demo workspace button from the header.
- Removed the approved templates count from the Chat tab vault inventory.
- Replaced the Chat tab matter dropdown with a Change user dropdown so the chatbot can switch persona/user behavior.
- Added a public npm registry .npmrc and regenerated package-lock URLs away from internal registries for Vercel builds.
