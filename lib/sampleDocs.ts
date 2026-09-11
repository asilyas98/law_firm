export type SampleDoc = {
  title: string;
  practice_area: string;
  doc_type: string;
  status: 'approved' | 'needs_review' | 'do_not_use';
  content: string;
};

export const sampleDocs: SampleDoc[] = [
  {
    title: 'Business Contract Review Checklist',
    practice_area: 'Business / Transactional',
    doc_type: 'Checklist',
    status: 'approved',
    content: `Use this checklist when a client requests review of a vendor agreement, services agreement, purchase order, SaaS contract, or commercial lease addendum. Intake must collect: legal business name, counterparty name, contract draft, deadline, contract value, renewal terms, termination rights, indemnity language, limitation of liability, payment terms, governing law, dispute resolution clause, insurance requirements, confidentiality obligations, data/security provisions, and signature authority. Staff should flag attorney review for indemnity, uncapped liability, automatic renewal, non-compete language, personal guarantees, unusual jurisdiction, or any clause affecting ownership of intellectual property.`,
  },
  {
    title: 'Client Welcome Email Template',
    practice_area: 'General',
    doc_type: 'Email Template',
    status: 'approved',
    content: `Subject: Welcome — Next Steps for Your Matter. Thank the client for contacting the firm. Confirm that the firm will not provide final legal advice until conflict checks and engagement are complete. Request missing documents in a clear bullet list. Explain that all AI-assisted drafts are reviewed by firm staff or an attorney before use. Avoid making promises about outcomes, timelines, or costs unless confirmed by the attorney.`,
  },
  {
    title: 'Missing Documents Request Checklist',
    practice_area: 'General',
    doc_type: 'Checklist',
    status: 'approved',
    content: `When requesting missing documents from a client, be specific and organized. Include: client full name, matter name, deadline, upload instructions, list of missing documents, acceptable file formats, and privacy warning not to send documents through unsecured text message. For business matters, request entity formation documents, current agreement draft, prior versions, relevant emails, invoices, payment history, and signed amendments. For litigation matters, request pleadings, notices, correspondence, contracts, photos, timelines, and witness names.`,
  },
  {
    title: 'Attorney Review Required Policy',
    practice_area: 'Firm Policy',
    doc_type: 'Policy',
    status: 'approved',
    content: `Attorney review is required before sending legal advice, demand letters, settlement language, court filings, contract redlines, immigration filings, fee quotes, or client-facing conclusions about legal rights. AI may help draft, summarize, organize, or prepare checklists, but AI output must not be treated as final legal advice. Staff should label drafts as Pending Attorney Review.`,
  },
  {
    title: 'Paralegal Task List Template',
    practice_area: 'General',
    doc_type: 'Task Template',
    status: 'approved',
    content: `Standard paralegal tasks: open preliminary matter record, run conflict check, confirm client contact information, collect engagement agreement status, upload received documents, create missing-document list, draft summary for attorney, flag urgent deadlines, and schedule follow-up. For contract review, also summarize contract type, counterparty, value, deadline, risky clauses, and client goals.`,
  },
];
