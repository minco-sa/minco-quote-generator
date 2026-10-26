// Minimal XLSX reader with no dependencies: unzips with DecompressionStream('deflate-raw') and
// parses sharedStrings + sheet XML with regexes. Returns { sheets: [{ name, rows: string[][] }] }.
// Works in browsers and Node 18+. Handles stored (0) and deflated (8) zip entries.

const td = new TextDecoder('utf-8');

function readU16(b, o) { return b[o] | (b[o + 1] << 8); }
function readU32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Unzip an ArrayBuffer into a Map(path → Uint8Array). */
export async function unzip(buffer) {
  const b = new Uint8Array(buffer);
  // locate End Of Central Directory
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) { if (readU32(b, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('Not a zip/xlsx file');
  const count = readU16(b, eocd + 10);
  let off = readU32(b, eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (readU32(b, off) !== 0x02014b50) throw new Error('Bad central directory');
    const method = readU16(b, off + 10);
    const csize = readU32(b, off + 20), usize = readU32(b, off + 24);
    const nlen = readU16(b, off + 28), elen = readU16(b, off + 30), clen = readU16(b, off + 32);
    const lho = readU32(b, off + 42);
    const name = td.decode(b.subarray(off + 46, off + 46 + nlen));
    off += 46 + nlen + elen + clen;
    const lnlen = readU16(b, lho + 26), lelen = readU16(b, lho + 28);
    const dataStart = lho + 30 + lnlen + lelen;
    const data = b.subarray(dataStart, dataStart + csize);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, await inflateRaw(data));
    else throw new Error(`Unsupported zip method ${method} for ${name}`);
    if (usize === 0 && csize === 0) files.set(name, new Uint8Array(0));
  }
  return files;
}

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

function parseSharedStrings(xml) {
  const out = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    const texts = [];
    const tre = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = tre.exec(m[1]))) texts.push(unesc(t[1]));
    out.push(texts.join(''));
  }
  return out;
}

function colIndex(ref) {
  const m = /^([A-Z]+)/.exec(ref);
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rre = /<row[^>]*?(?:r="(\d+)")?[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rre.exec(xml))) {
    const rowIdx = rm[1] ? parseInt(rm[1], 10) - 1 : rows.length;
    const row = [];
    const cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cre.exec(rm[2]))) {
      const attrs = cm[1], inner = cm[2] || '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="(\w+)"/.exec(attrs)?.[1];
      const ci = ref ? colIndex(ref) : row.length;
      let v = '';
      const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
      if (type === 's') v = shared[parseInt(vm?.[1] || '0', 10)] ?? '';
      else if (type === 'inlineStr') { const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner); v = t ? unesc(t[1]) : ''; }
      else if (type === 'b') v = vm?.[1] === '1' ? 'TRUE' : 'FALSE';
      else v = vm ? unesc(vm[1]) : '';
      row[ci] = v;
    }
    rows[rowIdx] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows.map((r) => Array.from(r, (c) => (c === undefined ? '' : c)));
}

/** Parse an .xlsx ArrayBuffer → { sheets: [{ name, rows }] }. */
export async function readXlsx(buffer) {
  const files = await unzip(buffer);
  const text = (p) => (files.has(p) ? td.decode(files.get(p)) : '');
  const shared = parseSharedStrings(text('xl/sharedStrings.xml'));
  const wb = text('xl/workbook.xml');
  const rels = text('xl/_rels/workbook.xml.rels');
  const relMap = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) relMap[m[1]] = m[2];
  for (const m of rels.matchAll(/<Relationship\b[^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g)) relMap[m[2]] = relMap[m[2]] || m[1];
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = unesc(/name="([^"]*)"/.exec(m[1])?.[1] || `Sheet${sheets.length + 1}`);
    const rid = /r:id="([^"]+)"/.exec(m[1])?.[1] || /\bid="([^"]+)"/.exec(m[1])?.[1];
    let target = relMap[rid] || `worksheets/sheet${sheets.length + 1}.xml`;
    target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
    const xml = text(`xl/${target}`);
    sheets.push({ name, rows: parseSheet(xml, shared) });
  }
  return { sheets };
}

/** Convert rows to objects using a header row index. */
export function rowsToObjects(rows, headerRow = 0) {
  const headers = (rows[headerRow] || []).map((h, i) => String(h || `col${i + 1}`).trim());
  return rows.slice(headerRow + 1).filter((r) => r.some((c) => String(c).trim() !== '')).map((r) => { const o = {}; headers.forEach((h, i) => { o[h] = r[i] ?? ''; }); return o; });
}
