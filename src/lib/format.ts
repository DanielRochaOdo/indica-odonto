export type Unit = "moeda" | "percentual" | "inteiro" | "decimal" | "numero" | "horas" | "texto";

export const UNITS: { value: Unit; label: string }[] = [
  { value: "moeda", label: "Moeda (R$)" },
  { value: "percentual", label: "Percentual (%)" },
  { value: "inteiro", label: "Quantidade (inteiro)" },
  { value: "decimal", label: "Decimal" },
  { value: "numero", label: "Número geral" },
  { value: "horas", label: "Horas (h:mm)" },
  { value: "texto", label: "Texto" },
];

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

export function formatValue(v: number | null | undefined, unit: string, decimals: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  switch (unit) {
    case "moeda":
      return "R$ " + nf(2, 2).format(v);
    case "percentual":
      return nf(decimals, decimals).format(v * 100) + "%";
    case "inteiro":
      return nf(0, 0).format(v);
    case "decimal":
      return nf(decimals, decimals).format(v);
    case "horas": {
      const neg = v < 0;
      const mins = Math.round(Math.abs(v) * 24 * 60);
      return (neg ? "-" : "") + Math.floor(mins / 60) + ":" + String(mins % 60).padStart(2, "0");
    }
    default:
      return nf(0, 2).format(v);
  }
}

/** Value shown in the edit box. */
export function toEditString(v: number | null, unit: string): string {
  if (v === null) return "";
  if (unit === "percentual") return String(+(v * 100).toFixed(6)).replace(".", ",");
  if (unit === "horas") return formatValue(v, unit, 0);
  return String(+v.toFixed(8)).replace(".", ",");
}

/** Parse user input. Returns {num} for numbers, {text} for anything else, null for empty. */
export function parseInput(raw: string, unit: string): { num: number } | { text: string } | null {
  const s = raw.trim();
  if (!s) return null;
  if (unit === "horas") {
    const m = s.match(/^(-?)(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
    if (m) {
      const d = (parseInt(m[2] ?? "0") * 3600 + parseInt(m[3] ?? "0") * 60 + parseInt(m[4] ?? "0")) / 86400;
      return { num: m[1] ? -d : d };
    }
  }
  const cleaned = s.replace(/R\$\s?/i, "").replace(/%$/, "").replace(/\s/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    const n = parseFloat(normalized);
    return { num: unit === "percentual" ? n / 100 : n };
  }
  return { text: s };
}

/** Month-over-month variation; null when either value is not valid or previous is zero. */
export function variation(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export function monthLabel(iso: string) {
  const [y = "", m = "1"] = iso.split("-");
  return `${MONTHS[parseInt(m) - 1]}/${y.slice(2)}`;
}
