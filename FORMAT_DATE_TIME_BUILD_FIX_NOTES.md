# FormatDateTime Build Fix

Fixed the Vercel build error where the case list used `formatDateTime(record.updatedAt)` but only `formatDate()` existed. Added a small `formatDateTime()` helper that delegates to `formatDate()` so the case list compiles.
