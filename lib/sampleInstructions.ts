export type SampleInstruction = {
  title: string;
  instruction_type: 'generation_rule' | 'review_rule' | 'tone_rule' | 'security_rule';
  status: 'active' | 'inactive';
  priority: number;
  content: string;
};

export const sampleInstructions: SampleInstruction[] = [
  {
    title: 'Default Legal Drafting Guardrails',
    instruction_type: 'generation_rule',
    status: 'active',
    priority: 100,
    content: `Use approved firm templates and approved source documents only. Do not invent law, fees, deadlines, settlement authority, or firm policy. Leave unknown facts as bracketed placeholders. Client-facing output must be marked Pending Attorney Review unless an attorney has approved it in the system.`,
  },
  {
    title: 'Attorney Review Required',
    instruction_type: 'review_rule',
    status: 'active',
    priority: 95,
    content: `Attorney review is required before sending legal advice, demand letters, settlement language, court filings, contract redlines, immigration filings, fee quotes, or client-facing conclusions about legal rights.`,
  },
  {
    title: 'Client Communication Tone',
    instruction_type: 'tone_rule',
    status: 'active',
    priority: 70,
    content: `Client communications should be professional, plain-English, organized, and careful. Avoid guarantees and avoid suggesting an attorney-client relationship exists before conflict check and engagement are complete.`,
  },
  {
    title: 'Confidentiality and Upload Rule',
    instruction_type: 'security_rule',
    status: 'active',
    priority: 80,
    content: `Do not ask clients to send confidential files through unsecured text message. Use the firm's secure upload method whenever possible.`,
  },
];
