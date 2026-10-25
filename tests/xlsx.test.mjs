import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readXlsx, rowsToObjects } from '../src/import/xlsx.js';
const path = process.argv[2];
if (!path) { console.log('usage: node tests/xlsx.test.mjs <file.xlsx>'); process.exit(0); }
const { sheets } = await readXlsx(fs.readFileSync(path).buffer);
console.log('sheets:', sheets.map((s) => `${s.name} (${s.rows.length} rows)`).join(', '));
assert.ok(sheets.length > 0);
for (const s of sheets.slice(0, 2)) { console.log(`--- ${s.name}`); s.rows.slice(0, 4).forEach((r) => console.log(r.slice(0, 8).join(' | '))); }
console.log('objects sample:', JSON.stringify(rowsToObjects(sheets[0].rows, 1).slice(0, 2)));
