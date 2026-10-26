// Read openings (marks, sizes, types) from architectural drawings, window schedules or site photos with AI.
import { callClaude, fileBlock } from '../ai/claude.js';

export const OPENINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    units_detected: { type: 'string', description: 'mm, cm or m as found on the drawing' },
    openings: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      mark: { type: 'string', description: 'tag such as W1, D2, SW-3; generate W1.. if none' },
      type: { type: 'string', enum: ['sliding', 'fixed', 'hinged', 'door', 'curtain_wall', 'other'] },
      width_mm: { type: 'number' }, height_mm: { type: 'number' },
      fix_height_mm: { type: 'number', description: 'height of a fixed top/bottom light if the opening has one, else 0' },
      panels: { type: 'integer', description: 'number of sliding panels or door leaves, 0 if unknown' },
      qty: { type: 'integer' },
      location: { type: 'string' }, notes: { type: 'string' },
      confidence: { type: 'number', description: '0..1 confidence that size and type are read correctly' },
    }, required: ['mark', 'type', 'width_mm', 'height_mm', 'fix_height_mm', 'panels', 'qty', 'location', 'notes', 'confidence'] } },
    notes: { type: 'string' },
  },
  required: ['units_detected', 'openings', 'notes'],
};

const SYSTEM = `You read architectural drawings, window/door schedules, elevations and site measurement photos for an aluminium window factory in Saudi Arabia (Arabic/English).
Extract every window, door, sliding or fixed opening with its width and height. Width is the horizontal dimension, height vertical.
Convert all sizes to millimetres (drawings are often in cm or m: 120×150 cm → 1200×1500 mm; 1.20×1.50 m → 1200×1500 mm).
Type: 'sliding' for sliding windows/doors (سحاب), 'fixed' (ثابت), 'hinged' for casement/top-hung windows (مفصلي، قلاب), 'door' for hinged doors (باب), 'curtain_wall' for curtain wall/facade.
If a schedule table exists, prefer its values. If an opening has a fixed light above or below the operable part, put that light's height in fix_height_mm.
Never invent openings; when a dimension is unreadable set confidence low and explain in notes.`;

export async function extractOpenings(files, settings, { signal, onRetry, hint = '' } = {}) {
  const blocks = [];
  for (let i = 0; i < files.length; i++) { blocks.push({ type: 'text', text: `File ${i + 1}: ${files[i].name}` }); blocks.push(await fileBlock(files[i])); }
  blocks.push({ type: 'text', text: `List all openings with sizes in mm.${hint ? ` Context from the user: ${hint}` : ''}` });
  const { json, usage } = await callClaude({ settings, system: SYSTEM, schema: OPENINGS_SCHEMA, content: blocks, signal, onRetry });
  return { ...json, usage };
}

/** Suggest a system id for an extracted opening from the library. */
export function suggestSystem(opening, systems) {
  const t = opening.type, hasFix = (Number(opening.fix_height_mm) || 0) > 0;
  const cat = t === 'hinged' ? 'hung' : t === 'curtain_wall' ? 'curtain_wall' : t;
  const list = systems.filter((s) => s.category === cat);
  if (!list.length) return '';
  const withFix = list.filter((s) => (s.params || []).some((p) => p.key === 'FIX' || p.key === 'TOP'));
  const noFix = list.filter((s) => !(s.params || []).some((p) => p.key === 'FIX'));
  const pick = hasFix ? (withFix[0] || list[0]) : (noFix[0] || list[0]);
  return pick.id;
}
