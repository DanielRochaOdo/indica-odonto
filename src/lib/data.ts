import { supabase } from "@/integrations/supabase/client";
import { evaluate, type Val } from "./formula";

export interface Indicator {
  id: string;
  position: number;
  sheet_row: number | null;
  kind: string;
  name: string;
  sector: string;
  grp: string | null;
  bold: boolean;
  indent: number;
  unit: string;
  decimals: number;
  companies: string[];
  rmr: boolean;
  rid: boolean;
  rgr: boolean;
  total_formula: string | null;
}
export interface Period { month: string; sheet_col: string | null }
export interface Cell { indicator_id: string; month: string; num_value: number | null; text_value: string | null; formula: string | null }

async function all<T>(table: "indicators" | "periods" | "cells", order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").order(order).range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadAll() {
  const [indicators, periods, cells] = await Promise.all([
    all<Indicator>("indicators", "position"),
    all<Period>("periods", "month"),
    all<Cell>("cells", "indicator_id"),
  ]);
  return { indicators, periods, cells };
}

export interface Computed {
  /** key `${indicatorId}|${month}` -> value */
  values: Map<string, { num: number | null; text: string | null; formula: string | null }>;
  totals: Map<string, number | null>;
}

export function compute(indicators: Indicator[], periods: Period[], cells: Cell[]): Computed {
  const byRow = new Map<number, Indicator>();
  indicators.forEach((i) => i.sheet_row != null && byRow.set(i.sheet_row, i));
  const colToMonth = new Map<string, string>();
  periods.forEach((p) => p.sheet_col && colToMonth.set(p.sheet_col, p.month));
  const letters = [...colToMonth.keys()].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const cellMap = new Map<string, Cell>();
  cells.forEach((c) => cellMap.set(`${c.indicator_id}|${c.month}`, c));

  const memo = new Map<string, Val>();
  const totalMemo = new Map<string, Val>();
  const stack = new Set<string>();

  const colIndex = (c: string) => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  const resolver = {
    colIndex,
    colAt: (i: number) => {
      let s = "", n = i;
      while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
      return s;
    },
    get: (col: string, row: number): Val => {
      const ind = byRow.get(row);
      if (!ind) return null;
      if (col === "P") return totalOf(ind);
      const m = colToMonth.get(col);
      if (!m) return null;
      return cellValue(ind.id, m);
    },
  };
  void letters;

  function cellValue(id: string, month: string): Val {
    const k = `${id}|${month}`;
    if (memo.has(k)) return memo.get(k)!;
    const c = cellMap.get(k);
    let v: Val = null;
    if (c) {
      if (c.formula && !stack.has(k)) {
        stack.add(k);
        const r = evaluate(c.formula, resolver);
        stack.delete(k);
        v = r === "err" ? (c.num_value ?? (c.text_value ? "err" : null)) : r;
      } else if (c.num_value != null) v = c.num_value;
      else if (c.text_value) v = "err";
    }
    memo.set(k, v);
    return v;
  }
  function totalOf(ind: Indicator): Val {
    if (!ind.total_formula) return null;
    if (totalMemo.has(ind.id)) return totalMemo.get(ind.id)!;
    totalMemo.set(ind.id, null);
    const r = evaluate(ind.total_formula, resolver);
    totalMemo.set(ind.id, r);
    return r;
  }

  const values: Computed["values"] = new Map();
  const totals: Computed["totals"] = new Map();
  for (const ind of indicators) {
    for (const p of periods) {
      const k = `${ind.id}|${p.month}`;
      const c = cellMap.get(k);
      if (!c) continue;
      const v = cellValue(ind.id, p.month);
      values.set(k, { num: typeof v === "number" ? v : null, text: typeof v === "number" ? null : c.text_value, formula: c.formula });
    }
    const t = totalOf(ind);
    totals.set(ind.id, typeof t === "number" ? t : null);
  }
  return { values, totals };
}
