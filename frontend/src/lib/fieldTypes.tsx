import type { SvgIconComponent } from "@mui/icons-material";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import ArrowDropDownCircleOutlinedIcon from "@mui/icons-material/ArrowDropDownCircleOutlined";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";
import NumbersIcon from "@mui/icons-material/Numbers";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import ShortTextIcon from "@mui/icons-material/ShortText";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import type { FieldConfig, FieldType } from "../types";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  hint: string;
  icon: SvgIconComponent;
  defaultLabel: string;
  hasOptions: boolean;
  defaultConfig: FieldConfig;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: "text", label: "Text", hint: "Short or long answers", icon: ShortTextIcon, defaultLabel: "Your answer", hasOptions: false, defaultConfig: {} },
  { type: "number", label: "Number", hint: "Quantities, ages, amounts", icon: NumbersIcon, defaultLabel: "Number", hasOptions: false, defaultConfig: {} },
  { type: "email", label: "Email", hint: "Validated email address", icon: AlternateEmailIcon, defaultLabel: "Email address", hasOptions: false, defaultConfig: {} },
  { type: "date", label: "Date", hint: "Calendar date", icon: CalendarTodayOutlinedIcon, defaultLabel: "Date", hasOptions: false, defaultConfig: {} },
  { type: "dropdown", label: "Dropdown", hint: "Pick one from a list", icon: ArrowDropDownCircleOutlinedIcon, defaultLabel: "Choose an option", hasOptions: true, defaultConfig: {} },
  { type: "radio", label: "Radio buttons", hint: "Pick one, all visible", icon: RadioButtonCheckedIcon, defaultLabel: "Pick one", hasOptions: true, defaultConfig: {} },
  { type: "checkbox", label: "Checkboxes", hint: "Pick several, or one agree box", icon: CheckBoxOutlinedIcon, defaultLabel: "Select all that apply", hasOptions: true, defaultConfig: {} },
  { type: "file", label: "File upload", hint: "Documents and images", icon: AttachFileIcon, defaultLabel: "Upload a file", hasOptions: false, defaultConfig: { allowed_extensions: ["pdf", "docx", "png", "jpg"], max_size_mb: 5 } },
  { type: "rating", label: "Rating", hint: "Stars from 1 to N", icon: StarOutlineIcon, defaultLabel: "How would you rate it?", hasOptions: false, defaultConfig: { max_rating: 5 } },
];

export const fieldMeta = (type: FieldType): FieldTypeMeta => FIELD_TYPES.find((f) => f.type === type) ?? FIELD_TYPES[0];

export function slugifyKey(label: string): string {
  let key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key || !/^[a-z]/.test(key)) key = `field_${key}`.replace(/_+$/, "");
  return key.slice(0, 90);
}

export function uniqueKey(base: string, taken: Set<string>): string {
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  return key;
}
