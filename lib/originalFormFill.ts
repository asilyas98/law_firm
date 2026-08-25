import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type FillField = {
  id: string;
  label: string;
  normalizedKey?: string;
  repeatedOf?: string | null;
  section?: string;
  itemNumber?: string;
  answerType?: string;
  options?: string[];
};

type FillOptions = {
  title: string;
  formType?: string;
  fields: FillField[];
  answers: Record<string, string>;
};

type PdfPlacement = {
  field: string;
  page: number;
  x: number;
  yTop: number;
  size?: number;
  width?: number;
  lines?: number;
};

type PdfCheckbox = {
  field: string;
  page: number;
  choices: Record<string, { x: number; yTop: number }>;
};

function cleanAnswer(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || /^\[?not applicable\]?$/i.test(text) || /^n\/?a$/i.test(text)) return '';
  return text;
}

function answerFor(fieldId: string, fields: FillField[], answers: Record<string, string>) {
  const direct = cleanAnswer(answers[fieldId]);
  if (direct) return direct;
  const field = fields.find((item) => item.id === fieldId);
  if (field?.repeatedOf) return cleanAnswer(answers[field.repeatedOf]);
  return '';
}

function splitLines(value: string, maxLines = 3) {
  return value
    .split(/\r?\n|;|\|/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

function drawTextInBox(page: any, font: any, value: string, placement: PdfPlacement) {
  if (!value) return;
  const size = placement.size || 8.5;
  const x = placement.x;
  let y = page.getHeight() - placement.yTop - 13;
  const maxWidth = placement.width || 170;
  const lines = splitLines(value, placement.lines || 1);
  for (const line of lines) {
    const clipped = line.length > 75 ? `${line.slice(0, 72)}...` : line;
    page.drawText(clipped, {
      x,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
      maxWidth,
    });
    y -= size + 3;
  }
}

function drawCheck(page: any, value: string, checkbox: PdfCheckbox) {
  if (!value) return;
  const normalized = value.toLowerCase();
  const entry = Object.entries(checkbox.choices).find(([choice]) => normalized.includes(choice.toLowerCase()))?.[1];
  if (!entry) return;
  page.drawText('X', {
    x: entry.x + 1.5,
    y: page.getHeight() - entry.yTop - 8.5,
    size: 10,
    color: rgb(0, 0, 0),
  });
}

const I130_TEXT_PLACEMENTS: PdfPlacement[] = [
  // Page 1 - petitioner identifiers and name
  { field: 'petitioner_a_number', page: 0, x: 450, yTop: 558, width: 120 },
  { field: 'petitioner_uscis_online_account', page: 0, x: 405, yTop: 522, width: 165 },
  { field: 'petitioner_ssn', page: 0, x: 450, yTop: 486, width: 120 },
  { field: 'petitioner_family_name', page: 0, x: 405, yTop: 612, width: 165 },
  { field: 'petitioner_given_name', page: 0, x: 405, yTop: 636, width: 165 },
  { field: 'petitioner_middle_name', page: 0, x: 405, yTop: 660, width: 165 },

  // Page 2 - petitioner other name, birth, mailing and physical address summary
  { field: 'petitioner_other_names', page: 1, x: 122, yTop: 150, width: 165, lines: 3 },
  { field: 'petitioner_birth_city', page: 1, x: 62, yTop: 264, width: 225 },
  { field: 'petitioner_birth_country', page: 1, x: 62, yTop: 300, width: 225 },
  { field: 'petitioner_date_of_birth', page: 1, x: 212, yTop: 324, width: 80 },
  { field: 'petitioner_mailing_address', page: 1, x: 62, yTop: 414, width: 225, lines: 5 },
  { field: 'petitioner_physical_address_1', page: 1, x: 344, yTop: 402, width: 225, lines: 5 },
  { field: 'petitioner_physical_address_2', page: 1, x: 344, yTop: 150, width: 225, lines: 5 },
  { field: 'petitioner_marriages_count', page: 1, x: 536, yTop: 660, width: 36 },

  // Page 3 - petitioner marriage, parents, citizenship
  { field: 'petitioner_current_marriage_date', page: 2, x: 212, yTop: 126, width: 80 },
  { field: 'petitioner_current_marriage_place', page: 2, x: 62, yTop: 168, width: 225, lines: 4 },
  { field: 'petitioner_spouses', page: 2, x: 122, yTop: 264, width: 165, lines: 4 },
  { field: 'petitioner_parent_1', page: 2, x: 62, yTop: 426, width: 225, lines: 4 },
  { field: 'petitioner_parent_2', page: 2, x: 344, yTop: 426, width: 225, lines: 4 },
  { field: 'petitioner_naturalization_certificate', page: 2, x: 344, yTop: 636, width: 225, lines: 3 },

  // Page 4 - LPR and employment / bio summary
  { field: 'petitioner_lpr_details', page: 3, x: 62, yTop: 150, width: 225, lines: 5 },
  { field: 'petitioner_employment_1', page: 3, x: 62, yTop: 414, width: 225, lines: 6 },
  { field: 'petitioner_employment_2', page: 3, x: 344, yTop: 150, width: 225, lines: 6 },
  { field: 'petitioner_height_weight', page: 3, x: 445, yTop: 640, width: 120, lines: 2 },

  // Page 5 - beneficiary identifiers, name, address, contact
  { field: 'beneficiary_a_number', page: 4, x: 168, yTop: 192, width: 120 },
  { field: 'beneficiary_uscis_online_account', page: 4, x: 168, yTop: 264, width: 120 },
  { field: 'beneficiary_ssn', page: 4, x: 168, yTop: 228, width: 120 },
  { field: 'beneficiary_family_name', page: 4, x: 122, yTop: 318, width: 165 },
  { field: 'beneficiary_given_name', page: 4, x: 122, yTop: 342, width: 165 },
  { field: 'beneficiary_middle_name', page: 4, x: 122, yTop: 366, width: 165 },
  { field: 'beneficiary_other_names', page: 4, x: 122, yTop: 450, width: 165, lines: 3 },
  { field: 'beneficiary_birth_city', page: 4, x: 62, yTop: 564, width: 225 },
  { field: 'beneficiary_birth_country', page: 4, x: 62, yTop: 600, width: 225 },
  { field: 'beneficiary_date_of_birth', page: 4, x: 212, yTop: 624, width: 80 },
  { field: 'beneficiary_physical_address', page: 4, x: 344, yTop: 384, width: 225, lines: 6 },
  { field: 'beneficiary_intended_us_address', page: 4, x: 408, yTop: 522, width: 165, lines: 4 },
  { field: 'beneficiary_foreign_address', page: 4, x: 408, yTop: 120, width: 165, lines: 4 },
  { field: 'beneficiary_contact', page: 4, x: 405, yTop: 690, width: 165, lines: 3 },

  // Page 6 - beneficiary marital and family info
  { field: 'beneficiary_marriages_count', page: 5, x: 252, yTop: 126, width: 40 },
  { field: 'beneficiary_current_marriage_date', page: 5, x: 212, yTop: 300, width: 80 },
  { field: 'beneficiary_current_marriage_place', page: 5, x: 62, yTop: 324, width: 225, lines: 4 },
  { field: 'beneficiary_spouses', page: 5, x: 122, yTop: 450, width: 165, lines: 4 },
  { field: 'beneficiary_family_members', page: 5, x: 62, yTop: 570, width: 500, lines: 8 },

  // Page 7/8 - entry, employment, processing
  { field: 'beneficiary_current_us_entry', page: 6, x: 62, yTop: 168, width: 225, lines: 5 },
  { field: 'beneficiary_travel_document', page: 6, x: 62, yTop: 342, width: 225, lines: 4 },
  { field: 'beneficiary_current_employment', page: 6, x: 344, yTop: 360, width: 225, lines: 6 },
  { field: 'beneficiary_immigration_proceedings', page: 6, x: 344, yTop: 600, width: 225, lines: 4 },
  { field: 'beneficiary_native_language_name_address', page: 7, x: 62, yTop: 150, width: 225, lines: 6 },
  { field: 'spousal_last_address_together', page: 7, x: 62, yTop: 414, width: 225, lines: 5 },
  { field: 'beneficiary_adjustment_or_consular', page: 7, x: 344, yTop: 180, width: 225, lines: 6 },

  // Page 8/9/10 - other information and signatures/contact summaries
  { field: 'previous_petitions', page: 7, x: 344, yTop: 420, width: 225, lines: 6 },
  { field: 'other_relatives_petitions', page: 7, x: 62, yTop: 642, width: 225, lines: 4 },
  { field: 'petitioner_contact_info', page: 8, x: 344, yTop: 126, width: 225, lines: 4 },
  { field: 'interpreter_details', page: 9, x: 62, yTop: 120, width: 225, lines: 7 },
  { field: 'preparer_used', page: 9, x: 344, yTop: 300, width: 225, lines: 8 },
  { field: 'additional_information', page: 11, x: 62, yTop: 174, width: 500, lines: 18 },
];

const I130_CHECKBOXES: PdfCheckbox[] = [
  { field: 'relationship_to_beneficiary', page: 0, choices: { Spouse: { x: 60, yTop: 505 }, Parent: { x: 114, yTop: 505 }, 'Brother/Sister': { x: 162, yTop: 505 }, Child: { x: 240, yTop: 505 } } },
  { field: 'child_or_parent_relationship_basis', page: 0, choices: { 'Child born to married parents': { x: 60, yTop: 566 }, 'Stepchild/Stepparent': { x: 60, yTop: 596 }, 'Child born to unmarried parents': { x: 60, yTop: 614 }, 'Child adopted': { x: 60, yTop: 644 } } },
  { field: 'sibling_related_by_adoption', page: 0, choices: { Yes: { x: 216, yTop: 685 }, No: { x: 258, yTop: 685 } } },
  { field: 'petitioner_status_through_adoption', page: 0, choices: { Yes: { x: 216, yTop: 715 }, No: { x: 258, yTop: 715 } } },
  { field: 'petitioner_sex', page: 1, choices: { Male: { x: 216, yTop: 352 }, Female: { x: 258, yTop: 352 } } },
  { field: 'petitioner_mailing_same_as_physical', page: 1, choices: { Yes: { x: 216, yTop: 631 }, No: { x: 258, yTop: 631 } } },
  { field: 'petitioner_current_marital_status', page: 1, choices: { 'Single, Never Married': { x: 342, yTop: 706 }, Married: { x: 462, yTop: 706 }, Divorced: { x: 522, yTop: 706 }, Widowed: { x: 342, yTop: 724 }, Separated: { x: 408, yTop: 724 }, Annulled: { x: 480, yTop: 724 } } },
  { field: 'petitioner_status', page: 2, choices: { 'U.S. Citizen': { x: 342, yTop: 478 }, 'Lawful Permanent Resident': { x: 414, yTop: 478 } } },
  { field: 'petitioner_citizenship_acquired', page: 2, choices: { 'Birth in the United States': { x: 343, yTop: 547 }, Naturalization: { x: 343, yTop: 565 }, Parents: { x: 343, yTop: 583 } } },
  { field: 'petitioner_has_naturalization_certificate', page: 2, choices: { Yes: { x: 498, yTop: 613 }, No: { x: 540, yTop: 613 } } },
  { field: 'petitioner_lpr_through_marriage', page: 3, choices: { Yes: { x: 216, yTop: 286 }, No: { x: 258, yTop: 286 } } },
  { field: 'petitioner_ethnicity', page: 3, choices: { 'Hispanic or Latino': { x: 344, yTop: 451 }, 'Not Hispanic or Latino': { x: 344, yTop: 466 } } },
  { field: 'petitioner_race', page: 3, choices: { White: { x: 344, yTop: 505 }, Asian: { x: 344, yTop: 520 }, 'Black or African American': { x: 344, yTop: 535 }, 'American Indian or Alaska Native': { x: 344, yTop: 550 }, 'Native Hawaiian or Other Pacific Islander': { x: 344, yTop: 565 } } },
  { field: 'petitioner_eye_color', page: 3, choices: { Black: { x: 344, yTop: 649 }, Blue: { x: 410, yTop: 649 }, Brown: { x: 470, yTop: 649 }, Gray: { x: 344, yTop: 664 }, Green: { x: 410, yTop: 664 }, Hazel: { x: 470, yTop: 664 }, Maroon: { x: 344, yTop: 679 }, Pink: { x: 410, yTop: 679 }, 'Unknown/Other': { x: 470, yTop: 679 } } },
  { field: 'petitioner_hair_color', page: 4, choices: { Bald: { x: 62, yTop: 97 }, Black: { x: 152, yTop: 97 }, Blond: { x: 210, yTop: 97 }, Brown: { x: 62, yTop: 112 }, Gray: { x: 152, yTop: 112 }, Red: { x: 210, yTop: 112 }, Sandy: { x: 62, yTop: 127 }, White: { x: 152, yTop: 127 }, 'Unknown/Other': { x: 210, yTop: 127 } } },
  { field: 'beneficiary_sex', page: 4, choices: { Male: { x: 150, yTop: 688 }, Female: { x: 192, yTop: 688 } } },
  { field: 'beneficiary_previous_petition', page: 4, choices: { Yes: { x: 150, yTop: 688 }, No: { x: 192, yTop: 688 }, Unknown: { x: 234, yTop: 688 } } },
  { field: 'beneficiary_current_marital_status', page: 5, choices: { 'Single, Never Married': { x: 60, yTop: 247 }, Married: { x: 180, yTop: 247 }, Divorced: { x: 240, yTop: 247 }, Widowed: { x: 60, yTop: 265 }, Separated: { x: 126, yTop: 265 }, Annulled: { x: 198, yTop: 265 } } },
  { field: 'beneficiary_ever_in_us', page: 6, choices: { Yes: { x: 216, yTop: 496 }, No: { x: 258, yTop: 496 } } },
  { field: 'beneficiary_immigration_proceedings', page: 6, choices: { Yes: { x: 498, yTop: 547 }, No: { x: 540, yTop: 547 } } },
  { field: 'previous_petitions', page: 7, choices: { Yes: { x: 498, yTop: 313 }, No: { x: 540, yTop: 313 } } },
  { field: 'interpreter_used', page: 8, choices: { Yes: { x: 61, yTop: 523 }, No: { x: 61, yTop: 481 } } },
];

function isI130(formType?: string, filename?: string) {
  const text = `${formType || ''} ${filename || ''}`.toLowerCase();
  return text.includes('i-130') || text.includes('alien relative');
}

async function fillAcroForm(pdfDoc: PDFDocument, fields: FillField[], answers: Record<string, string>) {
  const form = pdfDoc.getForm();
  const pdfFields = form.getFields();
  if (!pdfFields.length) return false;
  const allAnswers = new Map<string, string>();
  for (const field of fields) {
    const value = answerFor(field.id, fields, answers);
    if (!value) continue;
    allAnswers.set(field.id.toLowerCase(), value);
    allAnswers.set((field.normalizedKey || '').toLowerCase(), value);
    allAnswers.set(field.label.toLowerCase(), value);
    if (field.itemNumber) allAnswers.set(field.itemNumber.toLowerCase(), value);
  }
  for (const pdfField of pdfFields) {
    const name = pdfField.getName();
    const lower = name.toLowerCase();
    const matched = [...allAnswers.entries()].find(([key]) => key && (lower.includes(key) || key.includes(lower)));
    if (!matched) continue;
    const value = matched[1];
    try {
      const type = pdfField.constructor.name;
      if (type.includes('TextField')) (pdfField as any).setText(value);
      else if (type.includes('CheckBox') && /^yes|true|checked|x$/i.test(value)) (pdfField as any).check();
      else if (type.includes('Dropdown')) (pdfField as any).select(value);
      else if (type.includes('RadioGroup')) (pdfField as any).select(value);
    } catch {
      // Keep filling other fields.
    }
  }
  try { form.updateFieldAppearances(); } catch {}
  return true;
}

async function overlayI130(pdfDoc: PDFDocument, fields: FillField[], answers: Record<string, string>) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  for (const placement of I130_TEXT_PLACEMENTS) {
    const page = pages[placement.page];
    if (!page) continue;
    drawTextInBox(page, font, answerFor(placement.field, fields, answers), placement);
  }
  for (const checkbox of I130_CHECKBOXES) {
    const page = pages[checkbox.page];
    if (!page) continue;
    drawCheck(page, answerFor(checkbox.field, fields, answers), checkbox);
  }
  const firstPage = pages[0];
  if (firstPage) {
    firstPage.drawText('PENDING ATTORNEY REVIEW', {
      x: 390,
      y: firstPage.getHeight() - 34,
      size: 8,
      font: bold,
      color: rgb(0.65, 0, 0),
    });
  }
}

export async function fillOriginalPdfBuffer(originalBuffer: Buffer, options: FillOptions) {
  const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
  const usedAcroForm = await fillAcroForm(pdfDoc, options.fields, options.answers);
  if (!usedAcroForm && isI130(options.formType, options.title)) {
    await overlayI130(pdfDoc, options.fields, options.answers);
  }
  return Buffer.from(await pdfDoc.save());
}

export async function fillOriginalDocxBuffer(originalBuffer: Buffer, options: FillOptions) {
  const zip = new PizZip(originalBuffer);
  const data: Record<string, string> = {};
  for (const field of options.fields) {
    const value = answerFor(field.id, options.fields, options.answers);
    data[field.id] = value;
    if (field.normalizedKey) data[field.normalizedKey] = value;
  }
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
