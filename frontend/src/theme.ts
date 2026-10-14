import { createTheme } from "@mui/material/styles";

/** Form Builder palette: ledger green on cool paper, ink-slate chrome, one highlighter accent. */
export const tokens = {
  ink: "#1D2B3A",
  inkSoft: "#4A5869",
  paper: "#F5F7F9",
  sheet: "#FFFFFF",
  rule: "#DFE4EA",
  ledger: "#0F6E66",
  ledgerDark: "#0A524C",
  highlighter: "#F2C94C",
  highlighterSoft: "#FDF3D0",
  marginRule: "#E8A3A3",
  danger: "#B93A2B",
  success: "#2E7D4F",
};

const fontFamily = '"Public Sans", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: tokens.ledger, dark: tokens.ledgerDark, contrastText: "#fff" },
    secondary: { main: tokens.ink },
    warning: { main: "#B7791F" },
    error: { main: tokens.danger },
    success: { main: tokens.success },
    background: { default: tokens.paper, paper: tokens.sheet },
    text: { primary: tokens.ink, secondary: tokens.inkSoft },
    divider: tokens.rule,
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily,
    h1: { fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 },
    h2: { fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.015em", lineHeight: 1.2 },
    h3: { fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h4: { fontSize: "1.1rem", fontWeight: 700 },
    h5: { fontSize: "1rem", fontWeight: 700 },
    h6: { fontSize: "0.95rem", fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    body1: { lineHeight: 1.55 },
    body2: { lineHeight: 1.5 },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
    overline: { textTransform: "none", letterSpacing: 0, fontWeight: 600, fontSize: "0.8rem" },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { outlined: { borderColor: tokens.rule }, rounded: { borderRadius: 10 } },
    },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, color: tokens.inkSoft, background: "#F9FAFB", whiteSpace: "nowrap" },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiCssBaseline: {
      styleOverrides: {
        "*:focus-visible": { outline: `3px solid ${tokens.highlighter}`, outlineOffset: 2 },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": { animationDuration: "0.01ms !important", transitionDuration: "0.01ms !important" },
        },
      },
    },
  },
});
