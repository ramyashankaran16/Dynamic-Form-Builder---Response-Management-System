import { Alert, Box, Button, Collapse, Stack } from "@mui/material";
import { useMemo, useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { errorMessage, fieldErrors } from "../../lib/errors";
import { computeVisibility, isEmpty } from "../../lib/visibility";
import type { Answers, FormField } from "../../types";
import { FieldControl } from "./FieldControl";

interface Props {
  fields: FormField[];
  /** Form slug - enables file uploads. */
  slug?: string;
  initialAnswers?: Answers;
  submitLabel?: string;
  /** Throw to show errors; 422 field errors are mapped onto the fields automatically. */
  onSubmit?: (answers: Answers) => Promise<void>;
  onCancel?: () => void;
  /** Preview mode: validates but does not send anything. */
  preview?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultValue(field: FormField, initial?: Answers): unknown {
  const v = initial?.[field.field_key];
  switch (field.field_type) {
    case "checkbox":
      return field.options.length ? (Array.isArray(v) ? v.map(String) : []) : v === true;
    case "rating":
      return typeof v === "number" ? v : null;
    default:
      return v === null || v === undefined ? "" : String(v);
  }
}

/** Client-side checks mirroring the backend, so people see problems before submitting. */
function validateValue(field: FormField, value: unknown): string | true {
  const c = (field.config ?? {}) as Record<string, number | string | boolean | undefined>;
  const booleanCheckbox = field.field_type === "checkbox" && field.options.length === 0;

  if (booleanCheckbox) {
    return field.is_required && value !== true ? "This box must be checked." : true;
  }
  if (isEmpty(value)) return field.is_required ? "This field is required." : true;

  switch (field.field_type) {
    case "text": {
      const s = String(value).trim();
      if (c.min_length != null && s.length < Number(c.min_length)) return `Must be at least ${c.min_length} characters.`;
      if (c.max_length != null && s.length > Number(c.max_length)) return `Must be at most ${c.max_length} characters.`;
      if (c.pattern) {
        try {
          if (!new RegExp(`^(?:${c.pattern})$`).test(s)) return String(c.pattern_message || "Invalid format.");
        } catch {
          /* invalid regex: leave it to the server */
        }
      }
      return true;
    }
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return "Must be a valid number.";
      if (c.integer_only && !Number.isInteger(n)) return "Must be a whole number.";
      if (c.min != null && n < Number(c.min)) return `Must be at least ${c.min}.`;
      if (c.max != null && n > Number(c.max)) return `Must be at most ${c.max}.`;
      return true;
    }
    case "email":
      return EMAIL_RE.test(String(value).trim()) || "Must be a valid email address.";
    case "date": {
      const s = String(value);
      if (c.min_date && s < String(c.min_date)) return `Date must be on or after ${c.min_date}.`;
      if (c.max_date && s > String(c.max_date)) return `Date must be on or before ${c.max_date}.`;
      return true;
    }
    case "checkbox": {
      const count = Array.isArray(value) ? value.length : 0;
      if (c.min_selected != null && count < Number(c.min_selected)) return `Select at least ${c.min_selected} option(s).`;
      if (c.max_selected != null && count > Number(c.max_selected)) return `Select at most ${c.max_selected} option(s).`;
      return true;
    }
    default:
      return true;
  }
}

/** Convert form state into the API's answer format, dropping hidden and empty fields. */
function toAnswers(fields: FormField[], values: FieldValues, visible: Record<string, boolean>): Answers {
  const answers: Answers = {};
  for (const f of fields) {
    if (!visible[f.field_key]) continue;
    const v = values[f.field_key];
    if (f.field_type === "checkbox" && f.options.length === 0) {
      answers[f.field_key] = v === true;
      continue;
    }
    if (isEmpty(v)) continue;
    answers[f.field_key] = f.field_type === "number" ? Number(v) : v;
  }
  return answers;
}

export function FormRenderer({ fields, slug, initialAnswers, submitLabel = "Submit", onSubmit, onCancel, preview }: Props) {
  const ordered = useMemo(() => [...fields].sort((a, b) => a.order_index - b.order_index), [fields]);
  const defaults = useMemo(
    () => Object.fromEntries(ordered.map((f) => [f.field_key, defaultValue(f, initialAnswers)])),
    [ordered, initialAnswers],
  );
  const { control, handleSubmit, watch, setError, formState } = useForm<FieldValues>({ defaultValues: defaults, mode: "onTouched" });
  const [formError, setFormError] = useState<string | null>(null);
  const [previewOk, setPreviewOk] = useState(false);

  const values = watch();
  const visibility = computeVisibility(ordered, values);

  const submit = handleSubmit(async (vals) => {
    setFormError(null);
    setPreviewOk(false);
    const answers = toAnswers(ordered, vals, computeVisibility(ordered, vals));
    if (preview || !onSubmit) {
      setPreviewOk(true);
      return;
    }
    try {
      await onSubmit(answers);
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe) {
        Object.entries(fe).forEach(([key, message]) => setError(key, { type: "server", message }));
        setFormError("Please correct the highlighted fields.");
      } else {
        setFormError(errorMessage(err));
      }
    }
  }, () => setFormError("Please correct the highlighted fields."));

  return (
    <Box component="form" noValidate onSubmit={submit}>
      <Stack spacing={0}>
        {ordered.map((field) => (
          <Collapse key={field.field_key} in={visibility[field.field_key]} unmountOnExit appear={false}>
            <Box sx={{ py: 1.5 }}>
              <FieldControl
                field={field}
                control={control}
                slug={slug}
                preview={preview}
                rules={{
                  validate: (value: unknown, all: FieldValues) =>
                    computeVisibility(ordered, all)[field.field_key] ? validateValue(field, value) : true,
                }}
              />
            </Box>
          </Collapse>
        ))}
      </Stack>

      {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
      {previewOk && <Alert severity="success" sx={{ mt: 2 }}>All answers are valid. Nothing is saved in preview.</Alert>}

      <Box sx={{ display: "flex", gap: 1.5, mt: 3, flexWrap: "wrap" }}>
        <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button size="large" color="inherit" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </Box>
    </Box>
  );
}
