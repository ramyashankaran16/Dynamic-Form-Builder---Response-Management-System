import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { tokens } from "../theme";

/** A figure with its label. Used in a ruled strip, not as floating cards. */
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <Box sx={{ px: 2.5, py: 2, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13.5, color: "text.secondary", fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, mt: 0.25, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
      {note && <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>{note}</Typography>}
    </Box>
  );
}

export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(auto-fit, minmax(150px, 1fr))" },
        bgcolor: tokens.sheet,
        border: `1px solid ${tokens.rule}`,
        borderRadius: 2.5,
        "& > *": { borderRight: `1px solid ${tokens.rule}`, borderBottom: { xs: `1px solid ${tokens.rule}`, md: 0 } },
        "& > *:last-of-type": { borderRight: 0 },
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}
