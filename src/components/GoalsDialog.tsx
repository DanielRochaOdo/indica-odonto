import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DIRECTIONS, periodLabel, type Direction, type Goal } from "@/lib/goals";
import { formatValue, parseInput, toEditString } from "@/lib/format";
import type { Indicator } from "@/lib/data";

type Draft = { id?: string; scope: "all" | "year" | "month"; year: string; month: string; company: string; target: string; direction: Direction; tolerance: string; note: string };

export function GoalsDialog({ indicator, goals, years, onClose, onChanged }: {
  indicator: Indicator; goals: Goal[]; years: string[]; onClose: () => void; onChanged: () => void;
}) {
  const list = goals.filter((g) => g.indicator_id === indicator.id).sort((a, b) => a.period.localeCompare(b.period) || a.company.localeCompare(b.company));
  const blank: Draft = { scope: "all", year: years.at(-1) ?? "2026", month: "1", company: "", target: "", direction: list[0]?.direction ?? "up", tolerance: "5", note: "" };
  const [d, setD] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const edit = (g: Goal) => setD({
    id: g.id, scope: g.period === "" ? "all" : g.period.length === 4 ? "year" : "month",
    year: g.period.slice(0, 4) || blank.year, month: g.period.length > 4 ? String(parseInt(g.period.slice(5, 7))) : "1",
    company: g.company, target: toEditString(g.target, indicator.unit), direction: g.direction,
    tolerance: String(+(g.tolerance * 100).toFixed(2)), note: g.note ?? "",
  });

  const save = async () => {
    const parsed = parseInput(d.target, indicator.unit);
    if (!parsed || !("num" in parsed)) { toast.error("Informe um valor de meta numérico"); return; }
    const period = d.scope === "all" ? "" : d.scope === "year" ? d.year : `${d.year}-${d.month.padStart(2, "0")}`;
    const row = { indicator_id: indicator.id, period, company: d.company, target: parsed.num, direction: d.direction, tolerance: (Number(d.tolerance.replace(",", ".")) || 0) / 100, note: d.note || null };
    setBusy(true);
    const { error } = d.id
      ? await supabase.from("goals").update(row).eq("id", d.id)
      : await supabase.from("goals").upsert(row, { onConflict: "indicator_id,period,company" });
    setBusy(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Meta salva"); setD(blank); onChanged();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Meta excluída"); if (d.id === id) setD(blank); onChanged();
  };
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Metas · {indicator.name}</DialogTitle></DialogHeader>
        <div className="max-h-48 overflow-auto rounded border border-border">
          {list.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Nenhuma meta cadastrada.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {list.map((g) => (
                  <tr key={g.id} className="border-t border-border first:border-0">
                    <td className="px-2 py-1.5">{periodLabel(g.period)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{g.company || "Todas"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{DIRECTIONS.find((x) => x.value === g.direction)?.symbol} {formatValue(g.target, indicator.unit, indicator.decimals)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button aria-label="Editar meta" className="mr-2" onClick={() => edit(g)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button aria-label="Excluir meta" onClick={() => remove(g.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="grid gap-3">
          <p className="text-sm font-medium">{d.id ? "Editar meta" : "Nova meta"}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Vale para</Label>
              <select className={sel} value={d.scope} onChange={(e) => set("scope", e.target.value as Draft["scope"])}>
                <option value="all">Todos os meses</option><option value="year">Um ano</option><option value="month">Um mês</option>
              </select></div>
            {d.scope !== "all" && <div className="grid gap-1"><Label>Ano</Label><Input value={d.year} onChange={(e) => set("year", e.target.value)} /></div>}
            {d.scope === "month" && <div className="grid gap-1"><Label>Mês (1–12)</Label><Input type="number" min={1} max={12} value={d.month} onChange={(e) => set("month", e.target.value)} /></div>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Empresa</Label>
              <select className={sel} value={d.company} onChange={(e) => set("company", e.target.value)}>
                <option value="">Todas</option><option>Odontoart</option><option>New Odonto</option>
              </select></div>
            <div className="grid gap-1"><Label>Meta{indicator.unit === "percentual" ? " (%)" : ""}</Label><Input value={d.target} onChange={(e) => set("target", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Faixa amarela (%)</Label><Input value={d.tolerance} onChange={(e) => set("tolerance", e.target.value)} /></div>
          </div>
          <div className="grid gap-1"><Label>Sentido</Label>
            <select className={sel} value={d.direction} onChange={(e) => set("direction", e.target.value as Direction)}>
              {DIRECTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select></div>
          <div className="grid gap-1"><Label>Observação</Label><Input value={d.note} onChange={(e) => set("note", e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            {d.id && <Button variant="outline" onClick={() => setD(blank)}>Cancelar edição</Button>}
            <Button disabled={busy || !d.target.trim()} onClick={save}>Salvar meta</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
