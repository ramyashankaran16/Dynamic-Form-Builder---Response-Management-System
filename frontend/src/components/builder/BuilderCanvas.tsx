import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Box, IconButton, InputBase, Rating, Tooltip, Typography } from "@mui/material";
import { fieldMeta } from "../../lib/fieldTypes";
import { OPERATORS } from "../../lib/visibility";
import { tokens } from "../../theme";
import type { BuilderField } from "./builderState";

interface CanvasProps {
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  fields: BuilderField[];
  selectedUid: string | null;
  onSelect: (uid: string | null) => void;
  onDuplicate: (uid: string) => void;
  onDelete: (uid: string) => void;
  paletteDragging: boolean;
}

function conditionSummary(field: BuilderField, all: BuilderField[]): string | null {
  const rules = field.visibility_rules;
  if (!rules?.conditions.length) return null;
  const parts = rules.conditions.map((c) => {
    const ref = all.find((f) => f.field_key === c.field_key);
    const op = OPERATORS.find((o) => o.value === c.operator);
    const optionLabel = (v: unknown) => ref?.options.find((o) => o.value === String(v))?.label ?? String(v ?? "");
    const value = Array.isArray(c.value) ? c.value.map(optionLabel).join(", ") : c.value === true ? "Checked" : c.value === false ? "Not checked" : optionLabel(c.value);
    return `${ref?.label ?? c.field_key} ${op?.label ?? c.operator}${op?.needsValue ? ` "${value ?? ""}"` : ""}`;
  });
  return `Shown when ${parts.join(rules.logic === "any" ? " or " : " and ")}`;
}

/** Static look-alike of the input so the sheet reads like the real form. */
function FakeInput({ field }: { field: BuilderField }) {
  const line = { height: 36, border: `1px solid ${tokens.rule}`, borderRadius: 1, bgcolor: "#FBFCFD", px: 1.25, display: "flex", alignItems: "center", color: "text.disabled", fontSize: 14 };
  switch (field.field_type) {
    case "radio":
    case "checkbox":
      if (field.field_type === "checkbox" && field.options.length === 0)
        return <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", fontSize: 14 }}><Box sx={{ width: 16, height: 16, border: `2px solid ${tokens.inkSoft}`, borderRadius: 0.5 }} />Single checkbox</Box>;
      return (
        <Box sx={{ display: "grid", gap: 0.5 }}>
          {field.options.slice(0, 4).map((o, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 14, color: "text.secondary" }}>
              <Box sx={{ width: 15, height: 15, border: `2px solid ${tokens.inkSoft}`, borderRadius: field.field_type === "radio" ? "50%" : 0.5 }} />
              {o.label || "Untitled option"}
            </Box>
          ))}
          {field.options.length > 4 && <Typography sx={{ fontSize: 13, color: "text.secondary" }}>+{field.options.length - 4} more</Typography>}
        </Box>
      );
    case "rating":
      return <Rating readOnly value={0} max={Number(field.config.max_rating ?? 5)} />;
    case "file":
      return <Box sx={{ ...line, width: 160, justifyContent: "center", color: tokens.ledger, fontWeight: 600, borderStyle: "dashed" }}>Choose file</Box>;
    case "dropdown":
      return <Box sx={{ ...line, maxWidth: 360, justifyContent: "space-between" }}>{field.placeholder || "Select an option"}<span>▾</span></Box>;
    case "date":
      return <Box sx={{ ...line, maxWidth: 220 }}>dd / mm / yyyy</Box>;
    default:
      return <Box sx={{ ...line, height: field.config.multiline ? 72 : 36, alignItems: field.config.multiline ? "flex-start" : "center", pt: field.config.multiline ? 1 : 0 }}>{field.placeholder || " "}</Box>;
  }
}

function SortableFieldCard({ field, all, selected, onSelect, onDuplicate, onDelete }: {
  field: BuilderField; all: BuilderField[]; selected: boolean;
  onSelect: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.uid });
  const meta = fieldMeta(field.field_type);
  const Icon = meta.icon;
  const condition = conditionSummary(field, all);

  return (
    <Box
      ref={setNodeRef}
      onClick={(e) => {
        e.stopPropagation(); // the sheet's own click clears the selection
        onSelect();
      }}
      sx={{
        position: "relative",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        borderRadius: 1.5,
        px: 2, py: 1.75, pl: 5,
        cursor: "pointer",
        border: `1px solid ${selected ? tokens.highlighter : "transparent"}`,
        bgcolor: selected ? tokens.highlighterSoft : "transparent",
        "&:hover": { bgcolor: selected ? tokens.highlighterSoft : "#F7F9FB" },
        "&:hover .field-actions, &:focus-within .field-actions": { opacity: 1 },
      }}
    >
      <Tooltip title="Drag to reorder" placement="left">
        <IconButton
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          size="small"
          aria-label={`Reorder ${field.label}`}
          onClick={(e) => e.stopPropagation()}
          sx={{ position: "absolute", left: 6, top: 14, cursor: "grab", color: "text.secondary", touchAction: "none" }}
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1, pr: 9 }}>
        <Typography sx={{ fontWeight: 650, fontSize: 15.5 }}>
          <Box component="span" sx={selected ? { background: `linear-gradient(transparent 55%, ${tokens.highlighter} 55%)` } : undefined}>
            {field.label || "Untitled field"}
          </Box>
          {field.is_required && <Box component="span" sx={{ color: "error.main", ml: 0.5 }}>*</Box>}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary", fontSize: 12.5, whiteSpace: "nowrap" }}>
          <Icon sx={{ fontSize: 15 }} />
          {meta.label}
        </Box>
      </Box>

      <FakeInput field={field} />
      {field.help_text && <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.75 }}>{field.help_text}</Typography>}
      {condition && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1, fontSize: 13, color: tokens.ledgerDark, fontWeight: 500 }}>
          <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
          {condition}
        </Box>
      )}

      <Box className="field-actions" sx={{ position: "absolute", right: 8, top: 8, display: "flex", gap: 0.25, opacity: selected ? 1 : 0, transition: "opacity .15s" }}>
        <Tooltip title="Duplicate">
          <IconButton size="small" aria-label="Duplicate field" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" aria-label="Delete field" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export function BuilderCanvas(props: CanvasProps) {
  const { fields, selectedUid, onSelect, paletteDragging } = props;
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  return (
    <Box
      onClick={() => onSelect(null)}
      sx={{
        position: "relative",
        bgcolor: tokens.sheet,
        border: `1px solid ${tokens.rule}`,
        borderRadius: 1,
        boxShadow: "0 1px 0 #E6EAEF, 0 12px 32px -18px rgba(29,43,58,0.25)",
        maxWidth: 760,
        mx: "auto",
        minHeight: 520,
        px: { xs: 2, sm: 4 },
        pl: { xs: 3, sm: 7 },
        py: { xs: 3, sm: 5 },
        // the margin rule of a ruled sheet - the builder's signature detail
        "&::before": { content: '""', position: "absolute", top: 0, bottom: 0, left: { xs: 14, sm: 40 }, width: "1px", bgcolor: tokens.marginRule },
      }}
    >
      <InputBase
        value={props.title}
        onChange={(e) => props.onTitle(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="Untitled form"
        fullWidth
        inputProps={{ "aria-label": "Form title", maxLength: 255 }}
        sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800, letterSpacing: "-0.02em", mb: 0.5 }}
      />
      <InputBase
        value={props.description}
        onChange={(e) => props.onDescription(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="Add a short description that tells people what this form is for"
        fullWidth
        multiline
        inputProps={{ "aria-label": "Form description" }}
        sx={{ color: "text.secondary", fontSize: 15.5, mb: 3 }}
      />

      <SortableContext items={fields.map((f) => f.uid)} strategy={verticalListSortingStrategy}>
        <Box ref={setNodeRef} sx={{ display: "grid", gap: 0.75, minHeight: 160 }}>
          {fields.map((f) => (
            <SortableFieldCard
              key={f.uid}
              field={f}
              all={fields}
              selected={f.uid === selectedUid}
              onSelect={() => onSelect(f.uid)}
              onDuplicate={() => props.onDuplicate(f.uid)}
              onDelete={() => props.onDelete(f.uid)}
            />
          ))}
          <Box
            sx={{
              border: `2px dashed ${isOver || paletteDragging ? tokens.ledger : tokens.rule}`,
              bgcolor: isOver ? "rgba(15,110,102,0.06)" : "transparent",
              borderRadius: 1.5,
              py: fields.length ? 2 : 6,
              textAlign: "center",
              color: "text.secondary",
              fontSize: 14,
            }}
          >
            {fields.length ? "Drop a field here to add it at the end" : "This form has no fields yet. Drag a field from the left, or click one to add it."}
          </Box>
        </Box>
      </SortableContext>
    </Box>
  );
}
