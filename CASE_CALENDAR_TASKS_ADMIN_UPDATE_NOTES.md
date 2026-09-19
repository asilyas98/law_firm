# First Chair - Case Calendar Tasks Admin Update

Implemented changes requested on September 18:

- Main navigation simplified to Chat, Calendar, Cases, Tasks, Billing, Admin.
- Testers no longer see Admin, Users, Source Files, or Audit in the main navigation.
- Cases opens first and starts with a sample intake form.
- Cases includes sub-tabs: Intake, Info, Calendar, Documents, Tasks, Notes, Billing, Workflows, Tools.
- Document Filler, Packet Builder, and Checklists are now reachable from Cases > Tools rather than being primary navigation items.
- Calendar now supports all-users visibility, event type filtering, user filtering, event colors, matter/client attachment, meeting links, clickable event detail, event briefs, AI notes, and conflict warnings.
- Calendar can create a linked trial deadline workflow: trial, evidence deadline, client evidence deadline, prep call, and matching lawyer/client tasks.
- Tasks now separates lawyer/staff checklists and client homework checklists.
- Workflows can generate editable task lists, and custom workflows can be created by typed lines or voice input when supported by the browser.
- Chat sends on Enter and creates a newline with Shift+Enter.
- Admin tab includes Source Files, Users, and Audit subtabs, with account disabling protected by confirmation.

Notes:
- Email/SMS/client portal sending is represented as workflow text and task/comment structure. A production integration with Resend/SendGrid/Twilio or a client portal would be needed to actually send messages.
- The workflow/calendar/task data is still local-workspace based unless saved through existing backend routes.
