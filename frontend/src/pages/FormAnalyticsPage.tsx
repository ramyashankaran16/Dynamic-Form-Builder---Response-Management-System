import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import { Alert, Box, Button, LinearProgress, MenuItem, Paper, Skeleton, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { useNavigate, useParams } from "react-router-dom";
import { analyticsApi } from "../api/endpoints";
import { PageHeader } from "../components/PageHeader";
import { Stat, StatStrip } from "../components/Stat";
import { TrendChart } from "../components/TrendChart";
import { SERIES, gridColor } from "../lib/charts";
import { errorMessage } from "../lib/errors";
import { fieldMeta } from "../lib/fieldTypes";
import { formatDate, formatDateTime } from "../lib/format";
import { tokens } from "../theme";
import type { FieldAnalytics, FormAnalytics } from "../types";

function FieldCard({ f }: { f: FieldAnalytics }) {
  const Icon = fieldMeta(f.field_type).icon;
  const counts = f.option_counts ?? [];
  const total = counts.reduce((s, c) => s + c.count, 0);
  const pie = (f.field_type === "radio" || f.field_type === "dropdown" || (f.field_type === "checkbox" && counts[0]?.value === "true")) && counts.length <= 6;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Icon sx={{ fontSize: 20, color: tokens.ledger, mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h3">{f.label}</Typography>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
            Answered by {f.answered_count} ({f.response_rate}%)
          </Typography>
        </Box>
      </Box>
      <LinearProgress variant="determinate" value={f.response_rate} sx={{ mt: 1.5, height: 6, borderRadius: 3, bgcolor: "#EEF1F4" }} aria-label="Response rate" />

      <Box sx={{ mt: 2, flex: 1 }}>
        {counts.length > 0 && total > 0 && (pie ? (
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <Box sx={{ width: 150, height: 150 }}>
              <Doughnut
                data={{ labels: counts.map((c) => c.label), datasets: [{ data: counts.map((c) => c.count), backgroundColor: SERIES, borderWidth: 2, borderColor: "#fff" }] }}
                options={{ cutout: "62%", maintainAspectRatio: false }}
              />
            </Box>
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, flex: 1, minWidth: 150 }}>
              {counts.map((c, i) => (
                <Box component="li" key={c.value} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.4, fontSize: 14 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: SERIES[i % SERIES.length], flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>{c.label}</Box>
                  <Box sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{c.count}</Box>
                  <Box sx={{ color: "text.secondary", width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.percentage}%</Box>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ height: Math.max(120, counts.length * 34) }}>
            <Bar
              data={{ labels: counts.map((c) => c.label), datasets: [{ data: counts.map((c) => c.count), backgroundColor: f.field_type === "rating" ? tokens.highlighter : tokens.ledger, borderRadius: 3, barThickness: 18 }] }}
              options={{
                indexAxis: "y",
                maintainAspectRatio: false,
                plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x} (${counts[ctx.dataIndex].percentage}%)` } } },
                scales: { x: { beginAtZero: true, grid: { color: gridColor }, ticks: { precision: 0 } }, y: { grid: { display: false } } },
              }}
            />
          </Box>
        ))}
        {counts.length > 0 && total === 0 && <Typography color="text.secondary">No answers yet.</Typography>}

        {(f.field_type === "number" || f.field_type === "rating") && f.average !== null && (
          <Box sx={{ display: "flex", gap: 3, mt: counts.length ? 1.5 : 0 }}>
            <Box><Typography sx={{ fontSize: 13, color: "text.secondary" }}>Average</Typography><Typography sx={{ fontSize: 22, fontWeight: 800 }}>{f.average}</Typography></Box>
            <Box><Typography sx={{ fontSize: 13, color: "text.secondary" }}>Lowest</Typography><Typography sx={{ fontSize: 22, fontWeight: 800 }}>{f.minimum}</Typography></Box>
            <Box><Typography sx={{ fontSize: 13, color: "text.secondary" }}>Highest</Typography><Typography sx={{ fontSize: 22, fontWeight: 800 }}>{f.maximum}</Typography></Box>
          </Box>
        )}
        {f.field_type === "date" && f.earliest && (
          <Typography sx={{ fontSize: 14.5 }}>Answers range from <strong>{formatDate(f.earliest)}</strong> to <strong>{formatDate(f.latest)}</strong>.</Typography>
        )}
        {["text", "email", "file"].includes(f.field_type) && (
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Open the responses table to read individual answers.</Typography>
        )}
      </Box>
    </Paper>
  );
}

export default function FormAnalyticsPage() {
  const formId = Number(useParams().id);
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FormAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsApi.form(formId, days).then(setData).catch((e) => setError(errorMessage(e)));
  }, [formId, days]);

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <PageHeader
        backTo="/forms"
        title={data?.title ?? "Analytics"}
        subtitle={data ? (data.last_response_at ? `Last response ${formatDateTime(data.last_response_at)}` : "No responses yet") : " "}
        actions={<Button startIcon={<TableRowsOutlinedIcon />} color="inherit" onClick={() => navigate(`/forms/${formId}/responses`)}>View responses</Button>}
      />
      {!data ? <Skeleton variant="rounded" height={96} /> : (
        <StatStrip>
          <Stat label="Responses" value={data.total_responses} note={`${data.responses_last_7_days} in the last 7 days`} />
          <Stat label="Logged-in" value={data.authenticated_responses} note={`${data.anonymous_responses} anonymous`} />
          <Stat label="Edited" value={data.edited_responses} note="changed after submitting" />
          <Stat label="Per day" value={data.average_per_day} note={`average, last ${days} days`} />
        </StatStrip>
      )}

      <Paper variant="outlined" sx={{ p: 2.5, mt: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2 }}>
          <Typography variant="h4" component="h2">Responses per day</Typography>
          <TextField select value={days} onChange={(e) => setDays(Number(e.target.value))} sx={{ width: 150 }} slotProps={{ htmlInput: { "aria-label": "Time range" } }}>
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
          </TextField>
        </Box>
        {data ? <TrendChart points={data.submissions_trend} height={240} /> : <Skeleton variant="rounded" height={240} />}
      </Paper>

      <Typography variant="h3" component="h2" sx={{ mt: 4, mb: 2 }}>Answers by question</Typography>
      {data && data.fields.length === 0 && <Typography color="text.secondary">This form has no fields.</Typography>}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {data?.fields.map((f) => <FieldCard key={f.field_id} f={f} />)}
      </Box>
    </Box>
  );
}
