import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip,
} from "chart.js";
import { tokens } from "../theme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);
ChartJS.defaults.font.family = '"Public Sans", "Segoe UI", system-ui, sans-serif';
ChartJS.defaults.color = tokens.inkSoft;
ChartJS.defaults.plugins.legend.display = false;

/** Categorical series: ledger green first, then distinguishable companions. */
export const SERIES = ["#0F6E66", "#2F6FB3", "#C9822B", "#7A4FA3", "#B5475B", "#3E8E58", "#6B7A8C", "#D4A72C", "#2C9BA6", "#8C5A3C"];

export const gridColor = "#EEF1F4";

export function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
