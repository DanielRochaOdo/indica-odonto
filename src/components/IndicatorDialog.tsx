import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UNITS } from "@/lib/format";
import type { Indicator } from "@/lib/data";

export type IndicatorDraft = Omit<Indicator, "id" | "position" | "sheet_row" | "total_formula">;

export function IndicatorDialog({
  open, onOpenChange, initial, sectors, onSave, title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: IndicatorDraft;
  sectors: string[];
  onSave: (d: IndicatorDraft) => void;
  title: string;
}) {
  const [d, setD] = useState(initial);
  useEffect(() => { if (open) setD(initial); }, [open, initial]);
  const set = <K extends keyof IndicatorDraft>(k: K, v: IndicatorDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggleCompany = (c: string, on: boolean) =>
    set("companies", on ? [...d.companies.filter((x) => x !== c), c] : d.companies.filter((x) => x !== c));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Nome</Label><Input value={d.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Setor</Label>
              <Input list="sector-list" value={d.sector} onChange={(e) => set("sector", e.target.value)} />
              <datalist id="sector-list">{sectors.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="grid gap-1"><Label>Grupo (opcional)</Label><Input value={d.grp ?? ""} onChange={(e) => set("grp", e.target.value || null)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-1">
              <Label>Unidade</Label>
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={d.unit} onChange={(e) => set("unit", e.target.value)}>
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div className="grid gap-1"><Label>Casas decimais</Label><Input type="number" min={0} max={4} value={d.decimals} onChange={(e) => set("decimals", Number(e.target.value))} /></div>
          </div>
          <div className="grid gap-1">
            <Label>Tipo de linha</Label>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={d.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="indicator">Indicador</option>
              <option value="group">Título de grupo</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">Empresa:</span>
            {["Odontoart", "New Odonto"].map((c) => (
              <label key={c} className="flex items-center gap-2"><Checkbox checked={d.companies.includes(c)} onCheckedChange={(v) => toggleCompany(c, !!v)} />{c}</label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">Relatório:</span>
            {(["rmr", "rid", "rgr"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2"><Checkbox checked={d[k]} onCheckedChange={(v) => set(k, !!v)} />{k.toUpperCase()}</label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={d.bold} onCheckedChange={(v) => set("bold", !!v)} />Linha principal (negrito)</label>
            <label className="flex items-center gap-2"><Checkbox checked={d.indent > 0} onCheckedChange={(v) => set("indent", v ? 1 : 0)} />Recuada (sub-item)</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!d.name.trim() || !d.sector.trim()} onClick={() => onSave({ ...d, name: d.name.trim(), sector: d.sector.trim() })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
