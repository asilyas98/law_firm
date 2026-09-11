'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';

type TemplateRow = {
  id: string;
  template_key: string;
  name: string;
  practice_area: string;
  doc_type: string;
  jurisdiction: string;
  status: string;
  version: string;
  body_markdown: string;
  required_fields: string[];
  optional_fields: string[];
  review_required: boolean;
  updated_at: string;
};

type SourceDocumentRow = {
  id: string;
  title: string;
  practice_area: string;
  doc_type: string;
  source_kind: string;
  status: string;
  content: string;
  updated_at: string;
};

type InstructionRow = {
  id: string;
  title: string;
  instruction_type: string;
  status: string;
  priority: number;
  content: string;
  updated_at: string;
};

type MatterRow = {
  id: string;
  matter_name: string;
  matter_type: string;
  description: string | null;
  deadline: string | null;
  status: string;
  responsible_attorney: string | null;
  assigned_to: string | null;
  metadata: Record<string, unknown>;
  clients?: { id: string; name: string; contact_name: string | null; contact_email: string | null } | null;
  updated_at: string;
};

type GeneratedDocumentRow = {
  id: string;
  matter_id: string | null;
  matter_name: string;
  template_id: string | null;
  template_version: string;
  draft_type: string;
  prompt: string;
  input_data: Record<string, unknown>;
  output_markdown: string;
  status: string;
  created_by_email: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  matter_name: string | null;
  output_preview: string | null;
  created_at: string;
};

type ChatSource = {
  type: 'source_document' | 'template';
  id: string;
  title: string;
  similarity: number;
};

type ChatConversationRow = {
  id: string;
  title: string;
  matter_id: string | null;
  status: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

type ChatMessageRow = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: ChatSource[];
  created_at?: string;
};

type MeResponse = {
  user?: {
    email: string;
    role: string;
    displayName?: string;
    practiceArea?: string;
    chatbotPersona?: string;
    isDemo: boolean;
  };
  firm?: { name: string; slug: string; allowed_email_domain: string | null } | null;
};

type FirmUserRow = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  practice_area: string | null;
  chatbot_persona: string | null;
  role: string;
  status: string;
  created_at: string;
};

type FillerField = {
  id: string;
  label: string;
  normalizedKey: string;
  required: boolean;
  repeatedOf?: string | null;
  section?: string;
  itemNumber?: string;
  helpText?: string;
  answerType?: 'text' | 'long_text' | 'date' | 'yes_no' | 'single_select' | 'multi_select' | 'address' | 'number';
  options?: string[];
  conditionalKey?: string | null;
  conditionalValues?: string[] | null;
};

type FillerAnalyzeResponse = {
  title: string;
  filename: string;
  extension: string;
  sourceText: string;
  fields: FillerField[];
  uniqueFieldCount: number;
  repeatedFieldCount: number;
  formType?: string;
  analysisNote?: string;
};


type ChecklistItem = {
  id: string;
  text: string;
  category: string;
  required: boolean;
  source?: string;
};

type ChecklistAnalyzeResponse = {
  title: string;
  filename: string;
  sourceText: string;
  items: ChecklistItem[];
  categories: string[];
  analysisNote?: string;
};

type SentChecklistPacket = {
  id: string;
  title: string;
  clientName: string;
  matterName: string;
  recipientEmail: string;
  items: ChecklistItem[];
  message: string;
  createdAt: string;
};

type CalendarEventItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  reminder: string;
  notes: string;
};

type TaskItem = {
  id: string;
  title: string;
  dueDate: string;
  reminder: string;
  status: 'open' | 'done';
  notes: string;
};

type PacketExhibit = {
  id: string;
  label: string;
  fileName: string;
  title: string;
  category: string;
  facts: string;
  included: boolean;
  previewUrl?: string;
};


type MandamusContact = {
  id: string;
  date: string;
  method: string;
  office: string;
  outcome: string;
};

type MandamusExhibit = {
  id: string;
  label: string;
  title: string;
  included: boolean;
};

type MandamusCase = {
  petitionerName: string;
  petitionerAddress: string;
  petitionerEmail: string;
  petitionerPhone: string;
  beneficiaryName: string;
  beneficiaryCitizenship: string;
  beneficiaryResidence: string;
  relationship: string;
  petitionerStatus: string;
  formType: string;
  receiptNumber: string;
  filingDate: string;
  serviceCenter: string;
  processingPath: string;
  embassyOrFieldOffice: string;
  currentStatus: string;
  priorAction: string;
  currentProcessingTime: string;
  getInquiryDate: string;
  processingDataDate: string;
  federalDistrict: string;
  hardships: string;
  demandDeadlineDays: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const demoModeEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE !== 'false';
const DEMO_LOGIN_USERNAME = 'demo';
const DEMO_LOGIN_PASSWORD = 'demo';
const BLANK_LOGIN_USERNAME = 'blank';
const BLANK_LOGIN_PASSWORD = 'blank';
const TESTER_LOGIN_USERNAME = 'tester01';
const TESTER_LOGIN_PASSWORD = 'tester01';
const browserSupabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const DEFAULT_INPUT_DATA = {
  firm_name: 'Example Law Firm',
  client_name: 'Northstar Operations LLC',
  client_contact_name: 'Jordan Smith',
  matter_name: 'Apex Vendor Agreement Review',
  matter_description: 'review of the Apex Vendor Services agreement',
  counterparty_name: 'Apex Vendor Services Inc.',
  contract_type: 'Vendor services agreement',
  requested_deadline: 'May 17, 2026',
  contract_value: 'Approximately $85,000 annually',
  client_goals: 'Identify business and legal risk before signature and request negotiable revisions if needed.',
  matter_type: 'Business contract review',
  requested_output_type: 'Client-facing draft email and internal checklist',
  acceptable_file_formats: 'PDF, Microsoft Word, Excel/CSV, JPEG, or PNG',
  sender_name: 'Intake Team',
  missing_documents_bullets: [
    'Current vendor agreement draft',
    'Any prior versions of the agreement',
    'Relevant emails with the vendor',
    'Invoices, purchase orders, or payment-history records',
    'Any signed amendments or side letters',
  ],
};

function preview(input = '', length = 180) {
  return input.replace(/\s+/g, ' ').trim().slice(0, length);
}

function formatDate(input?: string | null) {
  if (!input) return 'N/A';
  return new Date(input).toLocaleString();
}

function shortDate(input?: string | null) {
  if (!input) return 'N/A';
  return new Date(input).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}


function dateKeyFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayDateKey() {
  const today = new Date();
  return dateKeyFromParts(today.getFullYear(), today.getMonth(), today.getDate());
}

function monthKeyFromDateKey(dateKey: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey.slice(0, 7) : todayDateKey().slice(0, 7);
}

function shiftMonthKey(monthKey: string, offset: number) {
  const [yearText, monthText] = monthKey.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-');
  return new Date(Number(yearText), Number(monthText) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function buildMonthCells(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells: Array<{ key: string; dateKey: string; day: number | null; inMonth: boolean }> = [];

  for (let index = 0; index < leadingBlanks; index += 1) {
    cells.push({ key: `blank-start-${index}`, dateKey: '', day: null, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: dateKeyFromParts(year, monthIndex, day), dateKey: dateKeyFromParts(year, monthIndex, day), day, inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-end-${cells.length}`, dateKey: '', day: null, inMonth: false });
  }

  return cells;
}

function conversationLabel(conversation: ChatConversationRow) {
  const title = (conversation.title || '').trim();
  if (title && title.toLowerCase() !== 'new firm chat') return title;
  return `Chat from ${shortDate(conversation.updated_at || conversation.created_at)}`;
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-bold-${match.index}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={`${keyPrefix}-code-${match.index}`}>{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isMarkdownTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitMarkdownTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function looksLikeSectionHeading(line: string) {
  const trimmed = line.trim();
  if (trimmed.length < 8 || trimmed.length > 90) return false;
  if (/[:.;,]$/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (letters.length < 6) return false;
  return letters === letters.toUpperCase();
}

function LegalMarkdownPreview({ content, emptyText, compact = false, chat = false }: { content?: string; emptyText: string; compact?: boolean; chat?: boolean }) {
  const text = (content || '').trim();
  if (!text) return <div className={`answer legal-preview ${compact ? 'compact-answer' : ''}`}>{emptyText}</div>;

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.includes('|') && lines[index + 1] && isMarkdownTableSeparator(lines[index + 1])) {
      const header = splitMarkdownTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitMarkdownTableRow(lines[index]));
        index += 1;
      }
      nodes.push(
        <div className="legal-table-wrap" key={`table-${index}`}>
          <table className="legal-table">
            <thead><tr>{header.map((cell, cellIndex) => <th key={`h-${cellIndex}`}>{renderInlineMarkdown(cell, `th-${index}-${cellIndex}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={`r-${rowIndex}`}>{header.map((_, cellIndex) => <td key={`c-${cellIndex}`}>{renderInlineMarkdown(row[cellIndex] || '', `td-${index}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3);
      const headingContent = renderInlineMarkdown(headingMatch[2], `h-${index}`);
      if (level === 1) nodes.push(<h2 className="legal-heading" key={`h-${index}`}>{headingContent}</h2>);
      else if (level === 2) nodes.push(<h3 className="legal-heading" key={`h-${index}`}>{headingContent}</h3>);
      else nodes.push(<h4 className="legal-heading" key={`h-${index}`}>{headingContent}</h4>);
      index += 1;
      continue;
    }

    if (looksLikeSectionHeading(line)) {
      nodes.push(<h3 className="legal-heading" key={`caps-${index}`}>{renderInlineMarkdown(line, `caps-${index}`)}</h3>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }
      nodes.push(<ul className="legal-list" key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item, `li-${index}-${itemIndex}`)}</li>)}</ul>);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ''));
        index += 1;
      }
      nodes.push(<ol className="legal-list" key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item, `oli-${index}-${itemIndex}`)}</li>)}</ol>);
      continue;
    }

    if (/^[A-Za-z][A-Za-z\s/.-]{1,42}:\s+/.test(line)) {
      const [label, ...rest] = line.split(':');
      nodes.push(<p className="legal-field" key={`field-${index}`}><span>{label}:</span>{renderInlineMarkdown(rest.join(':').trim(), `field-${index}`)}</p>);
      index += 1;
      continue;
    }

    nodes.push(<p key={`p-${index}`}>{renderInlineMarkdown(line, `p-${index}`)}</p>);
    index += 1;
  }

  return <div className={`answer legal-preview ${chat ? 'chat-rendered' : ''} ${compact ? 'compact-answer' : ''}`}>{nodes}</div>;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [demoBypass, setDemoBypass] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<'demo' | 'blank' | 'tester'>('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [sourceDocs, setSourceDocs] = useState<SourceDocumentRow[]>([]);
  const [instructions, setInstructions] = useState<InstructionRow[]>([]);
  const [matters, setMatters] = useState<MatterRow[]>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocumentRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversationRow[]>([]);
  const [firmUsers, setFirmUsers] = useState<FirmUserRow[]>([]);
  const [selectedChatUserId, setSelectedChatUserId] = useState('');

  const [selectedMatterId, setSelectedMatterId] = useState('');
  const [matterName, setMatterName] = useState('Apex Vendor Agreement Review');

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageRow[]>([]);
  const [chatInput, setChatInput] = useState('What intake checklist should staff use for a new vendor agreement review?');
  const [chatMode, setChatMode] = useState<'vault' | 'vault_web' | 'general_web'>('vault');
  const [lastChatSources, setLastChatSources] = useState<ChatSource[]>([]);
  const chatWindowRef = useRef<HTMLDivElement | null>(null);

  const [command, setCommand] = useState('Create a client welcome email for Northstar Operations about a vendor agreement review. Ask for the contract, prior versions, invoices, payment history, and signed amendments.');
  const [templateKey, setTemplateKey] = useState('auto');
  const [inputJson, setInputJson] = useState(JSON.stringify(DEFAULT_INPUT_DATA, null, 2));
  const [output, setOutput] = useState('');
  const [generatedDocumentId, setGeneratedDocumentId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [selectedTemplateVersion, setSelectedTemplateVersion] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [sourceTitles, setSourceTitles] = useState<string[]>([]);

  const [matterForm, setMatterForm] = useState({
    client_name: 'Northstar Operations LLC',
    client_contact_name: 'Jordan Smith',
    client_contact_email: 'jordan@northstar.example',
    matter_name: 'Apex Vendor Agreement Review',
    matter_type: 'Business contract review',
    description: 'Review of the Apex Vendor Services agreement before signature.',
    deadline: 'May 17, 2026',
    responsible_attorney: 'Demo Supervising Attorney',
    client_goals: 'Identify business and legal risk before signature.',
  });

  const [sourceForm, setSourceForm] = useState({
    title: '',
    practice_area: 'General',
    doc_type: 'Reference',
    source_kind: 'uploaded_text',
    status: 'needs_review',
    content: '',
  });
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [chatFiles, setChatFiles] = useState<File[]>([]);

  const [fillerFile, setFillerFile] = useState<File | null>(null);
  const [fillerTitle, setFillerTitle] = useState('');
  const [fillerSourceText, setFillerSourceText] = useState('');
  const [fillerFields, setFillerFields] = useState<FillerField[]>([]);
  const [fillerAnswers, setFillerAnswers] = useState<Record<string, string>>({});
  const [fillerIndex, setFillerIndex] = useState(0);
  const [fillerFormType, setFillerFormType] = useState('');

  const [quickPdfFile, setQuickPdfFile] = useState<File | null>(null);
  const [quickPdfForm, setQuickPdfForm] = useState({
    fieldName: '',
    newValue: '',
    pageNumber: '1',
    x: '100',
    yTop: '100',
    width: '220',
    height: '18',
    fontSize: '10',
    whiteOut: true,
  });

  const [checklistFile, setChecklistFile] = useState<File | null>(null);
  const [checklistTitle, setChecklistTitle] = useState('Document request checklist');
  const [checklistClientName, setChecklistClientName] = useState('');
  const [checklistMatterName, setChecklistMatterName] = useState('');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<string[]>([]);
  const [checklistRecipientUserId, setChecklistRecipientUserId] = useState('');
  const [checklistMessage, setChecklistMessage] = useState('Please upload or provide the selected documents for your matter.');
  const [sentChecklistPackets, setSentChecklistPackets] = useState<SentChecklistPacket[]>([]);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => todayDateKey());
  const [calendarMonth, setCalendarMonth] = useState(() => monthKeyFromDateKey(todayDateKey()));
  const [calendarForm, setCalendarForm] = useState(() => ({ title: '', date: todayDateKey(), time: '', reminder: '1 day before', notes: '' }));
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [workspaceStorageReady, setWorkspaceStorageReady] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '', reminder: '1 day before', notes: '' });

  const [packetPractice, setPacketPractice] = useState<'Family Law' | 'Immigration Law'>('Family Law');
  const [packetTemplate, setPacketTemplate] = useState('Parenting time motion packet');
  const [packetClaimType, setPacketClaimType] = useState('Motion');
  const [packetClaimDescription, setPacketClaimDescription] = useState("Terminate father's supervised parenting time and request a safer parenting-time arrangement.");
  const [packetExhibits, setPacketExhibits] = useState<PacketExhibit[]>([]);
  const [packetDraft, setPacketDraft] = useState('');
  const [packetDraftTitle, setPacketDraftTitle] = useState('First Chair Packet Draft');

  const [mandamusCase, setMandamusCase] = useState<MandamusCase>({
    petitionerName: 'Demo Petitioner',
    petitionerAddress: '123 Main Street, Springfield, IL 62701',
    petitionerEmail: 'petitioner@example.com',
    petitionerPhone: '(555) 555-0100',
    beneficiaryName: 'Demo Beneficiary',
    beneficiaryCitizenship: 'Canada',
    beneficiaryResidence: 'Canada',
    relationship: 'Spouse',
    petitionerStatus: 'U.S. citizen',
    formType: 'I-130 Petition for Alien Relative',
    receiptNumber: 'IOE0000000000',
    filingDate: '',
    serviceCenter: 'Texas Service Center',
    processingPath: 'Consular processing',
    embassyOrFieldOffice: 'U.S. Embassy/Consulate - to be confirmed',
    currentStatus: 'Case Was Received and A Receipt Notice Was Sent',
    priorAction: 'No RFE, interview, or other substantive action has been taken.',
    currentProcessingTime: '',
    getInquiryDate: '',
    processingDataDate: '',
    federalDistrict: 'U.S. District Court for the district where petitioner resides',
    hardships: 'Family separation, emotional distress, and financial burden caused by the delayed adjudication.',
    demandDeadlineDays: '30',
  });
  const [mandamusContacts, setMandamusContacts] = useState<MandamusContact[]>([
    { id: 'contact-1', date: '', method: 'USCIS customer service / Emma', office: 'USCIS', outcome: 'No substantive resolution yet.' },
  ]);
  const [mandamusExhibits, setMandamusExhibits] = useState<MandamusExhibit[]>([
    { id: 'ex-a', label: 'A', title: 'USCIS receipt notice', included: true },
    { id: 'ex-b', label: 'B', title: 'USCIS case status printout showing no adjudication', included: true },
    { id: 'ex-c', label: 'C', title: 'USCIS processing times printout', included: true },
    { id: 'ex-d', label: 'D', title: 'Administrative contact records with USCIS', included: true },
    { id: 'ex-e', label: 'E', title: 'Congressional or Ombudsman correspondence, if any', included: false },
  ]);
  const [mandamusDraft, setMandamusDraft] = useState('');
  const [mandamusDraftTitle, setMandamusDraftTitle] = useState('USCIS Mandamus Demand Letter');

  const [userForm, setUserForm] = useState({
    email: 'paralegal@examplelawfirm.com',
    password: 'ChangeMe123!',
    full_name: 'New Firm User',
    display_name: 'New Firm User',
    role: 'paralegal',
    status: 'active',
    practice_area: 'General',
    chatbot_persona: 'Treat this user as a paralegal. Focus on document collection, checklists, organization, and attorney-review handoff.',
  });

  const [instructionForm, setInstructionForm] = useState({
    title: 'New Firm Rule',
    instruction_type: 'generation_rule',
    status: 'active',
    priority: 50,
    content: 'Describe the firm rule here.',
  });

  const [templateForm, setTemplateForm] = useState({
    name: 'New Template',
    template_key: 'new_template',
    practice_area: 'General',
    doc_type: 'Client Email',
    jurisdiction: 'General',
    status: 'draft',
    version: '1.0.0',
    required_fields: 'firm_name, client_contact_name, matter_description, sender_name',
    optional_fields: 'requested_deadline, secure_upload_link',
    body_markdown: '**Status: Pending Attorney Review**\n\nDear {{client_contact_name}},\n\nThank you for contacting {{firm_name}} regarding {{matter_description}}.\n\nBest,\n{{sender_name}}',
  });

  const selectedTemplate = useMemo(() => templates.find((template) => template.template_key === templateKey), [templates, templateKey]);
  const selectedConversation = useMemo(() => chatConversations.find((item) => item.id === selectedConversationId), [chatConversations, selectedConversationId]);
  const activeChatUser = useMemo(() => {
    if (!selectedChatUserId) return null;
    return firmUsers.find((item) => item.user_id === selectedChatUserId) || null;
  }, [firmUsers, selectedChatUserId]);

  const blankWorkspace = workspaceMode === 'blank' || workspaceMode === 'tester';
  const workspaceStorageSuffix = workspaceMode === 'tester' ? 'tester01' : workspaceMode;
  const activeChatUserEmail = (activeChatUser?.email || me?.user?.email || '').toLowerCase();

  const visibleChatConversations = useMemo(() => {
    if (!activeChatUserEmail) return chatConversations;
    return chatConversations.filter((conversation) => (conversation.created_by_email || '').toLowerCase() === activeChatUserEmail);
  }, [chatConversations, activeChatUserEmail]);


  const calendarCells = useMemo(() => buildMonthCells(calendarMonth), [calendarMonth]);
  const calendarMonthTitle = useMemo(() => monthLabel(calendarMonth), [calendarMonth]);
  const calendarEventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEventItem[]> = {};
    calendarEvents.forEach((item) => {
      if (!item.date) return;
      grouped[item.date] = [...(grouped[item.date] || []), item].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    });
    return grouped;
  }, [calendarEvents]);
  const selectedCalendarEvents = calendarEventsByDate[selectedCalendarDate] || [];
  const upcomingCalendarEvents = useMemo(() => {
    const today = todayDateKey();
    return calendarEvents
      .filter((item) => !item.date || item.date >= today)
      .sort((a, b) => `${a.date || '9999-99-99'} ${a.time || ''}`.localeCompare(`${b.date || '9999-99-99'} ${b.time || ''}`))
      .slice(0, 8);
  }, [calendarEvents]);

  function shouldShowFillerField(field: FillerField, answers: Record<string, string>) {
    if (!field.conditionalKey || !field.conditionalValues?.length) return true;
    const dependency = fillerFields.find((candidate) => candidate.id === field.conditionalKey || candidate.normalizedKey === field.conditionalKey);
    const dependencyValue = dependency ? answers[dependency.id] : answers[field.conditionalKey];
    if (!dependencyValue) return false;
    return field.conditionalValues.some((value) => dependencyValue.toLowerCase().includes(value.toLowerCase()));
  }
  const visibleUniqueFillerFields = useMemo(() => fillerFields.filter((field) => !field.repeatedOf && shouldShowFillerField(field, fillerAnswers)), [fillerFields, fillerAnswers]);
  const uniqueFillerFields = visibleUniqueFillerFields;
  const currentFillerField = uniqueFillerFields[Math.min(fillerIndex, Math.max(uniqueFillerFields.length - 1, 0))] || null;
  const answeredFillerCount = uniqueFillerFields.filter((field) => (fillerAnswers[field.id] || '').trim()).length;
  const authenticated = Boolean(session || demoBypass);
  const canManageUsers = me?.user?.role === 'owner' || me?.user?.role === 'admin' || demoBypass;

  function makeHeaders(json = true, existing?: HeadersInit) {
    const headers = new Headers(existing);
    if (json && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (session?.access_token && !demoBypass) headers.set('Authorization', `Bearer ${session.access_token}`);
    return headers;
  }

  async function apiFetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const hasBody = options.body !== undefined && options.body !== null;
    const res = await fetch(url, { ...options, headers: makeHeaders(hasBody, options.headers) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data as T;
  }

  useEffect(() => {
    if (!browserSupabase) return undefined;
    browserSupabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = browserSupabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!demoModeEnabled) return;
    if (typeof window !== 'undefined' && window.localStorage.getItem('lawFirmDemoLogin') === 'true') {
      setDemoBypass(true);
      const savedMode = window.localStorage.getItem('firstChairWorkspaceMode');
      setWorkspaceMode(savedMode === 'blank' || savedMode === 'tester' ? savedMode : 'demo');
    }
  }, []);

  useEffect(() => {
    chatWindowRef.current?.scrollTo({ top: chatWindowRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setWorkspaceStorageReady(false);
    try {
      setCalendarEvents(JSON.parse(window.localStorage.getItem(`firstChairCalendarEvents:${workspaceStorageSuffix}`) || '[]'));
      setTasks(JSON.parse(window.localStorage.getItem(`firstChairTasks:${workspaceStorageSuffix}`) || '[]'));
    } catch {
      setCalendarEvents([]);
      setTasks([]);
    }
    setWorkspaceStorageReady(true);
  }, [workspaceStorageSuffix]);

  useEffect(() => {
    if (typeof window !== 'undefined' && workspaceStorageReady) window.localStorage.setItem(`firstChairCalendarEvents:${workspaceStorageSuffix}`, JSON.stringify(calendarEvents));
  }, [calendarEvents, workspaceStorageReady, workspaceStorageSuffix]);

  useEffect(() => {
    if (typeof window !== 'undefined' && workspaceStorageReady) window.localStorage.setItem(`firstChairTasks:${workspaceStorageSuffix}`, JSON.stringify(tasks));
  }, [tasks, workspaceStorageReady, workspaceStorageSuffix]);

  useEffect(() => {
    setSelectedConversationId(null);
    setChatMessages([]);
    setLastChatSources([]);
    setChatInput('');
  }, [selectedChatUserId]);

  async function refreshAll() {
    if (!authenticated) return;
    if (blankWorkspace) {
      const isTesterWorkspace = workspaceMode === 'tester';
      const blankUser: FirmUserRow = {
        id: isTesterWorkspace ? 'tester01-owner' : 'blank-owner',
        user_id: isTesterWorkspace ? 'tester01-owner' : 'blank-owner',
        email: isTesterWorkspace ? 'tester01@firstchair.local' : 'blank@firstchair.local',
        display_name: isTesterWorkspace ? 'Tester 01' : 'Blank Workspace Admin',
        practice_area: 'General',
        chatbot_persona: 'Answer as First Chair: law-centered, organized, attorney-review focused, practical, and clear. Include general helpful context only after legal/factual boundaries are stated.',
        role: 'owner',
        status: 'active',
        created_at: new Date().toISOString(),
      };
      setMe({ user: { email: blankUser.email, role: 'owner', displayName: blankUser.display_name || (isTesterWorkspace ? 'Tester 01' : 'Blank Workspace Admin'), practiceArea: 'General', chatbotPersona: blankUser.chatbot_persona || '', isDemo: true }, firm: { name: isTesterWorkspace ? 'First Chair Tester 01 Workspace' : 'First Chair Blank Workspace', slug: isTesterWorkspace ? 'first-chair-tester01' : 'first-chair-blank', allowed_email_domain: null } });
      setTemplates([]);
      setSourceDocs([]);
      setInstructions([]);
      setMatters([]);
      setGeneratedDocuments([]);
      setChatConversations([]);
      setLogs([]);
      setFirmUsers([blankUser]);
      setSelectedChatUserId(blankUser.user_id);
      setSelectedMatterId('');
      setMatterName('');
      return;
    }
    const [meJson, templatesJson, sourcesJson, instructionsJson, mattersJson, generatedJson, chatsJson, auditJson, usersJson] = await Promise.all([
      apiFetchJson<MeResponse>('/api/me'),
      apiFetchJson<{ templates: TemplateRow[] }>('/api/templates'),
      apiFetchJson<{ documents: SourceDocumentRow[] }>('/api/source-documents'),
      apiFetchJson<{ instructions: InstructionRow[] }>('/api/firm-instructions'),
      apiFetchJson<{ matters: MatterRow[] }>('/api/matters'),
      apiFetchJson<{ documents: GeneratedDocumentRow[] }>('/api/generated-documents'),
      apiFetchJson<{ conversations: ChatConversationRow[] }>('/api/chat-conversations').catch(() => ({ conversations: [] })),
      apiFetchJson<{ logs: AuditRow[] }>('/api/audit').catch(() => ({ logs: [] })),
      apiFetchJson<{ users: FirmUserRow[] }>('/api/users').catch(() => ({ users: [] })),
    ]);
    setMe(meJson);
    setTemplates(templatesJson.templates || []);
    setSourceDocs(sourcesJson.documents || []);
    setInstructions(instructionsJson.instructions || []);
    setMatters(mattersJson.matters || []);
    setGeneratedDocuments(generatedJson.documents || []);
    setChatConversations(chatsJson.conversations || []);
    setLogs(auditJson.logs || []);
    const nextUsers = usersJson.users || [];
    setFirmUsers(nextUsers);
    if (!selectedChatUserId && nextUsers.length) {
      const current = nextUsers.find((item) => item.email === meJson.user?.email) || nextUsers[0];
      setSelectedChatUserId(current.user_id);
    }
    if (!selectedMatterId && mattersJson.matters?.[0]) {
      setSelectedMatterId(mattersJson.matters[0].id);
      setMatterName(mattersJson.matters[0].matter_name);
    }
  }

  useEffect(() => {
    refreshAll().catch((err) => setStatus(err instanceof Error ? err.message : 'Refresh failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, session?.access_token, demoBypass, workspaceMode]);

  async function signIn() {
    const loginName = email.trim().toLowerCase();
    if (demoModeEnabled && loginName === DEMO_LOGIN_USERNAME && password === DEMO_LOGIN_PASSWORD) {
      setWorkspaceMode('demo');
      setDemoBypass(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lawFirmDemoLogin', 'true');
        window.localStorage.setItem('firstChairWorkspaceMode', 'demo');
      }
      setStatus('Signed in to the First Chair demo workspace.');
      return;
    }
    if (demoModeEnabled && loginName === BLANK_LOGIN_USERNAME && password === BLANK_LOGIN_PASSWORD) {
      setWorkspaceMode('blank');
      setDemoBypass(true);
      setSelectedConversationId(null);
      setChatMessages([]);
      setLastChatSources([]);
      setStatus('Signed in to a blank First Chair workspace.');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lawFirmDemoLogin', 'true');
        window.localStorage.setItem('firstChairWorkspaceMode', 'blank');
      }
      return;
    }
    if (demoModeEnabled && loginName === TESTER_LOGIN_USERNAME && password === TESTER_LOGIN_PASSWORD) {
      setWorkspaceMode('tester');
      setDemoBypass(true);
      setSelectedConversationId(null);
      setChatMessages([]);
      setLastChatSources([]);
      setCalendarEvents([]);
      setTasks([]);
      setStatus('Signed in to the new tester01 First Chair workspace.');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lawFirmDemoLogin', 'true');
        window.localStorage.setItem('firstChairWorkspaceMode', 'tester');
      }
      return;
    }
    if (!browserSupabase) {
      setStatus('Invalid username or password. Use an authorized First Chair workspace account.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await browserSupabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setWorkspaceMode('demo');
      setDemoBypass(false);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('lawFirmDemoLogin');
        window.localStorage.removeItem('firstChairWorkspaceMode');
      }
      setStatus('Signed in.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (browserSupabase) await browserSupabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('lawFirmDemoLogin');
      window.localStorage.removeItem('firstChairWorkspaceMode');
    }
    setWorkspaceMode('demo');
    setDemoBypass(false);
    setSession(null);
  }

  async function seedDemo() {
    setLoading(true);
    setStatus('Seeding private law-firm workspace...');
    try {
      const json = await apiFetchJson<{ documentCount: number; templateCount: number; instructionCount: number }>('/api/seed', { method: 'POST' });
      setStatus(`Seeded/updated demo workspace without deleting uploads: ${json.templateCount} templates, ${json.documentCount} source documents, and ${json.instructionCount} firm instructions.`);
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(conversationId: string) {
    setLoading(true);
    try {
      const json = await apiFetchJson<{ conversation: ChatConversationRow; messages: ChatMessageRow[] }>(`/api/chat-conversations?id=${conversationId}`);
      if (activeChatUserEmail && (json.conversation.created_by_email || '').toLowerCase() !== activeChatUserEmail) {
        startNewChat();
        setStatus('That chat belongs to a different user profile. Started a new chat for the selected user.');
        return;
      }
      setSelectedConversationId(json.conversation.id);
      setChatMessages(json.messages || []);
      const latestAssistant = [...(json.messages || [])].reverse().find((message) => message.role === 'assistant');
      setLastChatSources(latestAssistant?.sources || []);
      const matter = matters.find((item) => item.id === json.conversation.matter_id);
      if (matter) loadMatterIntoJson(matter);
      setStatus(`Loaded chat: ${json.conversation.title}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not load chat');
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    setSelectedConversationId(null);
    setChatMessages([]);
    setLastChatSources([]);
    setChatInput('');
    setStatus('Started a new chat.');
  }

  async function sendChatMessage() {
    const message = chatInput.trim();
    if (!message && !chatFiles.length) return;
    setLoading(true);
    setChatInput('');
    setLastChatSources([]);
    const attachmentContext = await buildChatAttachmentContext();
    const finalMessage = [message || 'Please review the attached files.', attachmentContext].filter(Boolean).join('\n\n');
    setChatMessages((current) => [...current, { role: 'user', content: finalMessage, created_at: new Date().toISOString() }]);
    try {
      if (blankWorkspace) {
        const localAnswer = `# First Chair response

**Pending Attorney Review**

This is a blank workspace, so I do not have approved firm source files yet. I can still help organize the request in a legal-workflow format.

## Legal focus

- Identify the **claim or requested relief** first.
- Tie every fact to a document, image, exhibit, deadline, or client statement.
- Separate general explanation from attorney-reviewed legal conclusions.

## Next useful step

Upload source files or exhibits in **Source Files**, **Chat**, or **Packet Builder**, then ask me to summarize facts, create a checklist, draft a packet, or prepare an attorney-review outline.

## Your request

${finalMessage}`;
        setChatMessages((current) => [...current, { role: 'assistant', content: localAnswer, sources: [], created_at: new Date().toISOString() }]);
        setChatFiles([]);
        setStatus('Blank workspace response generated locally. Upload source files to build firm-specific knowledge.');
        return;
      }
      const json = await apiFetchJson<{
        answer: string;
        sources: ChatSource[];
        conversationId: string | null;
        messages: ChatMessageRow[];
      }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: finalMessage,
          conversationId: selectedConversationId,
          matterId: selectedMatterId || null,
          matterName,
          chatMode,
          actingUser: activeChatUser ? {
            email: activeChatUser.email,
            displayName: activeChatUser.display_name || activeChatUser.email,
            role: activeChatUser.role,
            practiceArea: activeChatUser.practice_area || 'General',
            chatbotPersona: activeChatUser.chatbot_persona || '',
          } : null,
        }),
      });
      if (json.conversationId) setSelectedConversationId(json.conversationId);
      setChatMessages(json.messages?.length ? json.messages : [
        ...chatMessages,
        { role: 'user', content: finalMessage, created_at: new Date().toISOString() },
        { role: 'assistant', content: json.answer, sources: json.sources, created_at: new Date().toISOString() },
      ]);
      setLastChatSources(json.sources || []);
      setChatFiles([]);
      setStatus(chatMode === 'vault' ? 'Chat answer generated from the approved firm vault.' : 'Chat answer generated with web/general mode enabled.');
      await refreshAll();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Chat failed';
      setChatMessages((current) => [...current, { role: 'assistant', content: `Error: ${errorMessage}`, created_at: new Date().toISOString(), sources: [] }]);
      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function archiveChat(conversationId: string) {
    setLoading(true);
    try {
      await apiFetchJson(`/api/chat-conversations?id=${conversationId}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
      if (selectedConversationId === conversationId) startNewChat();
      await refreshAll();
      setStatus('Chat archived.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not archive chat');
    } finally {
      setLoading(false);
    }
  }

  async function downloadTextExport(content: string, title: string, format: 'docx' | 'pdf') {
    setLoading(true);
    try {
      const res = await fetch('/api/export-answer', {
        method: 'POST',
        headers: makeHeaders(true),
        body: JSON.stringify({ content, title, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || `${title}.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${filename}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      sendChatMessage();
    }
  }

  function handleChatFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;
    setChatFiles((current) => [...current, ...nextFiles]);
    setStatus(`Added ${nextFiles.length} file(s) to this chat. Text files will be summarized directly; PDFs/images are listed for context.`);
  }

  async function buildChatAttachmentContext() {
    if (!chatFiles.length) return '';
    const chunks: string[] = [];
    for (const file of chatFiles) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv')) {
        const text = (await file.text()).slice(0, 18000);
        chunks.push(`ATTACHED FILE: ${file.name}
TYPE: text-readable
CONTENT EXCERPT:
${text}`);
      } else {
        chunks.push(`ATTACHED FILE: ${file.name}
TYPE: ${file.type || 'uploaded file'}
NOTE: File was attached in chat. For full vault search/indexing, also upload it in Source Files.`);
      }
    }
    return ['CHAT ATTACHMENTS:', chunks.join('\n\n---\n\n')].join('\n');
  }

  function removeChatFile(index: number) {
    setChatFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function createFirmUser() {
    setLoading(true);
    try {
      const json = await apiFetchJson<{ user: FirmUserRow }>('/api/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });
      setStatus(`Created/updated user: ${json.user.email} (${json.user.role}).`);
      setUserForm({ ...userForm, email: '', password: '', full_name: '', display_name: '' });
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'User creation failed');
    } finally {
      setLoading(false);
    }
  }

  async function updateFirmUser(userRow: FirmUserRow, fields: Partial<FirmUserRow>) {
    setLoading(true);
    try {
      const payload = {
        user_id: userRow.user_id,
        role: fields.role ?? userRow.role,
        status: fields.status ?? userRow.status,
        display_name: fields.display_name ?? userRow.display_name ?? '',
        practice_area: fields.practice_area ?? userRow.practice_area ?? 'General',
        chatbot_persona: fields.chatbot_persona ?? userRow.chatbot_persona ?? '',
      };
      await apiFetchJson('/api/users', { method: 'PATCH', body: JSON.stringify(payload) });
      setStatus(`Updated user: ${userRow.email}.`);
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'User update failed');
    } finally {
      setLoading(false);
    }
  }

  async function createMatter() {
    setLoading(true);
    try {
      const json = await apiFetchJson<{ matter: MatterRow }>('/api/matters', { method: 'POST', body: JSON.stringify(matterForm) });
      setStatus(`Created matter: ${json.matter.matter_name}`);
      loadMatterIntoJson(json.matter);
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Matter creation failed');
    } finally {
      setLoading(false);
    }
  }

  async function uploadSourceDocument() {
    setLoading(true);
    const filesToUpload = sourceFiles.length ? sourceFiles : sourceFile ? [sourceFile] : [];
    setStatus(filesToUpload.length ? `Uploading and extracting ${filesToUpload.length} source file(s)...` : 'Uploading pasted source document...');
    try {
      const uploadedTitles: string[] = [];
      if (filesToUpload.length) {
        for (const file of filesToUpload) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('title', filesToUpload.length === 1 ? (sourceForm.title || file.name) : file.name);
          formData.append('practice_area', sourceForm.practice_area);
          formData.append('doc_type', sourceForm.doc_type);
          formData.append('source_kind', sourceForm.source_kind);
          formData.append('status', sourceForm.status);
          if (filesToUpload.length === 1 && sourceForm.content.trim()) formData.append('content', sourceForm.content);
          const res = await fetch('/api/source-documents', {
            method: 'POST',
            headers: makeHeaders(false),
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Source upload failed for ${file.name}`);
          uploadedTitles.push((data as { document: SourceDocumentRow }).document.title);
        }
      } else {
        const json = await apiFetchJson<{ document: SourceDocumentRow }>('/api/source-documents', { method: 'POST', body: JSON.stringify(sourceForm) });
        uploadedTitles.push(json.document.title);
      }
      setStatus(`Uploaded ${uploadedTitles.length} source document(s): ${uploadedTitles.join(', ')}. ${sourceForm.status === 'approved' ? 'They are indexed for chat.' : 'Approve them to index for chat.'}`);
      setSourceFile(null);
      setSourceFiles([]);
      setSourceForm({ ...sourceForm, title: '', content: '' });
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Source upload failed');
    } finally {
      setLoading(false);
    }
  }

  async function updateSourceStatus(id: string, statusValue: string) {
    setLoading(true);
    try {
      await apiFetchJson(`/api/source-documents?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status: statusValue }) });
      setStatus(`Source document marked ${statusValue}.`);
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Source update failed');
    } finally {
      setLoading(false);
    }
  }

  async function createInstruction() {
    setLoading(true);
    try {
      const json = await apiFetchJson<{ instruction: InstructionRow }>('/api/firm-instructions', { method: 'POST', body: JSON.stringify(instructionForm) });
      setStatus(`Created firm instruction: ${json.instruction.title}`);
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Instruction creation failed');
    } finally {
      setLoading(false);
    }
  }

  async function createTemplate() {
    setLoading(true);
    try {
      const json = await apiFetchJson<{ template: TemplateRow }>('/api/templates', { method: 'POST', body: JSON.stringify(templateForm) });
      setStatus(`Created template: ${json.template.name}`);
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Template creation failed');
    } finally {
      setLoading(false);
    }
  }

  async function updateTemplateStatus(id: string, statusValue: string) {
    setLoading(true);
    try {
      await apiFetchJson(`/api/templates?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status: statusValue }) });
      setStatus(`Template marked ${statusValue}.`);
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Template update failed');
    } finally {
      setLoading(false);
    }
  }

  async function generateDocument() {
    setLoading(true);
    setOutput('');
    setGeneratedDocumentId(null);
    setMissingFields([]);
    setSourceTitles([]);
    setStatus('Assembling from approved templates, firm instructions, matter data, and approved source documents...');
    try {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(inputJson);
      } catch {
        throw new Error('Matter data must be valid JSON.');
      }
      const json = await apiFetchJson<{
        output: string;
        generatedDocument: GeneratedDocumentRow;
        template: { name: string; version: string };
        missingFields: string[];
        sourceTitles: string[];
      }>('/api/generate-document', {
        method: 'POST',
        body: JSON.stringify({ command, matterName, matterId: selectedMatterId || null, templateKey, inputData: parsedInput }),
      });
      setOutput(json.output || '');
      setGeneratedDocumentId(json.generatedDocument.id);
      setSelectedTemplateName(json.template?.name || 'Unknown template');
      setSelectedTemplateVersion(json.template?.version || '');
      setMissingFields(json.missingFields || []);
      setSourceTitles(json.sourceTitles || []);
      setStatus('Draft generated, saved, and placed in Pending Attorney Review.');
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Document generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function updateGeneratedStatus(id: string, nextStatus: string) {
    setLoading(true);
    try {
      await apiFetchJson(`/api/generated-documents?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      setStatus(`Generated document marked ${nextStatus}.`);
      await refreshAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Review update failed');
    } finally {
      setLoading(false);
    }
  }

  async function downloadDocx(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/generated-document-docx?id=${id}`, { headers: makeHeaders(false) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'DOCX export failed' }));
        throw new Error(data.error || 'DOCX export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || 'generated-document.docx';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${filename}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  }

  function handleFillerFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFillerFile(file);
    setFillerTitle(file.name.replace(/\.[^.]+$/, ''));
    setFillerFields([]);
    setFillerAnswers({});
    setFillerSourceText('');
    setFillerFormType('');
    setFillerIndex(0);
    setStatus(`Selected ${file.name}. Click Analyze document to build the guided questionnaire.`);
  }

  async function analyzeFillerDocument() {
    if (!fillerFile) {
      setStatus('Choose a PDF, DOCX, TXT, MD, or CSV file first.');
      return;
    }
    setLoading(true);
    setStatus('Extracting questions and fields from document...');
    try {
      const formData = new FormData();
      formData.append('file', fillerFile);
      formData.append('title', fillerTitle || fillerFile.name);
      const res = await fetch('/api/document-filler/analyze', {
        method: 'POST',
        headers: makeHeaders(false),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Document analysis failed');
      const json = data as FillerAnalyzeResponse;
      setFillerTitle(json.title || fillerTitle || fillerFile.name);
      setFillerSourceText(json.sourceText || '');
      setFillerFormType(json.formType || 'generic');
      setFillerFields(json.fields || []);
      setFillerAnswers({});
      setFillerIndex(0);
      setStatus(`${json.analysisNote || 'Document analyzed.'} Found ${json.uniqueFieldCount} structured questions/fields. Answer the guided questions below, then export using the original-layout buttons when available.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Document analysis failed');
    } finally {
      setLoading(false);
    }
  }

  function setCurrentFillerAnswer(value: string) {
    if (!currentFillerField) return;
    setFillerAnswers((current) => ({ ...current, [currentFillerField.id]: value }));
  }

  function applyRepeatedFillerAnswers() {
    setFillerAnswers((current) => {
      const next = { ...current };
      for (const field of fillerFields) {
        if (field.repeatedOf && !next[field.id] && next[field.repeatedOf]) next[field.id] = next[field.repeatedOf];
      }
      return next;
    });
  }


  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '');
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  async function downloadFilledDocument(format: 'docx' | 'pdf', exactLayout = false) {
    if (!fillerSourceText || !fillerFields.length) {
      setStatus('Analyze a document and answer at least one question before exporting.');
      return;
    }
    setLoading(true);
    applyRepeatedFillerAnswers();
    try {
      const answers = { ...fillerAnswers };
      for (const field of fillerFields) {
        if (field.repeatedOf && !answers[field.id] && answers[field.repeatedOf]) answers[field.id] = answers[field.repeatedOf];
      }
      const res = await fetch('/api/document-filler/complete', {
        method: 'POST',
        headers: makeHeaders(true),
        body: JSON.stringify({
          title: fillerTitle || 'Filled Document',
          sourceText: fillerSourceText,
          fields: fillerFields,
          answers,
          format,
          exactLayout,
          originalBase64: exactLayout && fillerFile ? await fileToBase64(fillerFile) : undefined,
          originalFilename: fillerFile?.name || fillerTitle,
          originalExtension: fillerFile?.name?.split('.').pop() || '',
          formType: fillerFormType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Filled document export failed' }));
        throw new Error(data.error || 'Filled document export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || `filled-document.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${filename}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Filled document export failed');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickPdfFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setQuickPdfFile(file);
    setStatus(`Selected ${file.name}. Enter a PDF field name or coordinates to replace one value.`);
  }

  async function downloadQuickEditedPdf() {
    if (!quickPdfFile) {
      setStatus('Choose an already-filled PDF first.');
      return;
    }
    if (!quickPdfForm.newValue.trim()) {
      setStatus('Enter the new value to put into the PDF.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/pdf-quick-edit', {
        method: 'POST',
        headers: makeHeaders(true),
        body: JSON.stringify({
          originalBase64: await fileToBase64(quickPdfFile),
          originalFilename: quickPdfFile.name,
          fieldName: quickPdfForm.fieldName,
          newValue: quickPdfForm.newValue,
          pageNumber: Number(quickPdfForm.pageNumber || 1),
          x: Number(quickPdfForm.x || 100),
          yTop: Number(quickPdfForm.yTop || 100),
          width: Number(quickPdfForm.width || 220),
          height: Number(quickPdfForm.height || 18),
          fontSize: Number(quickPdfForm.fontSize || 10),
          whiteOut: quickPdfForm.whiteOut,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'PDF quick edit failed' }));
        throw new Error(data.error || 'PDF quick edit failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || 'edited-document.pdf';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${filename}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'PDF quick edit failed');
    } finally {
      setLoading(false);
    }
  }

  function handleChecklistFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setChecklistFile(file);
    setChecklistTitle(file.name.replace(/\.[^.]+$/, ''));
    setChecklistItems([]);
    setSelectedChecklistIds([]);
    setStatus(`Selected ${file.name}. Click Analyze checklist to extract document request items.`);
  }

  async function analyzeChecklistDocument() {
    if (!checklistFile) {
      setStatus('Choose a checklist file first. PDF, DOCX, TXT, MD, and CSV are supported.');
      return;
    }
    setLoading(true);
    setStatus('Extracting checklist items from uploaded document...');
    try {
      const formData = new FormData();
      formData.append('file', checklistFile);
      formData.append('title', checklistTitle || checklistFile.name);
      const res = await fetch('/api/checklists/analyze', { method: 'POST', headers: makeHeaders(false), body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checklist analysis failed');
      const json = data as ChecklistAnalyzeResponse;
      setChecklistTitle(json.title || checklistTitle || checklistFile.name);
      setChecklistItems(json.items || []);
      setSelectedChecklistIds((json.items || []).map((item) => item.id));
      setStatus(`${json.analysisNote || 'Checklist analyzed.'} Found ${json.items?.length || 0} checklist items.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Checklist analysis failed');
    } finally {
      setLoading(false);
    }
  }

  function toggleChecklistItem(id: string) {
    setSelectedChecklistIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function selectedChecklistItems() {
    return checklistItems.filter((item) => selectedChecklistIds.includes(item.id));
  }

  function sendChecklistRequest() {
    const recipient = firmUsers.find((item) => item.user_id === checklistRecipientUserId);
    const items = selectedChecklistItems();
    if (!checklistClientName.trim()) {
      setStatus('Enter the client name before sending a checklist request.');
      return;
    }
    if (!recipient) {
      setStatus('Choose a website user to receive the checklist request.');
      return;
    }
    if (!items.length) {
      setStatus('Select at least one checklist item to send.');
      return;
    }
    const packet: SentChecklistPacket = {
      id: `${Date.now()}`,
      title: checklistTitle || 'Document checklist request',
      clientName: checklistClientName,
      matterName: checklistMatterName || 'General document collection',
      recipientEmail: recipient.email,
      items,
      message: checklistMessage,
      createdAt: new Date().toISOString(),
    };
    setSentChecklistPackets((current) => [packet, ...current]);
    setStatus(`Checklist request prepared for ${recipient.email}. In this MVP it is saved in the Checklists tab; connect email/client portal later for real delivery.`);
  }

  async function downloadChecklistPacket(format: 'docx' | 'pdf', packet?: SentChecklistPacket) {
    const items = packet?.items || selectedChecklistItems();
    if (!items.length) {
      setStatus('Select at least one checklist item before downloading.');
      return;
    }
    const title = packet?.title || checklistTitle || 'Document checklist request';
    await downloadTextExport(checklistPacketText(packet), title, format);
  }

  function checklistPacketText(packet?: SentChecklistPacket) {
    const recipient = packet?.recipientEmail || firmUsers.find((item) => item.user_id === checklistRecipientUserId)?.email || 'Selected user';
    const items = packet?.items || selectedChecklistItems();
    const title = packet?.title || checklistTitle || 'Document checklist request';
    const clientName = packet?.clientName || checklistClientName || 'Client';
    const matter = packet?.matterName || checklistMatterName || 'Matter';
    const message = packet?.message || checklistMessage;
    const grouped = items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
      const category = item.category || 'Other';
      acc[category] = acc[category] || [];
      acc[category].push(item);
      return acc;
    }, {});
    const sections = Object.entries(grouped).map(([category, categoryItems]) => [
      `## ${category}`,
      '',
      '| Item | Required |',
      '| --- | --- |',
      ...categoryItems.map((item) => `| ${item.text.replace(/\|/g, '/')} | ${item.required ? 'Yes' : 'Optional'} |`),
    ].join('\n')).join('\n\n');
    return `# ${title}\n\n**Status:** Pending document collection\n\n| Field | Details |\n| --- | --- |\n| Client | ${clientName} |\n| Matter | ${matter} |\n| Recipient user | ${recipient} |\n\n## Message to recipient\n\n${message}\n\n## Selected checklist items\n\n${sections || '- No items selected.'}\n\n**Attorney review note:** Review requested items before sending externally.`;
  }

  function updateMandamusField(key: keyof MandamusCase, value: string) {
    setMandamusCase((current) => ({ ...current, [key]: value }));
  }

  function updateMandamusContact(id: string, key: keyof Omit<MandamusContact, 'id'>, value: string) {
    setMandamusContacts((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }

  function addMandamusContact() {
    setMandamusContacts((current) => [...current, { id: `contact-${Date.now()}`, date: '', method: 'USCIS contact', office: 'USCIS', outcome: '' }]);
  }

  function removeMandamusContact(id: string) {
    setMandamusContacts((current) => current.filter((item) => item.id !== id));
  }

  function updateMandamusExhibit(id: string, key: keyof Omit<MandamusExhibit, 'id'>, value: string | boolean) {
    setMandamusExhibits((current) => current.map((item) => {
      if (item.id !== id) return item;
      if (key === 'included') return { ...item, included: Boolean(value) };
      if (key === 'label') return { ...item, label: String(value) };
      return { ...item, title: String(value) };
    }));
  }

  function addMandamusExhibit() {
    const nextLabel = String.fromCharCode(65 + mandamusExhibits.length);
    setMandamusExhibits((current) => [...current, { id: `ex-${Date.now()}`, label: nextLabel, title: 'Additional delay-related printout or correspondence', included: true }]);
  }

  function mandamusDelayMetrics() {
    const filed = mandamusCase.filingDate ? new Date(`${mandamusCase.filingDate}T00:00:00`) : null;
    if (!filed || Number.isNaN(filed.getTime())) {
      return { daysPending: 0, monthsPending: 0, daysBeyond180: 0, demandDate: '' };
    }
    const today = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysPending = Math.max(0, Math.floor((today.getTime() - filed.getTime()) / msPerDay));
    const monthsPending = Math.round((daysPending / 30.4375) * 10) / 10;
    const daysBeyond180 = Math.max(0, daysPending - 180);
    const deadlineDays = Number(mandamusCase.demandDeadlineDays || 30) || 30;
    const demand = new Date(today.getTime() + deadlineDays * msPerDay);
    return { daysPending, monthsPending, daysBeyond180, demandDate: demand.toLocaleDateString() };
  }

  function contactTimelineText() {
    const rows = mandamusContacts.filter((item) => item.method.trim() || item.office.trim() || item.outcome.trim());
    if (!rows.length) return '- No administrative contacts have been entered yet.';
    return rows.map((item) => `- ${item.date || 'Date not entered'}: ${item.method || 'Contact'} with ${item.office || 'agency/office'} — ${item.outcome || 'Outcome not entered'}`).join('\n');
  }

  function exhibitText() {
    const included = mandamusExhibits.filter((item) => item.included);
    if (!included.length) return '- No exhibits selected yet.';
    return included.map((item) => `Exhibit ${item.label}: ${item.title}`).join('\n');
  }

  function buildMandamusDemandLetter() {
    const metrics = mandamusDelayMetrics();
    const monthsText = metrics.daysPending ? `${metrics.monthsPending} months (${metrics.daysPending} days)` : '[number of months/days pending]';
    return `${mandamusCase.petitionerName}\n${mandamusCase.petitionerAddress}\n${mandamusCase.petitionerEmail}\n${mandamusCase.petitionerPhone}\n\n${new Date().toLocaleDateString()}\n\nVia Email: uscis.serviceofprocess@uscis.dhs.gov\n\nOffice of the Chief Counsel\nU.S. Citizenship and Immigration Services\n5900 Capital Gateway Drive, Mail Stop 2120\nCamp Springs, MD 20588-0009\n\nRe: Demand for Adjudication of ${mandamusCase.formType} — Receipt Number ${mandamusCase.receiptNumber}\n\nPENDING ATTORNEY REVIEW\n\nMy ${mandamusCase.formType} has been pending for more than ${monthsText} with no final adjudication.\n\nI am ${mandamusCase.petitionerName}, the petitioner. I filed this petition for ${mandamusCase.beneficiaryName}, my ${mandamusCase.relationship}, on ${mandamusCase.filingDate || '[filing date]'}. The petition is pending with ${mandamusCase.serviceCenter || '[service center]'} under receipt number ${mandamusCase.receiptNumber || '[receipt number]'}. The current public case status is: ${mandamusCase.currentStatus || '[current status]'}. ${mandamusCase.priorAction || ''}\n\nThe delay has caused concrete hardship, including: ${mandamusCase.hardships || '[hardship details to be added]'}.\n\nI have attempted to resolve this matter administratively before seeking judicial relief. Those efforts include:\n${contactTimelineText()}\n\nCongress established a 180-day benchmark for processing immigration benefit applications and defined time in excess of 180 days as backlog. This case has been pending ${metrics.daysPending || '[days pending]'} days, including ${metrics.daysBeyond180 || '[days beyond 180]'} days beyond that benchmark. USCIS's current processing estimate for this case type is ${mandamusCase.currentProcessingTime || '[current USCIS processing-time figure]'}, checked on ${mandamusCase.processingDataDate || '[date checked]'}. The Get Inquiry Date shown by USCIS is ${mandamusCase.getInquiryDate || '[Get Inquiry Date]'}.\n\nUnless USCIS adjudicates this petition within ${mandamusCase.demandDeadlineDays || '30'} days, by ${metrics.demandDate || '[deadline date]'}, I am prepared to file the enclosed Complaint for Writ of Mandamus and Administrative Procedure Act relief in ${mandamusCase.federalDistrict || '[federal district]'}.\n\nRespectfully,\n\n${mandamusCase.petitionerName}\nPetitioner\n\nEnclosure: Complaint for Writ of Mandamus, ${mandamusCase.petitionerName} v. USCIS et al.\n\nAttorney review note: This draft is not legal advice. It should be reviewed by an immigration attorney before sending, filing, or relying on it.`;
  }

  function buildMandamusComplaint() {
    const metrics = mandamusDelayMetrics();
    return `PENDING ATTORNEY REVIEW\n\nIN THE UNITED STATES DISTRICT COURT\nFOR ${mandamusCase.federalDistrict.toUpperCase() || '[FEDERAL DISTRICT]'}\n\n${mandamusCase.petitionerName},\nPlaintiff,\n\nv.\n\nU.S. CITIZENSHIP AND IMMIGRATION SERVICES;\nUNITED STATES ATTORNEY GENERAL, in official capacity;\nDIRECTOR OF U.S. CITIZENSHIP AND IMMIGRATION SERVICES, in official capacity;\nSECRETARY OF HOMELAND SECURITY, in official capacity; and\nUNITED STATES ATTORNEY for the relevant district, in official capacity,\nDefendants.\n\nCase No.: ____________________\n\nCOMPLAINT FOR WRIT OF MANDAMUS AND RELIEF UNDER THE ADMINISTRATIVE PROCEDURE ACT\n\nINTRODUCTION\n\n1. Plaintiff ${mandamusCase.petitionerName} brings this action to compel Defendants to adjudicate a long-pending ${mandamusCase.formType} for ${mandamusCase.beneficiaryName}, Plaintiff's ${mandamusCase.relationship}.\n\n2. The petition was filed on ${mandamusCase.filingDate || '[filing date]'} and remains pending under receipt number ${mandamusCase.receiptNumber || '[receipt number]'}.\n\n3. As of this draft, the petition has been pending approximately ${metrics.daysPending || '[days pending]'} days, or ${metrics.monthsPending || '[months pending]'} months, including approximately ${metrics.daysBeyond180 || '[days beyond 180]'} days beyond Congress's 180-day benchmark for immigration benefit adjudications.\n\nJURISDICTION AND VENUE\n\n4. This Court has jurisdiction under 28 U.S.C. § 1331 because this action arises under federal law.\n\n5. This Court has mandamus jurisdiction under 28 U.S.C. § 1361 to compel federal officers or employees to perform duties owed to Plaintiff.\n\n6. This Court may compel agency action unlawfully withheld or unreasonably delayed under the Administrative Procedure Act, 5 U.S.C. § 706(1).\n\n7. Venue is proper under 28 U.S.C. § 1391(e) because Plaintiff resides in this district and Defendants are federal agencies/officers sued in official capacity.\n\nPARTIES\n\n8. Plaintiff ${mandamusCase.petitionerName} resides at ${mandamusCase.petitionerAddress || '[address]'}. Plaintiff is a ${mandamusCase.petitionerStatus || '[U.S. citizen or lawful permanent resident]'}.\n\n9. Beneficiary ${mandamusCase.beneficiaryName} is a citizen of ${mandamusCase.beneficiaryCitizenship || '[country]'} and currently resides in ${mandamusCase.beneficiaryResidence || '[country]'} .\n\n10. Defendant USCIS is the agency responsible for adjudicating the petition.\n\n11. The remaining Defendants are sued in their official capacities only. Current officeholders and service addresses should be verified before filing.\n\nFACTUAL BACKGROUND\n\nA. The Petition\n\n12. Plaintiff filed ${mandamusCase.formType} on ${mandamusCase.filingDate || '[filing date]'} for ${mandamusCase.beneficiaryName}.\n\n13. USCIS assigned receipt number ${mandamusCase.receiptNumber || '[receipt number]'}.\n\n14. The petition is pending with ${mandamusCase.serviceCenter || '[service center]'} and the current reported status is: ${mandamusCase.currentStatus || '[status]'}.\n\n15. Processing path: ${mandamusCase.processingPath || '[consular processing or adjustment of status]'}. ${mandamusCase.embassyOrFieldOffice ? `Relevant embassy/field office: ${mandamusCase.embassyOrFieldOffice}.` : ''}\n\nB. Processing Times and Congressional Benchmark\n\n16. Congress expressed that immigration benefit applications should be completed not later than 180 days after filing and defined backlog as time in excess of 180 days.\n\n17. Plaintiff's petition has been pending approximately ${metrics.daysPending || '[days pending]'} days, including ${metrics.daysBeyond180 || '[days beyond 180]'} days beyond the 180-day benchmark.\n\n18. USCIS current processing data entered for this case: ${mandamusCase.currentProcessingTime || '[80% processing-time figure]'}, checked on ${mandamusCase.processingDataDate || '[date checked]'}.\n\n19. USCIS Get Inquiry Date entered for this case: ${mandamusCase.getInquiryDate || '[Get Inquiry Date]'}.\n\nC. Exhaustion of Administrative Remedies\n\n20. Plaintiff attempted to obtain agency action before filing suit. Relevant contacts include:\n${contactTimelineText()}\n\nD. Harm Caused by Delay\n\n21. The delay has caused harm including: ${mandamusCase.hardships || '[specific hardship facts]'}.\n\nLEGAL BASIS FOR RELIEF\n\n22. USCIS has a nondiscretionary duty to adjudicate properly filed immigration benefit petitions.\n\n23. The Administrative Procedure Act authorizes this Court to compel agency action unlawfully withheld or unreasonably delayed.\n\n24. Under the TRAC factors, the delay is unreasonable because it exceeds Congress's 180-day benchmark, affects human welfare and family unity, prejudices Plaintiff and Beneficiary, and has persisted despite administrative attempts to obtain action.\n\n25. Plaintiff does not ask the Court to order a particular outcome on the petition. Plaintiff asks only that USCIS be compelled to adjudicate.\n\nRELIEF REQUESTED\n\nWHEREFORE, Plaintiff respectfully asks this Court to:\n\nA. Declare that Defendants have unreasonably delayed adjudication of the petition;\nB. Issue a writ of mandamus or order under the APA compelling adjudication within a reasonable deadline, such as 30 days;\nC. Award costs and any other relief the Court deems just and proper.\n\nVERIFICATION\n\nI, ${mandamusCase.petitionerName}, declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge.\n\nDate: ____________________\n\nSignature: ______________________________\n${mandamusCase.petitionerName}\nPlaintiff, Pro Se\n${mandamusCase.petitionerAddress}\n${mandamusCase.petitionerEmail}\n${mandamusCase.petitionerPhone}\n\nEXHIBIT LIST\n\n${exhibitText()}\n\nAttorney review note: This draft is not legal advice. It should be reviewed by an immigration attorney before filing.`;
  }

  function buildMandamusExhibitList() {
    return `PENDING ATTORNEY REVIEW\n\nMANDAMUS EXHIBIT LIST\n\nCase: ${mandamusCase.petitionerName} / ${mandamusCase.beneficiaryName}\nReceipt Number: ${mandamusCase.receiptNumber}\n\n${exhibitText()}\n\nExhibit guidance:\n- Use delay-related records, not merits documents.\n- Prefer professional labels like "USCIS case status printout" rather than "screenshot."\n- Do not include marriage certificates or identity documents unless an attorney specifically decides they are relevant to a delay issue.\n- Verify every exhibit exists before listing it in a complaint.`;
  }

  function buildMandamusFilingChecklist() {
    return `PENDING ATTORNEY REVIEW\n\nMANDAMUS FILING AND SERVICE CHECKLIST\n\nClient/Petitioner: ${mandamusCase.petitionerName}\nBeneficiary: ${mandamusCase.beneficiaryName}\nReceipt Number: ${mandamusCase.receiptNumber}\n\nFiling packet:\n- Complaint for Writ of Mandamus and APA relief\n- Exhibits supporting delay and exhaustion\n- Civil Cover Sheet (JS-44)\n- Summons forms (AO-440) for each defendant\n- Filing fee or fee-waiver paperwork\n\nService packet:\n- Serve the U.S. Attorney's Office for the petitioner's district\n- Serve the U.S. Attorney General in Washington, DC\n- Serve USCIS and the named federal officials/officers\n- Email USCIS service-of-process address as a supplemental notice\n\nBefore filing:\n- Verify current officeholders and addresses\n- Verify local district court requirements\n- Confirm exhibits are delay-related\n- Confirm all facts, dates, receipt numbers, and processing-time data\n- Attorney review completed\n\nThis checklist is not legal advice. Service and filing requirements should be confirmed by an attorney before filing.`;
  }

  function generateMandamusDraft(kind: 'demand' | 'complaint' | 'exhibits' | 'checklist') {
    const titleMap = {
      demand: 'USCIS Mandamus Demand Letter',
      complaint: 'Complaint for Writ of Mandamus',
      exhibits: 'Mandamus Exhibit List',
      checklist: 'Mandamus Filing and Service Checklist',
    };
    const contentMap = {
      demand: buildMandamusDemandLetter,
      complaint: buildMandamusComplaint,
      exhibits: buildMandamusExhibitList,
      checklist: buildMandamusFilingChecklist,
    };
    const content = contentMap[kind]();
    setMandamusDraftTitle(titleMap[kind]);
    setMandamusDraft(content);
    setStatus(`${titleMap[kind]} generated. Review before exporting.`);
  }

  async function downloadMandamusDraft(format: 'docx' | 'pdf') {
    if (!mandamusDraft.trim()) {
      setStatus('Generate a mandamus document first.');
      return;
    }
    await downloadTextExport(mandamusDraft, mandamusDraftTitle, format);
  }

  async function handleSourceFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;
    setSourceFiles(nextFiles);
    setSourceFile(nextFiles[0] || null);
    setSourceForm((current) => ({ ...current, title: nextFiles.length === 1 ? (current.title || nextFiles[0].name) : `${nextFiles.length} uploaded source files` }));
    const first = nextFiles[0];
    const lower = first.name.toLowerCase();
    if (nextFiles.length === 1 && (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv'))) {
      const text = await first.text();
      setSourceForm((current) => ({ ...current, content: text }));
    } else {
      setSourceForm((current) => ({ ...current, content: nextFiles.length > 1 ? '' : current.content }));
    }
    setStatus(`Selected ${nextFiles.length} file(s). PDF/DOCX text will be extracted on the server when you click Upload.`);
  }

  async function handleSourceFile(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) return;
    await handleSourceFiles(event.target.files);
  }

  function handleSourceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.files?.length) void handleSourceFiles(event.dataTransfer.files);
  }

  function selectCalendarDate(dateKey: string) {
    if (!dateKey) return;
    setSelectedCalendarDate(dateKey);
    setCalendarMonth(monthKeyFromDateKey(dateKey));
    setCalendarForm((current) => ({ ...current, date: dateKey }));
  }

  function addCalendarEvent() {
    if (!calendarForm.title.trim()) {
      setStatus('Enter an event title first.');
      return;
    }
    const eventDate = calendarForm.date || selectedCalendarDate || todayDateKey();
    const eventItem: CalendarEventItem = { id: `event-${Date.now()}`, ...calendarForm, date: eventDate };
    setCalendarEvents((current) => [eventItem, ...current].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
    setSelectedCalendarDate(eventDate);
    setCalendarMonth(monthKeyFromDateKey(eventDate));
    setCalendarForm({ title: '', date: eventDate, time: '', reminder: '1 day before', notes: '' });
    setStatus('Calendar event added to the month calendar. Browser/local reminders are saved in this workspace view.');
  }

  function removeCalendarEvent(id: string) {
    setCalendarEvents((current) => current.filter((item) => item.id !== id));
  }

  function addTask() {
    if (!taskForm.title.trim()) {
      setStatus('Enter a task title first.');
      return;
    }
    const taskItem: TaskItem = { id: `task-${Date.now()}`, title: taskForm.title, dueDate: taskForm.dueDate, reminder: taskForm.reminder, status: 'open', notes: taskForm.notes };
    setTasks((current) => [taskItem, ...current]);
    setTaskForm({ title: '', dueDate: '', reminder: '1 day before', notes: '' });
    setStatus('Task added.');
  }

  function updateTaskStatus(id: string, statusValue: 'open' | 'done') {
    setTasks((current) => current.map((item) => item.id === id ? { ...item, status: statusValue } : item));
  }

  function removeTask(id: string) {
    setTasks((current) => current.filter((item) => item.id !== id));
  }

  const familyPacketOptions = ['Parenting time motion packet', 'Custody modification packet', 'Child support modification packet', 'Emergency motion packet', 'Response / objection packet', 'Proposed order packet'];
  const immigrationPacketOptions = ['Adjustment of status packet', 'Family petition packet', 'Mandamus / delay packet', 'Waiver support packet', 'Administrative closure packet', 'U visa support packet'];

  function packetOptionsForPractice() {
    return packetPractice === 'Family Law' ? familyPacketOptions : immigrationPacketOptions;
  }

  function autoCategoryFromFileName(fileName: string) {
    const lower = fileName.toLowerCase();
    if (/message|text|email|chat|letter/.test(lower)) return 'Communications';
    if (/order|judgment|court|motion|pleading/.test(lower)) return 'Court record';
    if (/pay|income|bank|tax|support|money|expense/.test(lower)) return 'Financial record';
    if (/school|medical|doctor|therapy|police|cps/.test(lower)) return 'Third-party record';
    if (/photo|image|png|jpg|jpeg|heic/.test(lower)) return 'Photo / image exhibit';
    return 'General exhibit';
  }

  function suggestedExhibitTitle(fileName: string) {
    return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || fileName;
  }

  function handlePacketExhibitFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;
    setPacketExhibits((current) => [
      ...current,
      ...nextFiles.map((file, index) => {
        const label = String.fromCharCode(65 + current.length + index);
        return {
          id: `packet-ex-${Date.now()}-${index}`,
          label,
          fileName: file.name,
          title: suggestedExhibitTitle(file.name),
          category: autoCategoryFromFileName(file.name),
          facts: `Review this exhibit for facts supporting: ${packetClaimDescription || 'the requested claim/relief'}.`,
          included: true,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        };
      }),
    ]);
    setStatus(`Added ${nextFiles.length} exhibit file(s). First Chair assigned exhibit labels and draft categories; review them before generating.`);
  }

  function updatePacketExhibit(id: string, fields: Partial<PacketExhibit>) {
    setPacketExhibits((current) => current.map((item) => item.id === id ? { ...item, ...fields } : item));
  }

  function removePacketExhibit(id: string) {
    setPacketExhibits((current) => current.filter((item) => item.id !== id).map((item, index) => ({ ...item, label: String.fromCharCode(65 + index) })));
  }

  function buildPacketDraft() {
    const included = packetExhibits.filter((item) => item.included);
    const exhibitRows = included.map((item, index) => `| ${index + 1} | Exhibit ${item.label} | ${item.title.replace(/\|/g, '/')} | ${item.category} | ${item.fileName.replace(/\|/g, '/')} |`).join('\n');
    const facts = included.map((item, index) => `${index + 1}. **Exhibit ${item.label} — ${item.title}:** ${item.facts || `This exhibit should be reviewed for facts supporting ${packetClaimDescription || 'the requested relief'}.`}`).join('\n');
    const toc = included.map((item, index) => `| ${index + 1} | Exhibit ${item.label}: ${item.title.replace(/\|/g, '/')} | Page ${index + 3} |`).join('\n');
    const title = `${packetClaimType} Packet - ${packetTemplate}`;
    return `# ${title}\n\n**Status:** Pending Attorney Review\n\n**Brand:** First Chair\n\n| Field | Details |\n| --- | --- |\n| Practice area | ${packetPractice} |\n| Packet template | ${packetTemplate} |\n| Claim / filing type | ${packetClaimType} |\n| Claim description | ${packetClaimDescription || '[Describe the requested relief]'} |\n| Exhibits included | ${included.length} |\n\n## 1. Draft ${packetClaimType}\n\n### Requested relief\n\n${packetClaimDescription || '[Describe exactly what the client wants the Court or agency to order.]'}\n\n### Preliminary position\n\nThe attached packet is drafted around the requested claim and the selected exhibits. The final filing should be reviewed by counsel for jurisdiction, court rules, evidentiary objections, formatting, service, and local caption requirements.\n\n## 2. Statement of Facts / Historical Timeline\n\n${facts || '1. [No exhibits have been selected yet. Upload images or documents and describe what each exhibit proves.]'}\n\n## 3. IRAC Argument\n\n| IRAC Element | Draft Content |\n| --- | --- |\n| **Issue** | Whether the Court or decision-maker should grant the requested ${packetClaimType.toLowerCase()} based on the facts and exhibits in this packet. |\n| **Rule** | Insert the controlling statutes, court rules, case law, burden of proof, and local practice requirements for this claim. First Chair can help organize the argument, but counsel must verify the law. |\n| **Application** | Apply each exhibit to the requested relief. The strongest facts are the ones tied directly to records, communications, orders, financial evidence, medical/school records, or other concrete documents. |\n| **Conclusion** | For these reasons, the packet should request focused relief that solves the problem described in the claim while remaining supported by the exhibit record. |\n\n## 4. Table of Contents / Exhibit Pagination\n\nThis table should appear after the motion/response/reply and before the first exhibit. Update page numbers after final PDF pagination.\n\n| No. | Exhibit | Starting Page |\n| --- | --- | --- |\n${toc || '| 1 | [No exhibit selected] | Page ___ |'}\n\n## 5. Exhibit Index\n\n| No. | Label | Title | Category | Source File |\n| --- | --- | --- | --- | --- |\n${exhibitRows || '| 1 | Exhibit A | [Upload exhibit] | [Category] | [File] |'}\n\n## 6. AI-Generated Proposed Order\n\n### Case Caption\n\n[COURT NAME]\n\n[PARTY NAME],\nPetitioner/Plaintiff,\n\nv.\n\n[PARTY NAME],\nRespondent/Defendant.\n\nCase No.: ____________________\n\n# ORDER\n\nThe Court, having reviewed the ${packetClaimType.toLowerCase()}, the record, and the attached exhibits, and being otherwise fully advised, orders as follows:\n\n1. The requested relief is **granted / denied / granted in part** as follows: [insert proposed solution].\n2. The parties shall comply with the deadlines, conditions, parenting-time terms, payment terms, document-production requirements, or other obligations stated by the Court.\n3. Any prior order inconsistent with this Order is modified only to the extent stated here.\n4. This Order resolves the specific relief requested in this packet and does not decide any issue not properly before the Court.\n\nDate: ____________________\n\n__________________________________\nJudge\n\n## Attorney Review Note\n\nThis packet is an AI-generated drafting aid, not legal advice. Verify the law, facts, exhibits, page numbers, captions, signatures, court rules, service rules, and filing requirements before use.`;
  }

  function generatePacketDraft() {
    const content = buildPacketDraft();
    const title = `${packetClaimType} Packet - ${packetTemplate}`;
    setPacketDraftTitle(title);
    setPacketDraft(content);
    setStatus('Packet draft generated with motion/claim, statement of facts, IRAC argument, table of contents, exhibit index, and proposed order.');
  }

  async function downloadPacketDraft(format: 'docx' | 'pdf') {
    if (!packetDraft.trim()) {
      setStatus('Generate a packet draft first.');
      return;
    }
    await downloadTextExport(packetDraft, packetDraftTitle, format);
  }

  function loadMatterIntoJson(matter: MatterRow) {
    setSelectedMatterId(matter.id);
    setMatterName(matter.matter_name);
    const next = {
      ...DEFAULT_INPUT_DATA,
      client_name: matter.clients?.name || DEFAULT_INPUT_DATA.client_name,
      client_contact_name: matter.clients?.contact_name || DEFAULT_INPUT_DATA.client_contact_name,
      matter_name: matter.matter_name,
      matter_type: matter.matter_type,
      matter_description: matter.description || matter.matter_type,
      requested_deadline: matter.deadline || DEFAULT_INPUT_DATA.requested_deadline,
      assigned_attorney: matter.responsible_attorney || '',
      client_goals: String(matter.metadata?.client_goals || DEFAULT_INPUT_DATA.client_goals),
    };
    setInputJson(JSON.stringify(next, null, 2));
  }

  if (!authenticated) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="login-brand-row">
            <img className="login-logo-img" src="/first-chair-logo.png" alt="First Chair logo" />
            <div>
              <div className="section-label">Secure law-firm workspace</div>
              <h1 className="login-title">First Chair</h1>
            </div>
          </div>
          <p className="subtle">Sign in to access the private AI chatbot, document vault, packet builder, calendar, tasks, checklists, and PDF filler.</p>
          <label className="small">Username or email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter username or email" autoComplete="username" />
          <label className="small">Password</label>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') signIn(); }} />
          <div className="btn-row">
            <button onClick={signIn} disabled={loading}>Sign in</button>
          </div>
          {status && <div className="status">{status}</div>}
          <p className="footer-note">Authorized First Chair workspace users only.</p>
        </section>
        <aside className="login-preview-card">
          <div className="preview-window-bar"><span /> <span /> <span /></div>
          <h2>Private AI workspace</h2>
          <div className="preview-chat-bubble assistant-message">Upload source files, ask firm-specific questions, and export polished legal drafts.</div>
          <div className="preview-chat-bubble user-message">Create a motion packet with exhibits and a proposed order.</div>
          <div className="preview-feature-grid">
            <div><b>Vault Chat</b><span>Firm-only knowledge</span></div>
            <div><b>Document Filler</b><span>PDF/DOCX workflows</span></div>
            <div><b>Checklists</b><span>Client requests</span></div>
            <div><b>Packet Builder</b><span>Motion packets + exhibits</span></div>
          </div>
        </aside>
      </main>
    );
  }

  const navItems: [string, string][] = [
    ['chat', 'Chat'],
    ['filler', 'Document Filler'],
    ['checklists', 'Checklists'],
    ['packet', 'Packet Builder'],
    ['calendar', 'Calendar'],
    ['tasks', 'Tasks'],
    ['sources', 'Source Files'],
    ...(canManageUsers ? ([['users', 'Users']] as [string, string][]) : []),
    ['audit', 'Audit'],
  ];
  const activeTabName = navItems.find(([key]) => key === activeTab)?.[1] || 'Workspace';

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img className="sidebar-logo-img" src="/first-chair-logo.png" alt="First Chair logo" />
          <div>
            <div className="sidebar-title">First Chair</div>
            <div className="sidebar-subtitle">Private AI workspace</div>
          </div>
        </div>
        <button className="sidebar-new" onClick={() => { setActiveTab('chat'); startNewChat(); }} disabled={loading}>＋ New chat</button>
        <nav className="sidebar-nav">
          {navItems.map(([key, label]) => (
            <button key={key} className={activeTab === key ? 'sidebar-link active' : 'sidebar-link'} onClick={() => setActiveTab(key)}>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-user-card">
          <div className="avatar">{(me?.user?.displayName || me?.user?.email || 'D').slice(0, 1).toUpperCase()}</div>
          <div>
            <b>{me?.user?.displayName || me?.user?.email || (demoBypass ? 'Demo User' : 'Firm User')}</b>
            <span>{me?.firm?.name || 'Example Law Firm'}</span>
          </div>
        </div>
        <div className="sidebar-actions">
          <button className="secondary mini" onClick={refreshAll} disabled={loading}>Refresh</button>
          <button className="secondary mini" onClick={signOut} disabled={loading}>Sign out</button>
        </div>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div>
            <div className="section-label">First Chair legal workspace</div>
            <h1>{activeTabName}</h1>
            <p className="subtle">Law-centered AI workspace for firm chat, packets, exhibits, source files, document filling, deadlines, tasks, and general legal-support answers.</p>
          </div>
          <div className="topbar-pills">
            <span className="pill">Role: {me?.user?.role || 'demo owner'}</span>
            <span className="pill">Practice: {me?.user?.practiceArea || 'General'}</span>
          </div>
        </header>

        {status && <div className="status">{status}</div>}

        <div className="app-content">

      {activeTab === 'chat' && (
        <section className="chat-layout">
          <aside className="card chat-sidebar">
            <div className="section-label">Chat controls</div>
            <h2>First Chair legal chatbot</h2>
            <p className="subtle small">Choose whether the assistant should stay inside the approved vault, combine vault + web, or answer general web-enabled questions.</p>
            <label className="small">Answer mode</label>
            <select value={chatMode} onChange={(event) => setChatMode(event.target.value as 'vault' | 'vault_web' | 'general_web')}>
              <option value="vault">Vault only - approved firm data</option>
              <option value="vault_web">Vault + web - firm data first</option>
              <option value="general_web">General web - broad questions</option>
            </select>
            <p className="footer-note">Use Vault only for confidential firm work. Use Vault + web for public background or current law/government pages. Use General web for non-firm questions.</p>
            <label className="small">Change user</label>
            <select value={selectedChatUserId} onChange={(event) => { setSelectedChatUserId(event.target.value); startNewChat(); }}>
              <option value="">Current signed-in user</option>
              {firmUsers.map((firmUser) => (
                <option key={firmUser.user_id} value={firmUser.user_id}>
                  {(firmUser.display_name || firmUser.email)} - {firmUser.role}{firmUser.practice_area ? ` / ${firmUser.practice_area}` : ''}
                </option>
              ))}
            </select>
            <p className="footer-note">This changes how the chatbot answers: attorney, paralegal, intake, viewer, or any custom user persona set in the Users tab.</p>
            <div className="btn-row dense">
              <button onClick={startNewChat} disabled={loading}>New chat</button>
              <button className="secondary" onClick={refreshAll} disabled={loading}>Refresh chats</button>
            </div>
            <h2 className="spaced">Recent chats</h2>
            <div className="list compact-list">
              {visibleChatConversations.length === 0 && <div className="item small subtle">No saved chats for this user yet.</div>}
              {visibleChatConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={conversation.id === selectedConversationId ? 'conversation active-conversation' : 'conversation'}
                  onClick={() => loadConversation(conversation.id)}
                  disabled={loading}
                >
                  <span title={conversationLabel(conversation)}>{conversationLabel(conversation)}</span>
                  <small>{formatDate(conversation.updated_at)}</small>
                </button>
              ))}
            </div>
            <h2 className="spaced">Vault inventory</h2>
            <div className="metric-grid single-col">
              <div className="metric"><b>{sourceDocs.filter((item) => item.status === 'approved').length}</b><span>approved source files</span></div>
            </div>
          </aside>

          <section className="card chat-card">
            <div className="chat-card-header">
              <div>
                <div className="section-label">Ask the firm vault</div>
                <h2>{selectedConversation?.title || 'New firm chat'}</h2>
              </div>
              {selectedConversationId && <button className="secondary mini" onClick={() => archiveChat(selectedConversationId)} disabled={loading}>Archive</button>}
            </div>
            <div className="chat-window" ref={chatWindowRef}>
              {chatMessages.length === 0 && (
                <div className="empty-chat">
                  <h2>Ask about the firm vault, or switch modes for web/general questions.</h2>
                  <p>Examples: “What does our vendor agreement checklist require?”, “What are current USCIS filing fees?” in Vault + web mode, or “Explain what a motion in limine is” in General web mode.</p>
                </div>
              )}
              {chatMessages.map((message, index) => (
                <div key={message.id || `${message.role}-${index}`} className={message.role === 'user' ? 'chat-message user-message' : 'chat-message assistant-message'}>
                  <div className="chat-role">{message.role === 'user' ? 'You' : 'First Chair AI'}</div>
                  <div className="chat-content"><LegalMarkdownPreview content={message.content} emptyText="" compact chat /></div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="source-chips">
                      {message.sources.slice(0, 6).map((source) => <span className="badge" key={`${source.type}-${source.id}`}>{source.title}</span>)}
                    </div>
                  )}
                  {message.role === 'assistant' && !message.content.startsWith('Error:') && (
                    <div className="btn-row dense export-row">
                      <button className="secondary mini" onClick={() => downloadTextExport(message.content, selectedConversation?.title || 'Chat Answer', 'docx')} disabled={loading}>Send as DOCX</button>
                      <button className="secondary mini" onClick={() => downloadTextExport(message.content, selectedConversation?.title || 'Chat Answer', 'pdf')} disabled={loading}>Send as PDF</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {lastChatSources.length > 0 && <p className="footer-note">Last answer sources: {lastChatSources.map((source) => source.title).join(', ')}</p>}
            <div
              className="dropzone chat-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); handleChatFiles(event.dataTransfer.files); }}
            >
              <b>Drag & drop files into chat</b>
              <span>Upload multiple TXT/MD/CSV/PDF/DOCX/images. Text files are included in the prompt; other files are listed and can also be indexed in Source Files.</span>
              <input type="file" multiple accept=".txt,.md,.markdown,.csv,.pdf,.docx,.png,.jpg,.jpeg,.webp,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={(event) => { if (event.target.files) handleChatFiles(event.target.files); }} />
              {chatFiles.length > 0 && <div className="file-chip-row">{chatFiles.map((file, index) => <button className="file-chip" key={`${file.name}-${index}`} onClick={() => removeChatFile(index)} type="button">{file.name} ×</button>)}</div>}
            </div>
            <div className="chat-composer">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder={chatMode === 'vault' ? 'Ask based on approved firm data...' : chatMode === 'vault_web' ? 'Ask using firm data plus web when useful...' : 'Ask a general or current-events question...'}
              />
              <button onClick={sendChatMessage} disabled={loading || (!chatInput.trim() && !chatFiles.length)}>Send</button>
            </div>
            <p className="footer-note">Tip: press Ctrl+Enter or Cmd+Enter to send. Web/general answers are not firm-approved legal advice.</p>
          </section>
        </section>
      )}

      {activeTab === 'generate' && (
        <section className="grid">
          <div className="card wide-card">
            <div className="section-label">Controlled document assembly</div>
            <h2>Generate a saved draft from approved firm materials</h2>
            <label className="small">Matter</label>
            <select value={selectedMatterId} onChange={(event) => {
              const matter = matters.find((item) => item.id === event.target.value);
              if (matter) loadMatterIntoJson(matter);
              else setSelectedMatterId('');
            }}>
              <option value="">No matter selected</option>
              {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.matter_name}</option>)}
            </select>
            <label className="small">Matter name fallback</label>
            <input value={matterName} onChange={(event) => setMatterName(event.target.value)} />
            <label className="small">Template</label>
            <select value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>
              <option value="auto">Auto-detect best approved template</option>
              {templates.filter((template) => template.status === 'approved').map((template) => (
                <option key={template.id} value={template.template_key}>{template.name} v{template.version}</option>
              ))}
            </select>
            {selectedTemplate && <p className="footer-note">Required fields: {(selectedTemplate.required_fields || []).join(', ') || 'None'}</p>}
            <label className="small">Command</label>
            <textarea value={command} onChange={(event) => setCommand(event.target.value)} />
            <label className="small">Structured matter/client data JSON</label>
            <textarea className="json-box" value={inputJson} onChange={(event) => setInputJson(event.target.value)} />
            <div className="btn-row">
              <button onClick={generateDocument} disabled={loading}>Generate + save draft</button>
              {generatedDocumentId && <button className="secondary" onClick={() => downloadDocx(generatedDocumentId)} disabled={loading}>Download DOCX</button>}
            </div>
            {selectedTemplateName && <p className="footer-note">Selected template: {selectedTemplateName} {selectedTemplateVersion && `(v${selectedTemplateVersion})`}</p>}
            {missingFields.length > 0 && <div className="warning">Missing required fields left as placeholders: {missingFields.join(', ')}</div>}
            <h2 className="spaced">Generated draft</h2>
            <LegalMarkdownPreview content={output} emptyText="Generated documents will appear here." />
            {sourceTitles.length > 0 && <p className="footer-note">Sources used: {sourceTitles.join(', ')}</p>}
          </div>

          <aside className="card">
            <div className="section-label">Current vault status</div>
            <h2>Workspace inventory</h2>
            <div className="metric-grid">
              <div className="metric"><b>{templates.filter((item) => item.status === 'approved').length}</b><span>approved templates</span></div>
              <div className="metric"><b>{sourceDocs.filter((item) => item.status === 'approved').length}</b><span>approved source files</span></div>
              <div className="metric"><b>{instructions.filter((item) => item.status === 'active').length}</b><span>active rules</span></div>
              <div className="metric"><b>{generatedDocuments.filter((item) => item.status === 'pending_attorney_review').length}</b><span>pending review</span></div>
            </div>
            <h2 className="spaced">Recent drafts</h2>
            <div className="list compact-list">
              {generatedDocuments.slice(0, 5).map((doc) => (
                <div className="item" key={doc.id}>
                  <div className="item-title">{doc.draft_type}</div>
                  <span className="badge">{doc.status}</span>
                  <div className="small subtle">{doc.matter_name}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'filler' && (
        <section className="grid">
          <div className="card wide-card">
            <div className="section-label">Automatic document filler</div>
            <h2>Upload a PDF or Word form and answer its questions</h2>
            <p className="subtle small">Upload a PDF, DOCX, TXT, MD, or CSV. The app asks form-aware questions, reuses repeated answers, and can export either a review packet or the original-layout file. For PDFs like USCIS I-130, the output keeps the same pages and overlays answers onto the original form where fields are mapped. For DOCX, original-layout export works best with placeholder fields such as {"{{petitioner_family_name}"}.</p>
            <label className="small">Document file</label>
            <input type="file" accept=".pdf,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*" onChange={handleFillerFile} />
            <label className="small">Output title</label>
            <input value={fillerTitle} onChange={(event) => setFillerTitle(event.target.value)} placeholder="U Visa Questionnaire - Client Name" />
            <div className="btn-row dense">
              <button onClick={analyzeFillerDocument} disabled={loading || !fillerFile}>Analyze document</button>
              <button className="secondary" onClick={() => { setFillerFile(null); setFillerTitle(''); setFillerSourceText(''); setFillerFormType(''); setFillerFields([]); setFillerAnswers({}); setFillerIndex(0); }} disabled={loading}>Reset filler</button>
            </div>

            <div className="divider" />
            <div className="section-label">Quick PDF variable editor</div>
            <h3>Change one value in an already-filled PDF</h3>
            <p className="subtle small">Use this when a PDF is already filled and you only need to change one value. If the PDF has fillable fields, enter the PDF field name. If it is a flat PDF, enter the page and top-left coordinates; the app can cover the old value and write the new one while keeping the same PDF layout.</p>
            <label className="small">Already-filled PDF</label>
            <input type="file" accept=".pdf,application/pdf" onChange={handleQuickPdfFile} />
            {quickPdfFile && <div className="small subtle">Selected: {quickPdfFile.name} ({Math.round(quickPdfFile.size / 1024)} KB)</div>}
            <label className="small">PDF field name, if known</label>
            <input value={quickPdfForm.fieldName} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, fieldName: event.target.value })} placeholder="Optional, example: petitioner_family_name" />
            <label className="small">New value</label>
            <input value={quickPdfForm.newValue} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, newValue: event.target.value })} placeholder="Enter the corrected value" />
            <div className="two-col">
              <div><label className="small">Page number</label><input value={quickPdfForm.pageNumber} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, pageNumber: event.target.value })} /></div>
              <div><label className="small">Font size</label><input value={quickPdfForm.fontSize} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, fontSize: event.target.value })} /></div>
            </div>
            <div className="four-col">
              <div><label className="small">X from left</label><input value={quickPdfForm.x} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, x: event.target.value })} /></div>
              <div><label className="small">Y from top</label><input value={quickPdfForm.yTop} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, yTop: event.target.value })} /></div>
              <div><label className="small">Cover width</label><input value={quickPdfForm.width} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, width: event.target.value })} /></div>
              <div><label className="small">Cover height</label><input value={quickPdfForm.height} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, height: event.target.value })} /></div>
            </div>
            <label className="checkline"><input type="checkbox" checked={quickPdfForm.whiteOut} onChange={(event) => setQuickPdfForm({ ...quickPdfForm, whiteOut: event.target.checked })} /> Cover the old value before writing the new one</label>
            <button className="secondary" onClick={downloadQuickEditedPdf} disabled={loading || !quickPdfFile}>Download edited same-layout PDF</button>
            {fillerFields.length > 0 && (
              <div className="question-card">
                <div className="section-label">Question {Math.min(fillerIndex + 1, uniqueFillerFields.length)} of {uniqueFillerFields.length}</div>
                {currentFillerField ? (
                  <>
                    <p className="small subtle">{currentFillerField.section || 'Document'}{currentFillerField.itemNumber ? ` • Item ${currentFillerField.itemNumber}` : ''}{currentFillerField.conditionalKey ? ' • conditional question' : ''}</p>
                    <h3>{currentFillerField.label}</h3>
                    {currentFillerField.helpText && <p className="small subtle">{currentFillerField.helpText}</p>}
                    {(currentFillerField.answerType === 'yes_no' || currentFillerField.answerType === 'single_select') && currentFillerField.options?.length ? (
                      <select value={fillerAnswers[currentFillerField.id] || ''} onChange={(event) => setCurrentFillerAnswer(event.target.value)}>
                        <option value="">Select an answer...</option>
                        {currentFillerField.options.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : currentFillerField.answerType === 'date' || currentFillerField.answerType === 'number' ? (
                      <input value={fillerAnswers[currentFillerField.id] || ''} onChange={(event) => setCurrentFillerAnswer(event.target.value)} placeholder={currentFillerField.answerType === 'date' ? 'mm/dd/yyyy' : 'Enter a number'} />
                    ) : (
                      <textarea value={fillerAnswers[currentFillerField.id] || ''} onChange={(event) => setCurrentFillerAnswer(event.target.value)} placeholder="Enter the real answer for this question/field..." />
                    )}
                    <div className="btn-row dense">
                      <button className="secondary" onClick={() => setFillerIndex(Math.max(0, fillerIndex - 1))} disabled={loading || fillerIndex === 0}>Previous</button>
                      <button onClick={() => setFillerIndex(Math.min(uniqueFillerFields.length - 1, fillerIndex + 1))} disabled={loading || fillerIndex >= uniqueFillerFields.length - 1}>Next</button>
                      <button className="secondary" onClick={() => setCurrentFillerAnswer('[Not applicable]')} disabled={loading}>Mark N/A</button>
                    </div>
                  </>
                ) : <p className="subtle">All unique questions are loaded. Export when ready.</p>}
                <p className="footer-note">Answered {answeredFillerCount} of {uniqueFillerFields.length}. Repeated fields are automatically reused when possible.</p>
              </div>
            )}
          </div>
          <div className="card">
            <div className="section-label">Fill status</div>
            <h2>Export filled document</h2>
            <div className="metric-grid single-col">
              <div className="metric"><b>{uniqueFillerFields.length}</b><span>unique questions</span></div>
              <div className="metric"><b>{fillerFields.filter((field) => field.repeatedOf).length}</b><span>repeated fields skipped</span></div>
              <div className="metric"><b>{answeredFillerCount}</b><span>answered</span></div>
            </div>
            <div className="btn-row dense">
              <button onClick={() => downloadFilledDocument('pdf', true)} disabled={loading || !fillerFields.length || !fillerFile || !fillerFile.name.toLowerCase().endsWith('.pdf')}>Download same-layout PDF</button>
              <button onClick={() => downloadFilledDocument('docx', true)} disabled={loading || !fillerFields.length || !fillerFile || !fillerFile.name.toLowerCase().endsWith('.docx')}>Download same-layout DOCX</button>
              <button className="secondary" onClick={() => downloadFilledDocument('docx', false)} disabled={loading || !fillerFields.length}>Review packet DOCX</button>
              <button className="secondary" onClick={() => downloadFilledDocument('pdf', false)} disabled={loading || !fillerFields.length}>Review packet PDF</button>
            </div>
            <p className="footer-note">Same-layout exports keep the original uploaded file as the base. PDF output fills AcroForm fields when present and uses a curated overlay for I-130-style flat PDFs. DOCX same-layout output preserves the Word file and replaces placeholder fields such as {"{{field_id}"} when present.</p>
            {fillerFields.length > 0 && (
              <div className="list compact-list">
                {uniqueFillerFields.slice(0, 12).map((field) => (
                  <div className="item" key={field.id}>
                    <div className="item-title">{field.section ? `${field.section}: ` : ''}{field.label}</div>
                    <p className="small preview">{field.helpText || 'No guidance note.'}</p>
                    <p className="small preview">{fillerAnswers[field.id] || 'Not answered yet'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'matters' && (
        <section className="grid">
          <div className="card">
            <div className="section-label">Matter workspace</div>
            <h2>Create client + matter</h2>
            {Object.entries(matterForm).map(([key, value]) => (
              <div key={key}>
                <label className="small">{key}</label>
                <input value={String(value)} onChange={(event) => setMatterForm((current) => ({ ...current, [key]: event.target.value }))} />
              </div>
            ))}
            <button onClick={createMatter} disabled={loading}>Create matter</button>
          </div>
          <div className="card">
            <div className="section-label">Existing matters</div>
            <h2>Matters</h2>
            <div className="list">
              {matters.map((matter) => (
                <div className="item" key={matter.id}>
                  <div className="item-title">{matter.matter_name}</div>
                  <span className="badge">{matter.status}</span>
                  <span className="badge">{matter.matter_type}</span>
                  <div className="small subtle">Client: {matter.clients?.name || 'Unknown'}</div>
                  <div className="small subtle">Deadline: {matter.deadline || 'None'}</div>
                  <button className="secondary mini" onClick={() => loadMatterIntoJson(matter)}>Use in chat/generation</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'checklists' && (
        <section className="grid">
          <div className="card">
            <div className="section-label">Client document checklist</div>
            <h2>Upload checklist + choose request items</h2>
            <p className="subtle small">Upload a checklist PDF/DOCX/TXT, extract document request items, categorize them by client/matter, and prepare a selected-item request for a website user.</p>
            <label className="small">Checklist file</label>
            <input type="file" accept=".txt,.md,.markdown,.csv,.pdf,.docx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleChecklistFile} />
            {checklistFile && <div className="small subtle">Selected: {checklistFile.name} ({Math.round(checklistFile.size / 1024)} KB)</div>}
            <label className="small">Checklist title</label>
            <input value={checklistTitle} onChange={(event) => setChecklistTitle(event.target.value)} />
            <div className="two-col">
              <div><label className="small">Client</label><input value={checklistClientName} onChange={(event) => setChecklistClientName(event.target.value)} placeholder="Client name" /></div>
              <div><label className="small">Matter / case</label><input value={checklistMatterName} onChange={(event) => setChecklistMatterName(event.target.value)} placeholder="Matter or case name" /></div>
            </div>
            <button onClick={analyzeChecklistDocument} disabled={loading || !checklistFile}>Analyze checklist</button>

            {checklistItems.length > 0 && (
              <>
                <div className="btn-row dense">
                  <button className="secondary mini" onClick={() => setSelectedChecklistIds(checklistItems.map((item) => item.id))}>Select all</button>
                  <button className="secondary mini" onClick={() => setSelectedChecklistIds([])}>Clear all</button>
                </div>
                <div className="list compact-list">
                  {Object.entries(checklistItems.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
                    const category = item.category || 'Other';
                    acc[category] = acc[category] || [];
                    acc[category].push(item);
                    return acc;
                  }, {})).map(([category, items]) => (
                    <div className="item" key={category}>
                      <div className="item-title">{category}</div>
                      {items.map((item) => (
                        <label className="checkline checklist-line" key={item.id}>
                          <input type="checkbox" checked={selectedChecklistIds.includes(item.id)} onChange={() => toggleChecklistItem(item.id)} />
                          <span>{item.text}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="section-label">Send selected checklist items</div>
            <h2>Prepare request for website user</h2>
            <label className="small">Send to user</label>
            <select value={checklistRecipientUserId} onChange={(event) => setChecklistRecipientUserId(event.target.value)}>
              <option value="">Choose a user...</option>
              {firmUsers.map((firmUser) => (
                <option key={firmUser.user_id} value={firmUser.user_id}>{firmUser.display_name || firmUser.email} - {firmUser.role}</option>
              ))}
            </select>
            <label className="small">Message</label>
            <textarea value={checklistMessage} onChange={(event) => setChecklistMessage(event.target.value)} />
            <div className="metric-grid single-col">
              <div className="metric"><b>{selectedChecklistItems().length}</b><span>selected items</span></div>
              <div className="metric"><b>{new Set(selectedChecklistItems().map((item) => item.category)).size}</b><span>categories</span></div>
            </div>
            <div className="btn-row dense">
              <button onClick={sendChecklistRequest} disabled={loading || !selectedChecklistItems().length}>Prepare/send request</button>
              <button className="secondary" onClick={() => downloadChecklistPacket('docx')} disabled={loading || !selectedChecklistItems().length}>Download DOCX</button>
              <button className="secondary" onClick={() => downloadChecklistPacket('pdf')} disabled={loading || !selectedChecklistItems().length}>Download PDF</button>
            </div>
            <p className="footer-note">This MVP prepares and records the request in the app. To truly send externally, connect email, SMS, or a client portal later.</p>

            <h2 className="spaced">Prepared checklist requests</h2>
            <div className="list compact-list">
              {sentChecklistPackets.length === 0 && <div className="item small subtle">No checklist requests prepared yet.</div>}
              {sentChecklistPackets.map((packet) => (
                <div className="item" key={packet.id}>
                  <div className="item-title">{packet.clientName} - {packet.matterName}</div>
                  <p className="small subtle">To: {packet.recipientEmail} • {formatDate(packet.createdAt)}</p>
                  <p className="small preview">{packet.items.length} items selected</p>
                  <div className="btn-row dense">
                    <button className="secondary mini" onClick={() => downloadChecklistPacket('docx', packet)}>DOCX</button>
                    <button className="secondary mini" onClick={() => downloadChecklistPacket('pdf', packet)}>PDF</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}



      {activeTab === 'calendar' && (
        <section className="calendar-workspace">
          <div className="calendar-main card">
            <div className="calendar-toolbar">
              <div>
                <div className="section-label">30-day month calendar</div>
                <h2>{calendarMonthTitle}</h2>
                <p className="subtle small">Click any day to create hearings, filing deadlines, calls, reminders, and case events directly on the calendar.</p>
              </div>
              <div className="btn-row dense calendar-nav-row">
                <button className="secondary mini" onClick={() => setCalendarMonth((current) => shiftMonthKey(current, -1))}>Previous</button>
                <button className="secondary mini" onClick={() => { const today = todayDateKey(); setCalendarMonth(monthKeyFromDateKey(today)); selectCalendarDate(today); }}>Today</button>
                <button className="secondary mini" onClick={() => setCalendarMonth((current) => shiftMonthKey(current, 1))}>Next</button>
              </div>
            </div>

            <div className="month-calendar" role="grid" aria-label={`${calendarMonthTitle} calendar`}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => <div className="calendar-weekday" key={dayName}>{dayName}</div>)}
              {calendarCells.map((cell) => {
                const dayEvents = cell.dateKey ? (calendarEventsByDate[cell.dateKey] || []) : [];
                const isSelected = cell.dateKey === selectedCalendarDate;
                const isToday = cell.dateKey === todayDateKey();
                return (
                  <button
                    type="button"
                    key={cell.key}
                    className={`calendar-day ${cell.inMonth ? '' : 'calendar-day-blank'} ${isSelected ? 'calendar-day-selected' : ''} ${isToday ? 'calendar-day-today' : ''}`}
                    onClick={() => cell.dateKey && selectCalendarDate(cell.dateKey)}
                    disabled={!cell.inMonth}
                  >
                    {cell.inMonth && <span className="calendar-day-number">{cell.day}</span>}
                    <div className="calendar-day-events">
                      {dayEvents.slice(0, 3).map((item) => <span className="calendar-event-pill" key={item.id}>{item.time ? `${item.time} ` : ''}{item.title}</span>)}
                      {dayEvents.length > 3 && <span className="calendar-more">+{dayEvents.length - 3} more</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-side">
            <div className="card">
              <div className="section-label">Create event</div>
              <h2>{shortDate(selectedCalendarDate)}</h2>
              <p className="subtle small">Selected date: <b>{selectedCalendarDate}</b></p>
              <label className="small">Event title</label><input value={calendarForm.title} onChange={(event) => setCalendarForm({ ...calendarForm, title: event.target.value })} placeholder="Hearing, filing deadline, client call..." />
              <div className="two-col">
                <div><label className="small">Date</label><input type="date" value={calendarForm.date} onChange={(event) => { const value = event.target.value; setCalendarForm({ ...calendarForm, date: value }); if (value) selectCalendarDate(value); }} /></div>
                <div><label className="small">Time</label><input type="time" value={calendarForm.time} onChange={(event) => setCalendarForm({ ...calendarForm, time: event.target.value })} /></div>
              </div>
              <label className="small">Reminder</label><select value={calendarForm.reminder} onChange={(event) => setCalendarForm({ ...calendarForm, reminder: event.target.value })}><option>At time of event</option><option>30 minutes before</option><option>1 hour before</option><option>1 day before</option><option>1 week before</option></select>
              <label className="small">Notes</label><textarea value={calendarForm.notes} onChange={(event) => setCalendarForm({ ...calendarForm, notes: event.target.value })} placeholder="Call notes, filing instructions, Zoom link, assigned staff..." />
              <button onClick={addCalendarEvent} disabled={loading}>Add event to calendar</button>
            </div>

            <div className="card">
              <div className="section-label">Selected day</div>
              <h2>Events on {shortDate(selectedCalendarDate)}</h2>
              <div className="list calendar-event-list">
                {selectedCalendarEvents.length === 0 && <div className="item small subtle">No events on this day yet.</div>}
                {selectedCalendarEvents.map((item) => (
                  <div className="item" key={item.id}>
                    <div className="item-title">{item.title}</div>
                    <span className="badge">{item.time || 'No time'}</span>
                    <span className="badge">Reminder: {item.reminder}</span>
                    {item.notes && <p className="small preview">{item.notes}</p>}
                    <button className="secondary mini" onClick={() => removeCalendarEvent(item.id)}>Remove</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-label">Upcoming</div>
              <h2>Next events</h2>
              <div className="list calendar-event-list">
                {upcomingCalendarEvents.length === 0 && <div className="item small subtle">No upcoming events yet.</div>}
                {upcomingCalendarEvents.map((item) => (
                  <div className="item" key={item.id}>
                    <div className="item-title">{item.title}</div>
                    <span className="badge">{item.date || 'No date'} {item.time || ''}</span>
                    {item.notes && <p className="small preview">{item.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      )}



      {activeTab === 'tasks' && (
        <section className="grid">
          <div className="card">
            <div className="section-label">Tasks</div>
            <h2>Add task + reminder</h2>
            <p className="subtle small">Create internal work items for attorneys, paralegals, intake, filings, exhibit prep, document collection, and follow-up reminders.</p>
            <label className="small">Task</label><input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="Review exhibits, call client, file response..." />
            <div className="two-col">
              <div><label className="small">Due date</label><input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></div>
              <div><label className="small">Reminder</label><select value={taskForm.reminder} onChange={(event) => setTaskForm({ ...taskForm, reminder: event.target.value })}><option>At due date</option><option>1 day before</option><option>3 days before</option><option>1 week before</option></select></div>
            </div>
            <label className="small">Notes</label><textarea value={taskForm.notes} onChange={(event) => setTaskForm({ ...taskForm, notes: event.target.value })} />
            <button onClick={addTask} disabled={loading}>Add task</button>
          </div>
          <div className="card">
            <div className="section-label">Work queue</div>
            <h2>Tasks</h2>
            <div className="metric-grid">
              <div className="metric"><b>{tasks.filter((item) => item.status === 'open').length}</b><span>open</span></div>
              <div className="metric"><b>{tasks.filter((item) => item.status === 'done').length}</b><span>done</span></div>
            </div>
            <div className="list spaced">
              {tasks.length === 0 && <div className="item small subtle">No tasks yet.</div>}
              {tasks.map((item) => (
                <div className="item" key={item.id}>
                  <div className="item-title">{item.title}</div>
                  <span className="badge">{item.status}</span>
                  <span className="badge">Due: {item.dueDate || 'No due date'}</span>
                  <span className="badge">Reminder: {item.reminder}</span>
                  {item.notes && <p className="small preview">{item.notes}</p>}
                  <div className="btn-row dense">
                    <button className="secondary mini" onClick={() => updateTaskStatus(item.id, item.status === 'done' ? 'open' : 'done')}>{item.status === 'done' ? 'Reopen' : 'Mark done'}</button>
                    <button className="secondary mini" onClick={() => removeTask(item.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'packet' && (
        <section className="grid">
          <div className="card wide-card">
            <div className="section-label">Packet Builder</div>
            <h2>Build a motion / response packet from exhibits</h2>
            <p className="subtle small">Choose a packet template, upload multiple images/documents as exhibits, describe the claim, and generate a structured packet with statement of facts, IRAC argument, table of contents, exhibit index, pagination notes, and proposed order.</p>
            <div className="two-col">
              <div><label className="small">Practice area</label><select value={packetPractice} onChange={(event) => { const next = event.target.value as 'Family Law' | 'Immigration Law'; setPacketPractice(next); setPacketTemplate(next === 'Family Law' ? familyPacketOptions[0] : immigrationPacketOptions[0]); }}><option>Family Law</option><option>Immigration Law</option></select></div>
              <div><label className="small">Packet template</label><select value={packetTemplate} onChange={(event) => setPacketTemplate(event.target.value)}>{packetOptionsForPractice().map((option) => <option key={option}>{option}</option>)}</select></div>
            </div>
            <div className="two-col">
              <div><label className="small">Claim / filing type</label><select value={packetClaimType} onChange={(event) => setPacketClaimType(event.target.value)}><option>Motion</option><option>Oppositional Response</option><option>Reply</option><option>Surreply</option><option>Proposed Order</option></select></div>
              <div><label className="small">Short requested relief</label><input value={packetClaimDescription} onChange={(event) => setPacketClaimDescription(event.target.value)} placeholder="Example: Terminate father's supervised parenting time" /></div>
            </div>
            <label className="small">Exhibits / images</label>
            <div className="dropzone packet-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handlePacketExhibitFiles(event.dataTransfer.files); }}>
              <b>Drag & drop multiple exhibit images/files</b>
              <span>First Chair auto-labels Exhibit A, B, C and suggests categories. You can manually correct titles, categories, and fact notes.</span>
              <input type="file" multiple accept="image/*,.pdf,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { if (event.target.files) handlePacketExhibitFiles(event.target.files); }} />
            </div>
            <div className="list spaced">
              {packetExhibits.length === 0 && <div className="item small subtle">No exhibits uploaded yet.</div>}
              {packetExhibits.map((exhibit) => (
                <div className="item exhibit-editor" key={exhibit.id}>
                  <label className="checkline"><input type="checkbox" checked={exhibit.included} onChange={(event) => updatePacketExhibit(exhibit.id, { included: event.target.checked })} /> Include Exhibit {exhibit.label}</label>
                  {exhibit.previewUrl && <img className="exhibit-thumb" src={exhibit.previewUrl} alt={exhibit.fileName} />}
                  <div className="two-col">
                    <div><label className="small">Exhibit label</label><input value={exhibit.label} onChange={(event) => updatePacketExhibit(exhibit.id, { label: event.target.value })} /></div>
                    <div><label className="small">Category</label><input value={exhibit.category} onChange={(event) => updatePacketExhibit(exhibit.id, { category: event.target.value })} /></div>
                  </div>
                  <label className="small">Exhibit title</label><input value={exhibit.title} onChange={(event) => updatePacketExhibit(exhibit.id, { title: event.target.value })} />
                  <label className="small">What this exhibit proves / key facts</label><textarea value={exhibit.facts} onChange={(event) => updatePacketExhibit(exhibit.id, { facts: event.target.value })} />
                  <p className="footer-note">Source file: {exhibit.fileName}</p>
                  <button className="secondary mini" onClick={() => removePacketExhibit(exhibit.id)}>Remove exhibit</button>
                </div>
              ))}
            </div>
            <div className="btn-row">
              <button onClick={generatePacketDraft} disabled={loading}>Generate packet draft</button>
              <button className="secondary" onClick={() => downloadPacketDraft('docx')} disabled={loading || !packetDraft.trim()}>Download DOCX</button>
              <button className="secondary" onClick={() => downloadPacketDraft('pdf')} disabled={loading || !packetDraft.trim()}>Download PDF</button>
            </div>
          </div>
          <aside className="card">
            <div className="section-label">Generated packet</div>
            <h2>{packetDraftTitle}</h2>
            <div className="metric-grid single-col">
              <div className="metric"><b>{packetExhibits.filter((item) => item.included).length}</b><span>included exhibits</span></div>
              <div className="metric"><b>{packetPractice}</b><span>practice area</span></div>
            </div>
            <LegalMarkdownPreview content={packetDraft} emptyText="Generated packet will appear here after you choose a template, upload exhibits, describe the claim, and click Generate." compact />
          </aside>
        </section>
      )}

      {activeTab === 'mandamus' && (
        <section className="grid">
          <div className="card wide-card">
            <div className="section-label">USCIS delay / mandamus workflow</div>
            <h2>Mandamus Builder</h2>
            <p className="subtle small">Build a structured demand letter, mandamus complaint, exhibit list, and filing checklist for delayed USCIS petitions. This workflow collects facts first, calculates the 180-day delay benchmark, and labels every draft Pending Attorney Review.</p>

            <div className="divider" />
            <h2>1. Case information</h2>
            <div className="two-col">
              <div><label className="small">Petitioner's full name</label><input value={mandamusCase.petitionerName} onChange={(event) => updateMandamusField('petitionerName', event.target.value)} /></div>
              <div><label className="small">Beneficiary's full name</label><input value={mandamusCase.beneficiaryName} onChange={(event) => updateMandamusField('beneficiaryName', event.target.value)} /></div>
              <div><label className="small">Petitioner's email</label><input value={mandamusCase.petitionerEmail} onChange={(event) => updateMandamusField('petitionerEmail', event.target.value)} /></div>
              <div><label className="small">Petitioner's phone</label><input value={mandamusCase.petitionerPhone} onChange={(event) => updateMandamusField('petitionerPhone', event.target.value)} /></div>
            </div>
            <label className="small">Petitioner's full address</label>
            <input value={mandamusCase.petitionerAddress} onChange={(event) => updateMandamusField('petitionerAddress', event.target.value)} />
            <div className="two-col">
              <div><label className="small">Relationship</label><input value={mandamusCase.relationship} onChange={(event) => updateMandamusField('relationship', event.target.value)} placeholder="Spouse, parent, child..." /></div>
              <div><label className="small">Petitioner status</label><select value={mandamusCase.petitionerStatus} onChange={(event) => updateMandamusField('petitionerStatus', event.target.value)}><option>U.S. citizen</option><option>Lawful permanent resident</option></select></div>
              <div><label className="small">Beneficiary citizenship</label><input value={mandamusCase.beneficiaryCitizenship} onChange={(event) => updateMandamusField('beneficiaryCitizenship', event.target.value)} /></div>
              <div><label className="small">Beneficiary current residence</label><input value={mandamusCase.beneficiaryResidence} onChange={(event) => updateMandamusField('beneficiaryResidence', event.target.value)} /></div>
            </div>

            <div className="divider" />
            <h2>2. Petition and processing data</h2>
            <div className="two-col">
              <div><label className="small">Form / petition type</label><input value={mandamusCase.formType} onChange={(event) => updateMandamusField('formType', event.target.value)} /></div>
              <div><label className="small">Receipt number</label><input value={mandamusCase.receiptNumber} onChange={(event) => updateMandamusField('receiptNumber', event.target.value)} /></div>
              <div><label className="small">Filing date</label><input type="date" value={mandamusCase.filingDate} onChange={(event) => updateMandamusField('filingDate', event.target.value)} /></div>
              <div><label className="small">Service center / field office</label><input value={mandamusCase.serviceCenter} onChange={(event) => updateMandamusField('serviceCenter', event.target.value)} /></div>
              <div><label className="small">Processing path</label><select value={mandamusCase.processingPath} onChange={(event) => updateMandamusField('processingPath', event.target.value)}><option>Consular processing</option><option>Adjustment of status</option><option>Other / unsure</option></select></div>
              <div><label className="small">Embassy, consulate, or field office</label><input value={mandamusCase.embassyOrFieldOffice} onChange={(event) => updateMandamusField('embassyOrFieldOffice', event.target.value)} /></div>
            </div>
            <label className="small">Current USCIS case status</label>
            <input value={mandamusCase.currentStatus} onChange={(event) => updateMandamusField('currentStatus', event.target.value)} />
            <label className="small">Has USCIS taken any action? RFE, interview, transfer, etc.</label>
            <textarea value={mandamusCase.priorAction} onChange={(event) => updateMandamusField('priorAction', event.target.value)} />
            <div className="two-col">
              <div><label className="small">Current USCIS 80% processing time</label><input value={mandamusCase.currentProcessingTime} onChange={(event) => updateMandamusField('currentProcessingTime', event.target.value)} placeholder="Example: 16.5 months" /></div>
              <div><label className="small">Get Inquiry Date result</label><input value={mandamusCase.getInquiryDate} onChange={(event) => updateMandamusField('getInquiryDate', event.target.value)} placeholder="Date shown by USCIS" /></div>
              <div><label className="small">Date processing data checked</label><input type="date" value={mandamusCase.processingDataDate} onChange={(event) => updateMandamusField('processingDataDate', event.target.value)} /></div>
              <div><label className="small">Federal district / venue</label><input value={mandamusCase.federalDistrict} onChange={(event) => updateMandamusField('federalDistrict', event.target.value)} /></div>
            </div>
            <p className="footer-note">The workflow intentionally asks you to enter processing-time figures and Get Inquiry Date data instead of inventing them. Check USCIS before finalizing drafts.</p>

            <div className="divider" />
            <h2>3. Hardship and exhaustion</h2>
            <label className="small">Hardship caused by the delay</label>
            <textarea value={mandamusCase.hardships} onChange={(event) => updateMandamusField('hardships', event.target.value)} placeholder="Family separation, financial costs, medical impact, emotional distress, children, employment impact..." />
            <h3>Administrative contacts</h3>
            <div className="list compact-list">
              {mandamusContacts.map((contact) => (
                <div className="item" key={contact.id}>
                  <div className="two-col">
                    <div><label className="small">Date</label><input type="date" value={contact.date} onChange={(event) => updateMandamusContact(contact.id, 'date', event.target.value)} /></div>
                    <div><label className="small">Method</label><input value={contact.method} onChange={(event) => updateMandamusContact(contact.id, 'method', event.target.value)} /></div>
                    <div><label className="small">Office / person contacted</label><input value={contact.office} onChange={(event) => updateMandamusContact(contact.id, 'office', event.target.value)} /></div>
                    <div><label className="small">Outcome</label><input value={contact.outcome} onChange={(event) => updateMandamusContact(contact.id, 'outcome', event.target.value)} /></div>
                  </div>
                  <button className="secondary mini" onClick={() => removeMandamusContact(contact.id)}>Remove contact</button>
                </div>
              ))}
            </div>
            <button className="secondary" onClick={addMandamusContact}>Add contact attempt</button>

            <div className="divider" />
            <h2>4. Exhibits</h2>
            <p className="subtle small">Use delay-focused exhibits, such as receipt notices, case-status printouts, processing-time printouts, USCIS contact records, congressional correspondence, and Ombudsman/Get Inquiry Date records. Avoid merits documents unless an attorney specifically decides they are needed.</p>
            <div className="list compact-list">
              {mandamusExhibits.map((exhibit) => (
                <div className="item" key={exhibit.id}>
                  <label className="checkline"><input type="checkbox" checked={exhibit.included} onChange={(event) => updateMandamusExhibit(exhibit.id, 'included', event.target.checked)} /> Include Exhibit {exhibit.label}</label>
                  <div className="two-col">
                    <div><label className="small">Label</label><input value={exhibit.label} onChange={(event) => updateMandamusExhibit(exhibit.id, 'label', event.target.value)} /></div>
                    <div><label className="small">Title</label><input value={exhibit.title} onChange={(event) => updateMandamusExhibit(exhibit.id, 'title', event.target.value)} /></div>
                  </div>
                </div>
              ))}
            </div>
            <button className="secondary" onClick={addMandamusExhibit}>Add exhibit</button>
          </div>

          <aside className="card">
            <div className="section-label">Draft output</div>
            <h2>Generate mandamus documents</h2>
            <div className="metric-grid single-col">
              <div className="metric"><b>{mandamusDelayMetrics().daysPending || '—'}</b><span>days pending</span></div>
              <div className="metric"><b>{mandamusDelayMetrics().daysBeyond180 || '—'}</b><span>days beyond 180</span></div>
              <div className="metric"><b>{mandamusContacts.length}</b><span>contact attempts entered</span></div>
            </div>
            <label className="small">Demand deadline days</label>
            <input value={mandamusCase.demandDeadlineDays} onChange={(event) => updateMandamusField('demandDeadlineDays', event.target.value)} />
            <div className="btn-row dense">
              <button onClick={() => generateMandamusDraft('demand')}>Demand Letter</button>
              <button onClick={() => generateMandamusDraft('complaint')}>Complaint</button>
              <button className="secondary" onClick={() => generateMandamusDraft('exhibits')}>Exhibit List</button>
              <button className="secondary" onClick={() => generateMandamusDraft('checklist')}>Filing Checklist</button>
            </div>
            <div className="btn-row dense">
              <button className="secondary" onClick={() => downloadMandamusDraft('docx')} disabled={loading || !mandamusDraft.trim()}>Download DOCX</button>
              <button className="secondary" onClick={() => downloadMandamusDraft('pdf')} disabled={loading || !mandamusDraft.trim()}>Download PDF</button>
            </div>
            <p className="footer-note">Every generated document is marked Pending Attorney Review. Verify current officials, current processing-time numbers, venue, service requirements, and exhibits before using.</p>
            <h2 className="spaced">Preview</h2>
            <LegalMarkdownPreview content={mandamusDraft} emptyText="Generated demand letters, complaints, exhibit lists, and filing checklists will appear here." compact />
          </aside>
        </section>
      )}

      {activeTab === 'sources' && (
        <section className="grid">
          <div className="card">
            <div className="section-label">Source document vault</div>
            <h2>Upload / paste firm material</h2>
            <p className="subtle small">Upload TXT, MD, CSV, PDF, or DOCX, or paste text below. Apple Pages files should be exported to DOCX/PDF first. Approve a source before the chatbot can use it.</p>
            <label className="small">Files</label>
            <div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleSourceDrop}>
              <b>Drag & drop source files here</b>
              <span>Upload multiple TXT, MD, CSV, PDF, or DOCX files at the same time.</span>
              <input type="file" multiple accept=".txt,.md,.markdown,.csv,.pdf,.docx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleSourceFile} />
            </div>
            {(sourceFiles.length > 0 || sourceFile) && <div className="file-chip-row">{(sourceFiles.length ? sourceFiles : sourceFile ? [sourceFile] : []).map((file, index) => <span className="pill" key={`${file.name}-${index}`}>{file.name} ({Math.round(file.size / 1024)} KB)</span>)}</div>}
            <label className="small">Title</label><input value={sourceForm.title} onChange={(event) => setSourceForm({ ...sourceForm, title: event.target.value })} />
            <div className="two-col">
              <div><label className="small">Practice area</label><input value={sourceForm.practice_area} onChange={(event) => setSourceForm({ ...sourceForm, practice_area: event.target.value })} /></div>
              <div><label className="small">Doc type</label><input value={sourceForm.doc_type} onChange={(event) => setSourceForm({ ...sourceForm, doc_type: event.target.value })} /></div>
            </div>
            <label className="small">Status</label><select value={sourceForm.status} onChange={(event) => setSourceForm({ ...sourceForm, status: event.target.value })}><option>needs_review</option><option>approved</option><option>do_not_use</option></select>
            <label className="small">Content</label><textarea className="json-box" value={sourceForm.content} onChange={(event) => setSourceForm({ ...sourceForm, content: event.target.value })} />
            <button onClick={uploadSourceDocument} disabled={loading}>Upload + index source document</button>
          </div>
          <div className="card">
            <div className="section-label">Indexed source files</div>
            <h2>Source documents</h2>
            <div className="list">
              {sourceDocs.map((doc) => (
                <div className="item" key={doc.id}>
                  <div className="item-title">{doc.title}</div>
                  <span className="badge">{doc.status}</span>
                  <span className="badge">{doc.doc_type}</span>
                  <p className="small preview">{preview(doc.content)}</p>
                  <div className="btn-row dense">
                    <button className="secondary mini" onClick={() => updateSourceStatus(doc.id, 'approved')} disabled={loading}>Approve</button>
                    <button className="secondary mini" onClick={() => updateSourceStatus(doc.id, 'needs_review')} disabled={loading}>Needs review</button>
                    <button className="secondary mini" onClick={() => updateSourceStatus(doc.id, 'do_not_use')} disabled={loading}>Disable</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'templates' && (
        <section className="grid">
          <div className="card">
            <div className="section-label">Template vault</div>
            <h2>Add template</h2>
            <label className="small">Name</label><input value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} />
            <label className="small">Template key</label><input value={templateForm.template_key} onChange={(event) => setTemplateForm({ ...templateForm, template_key: event.target.value })} />
            <div className="two-col">
              <div><label className="small">Practice area</label><input value={templateForm.practice_area} onChange={(event) => setTemplateForm({ ...templateForm, practice_area: event.target.value })} /></div>
              <div><label className="small">Doc type</label><input value={templateForm.doc_type} onChange={(event) => setTemplateForm({ ...templateForm, doc_type: event.target.value })} /></div>
            </div>
            <div className="two-col">
              <div><label className="small">Jurisdiction</label><input value={templateForm.jurisdiction} onChange={(event) => setTemplateForm({ ...templateForm, jurisdiction: event.target.value })} /></div>
              <div><label className="small">Status</label><select value={templateForm.status} onChange={(event) => setTemplateForm({ ...templateForm, status: event.target.value })}><option>draft</option><option>approved</option><option>needs_review</option><option>do_not_use</option></select></div>
            </div>
            <label className="small">Required fields, comma-separated</label><input value={templateForm.required_fields} onChange={(event) => setTemplateForm({ ...templateForm, required_fields: event.target.value })} />
            <label className="small">Optional fields, comma-separated</label><input value={templateForm.optional_fields} onChange={(event) => setTemplateForm({ ...templateForm, optional_fields: event.target.value })} />
            <label className="small">Template body</label><textarea className="json-box" value={templateForm.body_markdown} onChange={(event) => setTemplateForm({ ...templateForm, body_markdown: event.target.value })} />
            <button onClick={createTemplate} disabled={loading}>Create template</button>
          </div>
          <div className="card">
            <div className="section-label">Approved and pending templates</div>
            <h2>Templates</h2>
            <div className="list">
              {templates.map((template) => (
                <div className="item" key={template.id}>
                  <div className="item-title">{template.name}</div>
                  <span className="badge">{template.status}</span>
                  <span className="badge">{template.doc_type}</span>
                  <span className="badge">v{template.version}</span>
                  <div className="small code">{template.template_key}</div>
                  <p className="small preview">{preview(template.body_markdown)}</p>
                  <div className="btn-row dense">
                    <button className="secondary mini" onClick={() => updateTemplateStatus(template.id, 'approved')} disabled={loading}>Approve</button>
                    <button className="secondary mini" onClick={() => updateTemplateStatus(template.id, 'needs_review')} disabled={loading}>Needs review</button>
                    <button className="secondary mini" onClick={() => updateTemplateStatus(template.id, 'do_not_use')} disabled={loading}>Disable</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'instructions' && (
        <section className="grid">
          <div className="card">
            <div className="section-label">Firm behavior layer</div>
            <h2>Add firm instruction</h2>
            <label className="small">Title</label><input value={instructionForm.title} onChange={(event) => setInstructionForm({ ...instructionForm, title: event.target.value })} />
            <label className="small">Type</label><select value={instructionForm.instruction_type} onChange={(event) => setInstructionForm({ ...instructionForm, instruction_type: event.target.value })}><option>generation_rule</option><option>review_rule</option><option>tone_rule</option><option>security_rule</option></select>
            <label className="small">Priority</label><input type="number" value={instructionForm.priority} onChange={(event) => setInstructionForm({ ...instructionForm, priority: Number(event.target.value) })} />
            <label className="small">Content</label><textarea value={instructionForm.content} onChange={(event) => setInstructionForm({ ...instructionForm, content: event.target.value })} />
            <button onClick={createInstruction} disabled={loading}>Create instruction</button>
          </div>
          <div className="card">
            <div className="section-label">Active rules</div>
            <h2>Firm instructions</h2>
            <div className="list">
              {instructions.map((instruction) => (
                <div className="item" key={instruction.id}>
                  <div className="item-title">{instruction.title}</div>
                  <span className="badge">{instruction.instruction_type}</span>
                  <span className="badge">priority {instruction.priority}</span>
                  <span className="badge">{instruction.status}</span>
                  <p className="small preview">{instruction.content}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'users' && canManageUsers && (
        <section className="grid">
          <div className="card">
            <div className="section-label">User access and AI behavior</div>
            <h2>Create user login</h2>
            <p className="subtle small">Creates a Supabase Auth email/password user and adds them to this firm. User-specific AI behavior is stored safely in Supabase Auth metadata, so it works even if older databases do not have persona columns.</p>
            <label className="small">Email</label><input value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
            <label className="small">Temporary password</label><input type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
            <label className="small">Full name</label><input value={userForm.full_name} onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value, display_name: event.target.value })} />
            <label className="small">Display name</label><input value={userForm.display_name} onChange={(event) => setUserForm({ ...userForm, display_name: event.target.value })} />
            <div className="two-col">
              <div><label className="small">Role</label><select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option>owner</option><option>admin</option><option>attorney</option><option>paralegal</option><option>intake</option><option>viewer</option></select></div>
              <div><label className="small">Status</label><select value={userForm.status} onChange={(event) => setUserForm({ ...userForm, status: event.target.value })}><option>active</option><option>pending</option><option>disabled</option></select></div>
            </div>
            <label className="small">Practice area</label><input value={userForm.practice_area} onChange={(event) => setUserForm({ ...userForm, practice_area: event.target.value })} />
            <label className="small">Chatbot behavior for this user</label><textarea value={userForm.chatbot_persona} onChange={(event) => setUserForm({ ...userForm, chatbot_persona: event.target.value })} />
            <button onClick={createFirmUser} disabled={loading}>Create / update user</button>
            <p className="footer-note">For production, ask users to change their temporary passwords after first login. Do not share admin/service keys with users.</p>
          </div>
          <div className="card">
            <div className="section-label">Firm users</div>
            <h2>Users and chatbot personas</h2>
            <div className="list">
              {firmUsers.length === 0 && <div className="item small subtle">No users found or you do not have admin access.</div>}
              {firmUsers.map((firmUser) => (
                <div className="item" key={firmUser.user_id}>
                  <div className="item-title">{firmUser.display_name || firmUser.email}</div>
                  <span className="badge">{firmUser.role}</span>
                  <span className="badge">{firmUser.status}</span>
                  <span className="badge">{firmUser.practice_area || 'General'}</span>
                  <div className="small subtle">{firmUser.email}</div>
                  {firmUser.chatbot_persona && <p className="small preview">{firmUser.chatbot_persona}</p>}
                  <div className="btn-row dense">
                    <button className="secondary mini" onClick={() => updateFirmUser(firmUser, { role: 'attorney' })} disabled={loading}>Make attorney</button>
                    <button className="secondary mini" onClick={() => updateFirmUser(firmUser, { role: 'paralegal' })} disabled={loading}>Make paralegal</button>
                    <button className="secondary mini" onClick={() => updateFirmUser(firmUser, { role: 'intake' })} disabled={loading}>Make intake</button>
                    <button className="secondary mini" onClick={() => updateFirmUser(firmUser, { status: firmUser.status === 'disabled' ? 'active' : 'disabled' })} disabled={loading}>{firmUser.status === 'disabled' ? 'Enable' : 'Disable'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'review' && (
        <section className="card">
          <div className="section-label">Attorney review workflow</div>
          <h2>Generated documents</h2>
          <div className="list review-list">
            {generatedDocuments.map((doc) => (
              <div className="item" key={doc.id}>
                <div className="item-title">{doc.draft_type}</div>
                <span className="badge">{doc.status}</span>
                <span className="badge">template v{doc.template_version}</span>
                <div className="small subtle">Matter: {doc.matter_name} | Created by: {doc.created_by_email || 'unknown'} | {formatDate(doc.created_at)}</div>
                <p className="small preview">{preview(doc.output_markdown, 500)}</p>
                <div className="btn-row dense">
                  <button className="secondary mini" onClick={() => downloadDocx(doc.id)} disabled={loading}>Download DOCX</button>
                  <button className="secondary mini" onClick={() => updateGeneratedStatus(doc.id, 'attorney_approved')} disabled={loading}>Approve</button>
                  <button className="secondary mini" onClick={() => updateGeneratedStatus(doc.id, 'sent_to_client')} disabled={loading}>Mark sent</button>
                  <button className="secondary mini" onClick={() => updateGeneratedStatus(doc.id, 'archived')} disabled={loading}>Archive</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'audit' && (
        <section className="card">
          <div className="section-label">Audit log</div>
          <h2>Recent actions</h2>
          <div className="list review-list">
            {logs.map((log) => (
              <div className="item" key={log.id}>
                <div className="item-title">{log.action}</div>
                <div className="small subtle">{log.actor_email || 'system'} | {log.matter_name || 'N/A'} | {formatDate(log.created_at)}</div>
                {log.output_preview && <p className="small preview">{log.output_preview}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
        </div>
      </section>
    </main>
  );
}
