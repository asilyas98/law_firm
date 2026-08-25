import { NextRequest, NextResponse } from 'next/server';
import { apiError, requireFirmUser } from '@/lib/serverAuth';
import { extractTextFromUpload } from '@/lib/fileExtract';

export const runtime = 'nodejs';

type Field = {
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

function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(your|the|applicant|client|current|please|provide|enter|print|write|full|information|about)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLabel(input: string): string {
  return input
    .replace(/[_•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*[:：]\s*$/, '')
    .trim();
}

function makeField(
  id: string,
  section: string,
  itemNumber: string,
  label: string,
  answerType: Field['answerType'] = 'text',
  options: string[] = [],
  helpText = '',
  required = true,
  conditionalKey: string | null = null,
  conditionalValues: string[] | null = null,
  repeatedOf: string | null = null,
): Field {
  return {
    id,
    label,
    normalizedKey: id,
    required,
    repeatedOf,
    section,
    itemNumber,
    helpText,
    answerType,
    options,
    conditionalKey,
    conditionalValues,
  };
}

function isI130(text: string, filename: string, title: string) {
  const sample = `${filename}\n${title}\n${text.slice(0, 4000)}`.toLowerCase();
  return sample.includes('form i-130') || (sample.includes('petition for alien relative') && sample.includes('petitioner'));
}

function i130Fields(): Field[] {
  const f = makeField;
  return [
    f('relationship_to_beneficiary', 'Part 1. Relationship', '1', 'What is the beneficiary\'s relationship to the petitioner?', 'single_select', ['Spouse', 'Parent', 'Brother/Sister', 'Child'], 'Select the one box that fits the I-130 relationship category.'),
    f('child_or_parent_relationship_basis', 'Part 1. Relationship', '2', 'If filing for a child or parent, which relationship basis applies?', 'single_select', ['Child born to married parents', 'Stepchild/Stepparent', 'Child born to unmarried parents', 'Child adopted'], 'Ask only if the petition is for a child or parent.', false, 'relationship_to_beneficiary', ['Parent', 'Child']),
    f('sibling_related_by_adoption', 'Part 1. Relationship', '3', 'If filing for a brother/sister, are the siblings related by adoption?', 'yes_no', ['Yes', 'No'], 'Ask only for brother/sister petitions.', false, 'relationship_to_beneficiary', ['Brother/Sister']),
    f('petitioner_status_through_adoption', 'Part 1. Relationship', '4', 'Did the petitioner gain lawful permanent resident status or citizenship through adoption?', 'yes_no', ['Yes', 'No']),

    f('petitioner_a_number', 'Part 2. Petitioner identifiers', '1', 'Petitioner Alien Registration Number / A-Number, if any', 'text', [], 'Use A-Number format if known, otherwise leave blank or enter N/A.', false),
    f('petitioner_uscis_online_account', 'Part 2. Petitioner identifiers', '2', 'Petitioner USCIS Online Account Number, if any', 'text', [], '', false),
    f('petitioner_ssn', 'Part 2. Petitioner identifiers', '3', 'Petitioner U.S. Social Security Number, if any', 'text', [], '', false),
    f('petitioner_family_name', 'Part 2. Petitioner name', '4.a', 'Petitioner family name / last name'),
    f('petitioner_given_name', 'Part 2. Petitioner name', '4.b', 'Petitioner given name / first name'),
    f('petitioner_middle_name', 'Part 2. Petitioner name', '4.c', 'Petitioner middle name, if any', 'text', [], '', false),
    f('petitioner_other_names', 'Part 2. Other names used', '5.a-5.c', 'List all other names the petitioner has used, including aliases, maiden names, and nicknames', 'long_text', [], 'If none, enter N/A.', false),
    f('petitioner_birth_city', 'Part 2. Petitioner birth information', '6', 'Petitioner city/town/village of birth'),
    f('petitioner_birth_country', 'Part 2. Petitioner birth information', '7', 'Petitioner country of birth'),
    f('petitioner_date_of_birth', 'Part 2. Petitioner birth information', '8', 'Petitioner date of birth', 'date', [], 'Use mm/dd/yyyy.'),
    f('petitioner_sex', 'Part 2. Petitioner birth information', '9', 'Petitioner sex', 'single_select', ['Male', 'Female']),
    f('petitioner_mailing_address', 'Part 2. Petitioner mailing address', '10.a-10.i', 'Petitioner complete mailing address', 'address', [], 'Include in-care-of name if applicable, street, apt/suite/floor, city, state/province, ZIP/postal code, and country.'),
    f('petitioner_mailing_same_as_physical', 'Part 2. Petitioner physical address', '11', 'Is the petitioner\'s current mailing address the same as the physical address?', 'yes_no', ['Yes', 'No']),
    f('petitioner_physical_address_1', 'Part 2. Petitioner address history', '12.a-13.b', 'Petitioner current physical address and date range', 'address', [], 'Ask only if mailing and physical address are different. Include Date From and Date To/PRESENT.', false, 'petitioner_mailing_same_as_physical', ['No']),
    f('petitioner_physical_address_2', 'Part 2. Petitioner address history', '14.a-15.b', 'Petitioner prior physical address and date range, if needed for five-year history', 'address', [], 'Ask if the current address does not cover the full last five years.', false),
    f('petitioner_marriages_count', 'Part 2. Petitioner marital information', '16', 'How many times has the petitioner been married?', 'number'),
    f('petitioner_current_marital_status', 'Part 2. Petitioner marital information', '17', 'Petitioner current marital status', 'single_select', ['Single, Never Married', 'Married', 'Divorced', 'Widowed', 'Separated', 'Annulled']),
    f('petitioner_current_marriage_date', 'Part 2. Petitioner marital information', '18', 'Date of petitioner\'s current marriage', 'date', [], 'Ask only if currently married.', false, 'petitioner_current_marital_status', ['Married']),
    f('petitioner_current_marriage_place', 'Part 2. Petitioner marital information', '19.a-19.d', 'Place of petitioner\'s current marriage', 'text', [], 'City/town, state/province, and country. Ask only if currently married.', false, 'petitioner_current_marital_status', ['Married']),
    f('petitioner_spouse_1', 'Part 2. Names of petitioner spouses', '20.a-21', 'Current or most recent spouse name and marriage end date, if any', 'long_text', [], 'Provide current spouse first if currently married, then prior spouse. Enter N/A if none.', false),
    f('petitioner_spouse_2', 'Part 2. Names of petitioner spouses', '22.a-23', 'Second spouse name and marriage end date, if any', 'long_text', [], 'Use only if there is a second spouse to list.', false),
    f('petitioner_parent_1', 'Part 2. Petitioner parents', '24.a-29', 'Petitioner Parent 1 full name, date of birth, sex, country of birth, city/country of residence', 'long_text'),
    f('petitioner_parent_2', 'Part 2. Petitioner parents', '30.a-35', 'Petitioner Parent 2 full name, date of birth, sex, country of birth, city/country of residence', 'long_text'),
    f('petitioner_immigration_status', 'Part 2. Petitioner immigration status', '36', 'Is the petitioner a U.S. citizen or lawful permanent resident?', 'single_select', ['U.S. Citizen', 'Lawful Permanent Resident']),
    f('petitioner_citizenship_acquired_through', 'Part 2. U.S. citizen details', '37', 'If the petitioner is a U.S. citizen, how was citizenship acquired?', 'single_select', ['Birth in the United States', 'Naturalization', 'Parents'], 'Ask only for U.S. citizen petitioners.', false, 'petitioner_immigration_status', ['U.S. Citizen']),
    f('petitioner_has_certificate', 'Part 2. U.S. citizen details', '38', 'Has the petitioner obtained a Certificate of Naturalization or Certificate of Citizenship?', 'yes_no', ['Yes', 'No'], 'Ask only for U.S. citizen petitioners.', false, 'petitioner_immigration_status', ['U.S. Citizen']),
    f('petitioner_certificate_details', 'Part 2. U.S. citizen details', '39.a-39.c', 'Certificate number, place of issuance, and date of issuance', 'long_text', [], 'Ask only if the petitioner has a Certificate of Naturalization or Citizenship.', false, 'petitioner_has_certificate', ['Yes']),
    f('petitioner_lpr_admission', 'Part 2. LPR details', '40.a-40.d', 'If petitioner is an LPR, class of admission, date of admission, and place of admission', 'long_text', [], 'Ask only for lawful permanent resident petitioners.', false, 'petitioner_immigration_status', ['Lawful Permanent Resident']),
    f('petitioner_lpr_through_marriage', 'Part 2. LPR details', '41', 'Did petitioner gain LPR status through marriage to a U.S. citizen or LPR?', 'yes_no', ['Yes', 'No'], 'Ask only for lawful permanent resident petitioners.', false, 'petitioner_immigration_status', ['Lawful Permanent Resident']),
    f('petitioner_current_employment', 'Part 2. Petitioner employment history', '42-45.b', 'Petitioner current employer, employer address, occupation, and date range', 'long_text', [], 'If currently unemployed, enter Unemployed for employer.'),
    f('petitioner_prior_employment', 'Part 2. Petitioner employment history', '46-49.b', 'Petitioner prior employer, employer address, occupation, and date range, if needed for five-year history', 'long_text', [], '', false),
    f('petitioner_biographics', 'Part 3. Petitioner biographic information', '1-6', 'Petitioner ethnicity, race, height, weight, eye color, and hair color', 'long_text', [], 'Use the form options where possible.'),

    f('beneficiary_a_number', 'Part 4. Beneficiary identifiers', '1', 'Beneficiary Alien Registration Number / A-Number, if any', 'text', [], '', false),
    f('beneficiary_uscis_online_account', 'Part 4. Beneficiary identifiers', '2', 'Beneficiary USCIS Online Account Number, if any', 'text', [], '', false),
    f('beneficiary_ssn', 'Part 4. Beneficiary identifiers', '3', 'Beneficiary U.S. Social Security Number, if any', 'text', [], '', false),
    f('beneficiary_family_name', 'Part 4. Beneficiary name', '4.a', 'Beneficiary family name / last name'),
    f('beneficiary_given_name', 'Part 4. Beneficiary name', '4.b', 'Beneficiary given name / first name'),
    f('beneficiary_middle_name', 'Part 4. Beneficiary name', '4.c', 'Beneficiary middle name, if any', 'text', [], '', false),
    f('beneficiary_other_names', 'Part 4. Beneficiary other names', '5.a-5.c', 'List all other names the beneficiary has used, including aliases, maiden names, and nicknames', 'long_text', [], 'If none, enter N/A.', false),
    f('beneficiary_birth_city', 'Part 4. Beneficiary birth information', '6', 'Beneficiary city/town/village of birth'),
    f('beneficiary_birth_country', 'Part 4. Beneficiary birth information', '7', 'Beneficiary country of birth'),
    f('beneficiary_date_of_birth', 'Part 4. Beneficiary birth information', '8', 'Beneficiary date of birth', 'date', [], 'Use mm/dd/yyyy.'),
    f('beneficiary_sex', 'Part 4. Beneficiary birth information', '9', 'Beneficiary sex', 'single_select', ['Male', 'Female']),
    f('beneficiary_prior_petition_known', 'Part 4. Beneficiary prior petitions', '10', 'Has anyone else ever filed a petition for the beneficiary?', 'single_select', ['Yes', 'No', 'Unknown']),
    f('beneficiary_physical_address', 'Part 4. Beneficiary physical address', '11.a-11.h', 'Beneficiary current physical address', 'address', [], 'If outside the United States without a street number or name, leave those parts blank.'),
    f('beneficiary_intended_us_address', 'Part 4. Beneficiary intended U.S. address', '12.a-12.e', 'Address in the United States where beneficiary intends to live', 'address', [], 'If same as physical address, enter SAME.', false),
    f('beneficiary_foreign_address', 'Part 4. Beneficiary foreign address', '13.a-13.f', 'Beneficiary address outside the United States', 'address', [], 'If same as physical address, enter SAME.', false),
    f('beneficiary_contact', 'Part 4. Beneficiary contact information', '14-16', 'Beneficiary daytime phone, mobile phone, and email address', 'long_text', [], '', false),
    f('beneficiary_marriages_count', 'Part 4. Beneficiary marital information', '17', 'How many times has the beneficiary been married?', 'number'),
    f('beneficiary_current_marital_status', 'Part 4. Beneficiary marital information', '18', 'Beneficiary current marital status', 'single_select', ['Single, Never Married', 'Married', 'Divorced', 'Widowed', 'Separated', 'Annulled']),
    f('beneficiary_current_marriage_date', 'Part 4. Beneficiary marital information', '19', 'Date of beneficiary\'s current marriage', 'date', [], 'Ask only if beneficiary is currently married.', false, 'beneficiary_current_marital_status', ['Married']),
    f('beneficiary_current_marriage_place', 'Part 4. Beneficiary marital information', '20.a-20.d', 'Place of beneficiary\'s current marriage', 'text', [], 'City/town, state/province, and country. Ask only if beneficiary is currently married.', false, 'beneficiary_current_marital_status', ['Married']),
    f('beneficiary_spouses', 'Part 4. Beneficiary spouses', '21.a-24', 'Beneficiary current and prior spouses, including names and marriage end dates if any', 'long_text', [], 'Provide current spouse first if currently married, then prior spouses. Enter N/A if none.', false),
    f('beneficiary_family_members', 'Part 4. Beneficiary family', '25.a-44', 'Beneficiary spouse and children: names, relationships, dates of birth, and countries of birth', 'long_text', [], 'List each spouse/child to be entered in Person 1 through Person 5. Enter N/A if none.', false),
    f('beneficiary_ever_in_us', 'Part 4. Beneficiary entry information', '45', 'Was the beneficiary ever in the United States?', 'yes_no', ['Yes', 'No']),
    f('beneficiary_current_us_entry', 'Part 4. Beneficiary entry information', '46.a-46.d', 'If beneficiary is currently in the U.S., provide class of admission, I-94 number, date of arrival, and authorized stay expiration/D/S', 'long_text', [], 'Ask only if currently in the United States.', false, 'beneficiary_ever_in_us', ['Yes']),
    f('beneficiary_travel_document', 'Part 4. Beneficiary travel document', '47-50', 'Beneficiary passport/travel document number, country of issuance, and expiration date', 'long_text', [], '', false),
    f('beneficiary_current_employment', 'Part 4. Beneficiary employment', '51.a-52', 'Beneficiary current employer, employer address, and date employment began', 'long_text', [], 'If unemployed, enter Unemployed.', false),
    f('beneficiary_immigration_proceedings', 'Part 4. Beneficiary immigration proceedings', '53-56', 'Was beneficiary ever in immigration proceedings? If yes, type, location, and date', 'long_text', [], 'Include removal, exclusion/deportation, rescission, or other judicial proceedings.', false),
    f('beneficiary_native_language_name_address', 'Part 4. Native written language', '57.a-58.f', 'Beneficiary name and foreign address in native written language, if applicable', 'long_text', [], 'Ask only if native written language does not use Roman letters.', false),
    f('spousal_last_address_together', 'Part 4. Spousal petition address', '59.a-60.b', 'If filing for spouse, last address where petitioner and beneficiary physically lived together and date range', 'address', [], 'If never lived together, enter Never lived together. Ask only for spouse petitions.', false, 'relationship_to_beneficiary', ['Spouse']),
    f('beneficiary_adjustment_or_consular', 'Part 4. Processing choice', '61.a-62.c', 'Will beneficiary apply for adjustment of status in the U.S. or immigrant visa processing abroad? Provide USCIS office or consulate city/province/country', 'long_text', [], 'Choose either adjustment of status or consular processing based on the case.'),

    f('previous_petitions', 'Part 5. Other information', '1-5', 'Has petitioner ever previously filed a petition for this beneficiary or any other alien? If yes, provide name, place, date filed, and result', 'long_text', [], '', false),
    f('other_relatives_petitions', 'Part 5. Other information', '6.a-9', 'If submitting separate petitions for other relatives, list each relative name and relationship', 'long_text', [], '', false),
    f('petitioner_contact_info', 'Part 6. Petitioner statement/contact/signature', '3-6.b', 'Petitioner daytime phone, mobile phone, email, statement option, signature date', 'long_text', [], 'Signature itself must be signed in ink; this tool can prepare the packet but cannot sign for the petitioner.'),
    f('interpreter_used', 'Part 7. Interpreter', '1.b', 'Was an interpreter used for the petitioner?', 'yes_no', ['Yes', 'No'], '', false),
    f('interpreter_details', 'Part 7. Interpreter', '1-7.b', 'Interpreter name, business, mailing address, phone, email, language, and signature date', 'long_text', [], 'Ask only if an interpreter was used.', false, 'interpreter_used', ['Yes']),
    f('preparer_used', 'Part 8. Preparer', '1-8.b', 'Was this petition prepared by someone other than the petitioner? If yes, provide preparer details, statement, and signature date', 'long_text', [], 'For attorney/accredited representative cases, confirm whether Form G-28 is attached.', false),
    f('additional_information', 'Part 9. Additional information', '1.a-7.d', 'Any additional information needed for overflow pages', 'long_text', [], 'Use this for answers that do not fit in prior sections. Include page, part, and item number where possible.', false),
  ];
}

const skipLinePatterns = [
  /^form i-?130/i,
  /^page \d+/i,
  /^part \d+\.?\s*$/i,
  /^(for uscis use only|fee stamp|action stamp|remarks|warning|penalties|note to all petitioners)/i,
  /^(uscis|department of homeland security|u\.s\. citizenship and immigration services)$/i,
  /^(initial receipt|resubmitted|relocated|received|sent|completed|approved|returned)$/i,
  /^(copies of any documents|i certify|i understand|i further authorize)/i,
];

function looksLikeField(line: string): boolean {
  const cleaned = cleanLabel(line);
  if (cleaned.length < 4 || cleaned.length > 180) return false;
  if (skipLinePatterns.some((pattern) => pattern.test(cleaned))) return false;
  if (/^(yes|no|male|female|present|city or town|state|country|province|postal code|zip code)$/i.test(cleaned)) return false;
  if (/[?¿]$/.test(cleaned)) return true;
  if (/[:：]\s*$/.test(line)) return true;
  if (/^\d+[a-z]?\.?\s+/i.test(cleaned) && /\b(name|address|phone|email|date|number|passport|income|expense|status|employer|birth|country|city|state|zip|spouse|children|parent|attorney|client|case|alien|receipt|entry|departure|visa|i-?94|relationship|occupation|signature)\b/i.test(cleaned)) return true;
  if (/\b(name|address|phone|email|date|number|passport|status|employer|birth|country|city|state|zip|spouse|children|parent|alien|entry|visa|relationship|occupation)\b/i.test(cleaned) && cleaned.length < 100) return true;
  return false;
}

function inferAnswerType(label: string): Field['answerType'] {
  if (/\bdate\b/i.test(label)) return 'date';
  if (/\bhow many|number\b/i.test(label)) return 'number';
  if (/\?\s*$/.test(label) || /\byes\b.*\bno\b/i.test(label)) return 'yes_no';
  if (/\baddress\b/i.test(label)) return 'address';
  if (label.length > 90) return 'long_text';
  return 'text';
}

function extractFallbackFields(text: string): Field[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Map<string, string>();
  const fields: Field[] = [];
  let currentSection = 'Uploaded document';

  for (const rawLine of lines) {
    const sectionMatch = rawLine.match(/^(Part\s+\d+\.?[^\n]*)/i);
    if (sectionMatch && rawLine.length < 120) currentSection = cleanLabel(rawLine);
    if (!looksLikeField(rawLine)) continue;
    const label = cleanLabel(rawLine);
    const normalized = normalizeKey(`${currentSection} ${label}`);
    if (!normalized || normalized.length < 3) continue;
    const existing = seen.get(normalized);
    const id = `field_${fields.length + 1}`;
    fields.push({
      id,
      label,
      normalizedKey: normalized,
      required: true,
      repeatedOf: existing || null,
      section: currentSection,
      itemNumber: label.match(/^\d+[a-z]?\.?/)?.[0] || '',
      answerType: inferAnswerType(label),
      options: /\?\s*$/.test(label) ? ['Yes', 'No'] : [],
    });
    if (!existing) seen.set(normalized, id);
    if (fields.length >= 80) break;
  }

  if (fields.length === 0) {
    const fallbackLines = lines.filter((line) => line.length > 8 && line.length < 180).slice(0, 25);
    return fallbackLines.map((line, index) => ({
      id: `field_${index + 1}`,
      label: cleanLabel(line),
      normalizedKey: normalizeKey(line),
      required: true,
      repeatedOf: null,
      section: 'Uploaded document',
      answerType: inferAnswerType(line),
      options: [],
    }));
  }

  return fields;
}

export async function POST(request: NextRequest) {
  try {
    await requireFirmUser(request, 'viewer');
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    const extracted = await extractTextFromUpload(file);
    const title = String(formData.get('title') || extracted.filename || 'Uploaded Document');
    const isKnownI130 = isI130(extracted.text, extracted.filename, title);
    const fields = isKnownI130 ? i130Fields() : extractFallbackFields(extracted.text);

    return NextResponse.json({
      title: isKnownI130 ? `${title} - guided I-130 intake` : title,
      filename: extracted.filename,
      extension: extracted.extension,
      formType: isKnownI130 ? 'USCIS Form I-130, Petition for Alien Relative' : 'generic',
      sourceText: extracted.text,
      fields,
      uniqueFieldCount: fields.filter((field) => !field.repeatedOf).length,
      repeatedFieldCount: fields.filter((field) => field.repeatedOf).length,
      analysisNote: isKnownI130
        ? 'Recognized Form I-130. The guided interview uses section-aware immigration questions, skips USCIS-use-only blocks, groups repeated name/address fields, and includes conditional questions.'
        : 'Generic form analysis used. Review extracted questions before using the filled packet.',
    });
  } catch (error: unknown) {
    return apiError(error);
  }
}
