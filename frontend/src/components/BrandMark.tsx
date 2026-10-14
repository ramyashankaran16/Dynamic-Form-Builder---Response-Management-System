import { Box, Typography } from "@mui/material";
import { tokens } from "../theme";

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box component="svg" viewBox="0 0 32 32" sx={{ width: 28, height: 28, flexShrink: 0 }} aria-hidden>
        <rect x="5" y="3" width="22" height="26" rx="3" fill={tokens.ledger} />
        <rect x="9" y="9" width="14" height="2.5" rx="1" fill={tokens.highlighter} />
        <rect x="9" y="15" width="10" height="2" rx="1" fill="#fff" />
        <rect x="9" y="20" width="12" height="2" rx="1" fill="#fff" />
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: light ? "#fff" : tokens.ink }}>
        Form Builder
      </Typography>
    </Box>
  );
}
