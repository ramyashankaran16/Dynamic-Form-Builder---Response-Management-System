/**
 * Client-side mirror of backend app/services/form_engine.py (evaluate_condition / compute_visibility).
 * The backend remains the source of truth; this gives instant show/hide while typing.
 */
import type { Answers, Operator, VisibilityRules } from "../types";

interface FieldLike {
  field_key: string;
  visibility_rules: VisibilityRules | null;
}

export const OPERATORS: { value: Operator; label: string; needsValue: boolean }[] = [
  { value: "equals", label: "is", needsValue: true },
  { value: "not_equals", label: "is not", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "in", label: "is any of", needsValue: true },
  { value: "not_in", label: "is none of", needsValue: true },
  { value: "greater_than", label: "is greater than", needsValue: true },
  { value: "less_than", label: "is less than", needsValue: true },
  { value: "greater_or_equal", label: "is at least", needsValue: true },
  { value: "less_or_equal", label: "is at most", needsValue: true },
  { value: "is_empty", label: "is empty", needsValue: false },
  { value: "is_not_empty", label: "is answered", needsValue: false },
];

export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function norm(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || v === undefined) return "";
  return String(v).trim().toLowerCase();
}

function toNumber(v: unknown): number | null {
  if (typeof v === "boolean" || v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function evaluateCondition(op: Operator, actual: unknown, expected: unknown): boolean {
  if (op === "is_empty") return isEmpty(actual);
  if (op === "is_not_empty") return !isEmpty(actual);
  if (isEmpty(actual)) return op === "not_equals" || op === "not_contains" || op === "not_in";

  const actualList = Array.isArray(actual) ? actual : null;
  switch (op) {
    case "equals":
    case "not_equals": {
      const match = actualList ? actualList.map(norm).includes(norm(expected)) : norm(actual) === norm(expected);
      return op === "equals" ? match : !match;
    }
    case "contains":
    case "not_contains": {
      const match = actualList ? actualList.map(norm).includes(norm(expected)) : norm(actual).includes(norm(expected));
      return op === "contains" ? match : !match;
    }
    case "in":
    case "not_in": {
      const expectedSet = new Set((Array.isArray(expected) ? expected : [expected]).map(norm));
      const match = (actualList ?? [actual]).some((a) => expectedSet.has(norm(a)));
      return op === "in" ? match : !match;
    }
    default: {
      const a = toNumber(actual);
      const e = toNumber(expected);
      const [x, y] = a !== null && e !== null ? [a, e] : [String(actual), String(expected)];
      if (op === "greater_than") return x > y;
      if (op === "less_than") return x < y;
      if (op === "greater_or_equal") return x >= y;
      if (op === "less_or_equal") return x <= y;
      return false;
    }
  }
}

/** Returns {field_key: visible}. Hidden fields never satisfy dependants' conditions. */
export function computeVisibility(fields: FieldLike[], values: Answers): Record<string, boolean> {
  const byKey = new Map(fields.map((f) => [f.field_key, f]));
  const memo = new Map<string, boolean>();

  const visible = (key: string, stack: Set<string>): boolean => {
    if (memo.has(key)) return memo.get(key)!;
    const field = byKey.get(key);
    const rules = field?.visibility_rules;
    if (!field || !rules || !rules.conditions?.length) {
      memo.set(key, true);
      return true;
    }
    if (stack.has(key)) return true;
    const next = new Set(stack).add(key);
    const results = rules.conditions.map((c) => {
      const ref = byKey.get(c.field_key);
      if (!ref) return false;
      const refValue = visible(ref.field_key, next) ? values[ref.field_key] : null;
      return evaluateCondition(c.operator, refValue, c.value);
    });
    const result = rules.logic === "any" ? results.some(Boolean) : results.every(Boolean);
    memo.set(key, result);
    return result;
  };

  return Object.fromEntries(fields.map((f) => [f.field_key, visible(f.field_key, new Set())]));
}
