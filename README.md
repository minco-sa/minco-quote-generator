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

## Built-in systems (mm; converted from the factory cm sheets)

| System | Deductions |
|---|---|
| Saraya 120 sliding (2 / 3_SSS / 3_SFS / 4_FSSF, optional top light, fly screen) | frame −83; SIDE = H−66; TB = W/2−93 (W/3−102, W/3−69, W/4−81); glass TB−4 × SIDE−109; fly TB−3 × SIDE−89 |
| Saraya 105 fixed (optional centre mullion) | frame −96; glass −62; bead W−52 / H−96; mullion: glass W/2−50, T H−52 |
| Saraya 105 top-hung over fixed | sash W−227.5 × H/2−215.5; sash glass W−192 × H/2−180; fixed glass W−62 × H/2−50 |
| Royal 120 two-panel (Kw/Dh/Dg model) | Sash = W/2+25 × H−60(65); glass −125 |
| Box 12 cm hinged door (1/2 leaves) | generic constants — adjust to the factory sheet |
| SG50 stick curtain wall (NCOL × NROW grid) | mullions (NCOL+1) × H, transoms per module, glass = module − 20 |

Profiles that have no supplier price yet (802995, 802988, door leaf/bead, brackets, corner cleats, fly rollers)
are included with price 0 so they appear as warnings rather than being silently omitted.

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
