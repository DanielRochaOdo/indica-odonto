import { supabase } from "@/integrations/supabase/client";

export type Direction = "up" | "down" | "near";
export type Status = "green" | "yellow" | "red" | "none";
export interface Goal { id: string; indicator_id: string; period: string; company: string; target: number; direction: Direction; tolerance: number; note: string | null }

export const DIRECTIONS: { value: Direction; label: string; symbol: string }[] = [
  { value: "up", label: "Maior é melhor (≥)", symbol: "≥" },
  { value: "down", label: "Menor é melhor (≤)", symbol: "≤" },
  { value: "near", label: "Próximo da meta (≈)", symbol: "≈" },
];

export async function loadGoals(): Promise<Goal[]> {
  const out: Goal[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("goals").select("*").order("indicator_id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data as Goal[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Most specific goal for a month: exact month > year > all months; company-specific > any company. */
export function goalFor(goals: Goal[], indicatorId: string, month: string, company: string | null): Goal | null {
  let best: Goal | null = null, score = -1;
  for (const g of goals) {
    if (g.indicator_id !== indicatorId) continue;
    const p = g.period === "" ? 0 : g.period === month.slice(0, 4) ? 1 : g.period === month.slice(0, 7) ? 2 : -1;
    if (p < 0) continue;
    const c = g.company === "" ? 0 : company && g.company === company ? 1 : -1;
    if (c < 0) continue;
    const s = p * 2 + c;
    if (s > score) { score = s; best = g; }
  }
  return best;
}

/** Status of a value against a goal. Empty values have no status. */
export function goalStatus(value: number | null, g: Goal | null): Status {
  if (!g || value === null) return "none";
  const t = g.target, tol = Math.abs(g.tolerance);
  const band = Math.abs(t) * tol || tol;
  if (g.direction === "up") return value >= t ? "green" : value >= t - band ? "yellow" : "red";
  if (g.direction === "down") return value <= t ? "green" : value <= t + band ? "yellow" : "red";
  const d = Math.abs(value - t);
  return d <= band ? "green" : d <= band * 2 ? "yellow" : "red";
}

/** Percent of goal achieved (1 = 100%). Null when it cannot be computed. */
export function achievement(value: number | null, g: Goal | null): number | null {
  if (!g || value === null) return null;
  const t = g.target;
  if (g.direction === "up") return t > 0 ? value / t : null;
  if (g.direction === "down") return value > 0 && t >= 0 ? t / value : value <= 0 && t >= 0 ? 1 : null;
  return t !== 0 ? 1 - Math.abs(value - t) / Math.abs(t) : null;
}

export const periodLabel = (p: string) => (p === "" ? "Todos os meses" : p.length === 4 ? `Ano ${p}` : `${p.slice(5, 7)}/${p.slice(0, 4)}`);
