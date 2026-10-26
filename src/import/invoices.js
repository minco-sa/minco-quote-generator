// Supplier-bill extraction (AI) and matching against the price book.
import { callClaude, fileBlock } from '../ai/claude.js';

export const SUPPLIER_IDS = [
  { code: 'DHY', vat: '300047882500003', names: ['الضحيان', 'dahayan', 'al dahayan', 'aldahayan'] },
  { code: 'ESC', vat: '311305800200003', names: ['الإسناد', 'الاسناد', 'esco', 'esnad'] },
  { code: 'MDJ', vat: '300691269100003', names: ['مدى الجزيرة', 'mada al jazeera', 'mada aljazeera'] },
  { code: 'ZMC', vat: '311047545800003', names: ['واجهات ذكية', 'zmco', 'smart facades'] },
  { code: 'TGF', vat: '', cr: '1010278952', names: ['تكنولوجيا الزجاج', 'techno glass', 'technoglass'] },
  { code: 'UNI', vat: '', cr: '1010263294', names: ['uniglass', 'المتحدة للصناعات الزجاجية'] },
  { code: 'SEC', vat: '312742275900003', names: ['سيكوريت', 'securit', 'مناع العمري'] },
  { code: 'HMC', vat: '311262234700003', names: ['حلول المعادن', 'metal solutions'] },
];

export const INVOICE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    supplier_name: { type: 'string' }, supplier_vat: { type: 'string' }, supplier_cr: { type: 'string' },
    document_type: { type: 'string', enum: ['invoice', 'quotation', 'delivery_note', 'other'] },
    document_number: { type: 'string' }, date: { type: 'string', description: 'Gregorian YYYY-MM-DD, empty if unknown' },
    prices_include_vat: { type: 'boolean' },
    lines: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      code: { type: 'string', description: 'supplier item code exactly as printed, empty if none' },
      description: { type: 'string' },
      unit: { type: 'string', enum: ['bar', 'pc', 'm', 'm2', 'kg', 'roll', 'box', 'sheet', 'other'] },
      qty: { type: 'number' }, unit_price: { type: 'number', description: 'price per unit EXCLUDING VAT' }, line_total: { type: 'number' },
      finish: { type: 'string', description: 'black / mill / bronze / white / champagne or empty' },
      length_m: { type: 'number', description: 'bar length in metres if stated (e.g. 6), else 0' },
    }, required: ['code', 'description', 'unit', 'qty', 'unit_price', 'line_total', 'finish', 'length_m'] } },
    notes: { type: 'string' },
  },
  required: ['supplier_name', 'supplier_vat', 'supplier_cr', 'document_type', 'document_number', 'date', 'prices_include_vat', 'lines', 'notes'],
};

const INVOICE_SYSTEM = `You extract line items from Saudi supplier invoices and quotations for an aluminium fabrication factory (aluminium profiles, glass, EPDM gaskets, brush seals, silicone, hardware, screws, steel, powder coating). Documents are in Arabic and/or English.
Rules:
- Copy supplier item codes exactly as printed (e.g. 1020070530). Leave code empty if there is none.
- unit: 'bar' for aluminium profile lengths sold per piece/length (حبة، عود، 6م), 'm2' for glass per square metre, 'm' per metre (ربل، فراشة بالمتر), 'roll' for rolls, 'kg' per kilogram, 'pc' for pieces, 'box', 'sheet'.
- unit_price must be EXCLUDING VAT. If the document shows prices including 15% VAT, divide by 1.15 and set prices_include_vat=true.
- Dates: output Gregorian YYYY-MM-DD; if only a Hijri date is printed, convert it.
- Never invent lines; skip subtotal/VAT/total rows. Put anything unclear in notes.`;

/** Extract one bill (PDF or image File) → { ...INVOICE_SCHEMA fields } */
export async function extractInvoice(file, settings, { signal, onRetry } = {}) {
  const block = await fileBlock(file);
  const { json, usage } = await callClaude({ settings, system: INVOICE_SYSTEM, schema: INVOICE_SCHEMA, signal, onRetry, content: [block, { type: 'text', text: `Extract all line items from this ${file.name}.` }] });
  return { ...json, usage };
}

/** Guess the supplier code from VAT / CR / name. */
export function detectSupplier({ supplier_name = '', supplier_vat = '', supplier_cr = '' }) {
  const vat = String(supplier_vat).replace(/\D/g, ''), cr = String(supplier_cr).replace(/\D/g, ''), nm = String(supplier_name).toLowerCase();
  for (const s of SUPPLIER_IDS) {
    if (s.vat && vat && vat === s.vat) return s.code;
    if (s.cr && cr && cr === s.cr) return s.code;
    if (s.names.some((n) => nm.includes(n))) return s.code;
  }
  return '';
}

/** Dahayan 10-digit SKU → 4-digit section (10 SSSS FF 30). */
export function dahayanSection(code) {
  const m = /^10(\d{4})(05|00|10|22)30$/.exec(String(code).trim());
  return m ? m[1] : null;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function nameSimilarity(a, b) {
  const ta = new Set(norm(a).split(' ').filter((x) => x.length > 1)), tb = new Set(norm(b).split(' ').filter((x) => x.length > 1));
  if (!ta.size || !tb.size) return 0;
  let inter = 0; for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

/** Match an extracted line to the price book: { status: exact|section|name|new, code, candidate } */
export function matchLine(line, priceBook) {
  const code = String(line.code || '').trim();
  if (code) {
    const exact = priceBook.find((p) => p.code === code);
    if (exact) return { status: 'exact', code: exact.code, candidate: exact };
    const sec = dahayanSection(code);
    if (sec) {
      const bySec = priceBook.find((p) => p.code === sec || dahayanSection(p.code) === sec);
      if (bySec) return { status: 'section', code: bySec.code, candidate: bySec, note: `section ${sec}` };
    }
  }
  let best = null, bestScore = 0;
  for (const p of priceBook) { const sc = nameSimilarity(line.description, p.name); if (sc > bestScore) { bestScore = sc; best = p; } }
  if (best && bestScore >= 0.6) return { status: 'name', code: best.code, candidate: best, score: bestScore };
  return { status: 'new', code: code || '', candidate: null, suggestion: best && bestScore >= 0.35 ? best : null };
}

const UNIT_MAP = { bar: 'bar', pc: 'pc', m: 'm', m2: 'm2', kg: 'kg', roll: 'roll', box: 'pc', sheet: 'pc', other: 'pc', length: 'bar', 'حبة': 'pc', 'عود': 'bar', 'قطعة': 'pc', 'م²': 'm2', 'م2': 'm2', 'متر مربع': 'm2', 'متر': 'm', 'م.ط': 'm', 'م': 'm', 'كجم': 'kg', 'كيلو': 'kg', 'لفة': 'roll', 'رول': 'roll', 'كرتون': 'pc', 'علبة': 'pc' };
/** Normalize a unit label (English/Arabic). `category` turns a generic piece (حبة) into a bar for profiles. */
export const normalizeUnit = (u, category) => { const k = String(u || '').trim().toLowerCase().replace(/\s+/g, ' '); const base = UNIT_MAP[k] || UNIT_MAP[String(u || '').trim()] || (/^m2|sqm|sq\.?m/.test(k) ? 'm2' : /box/.test(k) ? 'pc' : 'pc'); return base === 'pc' && category === 'profile' && /حبة|^pc$|^$|length/.test(k) ? 'bar' : base; };

/** Map a free-text category label (Arabic/English) to a price-book category. */
export function normalizeCategory(label) {
  const c = norm(label);
  if (!c) return '';
  if (/تيب|مستهلك|consumable|tape|disc|blade/.test(c)) return 'consumable';
  if (/إكسسوار|اكسسوار|ربل|براغي|سيليكون|hardware|accessor|gasket|screw|silicone|حديد|steel/.test(c)) return 'accessory';
  if (/زجاج|glass/.test(c)) return 'glass';
  if (/طلاء|دهان|coating|paint|service/.test(c)) return 'service';
  if (/قطاع|profile|aluminium|aluminum/.test(c)) return 'profile';
  return '';
}

/** Guess category from unit/description. */
export function guessCategory(line) {
  const d = norm(line.description);
  if (line.unit === 'm2' || /زجاج|glass|dgu|tempered|سيكوريت/.test(d)) return 'glass';
  if (line.unit === 'bar' || /حلق|درفة|بركلوز|انترلوك|قاطع|أدابتر|ادابتر|سكة|profile|mullion|frame|sash|bead/.test(d)) return 'profile';
  if (/طلاء|دهان|coating|paint/.test(d)) return 'service';
  if (/حجر|شفرة|تيب|لحام|disc|blade|tape|protect/.test(d)) return 'consumable';
  return 'accessory';
}

/** Auto-map spreadsheet headers to fields. */
export function guessColumns(headers) {
  const h = headers.map((x) => norm(x));
  const find = (...pats) => { const i = h.findIndex((x) => pats.some((p) => p.test(x))); return i >= 0 ? headers[i] : ''; };
  return {
    code: find(/^code$/, /كود|رقم الصنف|item ?code|sku|part|رمز/),
    name: find(/^name$|description|الوصف|البيان|اسم الصنف|^item$|^الصنف$|المادة|^desc/),
    unit: find(/^unit$|الوحدة|uom/),
    price: find(/قبل الضريبة|unit ?price|سعر الوحدة|السعر|^سعر|^price$|rate|excl/),
    category: find(/الفئة|category|التصنيف|group/),
    qty: find(/^qty$|quantity|الكمية|العدد/),
    supplier: find(/supplier|المورد|vendor/),
    date: find(/date|التاريخ/),
    source: find(/invoice|فاتورة|source|المصدر|ref|المرجع/),
  };
}
