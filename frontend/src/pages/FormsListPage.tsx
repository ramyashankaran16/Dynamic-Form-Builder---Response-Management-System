import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert, Box, Button, Chip, IconButton, InputAdornment, LinearProgress, Link, ListItemText, Menu, MenuItem, Paper, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { formsApi } from "../api/endpoints";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useNotify } from "../context/NotifyContext";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { useDebounce } from "../lib/useDebounce";
import type { FormSummary, Page } from "../types";

export default function FormsListPage() {
  const { isAdmin } = useAuth();
  const { notify, confirm } = useNotify();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "closed">("all");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [data, setData] = useState<Page<FormSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; form: FormSummary } | null>(null);
  const debounced = useDebounce(search);

  const load = useCallback(() => {
    setLoading(true);
    formsApi
      .list({ page: page + 1, size, search: debounced, is_active: status === "all" ? undefined : status === "active", mine: isAdmin && mine ? true : undefined })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [page, size, debounced, status, mine, isAdmin]);

  useEffect(load, [load]);
  useEffect(() => setPage(0), [debounced, status, mine]);

  const toggle = async (form: FormSummary) => {
    try {
      const updated = await formsApi.setStatus(form.id, !form.is_active);
      setData((d) => d && { ...d, items: d.items.map((f) => (f.id === form.id ? updated : f)) });
      notify(updated.is_active ? `"${form.title}" is open for responses.` : `"${form.title}" is closed.`);
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  const act = async (action: string, form: FormSummary) => {
    setMenu(null);
    try {
      if (action === "copy") {
        await navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`);
        notify("Link copied.");
      } else if (action === "open") {
        window.open(`/f/${form.slug}`, "_blank", "noopener");
      } else if (action === "duplicate") {
        const copy = await formsApi.duplicate(form.id);
        notify(`Copy created. It starts closed so you can review it first.`);
        navigate(`/forms/${copy.id}/edit`);
      } else if (action === "delete") {
        const ok = await confirm({
          title: `Delete "${form.title}"?`,
          message: `This permanently deletes the form and its ${form.response_count} ${form.response_count === 1 ? "response" : "responses"}. This can't be undone.`,
          confirmText: "Delete form",
          danger: true,
        });
        if (!ok) return;
        await formsApi.remove(form.id);
        notify("Form deleted.");
        load();
      } else {
        navigate(`/forms/${form.id}/${action}`);
      }
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  return (
    <Box>
      <PageHeader
        title="Forms"
        subtitle={isAdmin ? "Every form on the platform." : "Forms you've created."}
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/forms/new")}>New form</Button>}
      />

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          placeholder="Search by title or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ maxWidth: 360 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { "aria-label": "Search forms" } }}
        />
        <TextField select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} sx={{ width: 170 }} slotProps={{ htmlInput: { "aria-label": "Status" } }}>
          <MenuItem value="all">All forms</MenuItem>
          <MenuItem value="active">Open</MenuItem>
          <MenuItem value="closed">Closed</MenuItem>
        </TextField>
        {isAdmin && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Switch checked={mine} onChange={(e) => setMine(e.target.checked)} inputProps={{ "aria-label": "Only my forms" }} />
            <Typography sx={{ fontSize: 14 }}>Only my forms</Typography>
          </Box>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        {loading && <LinearProgress />}
        {data && data.total === 0 && !loading ? (
          debounced || status !== "all" ? (
            <EmptyState title="No forms match" message="Try a different search or status." action={<Button onClick={() => { setSearch(""); setStatus("all"); }}>Clear filters</Button>} />
          ) : (
            <EmptyState title="No forms yet" message="Create a form, add fields with drag and drop, then share its link." action={<Button variant="contained" onClick={() => navigate("/forms/new")}>New form</Button>} />
          )
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Form</TableCell>
                  <TableCell>Open</TableCell>
                  <TableCell align="right">Fields</TableCell>
                  <TableCell align="right">Responses</TableCell>
                  {isAdmin && <TableCell>Owner</TableCell>}
                  <TableCell>Updated</TableCell>
                  <TableCell align="right"><span className="sr-only">Actions</span></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.map((form) => (
                  <TableRow key={form.id} hover>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Link component={RouterLink} to={`/forms/${form.id}/edit`} underline="hover" sx={{ fontWeight: 650, color: "text.primary" }}>
                        {form.title}
                      </Link>
                      <Box sx={{ display: "flex", gap: 0.75, mt: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                        <Chip size="small" variant="outlined" label={form.is_public ? "Public link" : "Login required"} />
                        {form.allow_response_edit && <Chip size="small" variant="outlined" label="Editable answers" />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={form.is_active ? "Accepting responses. Click to close." : "Closed. Click to open."}>
                        <Switch checked={form.is_active} onChange={() => toggle(form)} inputProps={{ "aria-label": `Accept responses for ${form.title}` }} />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">{form.field_count}</TableCell>
                    <TableCell align="right">
                      <Link component={RouterLink} to={`/forms/${form.id}/responses`} underline="hover" fontWeight={600}>{form.response_count}</Link>
                    </TableCell>
                    {isAdmin && <TableCell>{form.owner_name}</TableCell>}
                    <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>{formatDateTime(form.updated_at)}</TableCell>
                    <TableCell align="right">
                      <IconButton aria-label={`Actions for ${form.title}`} onClick={(e) => setMenu({ el: e.currentTarget, form })}>
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {data && data.total > 0 && (
          <TablePagination component="div" count={data.total} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]}
            onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} />
        )}
      </Paper>

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        {[
          ["edit", "Edit form"], ["responses", "Responses"], ["analytics", "Analytics"], ["open", "Open form"],
          ["copy", "Copy link"], ["duplicate", "Duplicate"],
        ].map(([key, label]) => (
          <MenuItem key={key} onClick={() => menu && act(key, menu.form)}><ListItemText>{label}</ListItemText></MenuItem>
        ))}
        <MenuItem onClick={() => menu && act("delete", menu.form)} sx={{ color: "error.main" }}><ListItemText>Delete</ListItemText></MenuItem>
      </Menu>
    </Box>
  );
}
