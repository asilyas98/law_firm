# Form-aware Document Filler update

This build improves the Document Filler so complex government/legal forms do not turn into strange OCR-style questions.

## What changed

- Detects USCIS Form I-130 / Petition for Alien Relative.
- Uses a curated, section-aware guided interview for I-130 instead of raw line-by-line PDF text.
- Skips USCIS-use-only blocks, fee/action stamp areas, warnings, boilerplate, and signature-only text.
- Groups repeated sub-fields into human-friendly questions, such as complete mailing address, beneficiary contact information, and employment history.
- Adds conditional questions. For example, current-marriage fields are only shown if marital status is Married, and spouse last-address fields are only shown for spouse petitions.
- Adds answer types and options for yes/no and select questions.
- The exported DOCX/PDF packet includes Part and Item references for attorney review.

## Important limitation

This still produces a review packet / completed answer summary. It does not yet write answers into the original USCIS PDF boxes. For true field-level PDF filling, the next step is adding AcroForm/PDF coordinate mapping for each government form.
