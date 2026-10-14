import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert, Box, Chip, Collapse, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from "@mui/material";
import { Fragment, useEffect, useState } from "react";
import { activityApi, usersApi } from "../api/endpoints";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { useDebounce } from "../lib/useDebounce";
import { tokens } from "../theme";
import type { ActivityLog, Page, User } from "../types";

const humanize = (action: string) => action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, " ");

function actionColor(action: string): "success" | "error" | "warning" | "info" | "default" {
  if (action.endsWith("DELETED")) return "error";
  if (action.endsWith("CREATED") || action.endsWith("SUBMITTED") || action.endsWith("ENABLED") || action === "USER_REGISTERED") return "success";
  if (action.endsWith("UPDATED") || action.endsWith("DISABLED") || action === "PASSWORD_CHANGED") return "warning";
  if (action.startsWith("EXPORT")) return "info";
  return "default";
}

function Changes({ log }: { log: ActivityLog }) {
  const keys = Array.from(new Set([...Object.keys(log.old_values ?? {}), ...Object.keys(log.new_values ?? {})]));
  const fmt = (v: unknown) => (v === undefined ? "-" : typeof v === "object" ? JSON.stringify(v, null, 2) : String(v));
  if (!keys.length) return <Typography sx={{ fontSize: 14, color: "text.secondary" }}>No recorded values.</Typography>;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(120px, auto) 1fr 1fr", fontSize: 13.5, border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
      {["Value", "Before", "After"].map((h) => <Box key={h} sx={{ p: 1, fontWeight: 700, bgcolor: "#F9FAFB", borderBottom: `1px solid ${tokens.rule}` }}>{h}</Box>)}
      {keys.map((k) => (
        <Fragment key={k}>
          <Box sx={{ p: 1, fontWeight: 600, borderBottom: `1px solid ${tokens.rule}` }}>{k}</Box>
          <Box component="pre" sx={{ m: 0, p: 1, fontFamily: "inherit", color: "text.secondary", borderBottom: `1px solid ${tokens.rule}` }}>{fmt(log.old_values?.[k])}</Box>
          <Box component="pre" sx={{ m: 0, p: 1, fontFamily: "inherit", borderBottom: `1px solid ${tokens.rule}` }}>{fmt(log.new_values?.[k])}</Box>
        </Fragment>
      ))}
    </Box>
  );
}

export default function ActivityLogsPage() {
  const { isAdmin } = useAuth();
  const [actions, setActions] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState({ action: "", entity_type: "", user_id: "", date_from: "", date_to: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [data, setData] = useState<Page<ActivityLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const debounced = useDebounce(search);

  useEffect(() => {
    activityApi.actions().then(setActions).catch(() => undefined);
    if (isAdmin) usersApi.list({ size: 100 }).then((p) => setUsers(p.items)).catch(() => undefined);
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    activityApi
      .list({ ...filters, search: debounced, page: page + 1, size })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [filters, debounced, page, size]);

  const set = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  return (
    <Box>
      <PageHeader title="Activity log" subtitle={isAdmin ? "Every change made on the platform, newest first." : "Actions you've taken, newest first."} />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: isAdmin ? "1.5fr 1fr 1fr 1fr 0.8fr 0.8fr" : "1.5fr 1fr 1fr 0.8fr 0.8fr" } }}>
          <TextField placeholder="Search descriptions" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { "aria-label": "Search activity" } }} />
          <TextField select label="Action" value={filters.action} onChange={(e) => set("action", e.target.value)}>
            <MenuItem value="">All actions</MenuItem>
            {actions.map((a) => <MenuItem key={a} value={a}>{humanize(a)}</MenuItem>)}
          </TextField>
          <TextField select label="About" value={filters.entity_type} onChange={(e) => set("entity_type", e.target.value)}>
            <MenuItem value="">Anything</MenuItem>
            <MenuItem value="form">Forms</MenuItem>
            <MenuItem value="form_response">Responses</MenuItem>
            <MenuItem value="user">Users</MenuItem>
          </TextField>
          {isAdmin && (
            <TextField select label="User" value={filters.user_id} onChange={(e) => set("user_id", e.target.value)}>
              <MenuItem value="">All users</MenuItem>
              {users.map((u) => <MenuItem key={u.id} value={String(u.id)}>{u.full_name}</MenuItem>)}
            </TextField>
          )}
          <TextField label="From" type="date" value={filters.date_from} onChange={(e) => set("date_from", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="To" type="date" value={filters.date_to} onChange={(e) => set("date_to", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        {loading && <LinearProgress />}
        {data && data.total === 0 ? <EmptyState title="No activity found" message="Try a wider date range or different filters." /> : (
          <TableContainer>
            <Table size="small" sx={{ "& td, & th": { py: 1.1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  {isAdmin && <TableCell>User</TableCell>}
                  <TableCell>Action</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>IP address</TableCell>
                  <TableCell padding="checkbox"><span className="sr-only">Details</span></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.map((log) => {
                  const open = expanded === log.id;
                  return (
                    <Fragment key={log.id}>
                      <TableRow hover sx={{ "& > td": { borderBottom: open ? 0 : undefined } }}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(log.created_at)}</TableCell>
                        {isAdmin && <TableCell>{log.user_name ?? <Box component="span" sx={{ color: "text.secondary" }}>Anonymous</Box>}</TableCell>}
                        <TableCell><Chip size="small" variant="outlined" color={actionColor(log.action)} label={humanize(log.action)} /></TableCell>
                        <TableCell sx={{ maxWidth: 480 }}>{log.description}</TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{log.ip_address ?? "-"}</TableCell>
                        <TableCell padding="checkbox">
                          {(log.old_values || log.new_values) && (
                            <IconButton size="small" onClick={() => setExpanded(open ? null : log.id)} aria-expanded={open} aria-label="Show recorded values">
                              <ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 6 : 5} sx={{ py: 0, borderBottom: open ? undefined : 0 }}>
                          <Collapse in={open} unmountOnExit>
                            <Box sx={{ py: 1.5 }}><Changes log={log} /></Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {data && data.total > 0 && (
          <TablePagination component="div" count={data.total} page={page} rowsPerPage={size} rowsPerPageOptions={[25, 50, 100]}
            onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} />
        )}
      </Paper>
    </Box>
  );
}
