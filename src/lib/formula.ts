// Minimal evaluator for the spreadsheet formulas (+ - * / ^, SUM, AVERAGE, MIN, MAX).
// Empty cells: ignored by SUM/AVERAGE; count as 0 in arithmetic only when at least one
// referenced cell has a value (so a formula over only empty cells stays empty, not zero).

export type Val = number | null | "err";

export interface Resolver {
  /** value of a sheet cell (col letter, sheet row). null = empty, "err" = text/invalid */
  get(col: string, row: number): Val;
  colIndex(col: string): number;
  colAt(index: number): string | undefined;
}

type Tok = { t: "num"; v: number } | { t: "ref"; c: string; r: number } | { t: "op"; v: string } | { t: "fn"; v: string };

function tokenize(src: string): Tok[] {
  const s = src.replace(/^=/, "").replace(/\s+/g, "");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\d+(\.\d+)?(E[+-]?\d+)?/i))) {
      out.push({ t: "num", v: parseFloat(m[0]!) });
      i += m[0]!.length;
    } else if ((m = rest.match(/^([A-Z]+)\(/))) {
      out.push({ t: "fn", v: m[1]! });
      out.push({ t: "op", v: "(" });
      i += m[0]!.length;
    } else if ((m = rest.match(/^\$?([A-Z]{1,2})\$?(\d+)/))) {
      out.push({ t: "ref", c: m[1]!, r: parseInt(m[2]!, 10) });
      i += m[0]!.length;
    } else if ("+-*/^():,;".includes(s[i]!)) {
      out.push({ t: "op", v: s[i] === ";" ? "," : s[i]! });
      i++;
    } else {
      throw new Error("token");
    }
  }
  return out;
}

type Node = Val | Val[];

export function evaluate(formula: string, res: Resolver): Val {
  let toks: Tok[];
  try {
    toks = tokenize(formula);
  } catch {
    return "err";
  }
  let p = 0;
  let touched = 0;
  let filled = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && (peek() as { v: string }).v === v;
  const eat = (v: string) => {
    if (!isOp(v)) throw new Error("expected " + v);
    p++;
  };
  const read = (c: string, r: number): Val => {
    touched++;
    const v = res.get(c, r);
    if (v !== null) filled++;
    return v;
  };
  const num = (v: Val): number | "err" => (v === "err" ? "err" : v ?? 0);
  const arith = (a: Val, b: Val, f: (x: number, y: number) => number): Val => {
    const x = num(a), y = num(b);
    if (x === "err" || y === "err") return "err";
    const r = f(x, y);
    return Number.isFinite(r) ? r : "err";
  };

  function primary(): Node {
    const t = peek();
    if (!t) throw new Error("eof");
    if (t.t === "num") { p++; return t.v; }
    if (t.t === "ref") {
      p++;
      if (isOp(":")) {
        p++;
        const e = peek();
        if (!e || e.t !== "ref") throw new Error("range");
        p++;
        const list: Val[] = [];
        const c1 = res.colIndex(t.c), c2 = res.colIndex(e.c);
        for (let r = Math.min(t.r, e.r); r <= Math.max(t.r, e.r); r++)
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            const col = res.colAt(c);
            if (col) list.push(read(col, r));
          }
        return list;
      }
      return read(t.c, t.r);
    }
    if (t.t === "fn") {
      p++;
      eat("(");
      const args: Val[] = [];
      if (!isOp(")")) {
        for (;;) {
          const n = expr();
          if (Array.isArray(n)) args.push(...n); else args.push(n);
          if (isOp(",")) { p++; continue; }
          break;
        }
      }
      eat(")");
      const nums = args.filter((a): a is number => typeof a === "number");
      switch (t.v) {
        case "SUM": return nums.length ? nums.reduce((a, b) => a + b, 0) : args.some((a) => a !== null) ? 0 : null;
        case "AVERAGE": return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : "err";
        case "MIN": return nums.length ? Math.min(...nums) : null;
        case "MAX": return nums.length ? Math.max(...nums) : null;
        default: return "err";
      }
    }
    if (isOp("(")) { p++; const n = expr(); eat(")"); return n; }
    if (isOp("-")) { p++; const n = primary(); return arith(0, Array.isArray(n) ? "err" : n, (a, b) => a - b); }
    if (isOp("+")) { p++; return primary(); }
    throw new Error("unexpected");
  }
  const scalar = (n: Node): Val => (Array.isArray(n) ? "err" : n);
  function power(): Node {
    let l = primary();
    while (isOp("^")) { p++; l = arith(scalar(l), scalar(primary()), Math.pow); }
    return l;
  }
  function term(): Node {
    let l = power();
    while (isOp("*") || isOp("/")) {
      const op = (peek() as { v: string }).v; p++;
      const r = scalar(power());
      l = op === "*" ? arith(scalar(l), r, (a, b) => a * b) : arith(scalar(l), r, (a, b) => a / b);
    }
    return l;
  }
  function expr(): Node {
    let l = term();
    while (isOp("+") || isOp("-")) {
      const op = (peek() as { v: string }).v; p++;
      const r = scalar(term());
      l = arith(scalar(l), r, op === "+" ? (a, b) => a + b : (a, b) => a - b);
    }
    return l;
  }
  try {
    const n = expr();
    if (p !== toks.length) return "err";
    const v = scalar(n);
    if (touched > 0 && filled === 0) return null;
    return v;
  } catch {
    return "err";
  }
}
