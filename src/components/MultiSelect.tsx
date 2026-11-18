import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

export function MultiSelect({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const summary = value.length === 0 ? "Todos" : value.length === 1 ? options.find((o) => o.value === value[0])?.label : `${value.length} selecionados`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex min-w-40 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-left text-sm hover:bg-accent">
          <span>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="block max-w-48 truncate">{summary}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="mb-1 flex justify-between px-1 text-xs">
          <button className="text-primary hover:underline" onClick={() => onChange(options.map((o) => o.value))}>Marcar todos</button>
          <button className="text-muted-foreground hover:underline" onClick={() => onChange([])}>Limpar</button>
        </div>
        <div className="max-h-72 overflow-auto">
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
              <Checkbox
                checked={value.includes(o.value)}
                onCheckedChange={(c) => onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))}
              />
              {o.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
