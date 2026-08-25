export type TemplateStatus = 'draft' | 'approved' | 'needs_review' | 'do_not_use';

export type SampleTemplate = {
  template_key: string;
  name: string;
  practice_area: string;
  doc_type: string;
  jurisdiction: string;
  status: TemplateStatus;
  version: string;
  body_markdown: string;
  required_fields: string[];
  optional_fields: string[];
  approved_by: string;
  approved_at: string;
};

export const sampleTemplates: SampleTemplate[] = [
  {
    template_key: 'client_welcome_email',
    name: 'Client Welcome Email Template',
    practice_area: 'General',
    doc_type: 'Client Email',
    jurisdiction: 'General',
    status: 'approved',
    version: '1.0.0',
    approved_by: 'Demo Supervising Attorney',
    approved_at: '2026-04-28T00:00:00.000Z',
    required_fields: ['firm_name', 'client_contact_name', 'matter_description', 'missing_documents_bullets', 'sender_name'],
    optional_fields: ['client_name', 'requested_deadline', 'secure_upload_link'],
    body_markdown: `**Status: Pending Attorney Review**

**Subject:** Welcome - Next Steps for Your Matter

Dear {{client_contact_name}},

Thank you for contacting {{firm_name}} regarding {{matter_description}}.

Before the firm can provide final legal advice, we need to complete our conflict check and confirm that an engagement agreement is in place.

Please upload the following materials:

{{missing_documents_bullets}}

Please use the secure upload method provided by the firm whenever possible. Do not send confidential documents by unsecured text message.

Any AI-assisted draft or summary prepared during intake will be reviewed by firm staff or an attorney before it is used.

Best,
{{sender_name}}`,
  },
  {
    template_key: 'missing_documents_request',
    name: 'Missing Documents Request Checklist',
    practice_area: 'General',
    doc_type: 'Checklist',
    jurisdiction: 'General',
    status: 'approved',
    version: '1.0.0',
    approved_by: 'Demo Supervising Attorney',
    approved_at: '2026-04-28T00:00:00.000Z',
    required_fields: ['client_name', 'matter_name', 'requested_deadline', 'missing_documents_bullets', 'acceptable_file_formats'],
    optional_fields: ['secure_upload_link', 'privacy_warning'],
    body_markdown: `**Status: Pending Attorney Review**

# Missing Documents Request Checklist

## Client and matter

- **Client:** {{client_name}}
- **Matter:** {{matter_name}}
- **Deadline:** {{requested_deadline}}

## Documents to request

{{missing_documents_bullets}}

## Upload instructions

Please upload documents through the firm's secure upload link when available. Acceptable file formats: {{acceptable_file_formats}}.

## Privacy warning

Do not send confidential documents by unsecured text message. Use the secure upload method whenever possible.

## Attorney-review flags

Escalate immediately if the materials show an urgent deadline, threatened litigation, personal guarantee, non-compete language, uncapped liability, indemnity provision, intellectual-property transfer, or unusual governing-law/venue clause.`,
  },
  {
    template_key: 'business_contract_review_checklist',
    name: 'Business Contract Review Checklist',
    practice_area: 'Business / Transactional',
    doc_type: 'Internal Checklist',
    jurisdiction: 'General',
    status: 'approved',
    version: '1.0.0',
    approved_by: 'Demo Supervising Attorney',
    approved_at: '2026-04-28T00:00:00.000Z',
    required_fields: ['client_name', 'counterparty_name', 'contract_type', 'requested_deadline', 'contract_value', 'client_goals'],
    optional_fields: ['governing_law', 'known_risk_areas'],
    body_markdown: `**Status: Internal Draft - Pending Attorney Review**

# Business Contract Review Checklist

## Matter overview

- **Client:** {{client_name}}
- **Counterparty:** {{counterparty_name}}
- **Contract type:** {{contract_type}}
- **Requested deadline:** {{requested_deadline}}
- **Estimated contract value:** {{contract_value}}
- **Client goals:** {{client_goals}}

## Intake items to confirm

- Legal business name
- Counterparty legal name
- Current contract draft
- Prior versions or related agreements
- Review deadline
- Contract value
- Renewal terms
- Termination rights
- Payment terms
- Governing law
- Dispute-resolution clause
- Insurance requirements
- Confidentiality obligations
- Data/security provisions
- Signature authority

## Clauses to flag for attorney review

- Indemnity, especially broad or uncapped indemnity
- Limitation of liability, especially uncapped carveouts
- Automatic renewal
- Non-compete or exclusivity language
- Personal guarantee
- Unusual governing law, venue, or arbitration language
- Intellectual-property ownership or assignment language
- Data security, privacy, or confidentiality obligations
- Insurance requirements that may exceed existing coverage`,
  },
  {
    template_key: 'paralegal_task_list',
    name: 'Paralegal Task List Template',
    practice_area: 'General',
    doc_type: 'Task List',
    jurisdiction: 'General',
    status: 'approved',
    version: '1.0.0',
    approved_by: 'Demo Supervising Attorney',
    approved_at: '2026-04-28T00:00:00.000Z',
    required_fields: ['client_name', 'matter_name', 'matter_type', 'requested_deadline'],
    optional_fields: ['counterparty_name', 'assigned_attorney', 'client_goals'],
    body_markdown: `**Status: Internal Draft - Pending Attorney Review**

# Paralegal Task List

## Matter

- **Client:** {{client_name}}
- **Matter:** {{matter_name}}
- **Matter type:** {{matter_type}}
- **Requested deadline:** {{requested_deadline}}

## Preliminary setup

- Open preliminary matter record.
- Run conflict check.
- Confirm client contact information.
- Confirm engagement agreement status.
- Upload received documents to the matter file.
- Create missing-document list.
- Identify urgent deadlines.
- Schedule follow-up if documents are incomplete.

## Draft summary for attorney

Prepare a concise summary of the matter, client goals, key documents received, missing documents, deadlines, and any clauses or facts requiring attorney review.`,
  },
  {
    template_key: 'attorney_review_policy_summary',
    name: 'Attorney Review Required Policy Summary',
    practice_area: 'Firm Policy',
    doc_type: 'Policy Summary',
    jurisdiction: 'General',
    status: 'approved',
    version: '1.0.0',
    approved_by: 'Demo Managing Attorney',
    approved_at: '2026-04-28T00:00:00.000Z',
    required_fields: ['requested_output_type'],
    optional_fields: ['matter_name', 'recipient_type'],
    body_markdown: `**Status: Internal Policy Summary**

# Attorney Review Required

The requested output type is: {{requested_output_type}}.

Attorney review is required before sending legal advice, demand letters, settlement language, court filings, contract redlines, immigration filings, fee quotes, or client-facing conclusions about legal rights.

AI may help draft, summarize, organize, and prepare checklists, but AI output must not be treated as final legal advice. Staff should label drafts as **Pending Attorney Review** unless and until a reviewing attorney approves them.`,
  },
];
