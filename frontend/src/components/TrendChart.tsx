import { Box } from "@mui/material";
import { Line } from "react-chartjs-2";
import { gridColor, shortDate } from "../lib/charts";
import { tokens } from "../theme";
import type { TrendPoint } from "../types";

export function TrendChart({ points, height = 260 }: { points: TrendPoint[]; height?: number }) {
  return (
    <Box sx={{ height }}>
      <Line
        data={{
          labels: points.map((p) => shortDate(p.date)),
          datasets: [{
            label: "Responses",
            data: points.map((p) => p.count),
            borderColor: tokens.ledger,
            backgroundColor: "rgba(15,110,102,0.08)",
            fill: true,
            tension: 0.3,
            cubicInterpolationMode: "monotone",
            pointRadius: points.length > 45 ? 0 : 2.5,
            pointHoverRadius: 5,
            borderWidth: 2,
          }],
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { precision: 0 } },
          },
        }}
      />
    </Box>
  );
}
