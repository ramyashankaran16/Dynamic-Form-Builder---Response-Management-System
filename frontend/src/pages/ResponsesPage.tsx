import BarChartIcon from "@mui/icons-material/BarChart";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert, Box, Button, Chip, Divider, InputAdornment, LinearProgress, ListItemText, ListSubheader, Menu, MenuItem, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { exportsApi, formsApi, responsesApi } from "../api/endpoints";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { FullPageLoader } from "../components/ProtectedRoute";
import { ResponseDrawer } from "../components/responses/ResponseDrawer";
import { useNotify } from "../context/NotifyContext";
import { downloadFile } from "../lib/download";
import { errorMessage } from "../lib/errors";
import { formatAnswer, formatDateTime, plural } from "../lib/format";
import { useDebounce } from "../lib/useDebounce";
import type { FormDetail, FormResponse, Page, ResponseFilters } from "../types";

type Format = "excel" | "pdf";

export default function ResponsesPage() {
  const formId = Number(useParams().id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { notify } = useNotify();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ResponseFilters>({ submitter_type: "all", sort_by: "created_at", sort_order: "desc" });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [data, setData] = useState<Page<FormResponse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportMenu, setExportMenu] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search);
  const debouncedValue = useDebounce(filters.field_value ?? "");

  const openId = params.get("open") ? Number(params.get("open")) : null;
  const setOpenId = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("open", String(id));
    else next.delete("open");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    formsApi.get(formId).then(setForm).catch((e) => setFormError(errorMessage(e)));
  }, [formId]);

  const activeFilters: ResponseFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch || undefined, field_value: filters.field_key ? debouncedValue || undefined : undefined }),
    [filters, debouncedSearch, debouncedValue],
  );

  const load = useCallback(() => {
    setLoading(true);
    responsesApi
      .list(formId, { ...activeFilters, page: page + 1, size })
      .then(setData)
      .catch((e) => notify(errorMessage(e), "error"))
      .finally(() => setLoading(false));
  }, [formId, activeFilters, page, size, notify]);

  useEffect(load, [load]);
  useEffect(() => setPage(0), [activeFilters]);

  const columns = useMemo(() => (form?.fields ?? []).filter((f) => f.field_type !== "file").slice(0, 3), [form]);
  const filtering = Boolean(debouncedSearch || filters.date_from || filters.date_to || filters.field_key || filters.submitter_type !== "all");

  const exportNow = async (format: Format) => {
    setExportMenu(null);
    setExporting(format);
    try {
      await downloadFile(exportsApi.syncDownloadPath(formId), { format, ...activeFilters }, `responses.${format === "excel" ? "xlsx" : "pdf"}`);
      notify(`${format === "excel" ? "Excel" : "PDF"} file downloaded.`);
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setExporting(null);
    }
  };

  /** Background export through Celery: request, poll, download. */
  const exportInBackground = async (format: Format) => {
    setExportMenu(null);
    setExporting(format);
    try {
      const task = await exportsApi.request(formId, format, activeFilters);
      const started = Date.now();
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));
        const status = await exportsApi.status(task.task_id);
        if (status.status === "SUCCESS") {
          await downloadFile(exportsApi.taskDownloadPath(task.task_id), {}, status.file_name ?? "export");
          notify("Background export downloaded.");
          return;
        }
        if (status.status === "FAILURE") throw new Error(status.error || "The export failed.");
        if (status.status === "PENDING" && Date.now() - started > 20000) {
          throw new Error("No background worker picked up the export. Start the Celery worker, or use Download now.");
        }
      }
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setExporting(null);
    }
  };

  if (formError) return <Alert severity="error">{formError}</Alert>;
  if (!form) return <FullPageLoader />;

  return (
    <Box>
      <PageHeader
        backTo="/forms"
        title={form.title}
        subtitle={`Responses${data ? `: ${plural(data.total, filtering ? "match" : "response", filtering ? "matches" : "responses")}` : ""}`}
        actions={
          <>
            <Button startIcon={<EditOutlinedIcon />} color="inherit" onClick={() => navigate(`/forms/${formId}/edit`)}>Edit form</Button>
            <Button startIcon={<BarChartIcon />} color="inherit" onClick={() => navigate(`/forms/${formId}/analytics`)}>Analytics</Button>
            <Button variant="contained" startIcon={<FileDownloadOutlinedIcon />} onClick={(e) => setExportMenu(e.currentTarget)} disabled={!!exporting}>
              {exporting ? `Exporting ${exporting === "excel" ? "Excel" : "PDF"}…` : "Export"}
            </Button>
          </>
        }
      />

      <Menu anchorEl={exportMenu} open={!!exportMenu} onClose={() => setExportMenu(null)}>
        <ListSubheader sx={{ lineHeight: 2.5 }}>Download now</ListSubheader>
        <MenuItem onClick={() => exportNow("excel")}><ListItemText primary="Excel (.xlsx)" /></MenuItem>
        <MenuItem onClick={() => exportNow("pdf")}><ListItemText primary="PDF" /></MenuItem>
        <Divider />
        <ListSubheader sx={{ lineHeight: 2.5 }}>Prepare in background</ListSubheader>
        <MenuItem onClick={() => exportInBackground("excel")}><ListItemText primary="Excel" secondary="For large forms. Needs the worker." /></MenuItem>
        <MenuItem onClick={() => exportInBackground("pdf")}><ListItemText primary="PDF" secondary="For large forms. Needs the worker." /></MenuItem>
        {filtering && <Typography sx={{ px: 2, py: 1, fontSize: 12.5, color: "text.secondary", maxWidth: 260 }}>Exports include only the responses matching your filters.</Typography>}
      </Menu>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "2fr 1fr 1fr 1fr" } }}>
          <TextField
            placeholder="Search answers, names or emails"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { "aria-label": "Search responses" } }}
          />
          <TextField label="From" type="date" value={filters.date_from ?? ""} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || undefined }))} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="To" type="date" value={filters.date_to ?? ""} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined }))} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="Respondent" value={filters.submitter_type} onChange={(e) => setFilters((f) => ({ ...f, submitter_type: e.target.value as ResponseFilters["submitter_type"] }))}>
            <MenuItem value="all">Everyone</MenuItem>
            <MenuItem value="authenticated">Logged-in users</MenuItem>
            <MenuItem value="anonymous">Anonymous</MenuItem>
          </TextField>
          <TextField select label="Answer to" value={filters.field_key ?? ""} onChange={(e) => setFilters((f) => ({ ...f, field_key: e.target.value || undefined, field_value: "" }))}>
            <MenuItem value="">Any question</MenuItem>
            {form.fields.map((f) => <MenuItem key={f.id} value={f.field_key}>{f.label}</MenuItem>)}
          </TextField>
          {filters.field_key ? (() => {
            const field = form.fields.find((f) => f.field_key === filters.field_key);
            return field && field.options.length ? (
              <TextField select label="Contains" value={filters.field_value ?? ""} onChange={(e) => setFilters((f) => ({ ...f, field_value: e.target.value }))}>
                <MenuItem value="">Any answer</MenuItem>
                {field.options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            ) : (
              <TextField label="Contains" value={filters.field_value ?? ""} onChange={(e) => setFilters((f) => ({ ...f, field_value: e.target.value }))} />
            );
          })() : <Box sx={{ display: { xs: "none", lg: "block" } }} />}
          <TextField select label="Sort by" value={`${filters.sort_by}:${filters.sort_order}`} onChange={(e) => {
            const [sort_by, sort_order] = e.target.value.split(":") as [ResponseFilters["sort_by"], ResponseFilters["sort_order"]];
            setFilters((f) => ({ ...f, sort_by, sort_order }));
          }}>
            <MenuItem value="created_at:desc">Newest first</MenuItem>
            <MenuItem value="created_at:asc">Oldest first</MenuItem>
            <MenuItem value="updated_at:desc">Recently edited</MenuItem>
          </TextField>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {filtering && <Button onClick={() => { setSearch(""); setFilters({ submitter_type: "all", sort_by: "created_at", sort_order: "desc" }); }}>Clear filters</Button>}
          </Box>
        </Box>
      </Paper>

      <Paper variant="outlined">
        {loading && <LinearProgress />}
        {data && data.total === 0 ? (
          filtering ? (
            <EmptyState title="No responses match" message="Try widening the dates or clearing the search." />
          ) : (
            <EmptyState
              title="No responses yet"
              message={form.is_active ? "Share the form link to start collecting answers." : "This form is closed. Open it from the forms list to accept responses."}
              action={form.is_active ? <Button variant="outlined" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`); notify("Link copied."); }}>Copy form link</Button> : undefined}
            />
          )
        ) : (
          <TableContainer>
            <Table size="small" sx={{ "& td, & th": { py: 1.25 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Respondent</TableCell>
                  {columns.map((c) => <TableCell key={c.id} sx={{ maxWidth: 220 }}>{c.label}</TableCell>)}
                  <TableCell>Version</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.map((r) => (
                  <TableRow key={r.id} hover onClick={() => setOpenId(r.id)} sx={{ cursor: "pointer" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpenId(r.id)}>
                    <TableCell sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>{r.id}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>{r.submitter_name ?? <Box component="span" sx={{ color: "text.secondary" }}>Anonymous</Box>}</TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.id} sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {formatAnswer(c.field_type, r.answers[c.field_key], c.options)}
                      </TableCell>
                    ))}
                    <TableCell>{r.version > 1 ? <Chip size="small" label={`Edited, v${r.version}`} color="warning" variant="outlined" /> : "Original"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {data && data.total > 0 && (
          <TablePagination component="div" count={data.total} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50, 100]}
            onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} />
        )}
      </Paper>

      <ResponseDrawer responseId={openId} fields={form.fields} slug={form.slug} onClose={() => setOpenId(null)} onChanged={load} />
    </Box>
  );
}
