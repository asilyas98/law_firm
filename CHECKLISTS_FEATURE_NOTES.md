# Checklists feature

This build adds a visible **Checklists** tab for client document request workflows.

## What it does

- Upload a checklist PDF, DOCX, TXT, MD, or CSV.
- Extract checklist/document request items.
- Categorize items automatically, for example:
  - USCIS forms
  - Fees
  - Identity and civil documents
  - Translations
  - Photos
  - Relationship evidence
  - Financial / employment support
- Assign the checklist to a client and matter/case name.
- Select only the items you want to request.
- Choose which firm website user should receive the request.
- Prepare the checklist request in-app and download it as DOCX or PDF.

## Current delivery behavior

The app prepares and stores the request in the browser session and can export it as DOCX/PDF. It does not yet send real email/SMS/client-portal notifications. To send externally, connect an email service, SMS provider, or client portal workflow.

## Screenshot-based checklist PDFs

Some checklist exports are screenshot/image-only PDFs. The app includes a MyCase-style fallback for checklist screenshots like the uploaded Hague/Magateong example. For other image-only PDFs, OCR or pasted text may be needed.
