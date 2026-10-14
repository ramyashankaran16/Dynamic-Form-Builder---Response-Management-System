import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { authApi } from "../api/endpoints";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useNotify } from "../context/NotifyContext";
import { errorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { notify } = useNotify();
  const [pwError, setPwError] = useState<string | null>(null);
  const nameForm = useForm({ defaultValues: { full_name: user?.full_name ?? "" } });
  const pwForm = useForm({ defaultValues: { current: "", next: "", confirm: "" } });

  const saveName = nameForm.handleSubmit(async ({ full_name }) => {
    try {
      setUser(await authApi.updateMe(full_name.trim()));
      notify("Name updated.");
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  });

  const savePassword = pwForm.handleSubmit(async ({ current, next }) => {
    setPwError(null);
    try {
      await authApi.changePassword(current, next);
      pwForm.reset();
      notify("Password changed.");
    } catch (e) {
      setPwError(errorMessage(e));
    }
  });

  return (
    <Box sx={{ maxWidth: 640 }}>
      <PageHeader title="Profile" subtitle={`${user?.email}, ${user?.role}. Member since ${formatDateTime(user?.created_at)}.`} />
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 2 }}>Your name</Typography>
        <form onSubmit={saveName} noValidate>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField label="Full name" {...nameForm.register("full_name", { required: "Enter your name.", minLength: { value: 2, message: "Use at least 2 characters." } })}
              error={!!nameForm.formState.errors.full_name} helperText={nameForm.formState.errors.full_name?.message} />
            <Button type="submit" variant="contained" disabled={nameForm.formState.isSubmitting} sx={{ flexShrink: 0, alignSelf: "flex-start" }}>Save name</Button>
          </Stack>
        </form>
      </Paper>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 2 }}>Change password</Typography>
        <form onSubmit={savePassword} noValidate>
          <Stack spacing={2}>
            {pwError && <Alert severity="error">{pwError}</Alert>}
            <TextField label="Current password" type="password" autoComplete="current-password" {...pwForm.register("current", { required: "Enter your current password." })}
              error={!!pwForm.formState.errors.current} helperText={pwForm.formState.errors.current?.message} />
            <TextField label="New password" type="password" autoComplete="new-password" {...pwForm.register("next", { required: "Choose a new password.", minLength: { value: 8, message: "Use at least 8 characters." } })}
              error={!!pwForm.formState.errors.next} helperText={pwForm.formState.errors.next?.message ?? "At least 8 characters."} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" {...pwForm.register("confirm", { validate: (v) => v === pwForm.getValues("next") || "Passwords don't match." })}
              error={!!pwForm.formState.errors.confirm} helperText={pwForm.formState.errors.confirm?.message} />
            <Box><Button type="submit" variant="contained" disabled={pwForm.formState.isSubmitting}>Change password</Button></Box>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
