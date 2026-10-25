// SVG generators: opening elevations (shop-drawing style) and bar cutting diagrams.
import { evaluate } from './formula.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function resolve(spec, vars, fallback) {
  if (spec === undefined || spec === null) return fallback;
  try { return evaluate(spec, vars); } catch { return fallback; }
}

/**
 * Elevation drawing for one opening.
 * @param {object} system  system definition (uses system.drawing)
 * @param {object} vars    resolved variable scope (from takeoff)
 * @param {object} glass   takeoff glass lines (for pane labels)
 * @param {object} [opts]  { width: svg px width, title, showGlassLabels }
 */
export function elevationSVG(system, vars, glass = [], opts = {}) {
  const d = system.drawing || { type: 'fixed' };
  const W = Number(opts.productW ?? resolve(system.areaW, vars, vars.W)) || Number(vars.W) || 1000;
  const H = Number(opts.productH ?? resolve(system.areaH, vars, vars.H)) || Number(vars.H) || 1000;
  const px = opts.width || 420;
  const margin = 70; // room for dimension lines
  const scale = Math.min((px - 2 * margin) / W, (px * 0.9 - 2 * margin) / H);
  const w = W * scale, h = H * scale;
  const svgW = w + 2 * margin, svgH = h + 2 * margin;
  const ox = margin, oy = margin;
  const frameT = Math.max(4, Math.min(w, h) * 0.035);
  const sashT = Math.max(3, frameT * 0.7);
  const parts = [];
  const rect = (x, y, ww, hh, cls, extra = '') => parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, ww).toFixed(1)}" height="${Math.max(0, hh).toFixed(1)}" class="${cls}" ${extra}/>`);
  const line = (x1, y1, x2, y2, cls) => parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}"/>`);
  const text = (x, y, s, cls = 'lbl', extra = '') => parts.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" ${extra}>${esc(s)}</text>`);

  // outer frame
  rect(ox, oy, w, h, 'frame');
  const ix = ox + frameT, iy = oy + frameT, iw = w - 2 * frameT, ih = h - 2 * frameT;

  const glassLabel = (x, y, gw, gh, g) => {
    if (opts.showGlassLabels === false || !g) return;
    text(x + gw / 2, y + gh / 2, `${g.w} × ${g.h}`, 'glbl', 'text-anchor="middle"');
  };
  const arrow = (x1, y, x2) => {
    line(x1, y, x2, y, 'arrow');
    const dir = x2 > x1 ? 1 : -1;
    parts.push(`<polygon points="${x2.toFixed(1)},${y.toFixed(1)} ${(x2 - dir * 7).toFixed(1)},${(y - 4).toFixed(1)} ${(x2 - dir * 7).toFixed(1)},${(y + 4).toFixed(1)}" class="arrowhead"/>`);
  };
  const hingeTriangle = (x, y, pw, ph, side) => {
    // casement symbol: apex at hinge side
    const apexX = side === 'left' ? x : x + pw;
    const baseX = side === 'left' ? x + pw : x;
    parts.push(`<polyline points="${baseX.toFixed(1)},${y.toFixed(1)} ${apexX.toFixed(1)},${(y + ph / 2).toFixed(1)} ${baseX.toFixed(1)},${(y + ph).toFixed(1)}" class="sym"/>`);
  };

  const type = d.type || 'fixed';
  if (type === 'sliding') {
    const pattern = String(resolve(d.pattern, vars, 'SS'));
    const top = Number(resolve(d.top, vars, 0)) || 0;
    let gy = iy, gh = ih;
    if (top > 0) {
      const th = top * scale - frameT;
      rect(ix, iy, iw, th, 'glass');
      glassLabel(ix, iy, iw, th, glass[1]);
      rect(ix, iy + th, iw, sashT, 'mullion');
      gy = iy + th + sashT; gh = ih - th - sashT;
    }
    const n = pattern.length || 2;
    const pw = iw / n;
    for (let i = 0; i < n; i++) {
      const x = ix + i * pw;
      rect(x, gy, pw, gh, 'glass');
      rect(x, gy, pw, gh, pattern[i] === 'S' ? 'sash' : 'fixedpanel');
      const gx = x + sashT, gyy = gy + sashT, gw = pw - 2 * sashT, ggh = gh - 2 * sashT;
      rect(gx, gyy, gw, ggh, 'glass');
      glassLabel(gx, gyy, gw, ggh, glass[0]);
      if (pattern[i] === 'S') {
        const ay = gy + gh * 0.85;
        const towardsRight = i < n / 2;
        const ax1 = x + pw * (towardsRight ? 0.25 : 0.75), ax2 = x + pw * (towardsRight ? 0.75 : 0.25);
        arrow(ax1, ay, ax2);
      } else {
        text(x + pw / 2, gy + gh * 0.88, 'FIXED', 'lbl', 'text-anchor="middle"');
      }
    }
  } else if (type === 'fixed') {
    const cols = Math.max(1, Math.round(Number(resolve(d.cols, vars, 1)) || 1));
    const pw = iw / cols;
    for (let i = 0; i < cols; i++) {
      const x = ix + i * pw;
      rect(x, iy, pw, ih, 'glass');
      glassLabel(x, iy, pw, ih, glass[0]);
      if (i > 0) rect(x - sashT / 2, iy, sashT, ih, 'mullion');
    }
  } else if (type === 'hung') {
    const half = ih / 2;
    rect(ix, iy, iw, half, 'glass');
    rect(ix, iy, iw, half, 'sash');
    rect(ix + sashT, iy + sashT, iw - 2 * sashT, half - 2 * sashT, 'glass');
    // top-hung symbol: apex at top
    parts.push(`<polyline points="${ix.toFixed(1)},${(iy + half).toFixed(1)} ${(ix + iw / 2).toFixed(1)},${iy.toFixed(1)} ${(ix + iw).toFixed(1)},${(iy + half).toFixed(1)}" class="sym"/>`);
    glassLabel(ix, iy, iw, half, glass[0]);
    rect(ix, iy + half - sashT / 2, iw, sashT, 'mullion');
    rect(ix, iy + half + sashT / 2, iw, half - sashT / 2, 'glass');
    glassLabel(ix, iy + half, iw, half, glass[1]);
  } else if (type === 'door' || type === 'casement') {
    const leaves = Math.max(1, Math.round(Number(resolve(d.leaves, vars, 1)) || 1));
    const fixTop = Number(resolve(d.fixTop, vars, 0)) || 0;
    const fixBottom = Number(resolve(d.fixBottom, vars, 0)) || 0;
    let sy = iy, sh = ih;
    if (fixTop > 0) {
      const th = Math.max(0, fixTop * scale - frameT);
      rect(ix, iy, iw, th, 'glass'); text(ix + iw / 2, iy + th * 0.55, 'FIXED', 'lbl', 'text-anchor="middle"');
      glassLabel(ix, iy, iw, th * 0.6, glass[1]);
      rect(ix, iy + th, iw, sashT, 'mullion');
      sy = iy + th + sashT; sh -= th + sashT;
    }
    if (fixBottom > 0) {
      const bh = Math.max(0, fixBottom * scale - frameT);
      rect(ix, iy + ih - bh, iw, bh, 'glass'); text(ix + iw / 2, iy + ih - bh * 0.45, 'FIXED', 'lbl', 'text-anchor="middle"');
      rect(ix, iy + ih - bh - sashT, iw, sashT, 'mullion');
      sh -= bh + sashT;
    }
    const pw = iw / leaves;
    for (let i = 0; i < leaves; i++) {
      const x = ix + i * pw;
      rect(x, sy, pw, sh, 'glass');
      rect(x, sy, pw, sh, 'sash');
      rect(x + sashT * 2, sy + sashT * 2, pw - 4 * sashT, sh - 4 * sashT, 'glass');
      glassLabel(x, sy, pw, sh, glass[0]);
      hingeTriangle(x, sy, pw, sh, i === 0 ? 'left' : 'right');
      const hx = i === 0 ? x + pw - sashT * 3 : x + sashT * 3;
      rect(hx - 2, sy + sh * 0.48, 4, Math.max(6, sh * 0.06), 'mullion');
    }
    if (type === 'door') rect(ox, oy + h - frameT * 0.6, w, frameT * 0.6, 'frame');
  } else if (type === 'grid') {
    const cols = Math.max(1, Math.round(Number(resolve(d.cols, vars, 1)) || 1));
    const rows = Math.max(1, Math.round(Number(resolve(d.rows, vars, 1)) || 1));
    const pw = iw / cols, ph = ih / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      rect(ix + c * pw, iy + r * ph, pw, ph, 'glass');
      if (r === 0 && c === 0) glassLabel(ix, iy, pw, ph, glass[0]);
    }
    for (let c = 1; c < cols; c++) rect(ix + c * pw - sashT / 2, iy, sashT, ih, 'mullion');
    for (let r = 1; r < rows; r++) rect(ix, iy + r * ph - sashT / 2, iw, sashT, 'mullion');
  } else {
    rect(ix, iy, iw, ih, 'glass');
  }

  // dimension lines
  const dy = oy + h + 28;
  line(ox, dy, ox + w, dy, 'dim'); line(ox, dy - 6, ox, dy + 6, 'dim'); line(ox + w, dy - 6, ox + w, dy + 6, 'dim');
  text(ox + w / 2, dy + 16, `${fmt(W)}`, 'dimlbl', 'text-anchor="middle"');
  const dx = ox + w + 28;
  line(dx, oy, dx, oy + h, 'dim'); line(dx - 6, oy, dx + 6, oy, 'dim'); line(dx - 6, oy + h, dx + 6, oy + h, 'dim');
  text(dx + 14, oy + h / 2, `${fmt(H)}`, 'dimlbl', `text-anchor="middle" transform="rotate(90 ${(dx + 14).toFixed(1)} ${(oy + h / 2).toFixed(1)})"`);
  if (opts.title) text(ox, oy - 14, opts.title, 'title');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}" width="100%" class="elev" role="img" aria-label="Elevation ${W} by ${H} mm">
<style>
.frame{fill:#1f2937;stroke:#111;stroke-width:1}
.sash{fill:none;stroke:#111;stroke-width:${sashT.toFixed(1)}}
.fixedpanel{fill:none;stroke:#555;stroke-width:${(sashT * 0.6).toFixed(1)}}
.glass{fill:#bfe9ff;stroke:none}
.mullion{fill:#1f2937}
.sym{fill:none;stroke:#1d4ed8;stroke-width:1.2;stroke-dasharray:4 3}
.arrow{stroke:#1d4ed8;stroke-width:1.6}.arrowhead{fill:#1d4ed8}
.dim{stroke:#111;stroke-width:0.8}
.dimlbl{font:11px system-ui,sans-serif;fill:#111}
.lbl{font:9px system-ui,sans-serif;fill:#374151}
.glbl{font:9px system-ui,sans-serif;fill:#0f4c81}
.title{font:600 12px system-ui,sans-serif;fill:#111}
</style>
${parts.join('\n')}
</svg>`;
}

/** Cutting diagram for one profile's bars (from optimize.packBars result). */
export function barsSVG(result, opts = {}) {
  const width = opts.width || 760;
  const rowH = 30, gap = 10, left = 60, right = 90;
  const usable = width - left - right;
  const scale = usable / result.barLength;
  const rows = result.bars.length;
  const height = rows * (rowH + gap) + 20;
  const parts = [];
  const palette = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#f87171', '#2dd4bf', '#fb923c'];
  result.bars.forEach((bar, i) => {
    const y = 10 + i * (rowH + gap);
    parts.push(`<text x="4" y="${y + rowH / 2 + 4}" class="t">Bar ${i + 1}</text>`);
    parts.push(`<rect x="${left}" y="${y}" width="${usable}" height="${rowH}" class="stock"/>`);
    let x = left;
    bar.cuts.forEach((c, j) => {
      const cw = c.length * scale;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(1, cw).toFixed(1)}" height="${rowH}" fill="${palette[j % palette.length]}" stroke="#111" stroke-width="0.6"/>`);
      if (cw > 46) parts.push(`<text x="${(x + cw / 2).toFixed(1)}" y="${y + rowH / 2 + 4}" class="c" text-anchor="middle">${esc(c.length)}${cw > 110 && c.ref ? ' ' + esc(c.ref) : ''}</text>`);
      x += cw + result.kerf * scale;
    });
    parts.push(`<text x="${left + usable + 6}" y="${y + rowH / 2 + 4}" class="t">off ${Math.round(bar.offcut)}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" class="bars">
<style>.stock{fill:#e5e7eb;stroke:#9ca3af;stroke-width:0.8}.t{font:11px system-ui,sans-serif;fill:#111}.c{font:10px system-ui,sans-serif;fill:#111}</style>
${parts.join('\n')}</svg>`;
}
