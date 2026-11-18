import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, Pencil, Plus, Trash2, CalendarPlus, LogOut, FileSpreadsheet, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compute, loadAll, type Indicator } from "@/lib/data";
import { formatValue, monthLabel, MONTH_NAMES, parseInput, toEditString, variation } from "@/lib/format";
import logoAsset from "@/assets/logo-odontoart.png.asset.json";
import { MultiSelect } from "@/components/MultiSelect";
import { IndicatorDialog, type IndicatorDraft } from "@/components/IndicatorDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportExcel, readImport, exportGoals, readGoalsImport } from "@/lib/excel";
import { achievement, goalFor, goalStatus, loadGoals, DIRECTIONS, type Status } from "@/lib/goals";
import { GoalsDialog } from "@/components/GoalsDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel de Indicadores — Odontoart e New Odonto" },
      { name: "description", content: "Acompanhamento mensal dos indicadores de gestão (RMR, RID, RGR) da Odontoart e New Odonto." },
      { property: "og:title", content: "Painel de Indicadores — Odontoart e New Odonto" },
      { property: "og:description", content: "Acompanhamento mensal dos indicadores de gestão da Odontoart e New Odonto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const EMPTY_DRAFT: IndicatorDraft = { kind: "indicator", name: "", sector: "", grp: null, bold: false, indent: 0, unit: "numero", decimals: 2, companies: [], rmr: false, rid: false, rgr: false };

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ["all"], queryFn: loadAll, staleTime: Infinity });
  const [fSector, setFSector] = useState<string[]>([]);
  const [fYear, setFYear] = useState<string[]>([]);
  const [fMonth, setFMonth] = useState<string[]>([]);
  const [fReport, setFReport] = useState<string[]>([]);
  const [fCompany, setFCompany] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; month: string; text: string } | null>(null);
  const [dialog, setDialog] = useState<{ mode: "new" | "edit"; draft: IndicatorDraft; id?: string } | null>(null);
  const [toDelete, setToDelete] = useState<Indicator | null>(null);
  const [goalsFor, setGoalsFor] = useState<Indicator | null>(null);
  const { data: goals = [] } = useQuery({ queryKey: ["goals"], queryFn: loadGoals, staleTime: Infinity });

  const indicators = data?.indicators ?? [];
  const periods = data?.periods ?? [];
  const computed = useMemo(() => (data ? compute(data.indicators, data.periods, data.cells) : null), [data]);

  const sectors = useMemo(() => [...new Set(indicators.map((i) => i.sector))], [indicators]);
  const years = useMemo(() => [...new Set(periods.map((p) => p.month.slice(0, 4)))], [periods]);

  const visibleMonths = periods.filter((p) => {
    const y = p.month.slice(0, 4), m = String(parseInt(p.month.slice(5, 7)));
    return (!fYear.length || fYear.includes(y)) && (!fMonth.length || fMonth.includes(m));
  }).map((p) => p.month);

  const matches = (i: Indicator) =>
    (!fSector.length || fSector.includes(i.sector)) &&
    (!fReport.length || fReport.some((r) => i[r as "rmr" | "rid" | "rgr"])) &&
    (!fCompany.length || i.companies.some((c) => fCompany.includes(c)));

  // Keep sector/group header rows only if some indicator under them is visible.
  const rows = useMemo(() => {
    const out: Indicator[] = [];
    let pendingSector: Indicator | null = null, pendingGroup: Indicator | null = null;
    for (const i of indicators) {
      if (i.kind === "sector") { pendingSector = i; pendingGroup = null; continue; }
      if (i.kind === "group") { pendingGroup = i; continue; }
      if (!matches(i)) continue;
      if (pendingSector) { out.push(pendingSector); pendingSector = null; }
      if (pendingGroup) { out.push(pendingGroup); pendingGroup = null; }
      out.push(i);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators, fSector, fReport, fCompany]);

  const get = (id: string, m: string) => computed?.values.get(`${id}|${m}`);
  const sel = indicators.find((i) => i.id === selected) ?? null;

  // KPI: last visible month with a valid value, compared with the immediately previous month.
  const kpi = useMemo(() => {
    if (!sel) return null;
    const all = periods.map((p) => p.month);
    for (let k = visibleMonths.length - 1; k >= 0; k--) {
      const m = visibleMonths[k]!;
      const cur = get(sel.id, m)?.num ?? null;
      if (cur === null) continue;
      const prevMonth = all[all.indexOf(m) - 1];
      const prev = prevMonth ? get(sel.id, prevMonth)?.num ?? null : null;
      return { month: m, cur, prevMonth, prev, varPct: variation(cur, prev) };
    }
    return { month: null, cur: null, prevMonth: null, prev: null, varPct: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, visibleMonths.join(), computed]);

  const goalCompany = fCompany.length === 1 ? fCompany[0]! : null;
  const goalAt = (id: string, m: string) => goalFor(goals, id, m, goalCompany);
  const chartData = sel ? visibleMonths.map((m) => ({ month: monthLabel(m), value: get(sel.id, m)?.num ?? null, goal: goalAt(sel.id, m)?.target ?? null })) : [];
  const kpiGoal = sel && kpi?.month ? goalAt(sel.id, kpi.month) : null;
  const kpiStatus = goalStatus(kpi?.cur ?? null, kpiGoal);
  const kpiAch = achievement(kpi?.cur ?? null, kpiGoal);

  const refresh = () => qc.invalidateQueries({ queryKey: ["all"] });

  const saveCell = useMutation({
    mutationFn: async ({ ind, month, text }: { ind: Indicator; month: string; text: string }) => {
      const s = text.trim();
      if (s.startsWith("=")) {
        const { error } = await supabase.from("cells").upsert({ indicator_id: ind.id, month, formula: s, num_value: null, text_value: null });
        if (error) throw error;
        return;
      }
      const parsed = parseInput(s, ind.unit);
      if (!parsed) {
        const { error } = await supabase.from("cells").delete().eq("indicator_id", ind.id).eq("month", month);
        if (error) throw error;
        return;
      }
      const row = "num" in parsed
        ? { indicator_id: ind.id, month, num_value: parsed.num, text_value: null, formula: null }
        : { indicator_id: ind.id, month, num_value: null, text_value: parsed.text, formula: null };
      const { error } = await supabase.from("cells").upsert(row as { indicator_id: string; month: string; num_value: number | null; text_value: string | null; formula: null });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Valor salvo"); },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  const saveIndicator = useMutation({
    mutationFn: async ({ draft, id }: { draft: IndicatorDraft; id?: string | undefined }) => {
      if (id) {
        const { error } = await supabase.from("indicators").update(draft).eq("id", id);
        if (error) throw error;
      } else {
        // Insert right after the selected row, or at the end of the chosen sector.
        const anchorIdx = sel ? indicators.findIndex((i) => i.id === sel.id) : (() => {
          let last = -1; indicators.forEach((i, k) => { if (i.sector === draft.sector) last = k; }); return last;
        })();
        const anchor = indicators[anchorIdx];
        const next = indicators[anchorIdx + 1];
        const a = anchor ? anchor.position : (indicators.at(-1)?.position ?? 0);
        const b = anchor && next ? next.position : a + 2;
        const { error } = await supabase.from("indicators").insert({ ...draft, position: (a + b) / 2 });
        if (error) throw error;
      }
    },
    onSuccess: () => { refresh(); setDialog(null); toast.success("Indicador salvo"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteIndicator = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("indicators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); setToDelete(null); setSelected(null); toast.success("Indicador excluído"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const addMonth = useMutation({
    mutationFn: async () => {
      const last = periods.at(-1)?.month ?? "2026-01-01";
      const d = new Date(last + "T00:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + 1);
      const { error } = await supabase.from("periods").insert({ month: d.toISOString().slice(0, 10) });
      if (error) throw error;
      return d.toISOString().slice(0, 10);
    },
    onSuccess: (m) => { refresh(); toast.success(`Mês ${monthLabel(m)} adicionado`); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const importFile = useMutation({
    mutationFn: async (file: File) => {
      const changes = await readImport(file, indicators, periods.map((p) => p.month), get);
      for (let k = 0; k < changes.length; k += 500) {
        const { error } = await supabase.from("cells").upsert(changes.slice(k, k + 500));
        if (error) throw error;
      }
      return changes.length;
    },
    onSuccess: (n) => { refresh(); toast.success(n ? `${n} valor(es) importado(s)` : "Nenhum valor novo na planilha"); },
    onError: (e: Error) => toast.error("Erro ao importar: " + e.message),
  });

  const importGoals = useMutation({
    mutationFn: async (file: File) => {
      const rows = await readGoalsImport(file, indicators);
      for (let k = 0; k < rows.length; k += 500) {
        const { error } = await supabase.from("goals").upsert(rows.slice(k, k + 500), { onConflict: "indicator_id,period,company" });
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success(n ? `${n} meta(s) importada(s)` : "Nenhuma meta na planilha"); },
    onError: (e: Error) => toast.error("Erro ao importar metas: " + e.message),
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Carregando indicadores…</div>;
  if (error) return <div className="p-10 text-destructive">Erro ao carregar: {(error as Error).message}</div>;

  const draftFrom = (i: Indicator): IndicatorDraft => ({ kind: i.kind, name: i.name, sector: i.sector, grp: i.grp, bold: i.bold, indent: i.indent, unit: i.unit, decimals: i.decimals, companies: i.companies, rmr: i.rmr, rid: i.rid, rgr: i.rgr });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Odontoart Planos Odontológicos" className="h-9 w-auto shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">RID Geral</p>
              <h1 className="text-2xl font-semibold tracking-tight">Indicadores de Gestão · Odontoart &amp; New Odonto</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}><LogOut className="mr-1 h-4 w-4" />Sair</Button>
            <input id="import-xlsx" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile.mutate(f); e.target.value = ""; }} />
            <input id="import-goals" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importGoals.mutate(f); e.target.value = ""; }} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={importFile.isPending}><FileSpreadsheet className="mr-1 h-4 w-4" />Importar/Exportar</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => computed && exportExcel(rows, visibleMonths, get, computed.totals)}>Exportar tela filtrada (Excel)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => document.getElementById("import-xlsx")?.click()}>Importar planilha preenchida</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportGoals(rows, goals)}>Exportar metas (Excel)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => document.getElementById("import-goals")?.click()}>Importar metas (Excel)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => addMonth.mutate()}><CalendarPlus className="mr-1 h-4 w-4" />Novo mês</Button>
            <Button size="sm" onClick={() => setDialog({ mode: "new", draft: { ...EMPTY_DRAFT, sector: sel?.sector ?? "", grp: sel?.grp ?? null, companies: sel?.companies ?? [] } })}><Plus className="mr-1 h-4 w-4" />Novo indicador</Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1600px] flex-wrap gap-2 px-6 pb-4">
          <MultiSelect label="Setor" options={sectors.map((s) => ({ value: s, label: s }))} value={fSector} onChange={setFSector} />
          <MultiSelect label="Ano" options={years.map((y) => ({ value: y, label: y }))} value={fYear} onChange={setFYear} />
          <MultiSelect label="Mês" options={MONTH_NAMES.map((n, k) => ({ value: String(k + 1), label: n }))} value={fMonth} onChange={setFMonth} />
          <MultiSelect label="Relatório" options={[{ value: "rmr", label: "RMR" }, { value: "rid", label: "RID" }, { value: "rgr", label: "RGR" }]} value={fReport} onChange={setFReport} />
          <MultiSelect label="Empresa" options={[{ value: "Odontoart", label: "Odontoart" }, { value: "New Odonto", label: "New Odonto" }]} value={fCompany} onChange={setFCompany} />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-6 px-6 py-6">
        <section className="grid gap-4 lg:h-[420px] lg:grid-cols-[320px_1fr]">
          <div className="overflow-auto rounded-lg border border-border bg-card p-5">
            {sel && kpi ? (
              <>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{sel.sector}{sel.grp ? ` · ${sel.grp}` : ""}</p>
                <h2 className="mt-1 font-medium leading-snug">{sel.name}</h2>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Valor atual {kpi.month ? `(${monthLabel(kpi.month)})` : ""}</p>
                  <p className="text-3xl font-semibold tabular-nums">{kpi.cur !== null ? formatValue(kpi.cur, sel.unit, sel.decimals) : "—"}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Variação vs. mês anterior {kpi.prevMonth ? `(${monthLabel(kpi.prevMonth)})` : ""}</p>
                  {kpi.varPct === null ? (
                    <p className="flex items-center gap-1 text-lg text-muted-foreground"><Minus className="h-4 w-4" />sem base válida</p>
                  ) : (
                    <p className="flex items-center gap-1 text-lg font-medium tabular-nums">
                      {kpi.varPct > 0 ? <ArrowUpRight className="h-5 w-5 text-primary" /> : kpi.varPct < 0 ? <ArrowDownRight className="h-5 w-5 text-primary" /> : <Minus className="h-5 w-5" />}
                      {(kpi.varPct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Meta {kpiGoal ? `(${DIRECTIONS.find((x) => x.value === kpiGoal.direction)?.symbol} ${formatValue(kpiGoal.target, sel.unit, sel.decimals)})` : ""}</p>
                  {kpiGoal ? (
                    <>
                      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${STATUS_BG[kpiStatus]}`} style={{ width: `${Math.max(0, Math.min(1, kpiAch ?? 0)) * 100}%` }} />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm tabular-nums"><Dot s={kpiStatus} />{kpiAch !== null ? `${(kpiAch * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da meta` : "sem valor para comparar"} · {STATUS_LABEL[kpiStatus]}</p>
                    </>
                  ) : <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Dot s="none" />sem meta cadastrada</p>}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDialog({ mode: "edit", id: sel.id, draft: draftFrom(sel) })}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                  <Button variant="outline" size="sm" onClick={() => setToDelete(sel)}><Trash2 className="mr-1 h-3.5 w-3.5" />Excluir</Button>
                  <Button variant="outline" size="sm" onClick={() => setGoalsFor(sel)}><Target className="mr-1 h-3.5 w-3.5" />Metas</Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Clique em um indicador na tabela para ver o valor atual, a variação e a evolução mensal.</p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="h-64">
              {sel ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: 10, right: 20, top: 10 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <YAxis width={90} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatValue(v, sel.unit, sel.unit === "percentual" ? 0 : sel.decimals)} />
                    <Tooltip formatter={(v: number) => formatValue(v, sel.unit, sel.decimals)} />
                    <Line type="monotone" dataKey="value" name={sel.name} stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    <Line type="stepAfter" dataKey="goal" name="Meta" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Selecione um indicador para ver o gráfico</div>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-auto rounded-lg border border-border bg-card" style={{ maxHeight: "75vh" }}>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-secondary">
              <tr>
                <th className="sticky left-0 z-30 min-w-[360px] bg-secondary px-3 py-2 text-left font-medium">Indicador</th>
                {visibleMonths.map((m) => <th key={m} className="min-w-[110px] px-3 py-2 text-right font-medium">{monthLabel(m)}</th>)}
                <th className="min-w-[120px] px-3 py-2 text-right font-medium">Total 2026</th>
                <th className="px-2 py-2 text-center font-medium">RMR</th>
                <th className="px-2 py-2 text-center font-medium">RID</th>
                <th className="px-2 py-2 text-center font-medium">RGR</th>
                <th className="px-3 py-2 text-left font-medium">Empresa</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={visibleMonths.length + 6} className="p-6 text-center text-muted-foreground">Nenhum indicador para os filtros escolhidos.</td></tr>
              )}
              {rows.map((i) => {
                if (i.kind === "sector")
                  return (
                    <tr key={i.id} className="bg-sector">
                      <td className="sticky left-0 z-10 bg-sector px-3 py-2 text-base font-semibold text-sector-foreground" colSpan={1}>{i.name}</td>
                      <td colSpan={visibleMonths.length + 5} className="bg-sector" />
                    </tr>
                  );
                const isGroup = i.kind === "group";
                const active = i.id === selected;
                const total = computed?.totals.get(i.id) ?? null;
                return (
                  <tr key={i.id} onClick={() => setSelected(i.id === selected ? null : i.id)} className={`group cursor-pointer border-t border-border ${active ? "bg-highlight" : isGroup ? "bg-muted" : "hover:bg-accent/60"}`}>
                    <td className={`sticky left-0 z-10 px-3 py-1.5 ${active ? "bg-highlight" : isGroup ? "bg-muted" : "bg-card group-hover:bg-accent"} ${i.bold || isGroup ? "font-semibold" : ""}`} style={{ paddingLeft: 12 + i.indent * 18 }}>
                      <span className="flex items-center justify-between gap-2">
                        <span>{i.name}</span>
                        <button aria-label="Editar indicador" className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setDialog({ mode: "edit", id: i.id, draft: draftFrom(i) }); }}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </span>
                    </td>
                    {visibleMonths.map((m) => {
                      const v = get(i.id, m);
                      const isEditing = editing?.id === i.id && editing.month === m;
                      return (
                        <td key={m} className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${i.bold ? "font-semibold" : ""}`}
                          title={v?.formula ? `Fórmula: ${v.formula}` : "Clique duas vezes para editar"}
                          onDoubleClick={() => setEditing({ id: i.id, month: m, text: v?.formula ?? (v?.num != null ? toEditString(v.num, i.unit) : v?.text ?? "") })}>
                          {isEditing ? (
                            <input autoFocus className="w-24 rounded border border-ring bg-background px-1 text-right" value={editing.text}
                              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { saveCell.mutate({ ind: i, month: m, text: editing.text }); setEditing(null); }
                                if (e.key === "Escape") setEditing(null);
                              }}
                              onBlur={() => { saveCell.mutate({ ind: i, month: m, text: editing.text }); setEditing(null); }} />
                          ) : v?.num != null ? <span className="inline-flex items-center gap-1.5">{formatValue(v.num, i.unit, i.decimals)}{!isGroup && <Dot s={goalStatus(v.num, goalAt(i.id, m))} />}</span> : (v?.text ?? "")}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">{total !== null ? formatValue(total, i.unit, i.decimals) : ""}</td>
                    {(["rmr", "rid", "rgr"] as const).map((k) => <td key={k} className="px-2 py-1.5 text-center text-xs text-muted-foreground">{isGroup ? "" : i[k] ? "Sim" : "Não"}</td>)}
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground">{i.companies.join(" / ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <p className="text-xs text-muted-foreground">Clique numa linha para ver o gráfico · clique duas vezes num valor para editar (Enter salva, Esc cancela; deixe vazio para apagar; comece com “=” para fórmula).</p>
      </main>

      {goalsFor && <GoalsDialog indicator={goalsFor} goals={goals} years={years} onClose={() => setGoalsFor(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["goals"] })} />}
      {dialog && (
        <IndicatorDialog open title={dialog.mode === "new" ? "Novo indicador" : "Editar indicador"} initial={dialog.draft} sectors={sectors}
          onOpenChange={(o) => !o && setDialog(null)} onSave={(d) => saveIndicator.mutate({ draft: d, id: dialog.id })} />
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir indicador?</AlertDialogTitle>
            <AlertDialogDescription>“{toDelete?.name}” e todo o seu histórico mensal serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteIndicator.mutate(toDelete.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const STATUS_BG: Record<Status, string> = { green: "bg-goal-green", yellow: "bg-goal-yellow", red: "bg-goal-red", none: "bg-goal-none" };
const STATUS_LABEL: Record<Status, string> = { green: "meta atingida", yellow: "próximo da meta", red: "fora da meta", none: "sem meta" };
function Dot({ s }: { s: Status }) {
  return <span aria-label={STATUS_LABEL[s]} title={STATUS_LABEL[s]} className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_BG[s]}`} />;
}
