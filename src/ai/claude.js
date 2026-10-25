// Browser-side Claude API client (raw fetch, no SDK — the app has no build step).
// The API key is the user's own, stored in Settings (localStorage) and sent directly from the browser.
const API = 'https://api.anthropic.com/v1/messages';

export const DEFAULT_MODEL = 'claude-opus-5-5';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Call Claude and return parsed JSON matching `schema` (structured outputs).
 * @param {object} o  { settings, system, content (array of content blocks or string), schema, maxTokens, signal, onRetry }
 */
export async function callClaude({ settings, system, content, schema, maxTokens = 16000, signal, onRetry }) {
  const apiKey = (settings.aiApiKey || '').trim();
  if (!apiKey) throw new Error('No Anthropic API key — add it in Settings → AI');
  const model = settings.aiModel || DEFAULT_MODEL;
  let useFallback = settings.aiFallback !== false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const headers = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    const body = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content }] };
    if (schema) body.output_config = { format: { type: 'json_schema', schema } };
    if (useFallback) { headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; body.fallbacks = 'default'; }
    let res;
    try { res = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body), signal }); }
    catch (e) { if (signal?.aborted) throw e; if (attempt < 3) { onRetry?.(`network error, retrying (${attempt + 1})`); await sleep(1500 * 2 ** attempt); continue; } throw new Error(`Network error calling Claude API: ${e.message}`); }
    if (res.status === 429 || res.status === 529 || res.status >= 500) {
      if (attempt < 3) { const ra = Number(res.headers.get('retry-after')) || 2 ** attempt * 3; onRetry?.(`${res.status} — retrying in ${ra}s`); await sleep(ra * 1000); continue; }
      throw new Error(`Claude API ${res.status} after retries`);
    }
    if (!res.ok) {
      let msg = `${res.status}`;
      try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
      if (res.status === 400 && useFallback && /fallback|beta/i.test(msg)) { useFallback = false; continue; }
      if (res.status === 401) throw new Error('Invalid API key (401)');
      throw new Error(`Claude API error: ${msg}`);
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw new Error(`Request declined by safety classifier${data.stop_details?.category ? ` (${data.stop_details.category})` : ''}`);
    if (data.stop_reason === 'max_tokens') throw new Error('Response truncated (max_tokens) — split the document into fewer pages');
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!schema) return { text, usage: data.usage, model: data.model };
    try { return { json: JSON.parse(text), usage: data.usage, model: data.model }; }
    catch { throw new Error('Could not parse JSON from the model response'); }
  }
  throw new Error('Claude API: retries exhausted');
}

/** Read a File into a base64 string (no data: prefix). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(file); });
}

/** Downscale an image file so the long edge ≤ maxEdge px; returns { base64, mediaType }. Non-image files pass through. */
export async function imageToBase64(file, maxEdge = 2000) {
  if (!/^image\//.test(file.type)) return { base64: await fileToBase64(file), mediaType: file.type };
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    if (scale === 1 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) return { base64: await fileToBase64(file), mediaType: file.type };
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' };
  } finally { URL.revokeObjectURL(url); }
}

/** Build a content block for a file (PDF → document, image → image). */
export async function fileBlock(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await fileToBase64(file) } };
  if (/^image\//.test(file.type)) { const { base64, mediaType } = await imageToBase64(file); return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }; }
  throw new Error(`Unsupported file type for AI reading: ${file.name}`);
}
