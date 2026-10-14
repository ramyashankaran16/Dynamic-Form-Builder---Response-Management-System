import { fieldMeta, slugifyKey, uniqueKey } from "../../lib/fieldTypes";
import type { FieldConfig, FieldInput, FieldType, FormField, VisibilityRules } from "../../types";

export interface BuilderOption {
  label: string;
  value: string;
}

export interface BuilderField {
  uid: string;
  id?: number;
  label: string;
  field_key: string;
  /** User typed the key manually - stop auto-generating it from the label. */
  keyEdited: boolean;
  field_type: FieldType;
  placeholder: string;
  help_text: string;
  is_required: boolean;
  config: FieldConfig;
  visibility_rules: VisibilityRules | null;
  options: BuilderOption[];
}

let counter = 0;
export const newUid = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`;

export function fromApi(f: FormField): BuilderField {
  return {
    uid: newUid(),
    id: f.id,
    label: f.label,
    field_key: f.field_key,
    keyEdited: true,
    field_type: f.field_type,
    placeholder: f.placeholder ?? "",
    help_text: f.help_text ?? "",
    is_required: f.is_required,
    config: { ...(f.config ?? {}) },
    visibility_rules: f.visibility_rules,
    options: f.options.map((o) => ({ label: o.label, value: o.value })),
  };
}

export function createField(type: FieldType, existing: BuilderField[]): BuilderField {
  const meta = fieldMeta(type);
  const taken = new Set(existing.map((f) => f.field_key));
  return {
    uid: newUid(),
    label: meta.defaultLabel,
    field_key: uniqueKey(slugifyKey(meta.defaultLabel), taken),
    keyEdited: false,
    field_type: type,
    placeholder: "",
    help_text: "",
    is_required: false,
    config: { ...meta.defaultConfig },
    visibility_rules: null,
    options:
      type === "checkbox"
        ? [{ label: "Option 1", value: "option_1" }, { label: "Option 2", value: "option_2" }]
        : meta.hasOptions
          ? [{ label: "Option 1", value: "option_1" }, { label: "Option 2", value: "option_2" }, { label: "Option 3", value: "option_3" }]
          : [],
  };
}

export function duplicateField(f: BuilderField, existing: BuilderField[]): BuilderField {
  const taken = new Set(existing.map((x) => x.field_key));
  return {
    ...structuredClone(f),
    uid: newUid(),
    id: undefined,
    label: `${f.label} (copy)`,
    field_key: uniqueKey(`${f.field_key}_copy`, taken),
    keyEdited: false,
  };
}

export function toInput(f: BuilderField): FieldInput {
  const meta = fieldMeta(f.field_type);
  return {
    id: f.id ?? null,
    label: f.label.trim(),
    field_key: f.field_key,
    field_type: f.field_type,
    placeholder: f.placeholder.trim() || null,
    help_text: f.help_text.trim() || null,
    is_required: f.is_required,
    config: f.config,
    visibility_rules: f.visibility_rules?.conditions.length ? f.visibility_rules : null,
    options: meta.hasOptions ? f.options.map((o) => ({ label: o.label.trim(), value: o.value.trim() || o.label.trim() })) : [],
  };
}

/** Shape used by the renderer for the live preview. */
export function toPreview(f: BuilderField, index: number): FormField {
  const input = toInput(f);
  return {
    id: f.id ?? -(index + 1),
    field_key: f.field_key,
    label: input.label || "Untitled field",
    field_type: f.field_type,
    placeholder: input.placeholder ?? null,
    help_text: input.help_text ?? null,
    is_required: f.is_required,
    order_index: index,
    config: f.config,
    visibility_rules: input.visibility_rules,
    options: input.options.map((o, i) => ({ label: o.label, value: o.value ?? o.label, order_index: i })),
  };
}

/** Does field `a` depend (directly or indirectly) on field `b`? Used to prevent circular rules. */
export function dependsOn(fields: BuilderField[], aKey: string, bKey: string, seen = new Set<string>()): boolean {
  if (seen.has(aKey)) return false;
  seen.add(aKey);
  const a = fields.find((f) => f.field_key === aKey);
  const refs = a?.visibility_rules?.conditions.map((c) => c.field_key) ?? [];
  return refs.includes(bKey) || refs.some((r) => dependsOn(fields, r, bKey, seen));
}

/** Problems that would make the save fail - checked before calling the API. */
export function builderProblems(title: string, fields: BuilderField[]): string[] {
  const problems: string[] = [];
  if (!title.trim()) problems.push("Give the form a title.");
  const keys = new Set<string>();
  fields.forEach((f, i) => {
    const name = f.label.trim() || `Field ${i + 1}`;
    if (!f.label.trim()) problems.push(`Field ${i + 1} needs a label.`);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(f.field_key)) problems.push(`"${name}": the field key must start with a letter and use only letters, numbers and _.`);
    if (keys.has(f.field_key)) problems.push(`"${name}": the field key "${f.field_key}" is used twice.`);
    keys.add(f.field_key);
    if ((f.field_type === "dropdown" || f.field_type === "radio") && f.options.filter((o) => o.label.trim()).length === 0)
      problems.push(`"${name}" needs at least one option.`);
    if (fieldMeta(f.field_type).hasOptions && f.options.some((o) => !o.label.trim()))
      problems.push(`"${name}" has an option without a label.`);
  });
  return problems;
}
