# One-field PDF editing update

This build removes the visible Matters tab and adds a Quick PDF Variable Editor inside Document Filler.

Use cases:
- Upload an already-filled PDF.
- Change one value while keeping the same PDF layout.
- If the PDF has AcroForm fields, enter the field name and the app fills that field.
- If the PDF is flat, enter page number and top-left coordinates, optionally covering the old value with a white rectangle before drawing the new value.

For official flat forms, exact replacement still depends on coordinates. The original PDF pages are preserved; the app overlays only the requested value.
