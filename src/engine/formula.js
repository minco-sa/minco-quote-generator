// Safe arithmetic/logic expression evaluator for system definitions.
// Supports: numbers, 'strings', variables, + - * / % ^, comparisons, && ||, !,
// functions: ceil floor round max min abs sqrt if pick.
// No eval(), no access to globals.

const FUNCS = {
  ceil: (x) => Math.ceil(x),
  floor: (x) => Math.floor(x),
  round: (x, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; },
  max: (...a) => Math.max(...a),
  min: (...a) => Math.min(...a),
  abs: (x) => Math.abs(x),
  sqrt: (x) => Math.sqrt(x),
  if: (c, a, b) => (c ? a : b),
  // pick(key, k1, v1, k2, v2, ..., default)
  pick: (key, ...rest) => {
    for (let i = 0; i + 1 < rest.length; i += 2) {
      // eslint-disable-next-line eqeqeq
      if (rest[i] == key) return rest[i + 1];
    }
    return rest.length % 2 === 1 ? rest[rest.length - 1] : 0;
  },
};

const TOKEN_RE = /\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|('[^']*'|"[^"]*")|(>=|<=|==|!=|&&|\|\||[-+*/^%(),<>!]))/y;

export function tokenize(src) {
  const tokens = [];
  TOKEN_RE.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new Error(`Unexpected character at ${pos}: "${src.slice(pos, pos + 8)}"`);
    }
    pos = TOKEN_RE.lastIndex;
    if (m[1] !== undefined) tokens.push({ t: 'num', v: parseFloat(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: 'id', v: m[2] });
    else if (m[3] !== undefined) tokens.push({ t: 'str', v: m[3].slice(1, -1) });
    else if (m[4] !== undefined) tokens.push({ t: 'op', v: m[4] });
  }
  return tokens;
}

class Parser {
  constructor(tokens, vars) { this.tk = tokens; this.i = 0; this.vars = vars; }
  peek() { return this.tk[this.i]; }
  next() { return this.tk[this.i++]; }
  isOp(v) { const p = this.peek(); return p && p.t === 'op' && p.v === v; }
  expect(v) { if (!this.isOp(v)) throw new Error(`Expected "${v}"`); this.next(); }

  parse() {
    const v = this.or();
    if (this.i < this.tk.length) throw new Error(`Unexpected token "${this.peek().v}"`);
    return v;
  }
  or() { let l = this.and(); while (this.isOp('||')) { this.next(); const r = this.and(); l = (l || r) ? 1 : 0; } return l; }
  and() { let l = this.eq(); while (this.isOp('&&')) { this.next(); const r = this.eq(); l = (l && r) ? 1 : 0; } return l; }
  eq() {
    let l = this.cmp();
    for (;;) {
      // eslint-disable-next-line eqeqeq
      if (this.isOp('==')) { this.next(); l = (l == this.cmp()) ? 1 : 0; }
      // eslint-disable-next-line eqeqeq
      else if (this.isOp('!=')) { this.next(); l = (l != this.cmp()) ? 1 : 0; }
      else return l;
    }
  }
  cmp() {
    let l = this.add();
    for (;;) {
      if (this.isOp('<')) { this.next(); l = l < this.add() ? 1 : 0; }
      else if (this.isOp('>')) { this.next(); l = l > this.add() ? 1 : 0; }
      else if (this.isOp('<=')) { this.next(); l = l <= this.add() ? 1 : 0; }
      else if (this.isOp('>=')) { this.next(); l = l >= this.add() ? 1 : 0; }
      else return l;
    }
  }
  add() {
    let l = this.mul();
    for (;;) {
      if (this.isOp('+')) { this.next(); l = l + this.mul(); }
      else if (this.isOp('-')) { this.next(); l = l - this.mul(); }
      else return l;
    }
  }
  mul() {
    let l = this.unary();
    for (;;) {
      if (this.isOp('*')) { this.next(); l = l * this.unary(); }
      else if (this.isOp('/')) { this.next(); const r = this.unary(); if (r === 0) throw new Error('Division by zero'); l = l / r; }
      else if (this.isOp('%')) { this.next(); l = l % this.unary(); }
      else return l;
    }
  }
  unary() {
    if (this.isOp('-')) { this.next(); return -this.unary(); }
    if (this.isOp('+')) { this.next(); return this.unary(); }
    if (this.isOp('!')) { this.next(); return this.unary() ? 0 : 1; }
    return this.pow();
  }
  pow() {
    const base = this.primary();
    if (this.isOp('^')) { this.next(); return base ** this.unary(); }
    return base;
  }
  primary() {
    const t = this.next();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.t === 'num') return t.v;
    if (t.t === 'str') return t.v;
    if (t.t === 'op' && t.v === '(') { const v = this.or(); this.expect(')'); return v; }
    if (t.t === 'id') {
      if (this.isOp('(')) {
        this.next();
        const args = [];
        if (!this.isOp(')')) {
          args.push(this.or());
          while (this.isOp(',')) { this.next(); args.push(this.or()); }
        }
        this.expect(')');
        const fn = FUNCS[t.v];
        if (!fn) throw new Error(`Unknown function "${t.v}"`);
        return fn(...args);
      }
      if (!(t.v in this.vars)) throw new Error(`Unknown variable "${t.v}"`);
      const v = this.vars[t.v];
      if (v === undefined || v === null || v === '') throw new Error(`Variable "${t.v}" has no value`);
      const n = typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : v;
      return n;
    }
    throw new Error(`Unexpected token "${t.v}"`);
  }
}

/** Evaluate `expr` (number | string formula) with `vars`. Returns number|string. */
export function evaluate(expr, vars = {}) {
  if (typeof expr === 'number') return expr;
  if (expr === undefined || expr === null) return 0;
  const s = String(expr).trim();
  if (s === '') return 0;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  return new Parser(tokenize(s), vars).parse();
}

/** Evaluate and coerce to a finite number (throws otherwise). */
export function evalNumber(expr, vars, label = 'expression') {
  const v = evaluate(expr, vars);
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${label}: result is not a number (${v})`);
  return n;
}

/** Return the list of variable identifiers referenced by a formula (for the editor). */
export function referencedVars(expr) {
  try {
    return [...new Set(tokenize(String(expr)).filter((t, i, arr) => t.t === 'id' && !(arr[i + 1] && arr[i + 1].t === 'op' && arr[i + 1].v === '(')).map((t) => t.v))];
  } catch { return []; }
}
