import { useDraggable } from "@dnd-kit/core";
import { Box, Typography } from "@mui/material";
import { FIELD_TYPES, type FieldTypeMeta } from "../../lib/fieldTypes";
import { tokens } from "../../theme";
import type { FieldType } from "../../types";

export function PaletteTile({ meta, dragging = false }: { meta: FieldTypeMeta; dragging?: boolean }) {
  const Icon = meta.icon;
  return (
    <Box
      sx={{
        display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.1, borderRadius: 1.5,
        border: `1px solid ${dragging ? tokens.ledger : tokens.rule}`, bgcolor: tokens.sheet,
        boxShadow: dragging ? "0 8px 24px rgba(29,43,58,0.18)" : "none", cursor: dragging ? "grabbing" : "grab",
      }}
    >
      <Icon sx={{ fontSize: 20, color: tokens.ledger }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{meta.label}</Typography>
        <Typography noWrap sx={{ fontSize: 12, color: "text.secondary" }}>{meta.hint}</Typography>
      </Box>
    </Box>
  );
}

function DraggableTile({ meta, onAdd }: { meta: FieldTypeMeta; onAdd: (type: FieldType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${meta.type}`, data: { fromPalette: true, type: meta.type } });
  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAdd(meta.type)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onAdd(meta.type);
      }}
      role="button"
      aria-label={`Add ${meta.label} field`}
      sx={{ opacity: isDragging ? 0.4 : 1, borderRadius: 1.5, "&:hover > div": { borderColor: tokens.ledger } }}
    >
      <PaletteTile meta={meta} />
    </Box>
  );
}

export function FieldPalette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <Box>
      <Typography variant="h6" component="h2">Add a field</Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>Drag onto the form, or click to add below the selected field.</Typography>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", lg: "1fr" } }}>
        {FIELD_TYPES.map((meta) => (
          <DraggableTile key={meta.type} meta={meta} onAdd={onAdd} />
        ))}
      </Box>
    </Box>
  );
}
