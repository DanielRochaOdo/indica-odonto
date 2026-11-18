import type { Indicator } from "./data";
import { monthLabel, parseInput } from "./format";

type Get = (id: string, m: string) => { num: number | null; text: string | null; formula: string | null } | undefined;

const fmt = (unit: string, decimals: number) => {
  const d = decimals > 0 ? "." + "0".repeat(decimals) : "";
  switch (unit) {
    case "moeda": return '"R$" #,##0.00';
    case "percentual": return "0" + d + "%";
    case "inteiro": return "#,##0";
    case "horas": return "[h]:mm";
    case "decimal": return "#,##0" + d;
    default: return "General";
  }
};

/** Export the visible rows/months in the same layout as the dashboard table. Column A holds a hidden ID used on import. */
export async function exportExcel(rows: Indicator[], months: string[], get: Get, totals: Map<string, number | null>) {
  const XLSX = await import("xlsx");
  const header = ["ID", "Indicador", ...months.map(monthLabel), "Total 2026", "RMR", "RID", "RGR", "Empresa"];
  const aoa: (string | number | null)[][] = [header];
  for (const i of rows) {
    const label = " ".repeat(i.indent * 4) + i.name;
    if (i.kind === "sector") { aoa.push([i.id, label]); continue; }
    const isGroup = i.kind === "group";
    aoa.push([
      i.id, label,
      ...months.map((m) => { const v = get(i.id, m); return v?.num ?? v?.text ?? null; }),
      totals.get(i.id) ?? null,
      ...(["rmr", "rid", "rgr"] as const).map((k) => (isGroup ? "" : i[k] ? "Sim" : "Não")),
      i.companies.join(" / "),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  rows.forEach((i, r) => {
    for (let c = 0; c <= months.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c: c + 2 })];
      if (cell && cell.t === "n") cell.z = fmt(i.unit, i.decimals);
    }
  });
  ws["!cols"] = [{ hidden: true, wch: 10 }, { wch: 60 }, ...months.map(() => ({ wch: 14 })), { wch: 14 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 22 }];
  // Month keys in a hidden first row-independent sheet so import maps columns exactly.
  const meta = XLSX.utils.aoa_to_sheet([["coluna", "mes"], ...months.map((m, k) => [k + 2, m])]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Indicadores");
  XLSX.utils.book_append_sheet(wb, meta, "_meses");
  wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  XLSX.writeFile(wb, `indicadores-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export interface CellChange { indicator_id: string; month: string; num_value: number | null; text_value: string | null; formula: null }

/** Read an exported workbook and return only the cells whose values changed. Formula cells and empty cells are left untouched. */
export async function readImport(file: File, indicators: Indicator[], allMonths: string[], get: Get): Promise<CellChange[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets["Indicadores"];
  if (!ws) throw new Error("Aba 'Indicadores' não encontrada. Use uma planilha exportada pelo painel.");
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null, raw: true });
  const colMonth = new Map<number, string>();
  const meta = wb.Sheets["_meses"];
  if (meta) {
    XLSX.utils.sheet_to_json<(string | number)[]>(meta, { header: 1 }).slice(1).forEach(([c, m]) => {
      if (typeof c === "number" && typeof m === "string" && allMonths.includes(m)) colMonth.set(c, m);
    });
  } else {
    (aoa[0] ?? []).forEach((h, c) => { const m = allMonths.find((x) => monthLabel(x) === h); if (m) colMonth.set(c, m); });
  }
  const byId = new Map(indicators.map((i) => [i.id, i]));
  const out: CellChange[] = [];
  for (const row of aoa.slice(1)) {
    const ind = byId.get(String(row[0] ?? ""));
    if (!ind || ind.kind === "sector") continue;
    for (const [c, m] of colMonth) {
      const raw = row[c];
      if (raw === null || raw === undefined || raw === "") continue;
      const cur = get(ind.id, m);
      if (cur?.formula) continue;
      const parsed = typeof raw === "number" ? { num: raw } : parseInput(String(raw), ind.unit);
      if (!parsed) continue;
      if ("num" in parsed) {
        if (cur?.num != null && Math.abs(cur.num - parsed.num) < 1e-9) continue;
        out.push({ indicator_id: ind.id, month: m, num_value: parsed.num, text_value: null, formula: null });
      } else {
        if (cur?.text === parsed.text) continue;
        out.push({ indicator_id: ind.id, month: m, num_value: null, text_value: parsed.text, formula: null });
      }
    }
  }
  return out;
}

import type { Goal } from "./goals";
const DIR_SYM: Record<string, string> = { up: "≥", down: "≤", near: "≈" };
const SYM_DIR: Record<string, Goal["direction"]> = { "≥": "up", ">=": "up", "≤": "down", "<=": "down", "≈": "near", "=": "near" };

/** Export goals for the visible indicators. Rows without a goal are included so they can be filled in. */
export async function exportGoals(rows: Indicator[], goals: Goal[]) {
  const XLSX = await import("xlsx");
  const aoa: (string | number | null)[][] = [["ID", "Indicador", "Período (vazio, AAAA ou AAAA-MM)", "Empresa (vazio = todas)", "Meta", "Sentido (≥ ≤ ≈)", "Faixa amarela (%)", "Observação"]];
  for (const i of rows) {
    if (i.kind !== "indicator") continue;
    const list = goals.filter((g) => g.indicator_id === i.id);
    if (!list.length) aoa.push([i.id, i.name, "", "", null, "", 5, ""]);
    for (const g of list) aoa.push([i.id, i.name, g.period, g.company, g.target, DIR_SYM[g.direction] ?? "", +(g.tolerance * 100).toFixed(2), g.note ?? ""]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ hidden: true, wch: 10 }, { wch: 60 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Metas");
  XLSX.writeFile(wb, `metas-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Read a goals workbook exported by the dashboard. Rows with an empty goal value are ignored. */
export async function readGoalsImport(file: File, indicators: Indicator[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets["Metas"];
  if (!ws) throw new Error("Aba 'Metas' não encontrada. Use uma planilha exportada em 'Exportar metas'.");
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null, raw: true });
  const byId = new Map(indicators.map((i) => [i.id, i]));
  const out = new Map<string, Omit<Goal, "id">>();
  for (const r of aoa.slice(1)) {
    const ind = byId.get(String(r[0] ?? ""));
    if (!ind || r[4] === null || r[4] === "") continue;
    const parsed = typeof r[4] === "number" ? { num: r[4] } : parseInput(String(r[4]), ind.unit);
    if (!parsed || !("num" in parsed)) continue;
    const period = String(r[2] ?? "").trim();
    if (period && !/^\d{4}(-\d{2})?$/.test(period)) throw new Error(`Período inválido "${period}" em ${ind.name}`);
    const company = String(r[3] ?? "").trim();
    const g = { indicator_id: ind.id, period, company, target: parsed.num, direction: SYM_DIR[String(r[5] ?? "").trim()] ?? "up", tolerance: (Number(String(r[6] ?? 5).replace(",", ".")) || 0) / 100, note: r[7] ? String(r[7]) : null };
    out.set(`${g.indicator_id}|${period}|${company}`, g);
  }
  return [...out.values()];
}
