# Exact-layout filler and chatbot user switching update

This build adds:

- Chatbot user profile switching in the Chat tab. Create users in the Users tab, then choose which user/persona the chatbot should act for from Chat > Chatbot user profile.
- Removed the visible Generate Docs tab.
- Same-layout document filler export:
  - PDF -> PDF: keeps the original uploaded PDF pages and fills onto the original file.
  - DOCX -> DOCX: keeps the original Word file and replaces `{{field_id}}` placeholders when present.
  - Review packet DOCX/PDF remains available as a fallback.

Important notes:

- Fillable PDFs are filled through AcroForm fields when present.
- Flat PDFs with no fillable fields, such as some downloaded USCIS PDFs, need a coordinate overlay map. This build includes a first curated overlay for Form I-130 core fields and preserves the original I-130 layout.
- For the most reliable DOCX original-layout output, use Word templates with placeholders such as `{{petitioner_family_name}}`, `{{beneficiary_given_name}}`, etc.
- All generated form outputs should remain marked Pending Attorney Review and reviewed against the original form before filing.
