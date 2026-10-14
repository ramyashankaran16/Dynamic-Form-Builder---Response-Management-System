import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <Box sx={{ textAlign: "center", py: 7, px: 2 }}>
      <Typography variant="h4" component="p">{title}</Typography>
      {message && <Typography color="text.secondary" sx={{ mt: 1, mx: "auto", maxWidth: "52ch" }}>{message}</Typography>}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Box>
  );
}
