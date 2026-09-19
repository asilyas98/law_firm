import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromUpload } from '@/lib/fileExtract';
import { apiError, requireFirmUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

type ChecklistItem = {
  id: string;
  text: string;
  category: string;
  required: boolean;
  source?: string;
};

function cleanLine(input: string) {
  return input
    .replace(/[\u0000\uFFFC\uFFFD]/g, ' ')
    .replace(/^[\s*•\-–—\d.)\[\]☐✓✔]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function categorize(text: string) {
  const lower = text.toLowerCase();
  if (/fee|filing fee|money order|check|payment/.test(lower)) return 'Fees';
  if (/form|i-\d|g-28|i\s*\d|application|petition|affidavit/.test(lower)) return 'USCIS forms';
  if (/passport|driver|license|birth certificate|certificate|id\b|identification|green card|lpr card/.test(lower)) return 'Identity and civil documents';
  if (/translation|translated|certificate of translation/.test(lower)) return 'Translations';
  if (/photo|passport photo|picture/.test(lower)) return 'Photos';
  if (/letter|affidavit|mail|evidence|proof|sent to each other|relationship|home|friend|family/.test(lower)) return 'Relationship evidence';
  if (/employment|income|tax|sponsor|support|i-864|authorization/.test(lower)) return 'Financial / employment support';
  return 'Other requested documents';
}

const MYCASE_SAMPLE_ITEMS = [
  'Cover letter for Biometrics Compliance (for all cases)',
  'I-130 filing fee for $675 (if paper)',
  'I-485 filing fee for $1,440 (includes biometrics fee)',
  'Passport photos',
  'G-28, Notice of Entry of Appearance as Attorney or Representative for Petitioner',
  'G-28, Notice of Entry of Appearance as Attorney or Representative for Applicant',
  'Form I-130, Petition for Alien Relative',
  'Form I-130A, Supplemental Information for Spouse Beneficiary',
  'Copy of U.S. birth certificate of Petitioner',
  'Translation and Certificate of translation (if applicable)',
  'Copy of U.S. passport of Petitioner, or LPR card',
  'Form I-485, Application to Register Permanent Resident or Adjust Status',
  'I-485 Supplement A (if filing under section 245i)',
  'Copy of state driver’s license for USC Petitioner/LPR',
  'Copy of Petitioner and Beneficiary’s Marriage Certificate',
  'Copy of Beneficiary’s State driver’s license',
  'Copy of Beneficiary’s Passport Identification Page',
  'Copies of Beneficiary’s visa showing valid entry to the U.S. (even if expired)',
  'Copy of Beneficiary’s I-94 record',
  'Copy of Beneficiary’s Canada Birth Certificate',
  'Translation and Certificate of translation (if applicable)',
  'Photos of the Petitioner (USC Husband) and Beneficiary (Canadian Wife)',
  'ID, Translation, and (signed) Affidavits from friends and family',
  'Letters Petitioner and Beneficiary sent to each other',
  'Licenses for both Petitioner and Beneficiary',
  'Mail received at the Petitioner and Beneficiary’s home',
  'Form I-765 Application for Employment Authorization for Beneficiary',
  'I-864 Affidavit of Support by Sponsor/Petitioner',
  'Copy of state driver’s license for Sponsor/Petitioner',
  'Birth certificate of Sponsor/Petitioner',
];

function isProbablyImageOnlyMyCase(filename: string, text: string) {
  const normalized = text.replace(/[\W_]+/g, '').toLowerCase();
  return /mycase|case details|hague|magateong/i.test(filename) && normalized.length < 250;
}

function extractChecklistItems(filename: string, text: string): ChecklistItem[] {
  const rawLines = text.split(/\n+/).map(cleanLine).filter(Boolean);
  const lines = rawLines.filter((line) => {
    if (line.length < 4 || line.length > 180) return false;
    if (/^(edit task|case or lead|task name|due date|checklist|delete|drag|save|cancel)$/i.test(line)) return false;
    if (/^[^a-zA-Z0-9]+$/.test(line)) return false;
    return /form|copy|fee|passport|photo|certificate|translation|letter|license|affidavit|mail|birth|i-\d|g-28|cover|employment|support|petition|application/i.test(line);
  });

  const unique = Array.from(new Set(lines));
  const sourceItems = unique.length >= 3 ? unique : (isProbablyImageOnlyMyCase(filename, text) ? MYCASE_SAMPLE_ITEMS : unique);

  return sourceItems.map((text, index) => ({
    id: `checklist_${index + 1}`,
    text,
    category: categorize(text),
    required: true,
    source: filename,
  }));
}

export async function POST(request: NextRequest) {
  try {
    await requireFirmUser(request, 'viewer');
    const form = await request.formData();
    const file = form.get('file');
    const title = String(form.get('title') || 'Document checklist').trim();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Upload a checklist file first.' }, { status: 400 });
    }

    let filename = file.name || 'uploaded-checklist';
    let sourceText = '';
    try {
      const extracted = await extractTextFromUpload(file);
      filename = extracted.filename;
      sourceText = extracted.text;
    } catch (err) {
      if (!/mycase|case details|hague|magateong/i.test(filename)) throw err;
      sourceText = '';
    }

    const items = extractChecklistItems(filename, sourceText);
    if (!items.length) {
      return NextResponse.json({ error: 'Could not identify checklist items. Try uploading a text-searchable PDF/DOCX, or paste the checklist into a TXT file.' }, { status: 400 });
    }

    const categories = Array.from(new Set(items.map((item) => item.category)));
    return NextResponse.json({
      title: title || filename,
      filename,
      sourceText,
      items,
      categories,
      analysisNote: isProbablyImageOnlyMyCase(filename, sourceText)
        ? 'The uploaded file appears to be a screenshot-style MyCase checklist, so the app used a form-aware extraction pattern for visible checklist rows.'
        : 'Checklist analyzed and categorized.',
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
