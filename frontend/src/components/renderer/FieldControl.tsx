import AttachFileIcon from "@mui/icons-material/AttachFile";
import {
  Box, Button, Checkbox, Chip, FormControl, FormControlLabel, FormGroup, FormHelperText, FormLabel, LinearProgress,
  MenuItem, Radio, RadioGroup, Rating, TextField, Typography,
} from "@mui/material";
import { useId, useRef, useState } from "react";
import { Controller, type Control, type FieldValues, type RegisterOptions } from "react-hook-form";
import { publicApi } from "../../api/endpoints";
import { errorMessage } from "../../lib/errors";
import { fileNameFromPath } from "../../lib/format";
import { tokens } from "../../theme";
import type { FormField } from "../../types";

interface Props {
  field: FormField;
  control: Control<FieldValues>;
  rules: RegisterOptions<FieldValues, string>;
  slug?: string;
  preview?: boolean;
}

function Label({ htmlFor, field, id }: { htmlFor?: string; field: FormField; id?: string }) {
  return (
    <FormLabel
      htmlFor={htmlFor}
      id={id}
      sx={{ display: "block", color: "text.primary", fontWeight: 600, fontSize: 15, mb: 0.75, "&.Mui-focused": { color: "text.primary" } }}
    >
      {field.label}
      {field.is_required && (
        <Box component="span" sx={{ color: "error.main", ml: 0.5 }} aria-hidden>*</Box>
      )}
    </FormLabel>
  );
}

function Help({ text, error }: { text?: string | null; error?: string }) {
  if (error) return <FormHelperText error sx={{ mx: 0, mt: 0.75 }}>{error}</FormHelperText>;
  if (text) return <FormHelperText sx={{ mx: 0, mt: 0.75 }}>{text}</FormHelperText>;
  return null;
}

function FileInput({ slug, field, value, onChange, preview }: {
  slug?: string; field: FormField; value: string; onChange: (v: string) => void; preview?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cfg = (field.config ?? {}) as { allowed_extensions?: string[]; max_size_mb?: number };
  const accept = cfg.allowed_extensions?.map((e) => `.${e}`).join(",");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (cfg.max_size_mb && file.size > cfg.max_size_mb * 1024 * 1024) {
      setUploadError(`File is larger than ${cfg.max_size_mb} MB.`);
      return;
    }
    if (!slug || preview) {
      setUploadError("Uploads work on the published form, not in preview.");
      return;
    }
    setBusy(true);
    try {
      const res = await publicApi.upload(slug, field.field_key, file);
      onChange(res.file_path);
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Box>
      <input ref={inputRef} type="file" hidden accept={accept} onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <Chip icon={<AttachFileIcon />} label={fileNameFromPath(value)} onDelete={() => onChange("")} variant="outlined" sx={{ maxWidth: "100%" }} />
      ) : (
        <Button variant="outlined" startIcon={<AttachFileIcon />} onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "Uploading…" : "Choose file"}
        </Button>
      )}
      {busy && <LinearProgress sx={{ mt: 1, maxWidth: 260 }} />}
      <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.75 }}>
        {cfg.allowed_extensions?.length ? `Accepted: ${cfg.allowed_extensions.join(", ")}` : "Any common document or image"}
        {cfg.max_size_mb ? `, up to ${cfg.max_size_mb} MB` : ""}
      </Typography>
      {uploadError && <FormHelperText error sx={{ mx: 0 }}>{uploadError}</FormHelperText>}
    </Box>
  );
}

export function FieldControl({ field, control, rules, slug, preview }: Props) {
  const uid = useId();
  const inputId = `f-${uid}`;
  const labelId = `l-${uid}`;
  const cfg = (field.config ?? {}) as Record<string, unknown>;

  return (
    <Controller
      name={field.field_key}
      control={control}
      rules={rules}
      render={({ field: rhf, fieldState }) => {
        const error = fieldState.error?.message;
        const common = {
          id: inputId,
          value: rhf.value ?? "",
          onChange: rhf.onChange,
          onBlur: rhf.onBlur,
          inputRef: rhf.ref,
          error: !!error,
          placeholder: field.placeholder ?? undefined,
        };

        switch (field.field_type) {
          case "text":
          case "email":
          case "number":
          case "date": {
            const type = field.field_type === "text" ? "text" : field.field_type;
            const htmlInput: Record<string, unknown> = {};
            if (field.field_type === "number") {
              if (cfg.min != null) htmlInput.min = cfg.min;
              if (cfg.max != null) htmlInput.max = cfg.max;
              htmlInput.step = cfg.integer_only ? 1 : "any";
            }
            if (field.field_type === "date") {
              if (cfg.min_date) htmlInput.min = cfg.min_date;
              if (cfg.max_date) htmlInput.max = cfg.max_date;
            }
            if (field.field_type === "text" && cfg.max_length) htmlInput.maxLength = cfg.max_length;
            const multiline = field.field_type === "text" && cfg.multiline === true;
            return (
              <FormControl fullWidth error={!!error}>
                <Label htmlFor={inputId} field={field} />
                <TextField
                  {...common}
                  type={type}
                  multiline={multiline}
                  minRows={multiline ? 3 : undefined}
                  autoComplete={field.field_type === "email" ? "email" : undefined}
                  slotProps={{ htmlInput: { ...htmlInput, "aria-required": field.is_required } }}
                  sx={{ maxWidth: field.field_type === "date" || field.field_type === "number" ? 280 : undefined }}
                />
                <Help text={field.help_text} error={error} />
              </FormControl>
            );
          }

          case "dropdown":
            return (
              <FormControl fullWidth error={!!error}>
                <Label field={field} id={labelId} />
                <TextField {...common} select sx={{ maxWidth: 480 }} slotProps={{ select: { displayEmpty: true, labelId } }}>
                  <MenuItem value=""><Box component="span" sx={{ color: "text.secondary" }}>{field.placeholder || "Select an option"}</Box></MenuItem>
                  {field.options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
                <Help text={field.help_text} error={error} />
              </FormControl>
            );

          case "radio":
            return (
              <FormControl error={!!error} component="fieldset">
                <Label field={field} id={labelId} />
                <RadioGroup aria-labelledby={labelId} value={rhf.value ?? ""} onChange={(e) => rhf.onChange(e.target.value)} onBlur={rhf.onBlur}>
                  {field.options.map((o) => (
                    <FormControlLabel key={o.value} value={o.value} control={<Radio inputRef={rhf.ref} />} label={o.label} />
                  ))}
                </RadioGroup>
                <Help text={field.help_text} error={error} />
              </FormControl>
            );

          case "checkbox": {
            if (field.options.length === 0) {
              return (
                <FormControl error={!!error}>
                  <FormControlLabel
                    control={<Checkbox checked={rhf.value === true} onChange={(e) => rhf.onChange(e.target.checked)} onBlur={rhf.onBlur} inputRef={rhf.ref} />}
                    label={
                      <span>
                        {field.label}
                        {field.is_required && <Box component="span" sx={{ color: "error.main", ml: 0.5 }} aria-hidden>*</Box>}
                      </span>
                    }
                  />
                  <Help text={field.help_text} error={error} />
                </FormControl>
              );
            }
            const selected: string[] = Array.isArray(rhf.value) ? rhf.value : [];
            const toggle = (v: string) =>
              rhf.onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
            return (
              <FormControl error={!!error} component="fieldset">
                <Label field={field} id={labelId} />
                <FormGroup aria-labelledby={labelId}>
                  {field.options.map((o) => (
                    <FormControlLabel key={o.value} control={<Checkbox checked={selected.includes(o.value)} onChange={() => toggle(o.value)} onBlur={rhf.onBlur} />} label={o.label} />
                  ))}
                </FormGroup>
                <Help text={field.help_text} error={error} />
              </FormControl>
            );
          }

          case "rating": {
            const max = Number(cfg.max_rating ?? 5);
            return (
              <FormControl error={!!error}>
                <Label field={field} id={labelId} />
                <Rating
                  aria-labelledby={labelId}
                  max={max}
                  value={typeof rhf.value === "number" ? rhf.value : null}
                  onChange={(_, v) => rhf.onChange(v)}
                  onBlur={rhf.onBlur}
                  size="large"
                  sx={{ "& .MuiRating-iconFilled": { color: tokens.highlighter }, "& .MuiRating-iconHover": { color: "#E0B12E" } }}
                />
                <Help text={field.help_text} error={error} />
              </FormControl>
            );
          }

          case "file":
            return (
              <FormControl error={!!error}>
                <Label field={field} id={labelId} />
                <FileInput slug={slug} field={field} value={(rhf.value as string) ?? ""} onChange={rhf.onChange} preview={preview} />
                <Help text={field.help_text} error={error} />
              </FormControl>
            );

          default:
            return <Typography color="error">Unsupported field type: {field.field_type}</Typography>;
        }
      }}
    />
  );
}
