import { Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <Box sx={{ py: 10, textAlign: "center" }}>
      <Typography variant="h1">Page not found</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>The address may be mistyped, or the page was moved.</Typography>
      <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 3 }}>Go to dashboard</Button>
    </Box>
  );
}
