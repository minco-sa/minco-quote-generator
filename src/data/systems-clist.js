// Systems transcribed 1:1 from the factory workbook WINDOWS_C_LIST.xlsx (7 sheets).
// Every formula below is the sheet formula; nothing is added. W, H and FIX are the sheet inputs (mm).
// Glass sizes and hardware are NOT on the sheets, so they are left empty and flagged — add them when the
// factory confirms the deductions. Profile codes come from the section drawings embedded in the sheets
// (1210/1211 sliding frame, 2154 transom adaptor, 1283 threshold); the other profiles are placeholders
// (TBD_…) until the supplier section numbers are assigned in the Price book.

const SRC = 'WINDOWS_C_LIST.xlsx';
const NOGLASS = 'Glass sizes are not on the cutting sheet. Add the glass formula in the Glass tab when known.';

const paramsWH = (w, h) => [
  { key: 'W', label: 'W (as on cutting sheet)', unit: 'mm', type: 'number', default: w },
  { key: 'H', label: 'H (as on cutting sheet)', unit: 'mm', type: 'number', default: h },
];
const paramFix = (v) => ({ key: 'FIX', label: 'FIX — fixed light height', unit: 'mm', type: 'number', default: v });

export const CLIST_SYSTEMS = [
  {
    id: 'CL_SLIDING_2P', name: 'Sliding window — 2 panels (sheet: SLIDING)', nameAr: 'شباك سحاب درفتين', category: 'sliding',
    supplier: 'DHY', family: '120 series (sections 1210 / 1211)', source: SRC, verified: true, glassNote: NOGLASS,
    description: 'Sheet SLIDING: FRAME W = W+86 ×2 · FRAME H = H+86 ×2 · SASH W = (W+10)/2 ×4 · SASH H = H−58 ×4 · INTERLOCK = H−58 ×2.',
    barLength: 6000, waste: 0.05, rounding: 1, areaW: 'W + 86', areaH: 'H + 86',
    params: paramsWH(2000, 1500),
    variables: [
      { key: 'FRAME_W', label: 'Frame W', expr: 'W + 86' }, { key: 'FRAME_H', label: 'Frame H', expr: 'H + 86' },
      { key: 'SASH_W', label: 'Sash W', expr: '(W + 10) / 2' }, { key: 'SASH_H', label: 'Sash H', expr: 'H - 58' },
      { key: 'INTERLOCK', label: 'Interlock', expr: 'H - 58' }, { key: 'PATTERN', expr: "'SS'" },
    ],
    profiles: [
      { code: '1210', name: 'Sliding frame 120 — section 1210 (1.5 mm) / 1211 (1.8 mm)', finish: 'black', weightKgM: 2.008, pieces: [{ label: 'FRAME W', length: 'FRAME_W', qty: '2' }, { label: 'FRAME H', length: 'FRAME_H', qty: '2' }] },
      { code: 'TBD_SL_SASH', name: 'Sliding sash (assign section)', finish: 'black', pieces: [{ label: 'SASH W', length: 'SASH_W', qty: '4' }, { label: 'SASH H', length: 'SASH_H', qty: '4' }] },
      { code: 'TBD_SL_INTERLOCK', name: 'Interlock (assign section)', finish: 'black', pieces: [{ label: 'INTERLOCK', length: 'INTERLOCK', qty: '2' }] },
    ],
    glass: [], accessories: [],
    drawing: { type: 'sliding', pattern: 'PATTERN' },
  },
  {
    id: 'CL_SLIDING_2P_FIX', name: 'Sliding window — 2 panels + 1 fixed (sheet: SLIDING WITH FIX)', nameAr: 'شباك سحاب درفتين مع ثابت', category: 'sliding',
    supplier: 'DHY', family: '120 series (sections 1210 / 1211, adaptor 2154)', source: SRC, verified: true, glassNote: NOGLASS,
    description: 'Sheet SLIDING WITH FIX: FRAME W = W+86 ×2 · FRAME H = H+86 ×2 · SASH W = (W+10)/2 ×4 · SASH H = H−FIX−40 ×4 · INTERLOCK = H−FIX−40 ×2 · TRANSOM = W−74 ×1 · TR ADP W = W−74 / TR ADP H = FIX−55 ×2 · G BEAD W = W−88 ×2 · G BEAD H = FIX−109 ×2.',
    barLength: 6000, waste: 0.05, rounding: 1, areaW: 'W + 86', areaH: 'H + 86',
    params: [...paramsWH(2000, 2400), paramFix(600)],
    variables: [
      { key: 'FRAME_W', expr: 'W + 86' }, { key: 'FRAME_H', expr: 'H + 86' },
      { key: 'SASH_W', expr: '(W + 10) / 2' }, { key: 'SASH_H', expr: 'H - FIX - 40' }, { key: 'INTERLOCK', expr: 'H - FIX - 40' },
      { key: 'TRANSOM', expr: 'W - 74' }, { key: 'TR_ADP_W', expr: 'W - 74' }, { key: 'TR_ADP_H', expr: 'FIX - 55' },
      { key: 'G_BEAD_W', expr: 'W - 88' }, { key: 'G_BEAD_H', expr: 'FIX - 109' }, { key: 'PATTERN', expr: "'SS'" },
    ],
    profiles: [
      { code: '1210', name: 'Sliding frame 120 — section 1210 / 1211', finish: 'black', weightKgM: 2.008, pieces: [{ label: 'FRAME W', length: 'FRAME_W', qty: '2' }, { label: 'FRAME H', length: 'FRAME_H', qty: '2' }] },
      { code: 'TBD_SL_SASH', name: 'Sliding sash (assign section)', finish: 'black', pieces: [{ label: 'SASH W', length: 'SASH_W', qty: '4' }, { label: 'SASH H', length: 'SASH_H', qty: '4' }] },
      { code: 'TBD_SL_INTERLOCK', name: 'Interlock (assign section)', finish: 'black', pieces: [{ label: 'INTERLOCK', length: 'INTERLOCK', qty: '2' }] },
      { code: 'TBD_SL_TRANSOM', name: 'Transom (assign section)', finish: 'black', pieces: [{ label: 'TRANSOM', length: 'TRANSOM', qty: '1' }] },
      { code: '2154', name: 'Transom adaptor — section 2154 (0.836 kg/m)', finish: 'black', weightKgM: 0.836, pieces: [{ label: 'TR ADP W', length: 'TR_ADP_W', qty: '2' }, { label: 'TR ADP H', length: 'TR_ADP_H', qty: '2' }] },
      { code: 'TBD_GBEAD', name: 'Glazing bead (assign section)', finish: 'black', pieces: [{ label: 'G BEAD W', length: 'G_BEAD_W', qty: '2' }, { label: 'G BEAD H', length: 'G_BEAD_H', qty: '2' }] },
    ],
    glass: [], accessories: [],
    drawing: { type: 'sliding', pattern: 'PATTERN', top: 'FIX' },
  },
  {
    id: 'CL_HINGED_FIX', name: 'Hinged window + 1 fixed (sheet: HINGED WITH FIX)', nameAr: 'شباك مفصلي مع ثابت', category: 'hung',
    supplier: 'DHY', family: 'Hinged series (sections to assign)', source: SRC, verified: true, glassNote: NOGLASS,
    description: 'Sheet HINGED WITH FIX: FRAME W = W+80 ×2 · FRAME H = H+80 ×2 · SASH W = W−34 ×2 · SASH H = H−FIX−25 ×2 · TRANSOM = W−46 ×1 · SASH G BEAD W = W−138 ×2 · SASH G BEAD H = SASH H−148 ×2 · G BEAD W = W−46 ×2 · G BEAD H = FIX−81 ×2.',
    barLength: 6000, waste: 0.05, rounding: 1, areaW: 'W + 80', areaH: 'H + 80',
    params: [...paramsWH(1000, 1500), paramFix(400)],
    variables: [
      { key: 'FRAME_W', expr: 'W + 80' }, { key: 'FRAME_H', expr: 'H + 80' },
      { key: 'SASH_W', expr: 'W - 34' }, { key: 'SASH_H', expr: 'H - FIX - 25' }, { key: 'TRANSOM', expr: 'W - 46' },
      { key: 'SASH_GB_W', expr: 'W - 138' }, { key: 'SASH_GB_H', expr: 'SASH_H - 148' },
      { key: 'G_BEAD_W', expr: 'W - 46' }, { key: 'G_BEAD_H', expr: 'FIX - 81' },
    ],
    profiles: [
      { code: 'TBD_HW_FRAME', name: 'Hinged frame (assign section)', finish: 'black', pieces: [{ label: 'FRAME W', length: 'FRAME_W', qty: '2' }, { label: 'FRAME H', length: 'FRAME_H', qty: '2' }] },
      { code: 'TBD_HW_SASH', name: 'Hinged sash (assign section)', finish: 'black', pieces: [{ label: 'SASH W', length: 'SASH_W', qty: '2' }, { label: 'SASH H', length: 'SASH_H', qty: '2' }] },
      { code: 'TBD_HW_TRANSOM', name: 'Transom (assign section)', finish: 'black', pieces: [{ label: 'TRANSOM', length: 'TRANSOM', qty: '1' }] },
      { code: 'TBD_GBEAD', name: 'Glazing bead (assign section)', finish: 'black', pieces: [{ label: 'SASH G BEAD W', length: 'SASH_GB_W', qty: '2' }, { label: 'SASH G BEAD H', length: 'SASH_GB_H', qty: '2' }, { label: 'G BEAD W', length: 'G_BEAD_W', qty: '2' }, { label: 'G BEAD H', length: 'G_BEAD_H', qty: '2' }] },
    ],
    glass: [], accessories: [],
    drawing: { type: 'casement', leaves: '1', fixTop: 'FIX' },
  },
  {
    id: 'CL_HINGED_2FIX', name: 'Hinged window + 2 fixed (sheet: HINGED WITH 2 FIX)', nameAr: 'شباك مفصلي مع ثابتين', category: 'hung',
    supplier: 'DHY', family: 'Hinged series (sections to assign)', source: SRC, verified: true, glassNote: NOGLASS,
    description: 'Sheet HINGED WITH 2 FIX: FRAME W = W+80 ×2 · FRAME H = H+80 ×2 · SASH W = W−34 ×2 · SASH H = H−2·FIX−16 ×2 · TRANSOM = W−46 ×2 · SASH G BEAD W = W−138 ×2 · SASH G BEAD H = SASH H−148 ×2 · G BEAD W = W−46 ×4 · G BEAD H = FIX−81 ×4.',
    barLength: 6000, waste: 0.05, rounding: 1, areaW: 'W + 80', areaH: 'H + 80',
    params: [...paramsWH(1000, 2000), paramFix(400)],
    variables: [
      { key: 'FRAME_W', expr: 'W + 80' }, { key: 'FRAME_H', expr: 'H + 80' },
      { key: 'SASH_W', expr: 'W - 34' }, { key: 'SASH_H', expr: 'H - (2 * FIX) - 16' }, { key: 'TRANSOM', expr: 'W - 46' },
      { key: 'SASH_GB_W', expr: 'W - 138' }, { key: 'SASH_GB_H', expr: 'SASH_H - 148' },
      { key: 'G_BEAD_W', expr: 'W - 46' }, { key: 'G_BEAD_H', expr: 'FIX - 81' },
    ],
    profiles: [
      { code: 'TBD_HW_FRAME', name: 'Hinged frame (assign section)', finish: 'black', pieces: [{ label: 'FRAME W', length: 'FRAME_W', qty: '2' }, { label: 'FRAME H', length: 'FRAME_H', qty: '2' }] },
      { code: 'TBD_HW_SASH', name: 'Hinged sash (assign section)', finish: 'black', pieces: [{ label: 'SASH W', length: 'SASH_W', qty: '2' }, { label: 'SASH H', length: 'SASH_H', qty: '2' }] },
      { code: 'TBD_HW_TRANSOM', name: 'Transom (assign section)', finish: 'black', pieces: [{ label: 'TRANSOM', length: 'TRANSOM', qty: '2' }] },
      { code: 'TBD_GBEAD', name: 'Glazing bead (assign section)', finish: 'black', pieces: [{ label: 'SASH G BEAD W', length: 'SASH_GB_W', qty: '2' }, { label: 'SASH G BEAD H', length: 'SASH_GB_H', qty: '2' }, { label: 'G BEAD W', length: 'G_BEAD_W', qty: '4' }, { label: 'G BEAD H', length: 'G_BEAD_H', qty: '4' }] },
    ],
    glass: [], accessories: [],
    drawing: { type: 'casement', leaves: '1', fixTop: 'FIX', fixBottom: 'FIX' },
  },
  {
    id: 'CL_FIXED', name: 'Fixed window (sheet: FIXED)', nameAr: 'شباك ثابت', category: 'fixed',
    supplier: 'DHY', family: 'Hinged series frame (sections to assign)', source: SRC, verified: true, glassNote: NOGLASS,
    description: 'Sheet FIXED: FRAME W = W+80 ×2 · FRAME H = H+80 ×2 · G BEAD W = W−46 ×2 · G BEAD H = H−90 ×2.',
    barLength: 6000, waste: 0.05, rounding: 1, areaW: 'W + 80', areaH: 'H + 80',
    params: paramsWH(1000, 1000),
    variables: [
      { key: 'FRAME_W', expr: 'W + 80' }, { key: 'FRAME_H', expr: 'H + 80' },
      { key: 'G_BEAD_W', expr: 'W - 46' }, { key: 'G_BEAD_H', expr: 'H - 90' }, { key: 'COLS', expr: '1' },
    ],
    profiles: [
      { code: 'TBD_HW_FRAME', name: 'Frame (assign section)', finish: 'black', pieces: [{ label: 'FRAME W', length: 'FRAME_W', qty: '2' }, { label: 'FRAME H', length: 'FRAME_H', qty: '2' }] },
      { code: 'TBD_GBEAD', name: 'Glazing bead (assign section)', finish: 'black', pieces: [{ label: 'G BEAD W', length: 'G_BEAD_W', qty: '2' }, { label: 'G BEAD H', length: 'G_BEAD_H', qty: '2' }] },
    ],
    glass: [], accessories: [],
    drawing: { type: 'fixed', cols: 'COLS' },
  },
  {
    id: 'CL_DOOR_1LEAF', name: 'Door — 1 leaf (sheet: DOOR 1 LEAF)', nameAr: 'باب درفة واحدة', category: 'door',
    supplier: 'DHY', family: 'Door series (threshold section 1283)', source: SRC, verified: true, glassNote: NOGLASS,
    description: 'Sheet DOOR 1 LEAF: FRAME W = W+80 ×1 · FRAME H = H+40 ×2 · SASH W = W−34 ×1 · SASH H = H−24 ×2 · SASH G BEAD W = W−176 ×2 · SASH G BEAD H = SASH H−214 ×2 · THRESHOLD = W−176 ×1.',
    barLength: 6000, waste: 0.05, rounding: 1, areaW: 'W + 80', areaH: 'H + 40',
    params: paramsWH(900, 2100),
    variables: [
      { key: 'FRAME_W', expr: 'W + 80' }, { key: 'FRAME_H', expr: 'H + 40' },
      { key: 'SASH_W', expr: 'W - 34' }, { key: 'SASH_H', expr: 'H - 24' },
      { key: 'SASH_GB_W', expr: 'W - 176' }, { key: 'SASH_GB_H', expr: 'SASH_H - 214' }, { key: 'THRESHOLD', expr: 'W - 176' },
    ],
    profiles: [
      { code: 'TBD_DOOR_FRAME', name: 'Door frame (assign section)', finish: 'black', pieces: [{ label: 'FRAME W', length: 'FRAME_W', qty: '1' }, { label: 'FRAME H', length: 'FRAME_H', qty: '2' }] },
      { code: 'TBD_DOOR_SASH', name: 'Door sash (assign section)', finish: 'black', pieces: [{ label: 'SASH W', length: 'SASH_W', qty: '1' }, { label: 'SASH H', length: 'SASH_H', qty: '2' }] },
      { code: 'TBD_GBEAD', name: 'Glazing bead (assign section)', finish: 'black', pieces: [{ label: 'SASH G BEAD W', length: 'SASH_GB_W', qty: '2' }, { label: 'SASH G BEAD H', length: 'SASH_GB_H', qty: '2' }] },
      { code: '1283', name: 'Threshold — section 1283 (1.329 kg/m)', finish: 'black', weightKgM: 1.329, pieces: [{ label: 'THRESHOLD', length: 'THRESHOLD', qty: '1' }] },
    ],
    glass: [], accessories: [],
    drawing: { type: 'door', leaves: '1' },
  },
  {
    id: 'CL_DOOR_FIX', name: 'Door + fixed light (sheet: DOOR WITH FIX)', nameAr: 'باب مع ثابت', category: 'door',
    supplier: 'DHY', family: 'Door series (threshold section 1283)', source: SRC, verified: true, glassNote: NOGLASS,
    description: 'Sheet DOOR WITH FIX: FRAME W = W+80 ×1 · FRAME H = H+80 ×2 · SASH W = W−34 ×1 · SASH H = H−FIX−17 ×2 · TRANSOM = W−46 ×1 · SASH G BEAD W = W−176 ×2 · SASH G BEAD H = SASH H−214 ×2 · G BEAD W = W−46 ×2 · G BEAD H = FIX−81 ×2 · THRESHOLD = W−176 ×1.',
    barLength: 6000, waste: 0.05, rounding: 1, areaW: 'W + 80', areaH: 'H + 80',
    params: [...paramsWH(900, 2600), paramFix(500)],
    variables: [
      { key: 'FRAME_W', expr: 'W + 80' }, { key: 'FRAME_H', expr: 'H + 80' },
      { key: 'SASH_W', expr: 'W - 34' }, { key: 'SASH_H', expr: 'H - FIX - 17' }, { key: 'TRANSOM', expr: 'W - 46' },
      { key: 'SASH_GB_W', expr: 'W - 176' }, { key: 'SASH_GB_H', expr: 'SASH_H - 214' },
      { key: 'G_BEAD_W', expr: 'W - 46' }, { key: 'G_BEAD_H', expr: 'FIX - 81' }, { key: 'THRESHOLD', expr: 'W - 176' },
    ],
    profiles: [
      { code: 'TBD_DOOR_FRAME', name: 'Door frame (assign section)', finish: 'black', pieces: [{ label: 'FRAME W', length: 'FRAME_W', qty: '1' }, { label: 'FRAME H', length: 'FRAME_H', qty: '2' }] },
      { code: 'TBD_DOOR_SASH', name: 'Door sash (assign section)', finish: 'black', pieces: [{ label: 'SASH W', length: 'SASH_W', qty: '1' }, { label: 'SASH H', length: 'SASH_H', qty: '2' }] },
      { code: 'TBD_HW_TRANSOM', name: 'Transom (assign section)', finish: 'black', pieces: [{ label: 'TRANSOM', length: 'TRANSOM', qty: '1' }] },
      { code: 'TBD_GBEAD', name: 'Glazing bead (assign section)', finish: 'black', pieces: [{ label: 'SASH G BEAD W', length: 'SASH_GB_W', qty: '2' }, { label: 'SASH G BEAD H', length: 'SASH_GB_H', qty: '2' }, { label: 'G BEAD W', length: 'G_BEAD_W', qty: '2' }, { label: 'G BEAD H', length: 'G_BEAD_H', qty: '2' }] },
      { code: '1283', name: 'Threshold — section 1283 (1.329 kg/m)', finish: 'black', weightKgM: 1.329, pieces: [{ label: 'THRESHOLD', length: 'THRESHOLD', qty: '1' }] },
    ],
    glass: [], accessories: [],
    drawing: { type: 'door', leaves: '1', fixTop: 'FIX' },
  },
];

/** Price-book placeholders for the sections named in the sheets and the profiles still to be assigned. */
export const CLIST_PRICE_PLACEHOLDERS = [
  { code: '1210', name: 'Sliding frame 120 × 79.5 — section 1210, 1.5 mm, 2.008 kg/m', category: 'profile', unit: 'bar', price: 0, supplier: 'DHY', date: '', source: 'MISSING', weightKgM: 2.008 },
  { code: '1211', name: 'Sliding frame 120 × 79.5 — section 1211, 1.8 mm, 2.372 kg/m', category: 'profile', unit: 'bar', price: 0, supplier: 'DHY', date: '', source: 'MISSING', weightKgM: 2.372 },
  { code: '2154', name: 'Transom adaptor 100 × 48.4 — section 2154, 0.836 kg/m', category: 'profile', unit: 'bar', price: 0, supplier: 'DHY', date: '', source: 'MISSING', weightKgM: 0.836 },
  { code: '1283', name: 'Threshold / sill 120 × 45 — section 1283, 1.4 mm, 1.329 kg/m', category: 'profile', unit: 'bar', price: 0, supplier: 'DHY', date: '', source: 'MISSING', weightKgM: 1.329 },
  { code: 'TBD_SL_SASH', name: '⚠ assign section: sliding sash', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
  { code: 'TBD_SL_INTERLOCK', name: '⚠ assign section: sliding interlock', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
  { code: 'TBD_SL_TRANSOM', name: '⚠ assign section: sliding transom', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
  { code: 'TBD_HW_FRAME', name: '⚠ assign section: hinged / fixed frame', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
  { code: 'TBD_HW_SASH', name: '⚠ assign section: hinged sash', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
  { code: 'TBD_HW_TRANSOM', name: '⚠ assign section: transom', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
  { code: 'TBD_GBEAD', name: '⚠ assign section: glazing bead', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
  { code: 'TBD_DOOR_FRAME', name: '⚠ assign section: door frame', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
  { code: 'TBD_DOOR_SASH', name: '⚠ assign section: door sash', category: 'profile', unit: 'bar', price: 0, supplier: '', date: '', source: 'MISSING' },
];
