import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert, Box, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { usersApi } from "../api/endpoints";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useNotify } from "../context/NotifyContext";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { useDebounce } from "../lib/useDebounce";
import type { Page, Role, User } from "../types";

export default function UsersPage() {
  const { user: me } = useAuth();
  const { notify, confirm } = useNotify();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [data, setData] = useState<Page<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounce(search);

  const load = useCallback(() => {
    setLoading(true);
    usersApi
      .list({ page: page + 1, size, search: debounced, role, is_active: status === "" ? undefined : status === "active" })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [page, size, debounced, role, status]);
  useEffect(load, [load]);

  const update = async (u: User, patch: { role?: Role; is_active?: boolean }) => {
    try {
      const updated = await usersApi.update(u.id, patch);
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === u.id ? updated : x)) });
      notify(patch.role ? `${u.full_name} is now ${patch.role === "Admin" ? "an admin" : "a user"}.` : patch.is_active ? `${u.full_name} can log in again.` : `${u.full_name} can no longer log in.`);
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  const remove = async (u: User) => {
    const ok = await confirm({
      title: `Delete ${u.full_name}?`,
      message: "This also deletes every form they own and all of those responses. To keep their forms, turn off their access instead.",
      confirmText: "Delete user",
      danger: true,
    });
    if (!ok) return;
    try {
      await usersApi.remove(u.id);
      notify("User deleted.");
      load();
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  return (
    <Box>
      <PageHeader title="Users" subtitle="Change roles and control who can log in." />
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <TextField placeholder="Search by name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ maxWidth: 340 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { "aria-label": "Search users" } }} />
        <TextField select label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }} sx={{ width: 150 }}>
          <MenuItem value="">All roles</MenuItem>
          <MenuItem value="Admin">Admin</MenuItem>
          <MenuItem value="User">User</MenuItem>
        </TextField>
        <TextField select label="Access" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ width: 150 }}>
          <MenuItem value="">Everyone</MenuItem>
          <MenuItem value="active">Can log in</MenuItem>
          <MenuItem value="inactive">Blocked</MenuItem>
        </TextField>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper variant="outlined">
        {loading && <LinearProgress />}
        {data && data.total === 0 ? <EmptyState title="No users match" message="Try a different search." /> : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Can log in</TableCell>
                  <TableCell>Last login</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell align="right"><span className="sr-only">Actions</span></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>{u.full_name}{self && <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}> (you)</Box>}</Typography>
                        <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>{u.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <TextField select value={u.role ?? "User"} disabled={self} onChange={(e) => update(u, { role: e.target.value as Role })} sx={{ width: 120 }} slotProps={{ htmlInput: { "aria-label": `Role of ${u.full_name}` } }}>
                          <MenuItem value="Admin">Admin</MenuItem>
                          <MenuItem value="User">User</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <Switch checked={u.is_active} disabled={self} onChange={(e) => update(u, { is_active: e.target.checked })} inputProps={{ "aria-label": `${u.full_name} can log in` }} />
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}</TableCell>
                      <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{formatDateTime(u.created_at)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={self ? "You can't delete your own account" : "Delete user"}>
                          <span><IconButton disabled={self} onClick={() => remove(u)} aria-label={`Delete ${u.full_name}`}><DeleteOutlineIcon /></IconButton></span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {data && data.total > 0 && (
          <TablePagination component="div" count={data.total} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]}
            onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} />
        )}
      </Paper>
    </Box>
  );
}
