import { Box, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";
import { tokens } from "../theme";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2, py: 6, bgcolor: tokens.paper }}>
      <Box sx={{ width: "100%", maxWidth: 420 }}>
        <Box sx={{ mb: 3 }}><BrandMark /></Box>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, position: "relative", overflow: "hidden", "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: tokens.ledger } }}>
          <Typography variant="h2" component="h1">{title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>{subtitle}</Typography>
          {children}
        </Paper>
        <Box sx={{ mt: 2.5, textAlign: "center", color: "text.secondary", fontSize: 14.5 }}>{footer}</Box>
      </Box>
    </Box>
  );
}
