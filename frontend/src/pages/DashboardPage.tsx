import AddIcon from "@mui/icons-material/Add";
import { Alert, Box, Button, Link, MenuItem, Paper, Skeleton, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { analyticsApi } from "../api/endpoints";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { Stat, StatStrip } from "../components/Stat";
import { TrendChart } from "../components/TrendChart";
import { useAuth } from "../context/AuthContext";
import { gridColor } from "../lib/charts";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { tokens } from "../theme";
import type { DashboardStats } from "../types";

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsApi.dashboard(days).then(setStats).catch((e) => setError(errorMessage(e)));
  }, [days]);

  const firstName = user?.full_name.split(" ")[0];

  return (
    <Box>
      <PageHeader
        title={`Hello, ${firstName}`}
        subtitle={isAdmin ? "Activity across every form on the platform." : "How your forms are doing."}
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/forms/new")}>New form</Button>}
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!stats ? (
        <Skeleton variant="rounded" height={96} />
      ) : (
        <StatStrip>
          <Stat label="Forms" value={stats.total_forms} note={`${stats.active_forms} open, ${stats.inactive_forms} closed`} />
          <Stat label="Responses" value={stats.total_responses.toLocaleString()} note={`${stats.responses_last_30_days} in the last 30 days`} />
          <Stat label="Today" value={stats.responses_today} note="responses" />
          <Stat label="Last 7 days" value={stats.responses_last_7_days} note="responses" />
          {isAdmin && stats.total_users !== null && <Stat label="Users" value={stats.total_users} note={`${stats.active_users} active`} />}
        </StatStrip>
      )}

      {stats && stats.total_forms === 0 ? (
        <Paper variant="outlined" sx={{ mt: 3 }}>
          <EmptyState
            title="Create your first form"
            message="Add fields with drag and drop, share the link, and responses will show up here."
            action={<Button variant="contained" onClick={() => navigate("/forms/new")}>New form</Button>}
          />
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gap: 3, mt: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2fr) minmax(0, 1fr)" } }}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 2 }}>
              <Typography variant="h4" component="h2">Responses per day</Typography>
              <TextField select value={days} onChange={(e) => { setStats(null); setDays(Number(e.target.value)); }} sx={{ width: 150 }} slotProps={{ htmlInput: { "aria-label": "Time range" } }}>
                <MenuItem value={7}>Last 7 days</MenuItem>
                <MenuItem value={30}>Last 30 days</MenuItem>
                <MenuItem value={90}>Last 90 days</MenuItem>
              </TextField>
            </Box>
            {stats ? <TrendChart points={stats.submissions_trend} /> : <Skeleton variant="rounded" height={260} />}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 2 }}>Recent responses</Typography>
            {!stats ? <Skeleton variant="rounded" height={200} /> : stats.recent_responses.length === 0 ? (
              <Typography color="text.secondary">No responses yet. Share a form link to start collecting.</Typography>
            ) : (
              <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
                {stats.recent_responses.map((r) => (
                  <Box component="li" key={r.response_id} sx={{ py: 1.25, borderBottom: `1px solid ${tokens.rule}`, "&:last-of-type": { borderBottom: 0 } }}>
                    <Link component={RouterLink} to={`/forms/${r.form_id}/responses?open=${r.response_id}`} underline="hover" sx={{ fontWeight: 600, color: "text.primary" }}>
                      {r.form_title}
                    </Link>
                    <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                      {r.submitter_name ?? "Anonymous"}, {formatDateTime(r.created_at)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          {stats && stats.top_forms.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5, gridColumn: { lg: "1 / -1" } }}>
              <Typography variant="h4" component="h2" sx={{ mb: 2 }}>Most responses</Typography>
              <Box sx={{ height: Math.max(140, stats.top_forms.length * 46) }}>
                <Bar
                  data={{
                    labels: stats.top_forms.map((f) => f.title),
                    datasets: [{ data: stats.top_forms.map((f) => f.response_count), backgroundColor: tokens.ledger, borderRadius: 4, barThickness: 22 }],
                  }}
                  options={{
                    indexAxis: "y",
                    maintainAspectRatio: false,
                    onClick: (_, els) => { if (els[0]) navigate(`/forms/${stats.top_forms[els[0].index].form_id}/analytics`); },
                    scales: { x: { beginAtZero: true, grid: { color: gridColor }, ticks: { precision: 0 } }, y: { grid: { display: false } } },
                  }}
                />
              </Box>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}
