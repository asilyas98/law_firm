# First Chair case list, voice, and documents update

Implemented changes:

- Added a case-list workflow to the Cases tab.
- Staff can create a case from the Intake form, then click a case card to open its tabs.
- Case cards are stored per workspace in local browser storage for demo/tester workflows.
- Added microphone dictation to the Chat composer.
- Improved workflow voice capture with clearer browser permission/support messages.
- Added source document, evidence, and template uploads inside Cases → Documents.
- Added multi-file drag-and-drop upload in the case Documents area.
- Kept Admin source files for admins, while moving practical document upload into the case workspace.
- Cropped First Chair logo assets to reduce whitespace and improved sidebar/login logo sizing.
- Updated favicon/app icons with the cropped First Chair logo.

Browser note:

Speech recognition depends on the browser Web Speech API. It usually works best in Chrome or Edge over HTTPS with microphone permission granted. If unsupported, the UI shows a clear message and the user can type instead.
