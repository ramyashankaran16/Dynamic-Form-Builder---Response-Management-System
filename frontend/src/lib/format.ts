import type { FieldOption, FieldType } from "../types";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  // API returns naive UTC datetimes; mark them as UTC so the browser converts to local time.
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function fileNameFromPath(path: string): string {
  const name = path.split("/").pop() ?? path;
  const idx = name.indexOf("_");
  return idx > 0 ? name.slice(idx + 1) : name;
}

/** Human readable answer for tables / detail views. */
export function formatAnswer(type: FieldType | string, value: unknown, options?: FieldOption[]): string {
  if (value === null || value === undefined || value === "") return "";
  const label = (v: unknown) => options?.find((o) => o.value === String(v))?.label ?? String(v);
  if (Array.isArray(value)) return value.map(label).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  switch (type) {
    case "dropdown":
    case "radio":
      return label(value);
    case "date":
      return formatDate(String(value));
    case "file":
      return fileNameFromPath(String(value));
    case "rating":
      return `${value} ★`;
    default:
      return String(value);
  }
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n.toLocaleString()} ${n === 1 ? word : pluralWord}`;
}
