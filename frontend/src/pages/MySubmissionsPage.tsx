import { Alert, Box, Button, Chip, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { responsesApi } from "../api/endpoints";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { ResponseDrawer } from "../components/responses/ResponseDrawer";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import type { FormResponse, Page } from "../types";

export default function MySubmissionsPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [data, setData] = useState<Page<FormResponse> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    responsesApi.mine({ page: page + 1, size }).then(setData).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  }, [page, size]);
  useEffect(load, [load]);

  return (
    <Box>
      <PageHeader title="My submissions" subtitle="Forms you've filled in while logged in. Some forms let you edit your answers." />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper variant="outlined">
        {loading && <LinearProgress />}
        {data && data.total === 0 ? (
          <EmptyState title="Nothing submitted yet" message="When you fill in a form while logged in, it shows up here." />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Form</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right"><span className="sr-only">Actions</span></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{r.form_title}</TableCell>
                    <TableCell>{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>
                      {r.version > 1 ? <Chip size="small" variant="outlined" label={`Edited ${formatDateTime(r.updated_at)}`} /> : <Chip size="small" variant="outlined" label="Submitted" />}
                    </TableCell>
                    <TableCell align="right">
                      <Button onClick={() => setOpen(r.id)}>{r.can_edit ? "View or edit" : "View"}</Button>
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
      <ResponseDrawer responseId={open} onClose={() => setOpen(null)} onChanged={load} />
    </Box>
  );
}
