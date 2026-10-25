export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const money = (n, d = 2) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const num = (n, d = 0) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const mm = (n) => (Number.isInteger(n) ? String(n) : (Number(n) || 0).toFixed(1));
export const pct = (n, d = 1) => `${(Number(n) || 0).toFixed(d)}%`;

export function navigate(hash) { location.hash = hash; }
export function qs(hash) {
  const i = hash.indexOf('?');
  const out = {};
  if (i < 0) return out;
  for (const [k, v] of new URLSearchParams(hash.slice(i + 1))) out[k] = v;
  return out;
}

let toastTimer;
export function toast(msg, ms = 2600) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
}

export function download(filename, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function readFile(accept = '.json') {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => { const f = inp.files[0]; if (!f) return reject(new Error('No file')); const r = new FileReader(); r.onload = () => resolve({ name: f.name, text: r.result }); r.onerror = reject; r.readAsText(f); };
    inp.click();
  });
}

export function toCSV(rows, headers) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [headers.map(q).join(','), ...rows.map((r) => headers.map((h) => q(r[h])).join(','))].join('\n');
}

export function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  const parse = (line) => { const out = []; let cur = '', inq = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (inq) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inq = false; else cur += c; } else if (c === '"') inq = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
  const headers = parse(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => { const vals = parse(l); const o = {}; headers.forEach((h, i) => { o[h] = vals[i] ?? ''; }); return o; });
}

/** Set a nested value by dotted path on an object (creates intermediate objects/arrays). */
export function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (o[k] === undefined || o[k] === null) o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    o = o[k];
  }
  o[parts[parts.length - 1]] = value;
}
export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }

/** Bind inputs with data-path inside root to `target` object (strings; numbers when data-type="number"). */
export function bindPaths(root, target, onChange) {
  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-path]');
    if (!el || !root.contains(el)) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.type === 'number') v = el.value === '' ? '' : Number(el.value);
    setPath(target, el.dataset.path, v);
    if (onChange) onChange(el.dataset.path, v, el);
  });
}

export const field = (label, inner, unit = '') => `<label class="f"><span>${esc(label)}${unit ? ` <span class="u">(${esc(unit)})</span>` : ''}</span>${inner}</label>`;
export const input = (path, value, { type = 'text', step, min, placeholder = '', cls = 'i', number = false } = {}) => `<input class="${cls}" type="${type}" data-path="${esc(path)}" ${number || type === 'number' ? 'data-type="number"' : ''} value="${esc(value ?? '')}" ${step !== undefined ? `step="${step}"` : ''} ${min !== undefined ? `min="${min}"` : ''} placeholder="${esc(placeholder)}">`;
export const select = (path, value, options, { cls = 'i' } = {}) => `<select class="${cls}" data-path="${esc(path)}">${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;

export function confirmDialog(msg) { return window.confirm(msg); }
