# MINCO Estimator — aluminium costing, quotations & shop drawings

Static web application (no build step, no server, no AI guessing). Open `index.html` through any static
server (`npm start` → http://localhost:8080) or GitHub Pages. Data is stored in the browser (localStorage)
and can be exported/imported as JSON or pushed to a webhook (n8n / Make / Odoo).

## Workflow

1. **Estimator** — choose a system, enter W × H (mm) and the configuration (panels, top light, mullion, leaves,
   grid…). The engine produces the cutting list, glass sizes, accessories and a cost sheet:
   aluminium (theoretical bars incl. waste) + powder coating + glass (supplier minimum area per lite + waste)
   + accessories + labour (fabrication / installation per m²) + overhead → **cost per m²**, then profit →
   **selling price per m²**, VAT shown separately.
2. **Quotations** — openings are collected per project with client data, discount, validity and a reference
   `MINCO/Q/YYYY/MMDD-PROJECT`. Status pipeline: draft → sent → approved / rejected / expired → in production →
   delivered. Print a client-facing quotation (no internal costs), export JSON/CSV, push to a webhook.
3. **Shop drawings** (unlocked when the customer approves) — per opening: elevation drawing, cutting list,
   key dimensions, glass and hardware; project-wide: **bar optimization** (first-fit-decreasing into 6 m stock
   with kerf, whole bars only, diagrams per bar), aluminium purchase list, glass order, hardware order.
   Exports: cutting-list CSV, glass CSV, production JSON (with `mrp.bom_lines` for Odoo).
4. **Systems** — every profile system is pure data: params → constants → variables (formulas) → profiles with
   cut pieces → glass → accessories → drawing template. Add a new system in the editor (structured form or JSON)
   with a live test panel; duplicate an existing one and change the deductions.
5. **Price book** — purchase prices (SAR excl. VAT) by supplier code, with date and source. Zero-price items are
   flagged `no price` in every estimate; prices older than 90 days are flagged `old`.
6. **Settings** — company, VAT, profit, overhead, waste, bar length/kerf, labour rates per category, terms,
   webhook, backup/restore.

## Importing supplier bills (price book with history)

`#/import` accepts up to hundreds of files per run. `.xlsx` / `.csv` are parsed in the browser (no library, no
server) with a column-mapping step; `.pdf` / `.jpg` / `.png` bills are read by Claude (your own API key in
Settings → AI, called directly from the browser). Every extracted line is matched to the price book
(exact code → supplier section number → similar name → new) and shown for review with the current price and
the % change before anything is applied. Applying keeps the previous price in the item's history; swings over
5 % are flagged in the price book.

## Reading drawings and site photos

Estimator → "Read openings from drawing / photo (AI)": upload elevations, window schedules or measurement
photos; the reader returns marks, types, W × H (converted to mm), fixed-light heights and quantities, suggests a
system per row from the library, and adds the selected rows to a quotation after you check them.

## Built-in systems (mm)

### From the factory workbook `WINDOWS_C_LIST.xlsx` (formulas copied 1:1, marked "factory sheet")

| Sheet | Pieces |
|---|---|
| SLIDING | FRAME W = W+86 ×2 · FRAME H = H+86 ×2 · SASH W = (W+10)/2 ×4 · SASH H = H−58 ×4 · INTERLOCK = H−58 ×2 |
| SLIDING WITH FIX | + SASH H / INTERLOCK = H−FIX−40 · TRANSOM = W−74 · TR ADP W = W−74 / H = FIX−55 ×2 · G BEAD W = W−88 / H = FIX−109 ×2 |
| HINGED WITH FIX | FRAME = W+80 / H+80 ×2 · SASH W = W−34 ×2 · SASH H = H−FIX−25 ×2 · TRANSOM = W−46 · sash bead W−138 / SASH H−148 · G BEAD W−46 / FIX−81 |
| HINGED WITH 2 FIX | SASH H = H−2·FIX−16 · TRANSOM ×2 · G BEAD ×4 |
| FIXED | FRAME = W+80 / H+80 ×2 · G BEAD W = W−46 ×2 · G BEAD H = H−90 ×2 |
| DOOR 1 LEAF | FRAME W = W+80 ×1 · FRAME H = H+40 ×2 · SASH W = W−34 ×1 · SASH H = H−24 ×2 · sash bead W−176 / SASH H−214 · THRESHOLD = W−176 (section 1283) |
| DOOR WITH FIX | FRAME H = H+80 ×2 · SASH H = H−FIX−17 ×2 · TRANSOM = W−46 · G BEAD W−46 / FIX−81 · THRESHOLD = W−176 |

Area and drawings use the frame outer size (W+86 × H+86 for sliding, W+80 × H+80 for hinged/fixed/door).
Glass sizes and hardware are not on the sheets and are left empty and flagged until confirmed. Profile codes named
by the sheet drawings: 1210/1211 (sliding frame), 2154 (transom adaptor), 1283 (threshold); other profiles are
`TBD_…` placeholders to be assigned in the Price book.

### From the skill files (factory cm sheets converted to mm, marked "not verified" until the factory confirms)

| System | Deductions |
|---|---|
| Saraya 120 sliding (2 / 3_SSS / 3_SFS / 4_FSSF, optional top light, fly screen) | frame −83; SIDE = H−66; TB = W/2−93 (W/3−102, W/3−69, W/4−81); glass TB−4 × SIDE−109; fly TB−3 × SIDE−89 |
| Saraya 105 fixed (optional centre mullion) | frame −96; glass −62; bead W−52 / H−96; mullion: glass W/2−50, T H−52 |
| Saraya 105 top-hung over fixed | sash W−227.5 × H/2−215.5; sash glass W−192 × H/2−180; fixed glass W−62 × H/2−50 |
| Royal 120 two-panel (Kw/Dh/Dg model) | Sash = W/2+25 × H−60(65); glass −125 |

Profiles that have no supplier price yet are included with price 0 so they appear as warnings rather than being
silently omitted. Two earlier systems whose deductions were assumptions (generic Box door, SG50 grid) were removed.

## Formula language

`+ - * / % ^`, comparisons, `&& || !`, strings in quotes, and functions `ceil floor round max min abs sqrt`,
`if(cond, a, b)`, `pick(key, k1, v1, k2, v2, …, default)`. Variables available: params, constants, helper
variables set by select options (e.g. `NS`, `NF`, `NP`, `PATTERN`), earlier variables.

## Integration

- `Export JSON` on a quotation: `{ ref, status, client, project, totals, items[{ inputs, unit{breakdown}, takeoff }], odoo.sale_order_lines[] }`.
- `Push to webhook`: same payload POSTed as JSON with `event: "quotation"` and optional `X-Webhook-Secret` header.
- `Production JSON` on shop drawings: pieces, bars (with cut sequence), glass, accessories and `mrp.bom_lines[]`.

## Development

```
npm test          # engine tests against the factory-sheet examples
npm start         # serve locally
```

Source layout: `src/engine` (formula, calc, optimize, drawing — pure, runs in Node), `src/data` (default
systems, prices, settings), `src/ui` (views), `src/store.js` (persistence).
