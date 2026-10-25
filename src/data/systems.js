// Default system library. All dimensions in mm. Formulas are evaluated by src/engine/formula.js.
// Each system is pure data: params → variables → profiles (pieces) → glass → accessories → drawing.
// Add a new system from the Systems screen (or duplicate one of these and edit the constants).

const SLIDING_CFG = {
  key: 'CFG', label: 'Panel configuration', type: 'select', default: '2',
  options: [
    { value: '2', label: '2 panels — S/S', set: { NS: 2, NF: 0, NP: 2, PATTERN: 'SS' } },
    { value: '3_SSS', label: '3 panels — S/S/S', set: { NS: 3, NF: 0, NP: 3, PATTERN: 'SSS' } },
    { value: '3_SFS', label: '3 panels — S/F/S', set: { NS: 2, NF: 1, NP: 3, PATTERN: 'SFS' } },
    { value: '4_FSSF', label: '4 panels — F/S/S/F', set: { NS: 2, NF: 2, NP: 4, PATTERN: 'FSSF' } },
  ],
};

const SLIDING_ACCESSORIES = [
  { code: '66993059', name: 'Sliding rollers (double) — كفرات', unit: 'pc', qty: '2 * NS' },
  { code: '442032', name: 'Crescent lock — كالون DOMUS', unit: 'pc', qty: 'ceil(NS / 2)' },
  { code: '11260006', name: 'Side handle — مسكة جانبية', unit: 'pc', qty: 'NS' },
  { code: 'ACC_SASH_CORNER', name: 'Sash corner cleats', unit: 'pc', qty: '4 * NP' },
  { code: 'WOOL_PILE_7_M', name: 'Wool pile 7 mm — فراشة', unit: 'm', qty: 'NS * 2 * (2 * SIDE + 2 * TB) / 1000' },
  { code: '556008E', name: 'EPDM glazing gasket — ربل', unit: 'm', qty: 'NP * 2 * 2 * (GW + GH) / 1000' },
  { code: 'ACC_FLY_ROLLER', name: 'Fly-screen rollers', unit: 'pc', qty: '2 * NS' },
  { code: '590056', name: 'Fly-screen handle', unit: 'pc', qty: 'NS' },
  { code: '590010', name: 'Frame end caps — طبة حلق', unit: 'pc', qty: '4' },
  { code: '961220', name: 'Screws 12×2', unit: 'pc', qty: '20 + 10 * NP' },
  { code: '564416', name: 'Silicone black 300 ml (1 tube / 8 lm)', unit: 'pc', qty: 'ceil(2 * (W + H) / 1000 / 8)' },
];

import { CLIST_SYSTEMS } from './systems-clist.js';

// Systems from Abdullah's skill files (factory cm sheets converted to mm).
const SKILL_SYSTEMS = [
  // =====================================================================================
  {
    id: 'SARAYA_120_SLIDING', supplier: 'DHY', family: 'Saraya 120', source: 'aluminum-fabrication-calculator skill (factory cm sheet)', verified: false,
    name: 'Saraya 120 — Sliding window / door',
    nameAr: 'سرايا 120 سحاب',
    category: 'sliding',
    mincoCode: 'SL94',
    description: 'Factory-sheet deductions (805797 / 802972 / 802971 / 801752), 8 mm glass pocket. Converted from the cm sheet to mm. TOP (top fixed light) formulas apply to the 2-panel configuration.',
    barLength: 6000,
    waste: 0.05,
    rounding: 1,
    defaultGlassKey: 'GL_6_CLEAR_TMP_SEC',
    params: [
      { key: 'W', label: 'Opening width', unit: 'mm', type: 'number', default: 2400 },
      { key: 'H', label: 'Opening height', unit: 'mm', type: 'number', default: 2200 },
      SLIDING_CFG,
      { key: 'TOP', label: 'Top fixed light height (0 = none)', unit: 'mm', type: 'number', default: 0 },
      { key: 'FLY', label: 'Fly screen', type: 'select', default: '1', options: [{ value: '1', label: 'Yes', set: { HASFLY: 1 } }, { value: '0', label: 'No', set: { HASFLY: 0 } }] },
    ],
    variables: [
      { key: 'FW', label: 'Frame width', expr: 'W - 83' },
      { key: 'FH', label: 'Frame height', expr: 'H - 83' },
      { key: 'SIDE', label: 'Sash stile', expr: 'if(TOP > 0, (H - TOP) - 69, H - 66)' },
      { key: 'CTR', label: 'Interlock', expr: 'SIDE' },
      { key: 'TB', label: 'Sash top/bottom rail', expr: "if(TOP > 0, (W - 191) / 2, pick(CFG, '2', W/2 - 93, '3_SSS', W/3 - 102, '3_SFS', W/3 - 69, '4_FSSF', W/4 - 81, W/2 - 93))" },
      { key: 'GW', label: 'Sash glass width', expr: 'TB - 4' },
      { key: 'GH', label: 'Sash glass height', expr: 'if(TOP > 0, SIDE - 108, SIDE - 109)' },
      { key: 'FLYW', label: 'Fly-screen width', expr: 'TB - 3' },
      { key: 'FLYH', label: 'Fly-screen height', expr: 'SIDE - 89' },
      { key: 'TOPGW', label: 'Top glass width', expr: 'W - 110' },
      { key: 'TOPGH', label: 'Top glass height', expr: 'if(TOP > 0, TOP - 55, 0)' },
    ],
    profiles: [
      { code: '1020070530', name: 'Frame 10 cm — حلق 10سم سرايا', finish: 'black', pieces: [
        { label: 'Head / sill', length: 'FW', qty: '2' },
        { label: 'Jamb', length: 'FH', qty: '2' },
      ] },
      { code: '1013100530', name: 'Transom 9.5 cm — قاطع ترانزم (top light)', finish: 'black', pieces: [
        { label: 'Transom', length: 'FW', qty: 'if(TOP > 0, 1, 0)' },
      ] },
      { code: '1012690530', name: 'Sash side — درفة جنب سوبر', finish: 'black', pieces: [
        { label: 'Sash stile (SIDE)', length: 'SIDE', qty: 'NS' },
        { label: 'Fixed panel stile', length: 'SIDE', qty: '2 * NF' },
      ] },
      { code: '1021430530', name: 'Interlock — انترلوك', finish: 'black', pieces: [
        { label: 'Interlock (CTR)', length: 'CTR', qty: 'NS' },
      ] },
      { code: '1010750530', name: 'Sash rail 6 cm — درفة 6سم', finish: 'black', pieces: [
        { label: 'Sash top / bottom rail', length: 'TB', qty: '2 * NS' },
        { label: 'Fixed panel rail', length: 'TB', qty: '2 * NF' },
      ] },
      { code: '1020890530', name: 'Glazing bead — بركلوز', finish: 'black', pieces: [
        { label: 'Bead horizontal', length: 'GW', qty: '2 * NP' },
        { label: 'Bead vertical', length: 'GH', qty: '2 * NP' },
        { label: 'Top light bead H', length: 'TOPGW', qty: 'if(TOP > 0, 2, 0)' },
        { label: 'Top light bead V', length: 'TOPGH', qty: 'if(TOP > 0, 2, 0)' },
      ] },
      { code: '1011390530', name: 'Fly-screen sash — درفة سلك سحاب', finish: 'black', pieces: [
        { label: 'Fly stile', length: 'FLYH', qty: '2 * NS * HASFLY' },
        { label: 'Fly rail', length: 'FLYW', qty: '2 * NS * HASFLY' },
      ] },
    ],
    glass: [
      { label: 'Sash glass', width: 'GW', height: 'GH', qty: 'NP' },
      { label: 'Top fixed glass', width: 'TOPGW', height: 'TOPGH', qty: 'if(TOP > 0, 1, 0)' },
    ],
    accessories: SLIDING_ACCESSORIES,
    drawing: { type: 'sliding', pattern: 'PATTERN', top: 'TOP' },
  },
  // =====================================================================================
  {
    id: 'SARAYA_105_FIXED', supplier: 'DHY', family: 'Saraya 105', source: 'aluminum-fabrication-calculator skill (factory cm sheet)', verified: false,
    name: 'Saraya 105 — Fixed window',
    nameAr: 'سرايا 105 ثابت',
    category: 'fixed',
    mincoCode: 'HW52',
    description: 'Frame 802995, 6 mm glass. Frame W−96 / H−96; glass W−62 × H−62; bead W−52 / H−96. Optional centre mullion.',
    barLength: 6000, waste: 0.05, rounding: 1,
    defaultGlassKey: 'GL_6_CLEAR_TMP_SEC',
    params: [
      { key: 'W', label: 'Opening width', unit: 'mm', type: 'number', default: 1200 },
      { key: 'H', label: 'Opening height', unit: 'mm', type: 'number', default: 1200 },
      { key: 'MUL', label: 'Centre mullion', type: 'select', default: '0', options: [{ value: '0', label: 'None', set: { NM: 0, NP: 1, COLS: 1 } }, { value: '1', label: 'One centre mullion', set: { NM: 1, NP: 2, COLS: 2 } }] },
    ],
    variables: [
      { key: 'FW', expr: 'W - 96' }, { key: 'FH', expr: 'H - 96' },
      { key: 'GW', expr: 'if(NM > 0, W/2 - 50, W - 62)' }, { key: 'GH', expr: 'H - 62' },
      { key: 'BW', expr: 'if(NM > 0, W/2 - 40, W - 52)' }, { key: 'BH', expr: 'H - 96' },
      { key: 'TF', expr: 'H - 52' },
    ],
    profiles: [
      { code: '802995', name: 'Fixed frame 802995', finish: 'black', pieces: [{ label: 'Head / sill', length: 'FW', qty: '2' }, { label: 'Jamb', length: 'FH', qty: '2' }] },
      { code: '1011570530', name: 'T mullion 7 cm — قاطع تي', finish: 'black', pieces: [{ label: 'Centre mullion', length: 'TF', qty: 'NM' }] },
      { code: '1020890530', name: 'Glazing bead — بركلوز', finish: 'black', pieces: [{ label: 'Bead horizontal', length: 'BW', qty: '2 * NP' }, { label: 'Bead vertical', length: 'BH', qty: '2 * NP' }] },
    ],
    glass: [{ label: 'Fixed glass', width: 'GW', height: 'GH', qty: 'NP' }],
    accessories: [
      { code: 'ACC_SASH_CORNER', name: 'Frame corner cleats', unit: 'pc', qty: '4' },
      { code: '556008E', name: 'EPDM glazing gasket', unit: 'm', qty: 'NP * 2 * 2 * (GW + GH) / 1000' },
      { code: '961220', name: 'Screws 12×2', unit: 'pc', qty: '16 + 8 * NM' },
      { code: '564416', name: 'Silicone black (1 tube / 8 lm)', unit: 'pc', qty: 'ceil(2 * (W + H) / 1000 / 8)' },
    ],
    drawing: { type: 'fixed', cols: 'COLS' },
  },
  // =====================================================================================
  {
    id: 'SARAYA_105_HUNG', supplier: 'DHY', family: 'Saraya 105', source: 'aluminum-fabrication-calculator skill (factory cm sheet)', verified: false,
    name: 'Saraya 105 — Top-hung over fixed (2 equal parts)',
    nameAr: 'سرايا 105 قلاب مع ثابت',
    category: 'hung',
    mincoCode: 'HW52',
    description: 'Frame 802995, sash 802988, 6 mm glass. Frame W−96/H−96; sash W−227.5 × H/2−215.5; sash glass W−192 × H/2−180; T-frame W−52; fixed glass W−62 × H/2−50; flyscreen W−93 × H/2−76.',
    barLength: 6000, waste: 0.05, rounding: 0.5,
    defaultGlassKey: 'GL_6_CLEAR_TMP_SEC',
    params: [
      { key: 'W', label: 'Opening width', unit: 'mm', type: 'number', default: 1000 },
      { key: 'H', label: 'Opening height', unit: 'mm', type: 'number', default: 1400 },
      { key: 'FLY', label: 'Fly screen', type: 'select', default: '1', options: [{ value: '1', label: 'Yes', set: { HASFLY: 1 } }, { value: '0', label: 'No', set: { HASFLY: 0 } }] },
    ],
    variables: [
      { key: 'FW', expr: 'W - 96' }, { key: 'FH', expr: 'H - 96' },
      { key: 'SW', expr: 'W - 227.5' }, { key: 'SH', expr: 'H/2 - 215.5' },
      { key: 'SGW', expr: 'W - 192' }, { key: 'SGH', expr: 'H/2 - 180' },
      { key: 'TF', expr: 'W - 52' },
      { key: 'FGW', expr: 'W - 62' }, { key: 'FGH', expr: 'H/2 - 50' },
      { key: 'FLYW', expr: 'W - 93' }, { key: 'FLYH', expr: 'H/2 - 76' },
    ],
    profiles: [
      { code: '802995', name: 'Frame 802995', finish: 'black', pieces: [{ label: 'Head / sill', length: 'FW', qty: '2' }, { label: 'Jamb', length: 'FH', qty: '2' }, { label: 'T-frame (transom)', length: 'TF', qty: '1' }] },
      { code: '802988', name: 'Hung sash 802988', finish: 'black', pieces: [{ label: 'Sash rail', length: 'SW', qty: '2' }, { label: 'Sash stile', length: 'SH', qty: '2' }] },
      { code: '1020890530', name: 'Glazing bead — بركلوز', finish: 'black', pieces: [{ label: 'Fixed bead H', length: 'FGW', qty: '2' }, { label: 'Fixed bead V', length: 'FGH', qty: '2' }, { label: 'Sash bead H', length: 'SGW', qty: '2' }, { label: 'Sash bead V', length: 'SGH', qty: '2' }] },
      { code: '1020250530', name: 'Fixed fly-screen sash — درفة سلك ثابت', finish: 'black', pieces: [{ label: 'Fly rail', length: 'FLYW', qty: '2 * HASFLY' }, { label: 'Fly stile', length: 'FLYH', qty: '2 * HASFLY' }] },
    ],
    glass: [
      { label: 'Sash glass (top hung)', width: 'SGW', height: 'SGH', qty: '1' },
      { label: 'Fixed glass (bottom)', width: 'FGW', height: 'FGH', qty: '1' },
    ],
    accessories: [
      { code: 'ACC_SASH_CORNER', name: 'Corner cleats (frame + sash)', unit: 'pc', qty: '8' },
      { code: '351160', name: 'Friction stays 60 cm (pair)', unit: 'pc', qty: '2' },
      { code: '121006', name: 'Casement handle + lock', unit: 'pc', qty: '1' },
      { code: '556008E', name: 'EPDM glazing gasket', unit: 'm', qty: '2 * 2 * (SGW + SGH + FGW + FGH) / 1000' },
      { code: 'WOOL_PILE_7_M', name: 'Weather pile', unit: 'm', qty: '2 * (SW + SH) / 1000' },
      { code: '961220', name: 'Screws 12×2', unit: 'pc', qty: '30' },
      { code: '564416', name: 'Silicone black', unit: 'pc', qty: 'ceil(2 * (W + H) / 1000 / 8)' },
    ],
    drawing: { type: 'hung' },
  },
  // =====================================================================================
  {
    id: 'ROYAL_120_SLIDING_2P', supplier: 'DHY', family: 'Royal 120', source: 'sliding-window-cutting-list skill (Kw/Dh/Dg)', verified: false,
    name: 'Royal 120 — 2-panel sliding (Kw/Dh/Dg model)',
    nameAr: 'رويال 120 سحاب درفتين',
    category: 'sliding',
    mincoCode: 'SL120',
    description: 'Generic 2-panel model: Sash_W = W/2 + Kw; Sash_H = H − Dh; Glass = Sash − Dg. Royal 120: Kw 25, Dh 60 (std rollers) / 65 (high), Dg 125 (130 heavy DGU). Change the constants for any other 2-panel system.',
    barLength: 6000, waste: 0.05, rounding: 1,
    defaultGlassKey: 'GL_DGU24_HDGREY_TGF',
    constants: [
      { key: 'KW', label: 'Kw — sash width increase', value: 25 },
      { key: 'DG', label: 'Dg — glass deduction', value: 125 },
      { key: 'DH_STD', label: 'Dh — standard rollers', value: 60 },
      { key: 'DH_HIGH', label: 'Dh — high rollers', value: 65 },
    ],
    params: [
      { key: 'W', label: 'Frame outside width', unit: 'mm', type: 'number', default: 2000 },
      { key: 'H', label: 'Frame outside height', unit: 'mm', type: 'number', default: 1500 },
      { key: 'ROLL', label: 'Rollers', type: 'select', default: 'std', options: [{ value: 'std', label: 'Standard', set: { DH: 60 } }, { value: 'high', label: 'High (heavy glass)', set: { DH: 65 } }] },
    ],
    variables: [
      { key: 'NS', expr: '2' }, { key: 'NF', expr: '0' }, { key: 'NP', expr: '2' },
      { key: 'SW', label: 'Sash width', expr: 'W / 2 + KW' },
      { key: 'SH', label: 'Sash height', expr: 'H - DH' },
      { key: 'GW', expr: 'SW - DG' }, { key: 'GH', expr: 'SH - DG' },
      { key: 'SIDE', expr: 'SH' }, { key: 'TB', expr: 'SW' },
    ],
    profiles: [
      { code: '1010350530', name: 'Royal frame 12 cm — حلق 12سم رويال', finish: 'black', pieces: [{ label: 'Head / sill', length: 'W', qty: '2' }, { label: 'Jamb', length: 'H', qty: '2' }] },
      { code: '1013290030', name: 'Royal sash — درفة رويال (mill, verify black price)', finish: 'mill', pieces: [{ label: 'Sash stile (handle side)', length: 'SH', qty: '2' }, { label: 'Sash top / bottom rail', length: 'SW', qty: '4' }] },
      { code: '1021570530', name: 'Interlock / adaptor — أدابتر رويال', finish: 'black', pieces: [{ label: 'Interlock', length: 'SH', qty: '2' }] },
      { code: '1020060030', name: 'Royal bead — طبشة رويال', finish: 'mill', pieces: [{ label: 'Bead H', length: 'GW', qty: '4' }, { label: 'Bead V', length: 'GH', qty: '4' }] },
    ],
    glass: [{ label: 'Sash glass', width: 'GW', height: 'GH', qty: '2' }],
    accessories: [
      { code: '66993059', name: 'Rollers (double, 2 per sash; 4 for heavy)', unit: 'pc', qty: "if(ROLL == 'high', 8, 4)" },
      { code: '442032', name: 'Lock', unit: 'pc', qty: '1' },
      { code: '11260006', name: 'Side handle', unit: 'pc', qty: '2' },
      { code: 'WOOL_PILE_10_M', name: 'Wool pile 10 mm', unit: 'm', qty: '2 * (2 * SH + 2 * SW) * 2 / 1000' },
      { code: '556008E', name: 'EPDM glazing gasket', unit: 'm', qty: '2 * 2 * 2 * (GW + GH) / 1000' },
      { code: 'ACC_SASH_CORNER', name: 'Corner cleats', unit: 'pc', qty: '12' },
      { code: '961220', name: 'Screws', unit: 'pc', qty: '40' },
      { code: '564416', name: 'Silicone black', unit: 'pc', qty: 'ceil(2 * (W + H) / 1000 / 8)' },
    ],
    drawing: { type: 'sliding', pattern: "'SS'" },
  },

];

export const DEFAULT_SYSTEMS = [...CLIST_SYSTEMS, ...SKILL_SYSTEMS];

/** Systems removed from the library because their deductions were assumptions, not factory data. */
export const RETIRED_SYSTEM_IDS = ['BOX_HINGED_DOOR', 'SG50_STICK_CW'];
export const LIBRARY_VERSION = 2;

export const CATEGORIES = [
  { id: 'sliding', label: 'Sliding windows & doors' },
  { id: 'fixed', label: 'Fixed windows' },
  { id: 'hung', label: 'Hinged / casement windows' },
  { id: 'door', label: 'Hinged doors' },
  { id: 'curtain_wall', label: 'Curtain wall / structural glazing' },
  { id: 'skylight', label: 'Skylights' },
  { id: 'railing', label: 'Railings & partitions' },
  { id: 'other', label: 'Other' },
];
