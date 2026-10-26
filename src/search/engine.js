// In-app search built on the Apple Notes search design (see logikal-search README):
// normalize (case, Latin diacritics, Arabic folding, digits) → tokenize → scope tokens →
// tiered matching (exact title > title prefix > word prefix > substring > fuzzy) → ranking strategy → sections + snippets.
// Pure JS, no dependencies; indexes quotations, positions, systems and price-book items.

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };

/** Fold text so that typing variants match: case, Latin accents, Arabic hamza/ya/ta-marbuta, tashkeel, digits, ×. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(TASHKEEL, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] || d)
    .replace(/[×✕✖]/g, 'x').replace(/ß/g, 'ss').replace(/ø/g, 'o').replace(/æ/g, 'ae')
    .toLowerCase();
}

/** Tokens: split on non-alphanumerics and on letter/digit boundaries so 2400x1500, 2400×1500 and 2400 x 1500 all match. */
export const tokenize = (s) => normalize(s).replace(/(\p{N})(\p{L})/gu, '$1 $2').replace(/(\p{L})(\p{N})/gu, '$1 $2').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const SCOPES = { system: 'system', customer: 'customer', type: 'kind', 'نوع': 'kind', status: 'status', city: 'city', supplier: 'supplier', mark: 'mark', ref: 'ref', project: 'project' };

/** Parse `system:"Gulf GE-SL 120" customer:ageel free text` into { scopes, text }. */
export function parseQuery(q) {
  const scopes = {};
  const text = String(q || '').replace(/(\p{L}+):("([^"]*)"|(\S+))/gu, (m, key, _v, quoted, bare) => {
    const k = SCOPES[key.toLowerCase()];
    if (!k) return m;
    scopes[k] = normalize(quoted ?? bare);
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  return { scopes, text };
}

function levenshtein(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v); if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev.splice(0, prev.length, ...cur);
  }
  return prev[b.length];
}

/**
 * Build a search index from documents: { kind, id, title, body, date, fields: {system, customer, status, supplier, ...}, href }.
 */
export function buildIndex(docs) {
  const vocab = new Set();
  const items = docs.map((d) => {
    const title = normalize(d.title);
    const body = normalize([d.body, ...Object.values(d.fields || {})].filter(Boolean).join(' · '));
    const words = tokenize(`${d.title} ${d.body || ''} ${Object.values(d.fields || {}).join(' ')}`);
    words.forEach((w) => vocab.add(w));
    const fields = {}; for (const [k, v] of Object.entries(d.fields || {})) fields[k] = normalize(v);
    return { ...d, _title: title, _body: body, _words: new Set(words), _fields: fields, _time: d.date ? new Date(d.date).getTime() : 0 };
  });
  return { items, vocab: [...vocab] };
}

/** Spell-check fallback: closest vocabulary words within 2 edits (Notes' spellCheckerGuesses). */
export function guesses(index, token) {
  if (token.length < 4) return [];
  const out = [];
  for (const w of index.vocab) { if (Math.abs(w.length - token.length) > 2) continue; const d = levenshtein(token, w, 2); if (d <= 2) out.push({ w, d }); }
  return out.sort((a, b) => a.d - b.d || a.w.length - b.w.length).slice(0, 5).map((x) => x.w);
}

function scoreItem(it, tokens, phrase) {
  let score = 0; const matched = new Set();
  if (phrase && it._title === phrase) score += 1000;
  else if (phrase && it._title.startsWith(phrase)) score += 600;
  for (const t of tokens) {
    let s = 0;
    if (it._words.has(t)) s = 400;
    else if ([...it._words].some((w) => w.startsWith(t))) s = 300;
    else if (it._title.includes(t) || it._body.includes(t)) s = 200;
    if (s) { score += s; matched.add(t); if (it._title.includes(t)) score += 50; }
  }
  if (matched.size < tokens.length) return { score: 0, matched };
  return { score, matched };
}

/**
 * Search. opts: { strategy: 'relevance'|'recent', limit, now }
 * Returns { query, scopes, tokens, corrected, hits:[{doc, score, snippet, tier}], sections:[{kind, hits}], suggestions }.
 */
export function search(index, q, opts = {}) {
  const { scopes, text } = parseQuery(q);
  const phrase = normalize(text);
  let tokens = tokenize(text);
  const strategy = opts.strategy || 'relevance';
  const limit = opts.limit || 50;
  const now = opts.now || Date.now();
  const inScope = (it) => Object.entries(scopes).every(([k, v]) => (it._fields[k] || '').includes(v) || (k === 'kind' && it.kind === v));
  const pool = index.items.filter(inScope);
  let corrected = null;
  let tier = 'match';
  let scored = pool.map((it) => ({ it, ...scoreItem(it, tokens, phrase) })).filter((x) => x.score > 0 || (!tokens.length && Object.keys(scopes).length));
  if (!scored.length && tokens.length) {
    // fuzzy fallback: replace each unmatched token by its best vocabulary guess
    const fixed = tokens.map((t) => (pool.some((it) => [...it._words].some((w) => w.startsWith(t))) ? t : (guesses(index, t)[0] || t)));
    if (fixed.join(' ') !== tokens.join(' ')) {
      corrected = fixed.join(' '); tier = 'fuzzy'; tokens = fixed;
      scored = pool.map((it) => ({ it, ...scoreItem(it, tokens, corrected) })).filter((x) => x.score > 0).map((x) => ({ ...x, score: Math.round(x.score * 0.2) + 80 }));
    }
  }
  if (!tokens.length && Object.keys(scopes).length) scored = pool.map((it) => ({ it, score: 1, matched: new Set() }));
  const fresh = (it) => { if (!it._time) return 0; const days = (now - it._time) / 86400000; return Math.max(0, 30 - days) ; };
  scored.sort((a, b) => strategy === 'recent' ? (b.it._time - a.it._time) || (b.score - a.score) : (b.score + fresh(b.it)) - (a.score + fresh(a.it)) || (b.it._time - a.it._time));
  const hits = scored.slice(0, limit).map(({ it, score }) => ({ doc: it, score, tier, snippet: snippet(it, tokens) }));
  const kinds = [...new Set(hits.map((h) => h.doc.kind))];
  const sections = [{ kind: 'top', label: 'Top hits', hits: hits.slice(0, 3) }, ...kinds.map((k) => ({ kind: k, label: KIND_LABELS[k] || k, hits: hits.filter((h) => h.doc.kind === k) }))].filter((s) => s.hits.length);
  const last = tokens[tokens.length - 1] || '';
  const suggestions = last.length >= 2 ? index.vocab.filter((w) => w.startsWith(last) && w !== last).sort((a, b) => a.length - b.length).slice(0, 6).map((w) => [...tokens.slice(0, -1), w].join(' ')) : [];
  return { query: q, scopes, tokens, corrected, hits, sections, suggestions };
}

export const KIND_LABELS = { quote: 'Quotations', position: 'Positions (openings)', system: 'Systems', price: 'Price book' };

/** Highlighted snippet: «term» around the first match; prefix-of-word match first, then inside a word. */
export function snippet(it, tokens, width = 90) {
  const src = `${it.title}${it.body ? ' — ' + it.body : ''}`;
  const n = normalize(src);
  let pos = -1;
  for (const t of tokens) { const m = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(t)}`, 'u').exec(n); if (m) { pos = m.index + m[1].length; break; } }
  if (pos < 0) for (const t of tokens) { const i = n.indexOf(t); if (i >= 0) { pos = i; break; } }
  if (pos < 0) return src.slice(0, width);
  const start = Math.max(0, pos - Math.floor(width / 3));
  let piece = src.slice(start, start + width);
  for (const t of tokens) if (t.length >= 2) piece = piece.replace(new RegExp(`(${escapeRe(t)})`, 'giu'), '«$1»');
  return (start > 0 ? '…' : '') + piece + (start + width < src.length ? '…' : '');
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
