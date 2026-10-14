import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
}

export function PageHeader({ title, subtitle, actions, backTo }: Props) {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, gap: 2, mb: 3, flexWrap: "wrap" }}>
      {backTo && (
        <Tooltip title="Back">
          <IconButton onClick={() => navigate(backTo)} aria-label="Back" sx={{ border: 1, borderColor: "divider" }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography variant="h2" component="h1">{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: "75ch" }}>{subtitle}</Typography>}
      </Box>
      {actions && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
    </Box>
  );
}
