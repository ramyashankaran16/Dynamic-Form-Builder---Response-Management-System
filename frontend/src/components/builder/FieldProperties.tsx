import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert, Box, Button, Divider, FormControlLabel, IconButton, MenuItem, Slider, Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { FIELD_TYPES, fieldMeta, slugifyKey } from "../../lib/fieldTypes";
import { OPERATORS } from "../../lib/visibility";
import type { Condition, FieldConfig, FieldType, Operator } from "../../types";
import { dependsOn, type BuilderField, type BuilderOption } from "./builderState";

interface Props {
  field: BuilderField;
  all: BuilderField[];
  onChange: (patch: Partial<BuilderField>) => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="h6" component="h3" sx={{ mb: 1.25 }}>{title}</Typography>
      <Stack spacing={1.75}>{children}</Stack>
    </Box>
  );
}

function NumberSetting({ label, config, name, onChange, helper, step }: {
  label: string; config: FieldConfig; name: string; onChange: (c: FieldConfig) => void; helper?: string; step?: number;
}) {
  const value = config[name];
  return (
    <TextField
      label={label}
      type="number"
      value={value === undefined || value === null ? "" : String(value)}
      helperText={helper}
      slotProps={{ htmlInput: { step: step ?? "any" } }}
      onChange={(e) => {
        const next = { ...config };
        if (e.target.value === "") delete next[name];
        else next[name] = Number(e.target.value);
        onChange(next);
      }}
    />
  );
}

function TextSetting({ label, config, name, onChange, helper, type = "text" }: {
  label: string; config: FieldConfig; name: string; onChange: (c: FieldConfig) => void; helper?: string; type?: string;
}) {
  return (
    <TextField
      label={label}
      type={type}
      value={(config[name] as string) ?? ""}
      helperText={helper}
      slotProps={type === "date" ? { inputLabel: { shrink: true } } : undefined}
      onChange={(e) => {
        const next = { ...config };
        if (e.target.value === "") delete next[name];
        else next[name] = e.target.value;
        onChange(next);
      }}
    />
  );
}

function OptionsEditor({ options, onChange, allowEmpty, autoValue }: {
  options: BuilderOption[]; onChange: (o: BuilderOption[]) => void; allowEmpty?: boolean; autoValue: boolean;
}) {
  const update = (i: number, patch: Partial<BuilderOption>) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...options];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };
  const add = () => {
    const taken = new Set(options.map((o) => o.value));
    let n = options.length + 1;
    while (taken.has(`option_${n}`)) n++;
    onChange([...options, { label: `Option ${n}`, value: `option_${n}` }]);
  };

  return (
    <Box>
      <Stack spacing={1}>
        {options.map((o, i) => (
          <Box key={i} sx={{ display: "grid", gridTemplateColumns: "1fr 0.8fr auto", gap: 0.75, alignItems: "center" }}>
            <TextField
              value={o.label}
              placeholder="Label"
              slotProps={{ htmlInput: { "aria-label": `Option ${i + 1} label` } }}
              onChange={(e) => {
                const label = e.target.value;
                // On unsaved fields the stored value follows the label until edited separately.
                const synced = autoValue && (o.value === "" || o.value === slugifyKey(o.label));
                update(i, synced ? { label, value: slugifyKey(label || `option ${i + 1}`) } : { label });
              }}
            />
            <TextField
              value={o.value}
              placeholder="Stored value"
              slotProps={{ htmlInput: { "aria-label": `Option ${i + 1} stored value` } }}
              onChange={(e) => update(i, { value: e.target.value })}
            />
            <Box sx={{ display: "flex" }}>
              <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move option up"><ArrowUpwardIcon fontSize="inherit" /></IconButton>
              <IconButton size="small" disabled={i === options.length - 1} onClick={() => move(i, 1)} aria-label="Move option down"><ArrowDownwardIcon fontSize="inherit" /></IconButton>
              <IconButton size="small" disabled={!allowEmpty && options.length <= 1} onClick={() => onChange(options.filter((_, idx) => idx !== i))} aria-label="Remove option"><CloseIcon fontSize="inherit" /></IconButton>
            </Box>
          </Box>
        ))}
      </Stack>
      <Button startIcon={<AddIcon />} onClick={add} size="small" sx={{ mt: 1 }}>Add option</Button>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.5 }}>
        The stored value is what exports and conditions use. Keep it stable once responses arrive.
      </Typography>
    </Box>
  );
}

function ConditionValue({ condition, refField, onChange }: { condition: Condition; refField?: BuilderField; onChange: (v: unknown) => void }) {
  const op = OPERATORS.find((o) => o.value === condition.operator);
  if (!op?.needsValue) return null;
  const multi = condition.operator === "in" || condition.operator === "not_in";

  if (refField && refField.options.length > 0) {
    const value = multi ? (Array.isArray(condition.value) ? condition.value : []) : (condition.value as string) ?? "";
    return (
      <TextField select label="Value" value={value} onChange={(e) => onChange(e.target.value)} slotProps={{ select: { multiple: multi } }}>
        {refField.options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
      </TextField>
    );
  }
  if (refField?.field_type === "checkbox") {
    return (
      <TextField select label="Value" value={condition.value === true ? "true" : condition.value === false ? "false" : ""} onChange={(e) => onChange(e.target.value === "true")}>
        <MenuItem value="true">Checked</MenuItem>
        <MenuItem value="false">Not checked</MenuItem>
      </TextField>
    );
  }
  const type = refField?.field_type === "number" || refField?.field_type === "rating" ? "number" : refField?.field_type === "date" ? "date" : "text";
  return (
    <TextField
      label={multi ? "Values (comma separated)" : "Value"}
      type={multi ? "text" : type}
      value={multi ? (Array.isArray(condition.value) ? condition.value.join(", ") : "") : String(condition.value ?? "")}
      slotProps={type === "date" ? { inputLabel: { shrink: true } } : undefined}
      onChange={(e) =>
        onChange(multi ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)
      }
    />
  );
}

function VisibilityEditor({ field, all, onChange }: Props) {
  const rules = field.visibility_rules;
  // Fields this one may depend on: not itself, and not fields that already depend on it (would create a loop).
  const candidates = all.filter((f) => f.uid !== field.uid && !dependsOn(all, f.field_key, field.field_key));
  const conditions = rules?.conditions ?? [];

  const setConditions = (next: Condition[]) =>
    onChange({ visibility_rules: next.length ? { logic: rules?.logic ?? "all", conditions: next } : null });
  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  if (!conditions.length) {
    return (
      <Box>
        <Typography sx={{ fontSize: 14, color: "text.secondary", mb: 1 }}>Always shown.</Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={!candidates.length}
          onClick={() => setConditions([{ field_key: candidates[0].field_key, operator: "equals", value: "" }])}
        >
          Show only when…
        </Button>
        {!candidates.length && <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Add another field first.</Typography>}
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      {conditions.length > 1 && (
        <TextField select label="Show when" value={rules?.logic ?? "all"} onChange={(e) => onChange({ visibility_rules: { logic: e.target.value as "all" | "any", conditions } })}>
          <MenuItem value="all">All conditions are met</MenuItem>
          <MenuItem value="any">Any condition is met</MenuItem>
        </TextField>
      )}
      {conditions.map((c, i) => {
        const ref = all.find((f) => f.field_key === c.field_key);
        return (
          <Box key={i} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5, position: "relative" }}>
            <Tooltip title="Remove condition">
              <IconButton size="small" sx={{ position: "absolute", right: 4, top: 4 }} onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))} aria-label="Remove condition">
                <CloseIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Stack spacing={1.25} sx={{ pr: 3 }}>
              <TextField select label="Field" value={c.field_key} onChange={(e) => updateCondition(i, { field_key: e.target.value, value: "" })}>
                {!ref && <MenuItem value={c.field_key}>{c.field_key} (missing)</MenuItem>}
                {candidates.map((f) => <MenuItem key={f.uid} value={f.field_key}>{f.label || f.field_key}</MenuItem>)}
              </TextField>
              <TextField select label="Condition" value={c.operator} onChange={(e) => updateCondition(i, { operator: e.target.value as Operator, value: e.target.value === "in" || e.target.value === "not_in" ? [] : "" })}>
                {OPERATORS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
              <ConditionValue condition={c} refField={ref} onChange={(value) => updateCondition(i, { value })} />
            </Stack>
          </Box>
        );
      })}
      <Button size="small" startIcon={<AddIcon />} onClick={() => setConditions([...conditions, { field_key: candidates[0]?.field_key ?? "", operator: "equals", value: "" }])} disabled={!candidates.length}>
        Add condition
      </Button>
      {field.is_required && (
        <Alert severity="info" sx={{ py: 0 }}>While hidden, this field is not required.</Alert>
      )}
    </Stack>
  );
}

export function FieldProperties({ field, all, onChange }: Props) {
  const meta = fieldMeta(field.field_type);
  const setConfig = (config: FieldConfig) => onChange({ config });
  const c = field.config;

  const changeType = (type: FieldType) => {
    const next = fieldMeta(type);
    onChange({
      field_type: type,
      config: { ...next.defaultConfig },
      options: next.hasOptions ? (field.options.length ? field.options : [{ label: "Option 1", value: "option_1" }, { label: "Option 2", value: "option_2" }]) : [],
    });
  };

  return (
    <Stack spacing={3} divider={<Divider flexItem />}>
      <Section title="Field">
        <TextField select label="Type" value={field.field_type} onChange={(e) => changeType(e.target.value as FieldType)}>
          {FIELD_TYPES.map((t) => <MenuItem key={t.type} value={t.type}>{t.label}</MenuItem>)}
        </TextField>
        <TextField label="Label" value={field.label} onChange={(e) => onChange({ label: e.target.value })} autoFocus required />
        <TextField
          label="Field key"
          value={field.field_key}
          onChange={(e) => onChange({ field_key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_"), keyEdited: true })}
          helperText={field.id ? "Used in exports and conditions. Changing it disconnects answers already saved under the old key." : "Used in exports and conditions. Filled in from the label."}
        />
        {["text", "number", "email", "dropdown"].includes(field.field_type) && (
          <TextField label="Placeholder" value={field.placeholder} onChange={(e) => onChange({ placeholder: e.target.value })} />
        )}
        <TextField label="Help text" value={field.help_text} onChange={(e) => onChange({ help_text: e.target.value })} multiline minRows={2} helperText="Shown under the field." />
        <FormControlLabel control={<Switch checked={field.is_required} onChange={(e) => onChange({ is_required: e.target.checked })} />} label={field.field_type === "checkbox" && !field.options.length ? "Must be checked" : "Required"} />
      </Section>

      {meta.hasOptions && (
        <Section title="Options">
          {field.field_type === "checkbox" && (
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              Remove every option to turn this into a single checkbox, like "I agree to the terms".
            </Typography>
          )}
          <OptionsEditor options={field.options} onChange={(options) => onChange({ options })} allowEmpty={field.field_type === "checkbox"} autoValue={!field.id} />
          {field.field_type === "checkbox" && field.options.length > 0 && (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              <NumberSetting label="Min. selected" name="min_selected" config={c} onChange={setConfig} step={1} />
              <NumberSetting label="Max. selected" name="max_selected" config={c} onChange={setConfig} step={1} />
            </Box>
          )}
        </Section>
      )}

      {field.field_type === "text" && (
        <Section title="Validation">
          <FormControlLabel control={<Switch checked={c.multiline === true} onChange={(e) => setConfig({ ...c, multiline: e.target.checked || undefined })} />} label="Long answer (several lines)" />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <NumberSetting label="Min. length" name="min_length" config={c} onChange={setConfig} step={1} />
            <NumberSetting label="Max. length" name="max_length" config={c} onChange={setConfig} step={1} />
          </Box>
          <TextSetting label="Pattern (regular expression)" name="pattern" config={c} onChange={setConfig} helper="Example for a 10-digit phone number: [0-9]{10}" />
          {Boolean(c.pattern) && <TextSetting label="Message when the pattern doesn't match" name="pattern_message" config={c} onChange={setConfig} />}
        </Section>
      )}

      {field.field_type === "number" && (
        <Section title="Validation">
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <NumberSetting label="Minimum" name="min" config={c} onChange={setConfig} />
            <NumberSetting label="Maximum" name="max" config={c} onChange={setConfig} />
          </Box>
          <FormControlLabel control={<Switch checked={c.integer_only === true} onChange={(e) => setConfig({ ...c, integer_only: e.target.checked || undefined })} />} label="Whole numbers only" />
        </Section>
      )}

      {field.field_type === "date" && (
        <Section title="Validation">
          <TextSetting label="Earliest date" name="min_date" type="date" config={c} onChange={setConfig} />
          <TextSetting label="Latest date" name="max_date" type="date" config={c} onChange={setConfig} />
        </Section>
      )}

      {field.field_type === "rating" && (
        <Section title="Scale">
          <Box sx={{ px: 1 }}>
            <Typography sx={{ fontSize: 14, mb: 0.5 }}>Number of stars: {Number(c.max_rating ?? 5)}</Typography>
            <Slider value={Number(c.max_rating ?? 5)} min={3} max={10} step={1} marks onChange={(_, v) => setConfig({ ...c, max_rating: v as number })} aria-label="Number of stars" />
          </Box>
        </Section>
      )}

      {field.field_type === "file" && (
        <Section title="Files">
          <TextField
            label="Allowed file types"
            value={Array.isArray(c.allowed_extensions) ? (c.allowed_extensions as string[]).join(", ") : ""}
            helperText="Comma separated, e.g. pdf, docx, png"
            onChange={(e) => setConfig({ ...c, allowed_extensions: e.target.value.split(",").map((s) => s.trim().replace(/^\./, "").toLowerCase()).filter(Boolean) })}
          />
          <NumberSetting label="Max. size (MB)" name="max_size_mb" config={c} onChange={setConfig} helper="The server limit is 10 MB." />
        </Section>
      )}

      <Section title="Visibility">
        <VisibilityEditor field={field} all={all} onChange={onChange} />
      </Section>
    </Stack>
  );
}
