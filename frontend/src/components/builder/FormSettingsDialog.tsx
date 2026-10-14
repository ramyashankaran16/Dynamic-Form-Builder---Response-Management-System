import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { FormSettings } from "../../types";

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help: string }) {
  return (
    <Box>
      <FormControlLabel control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />} label={<Typography sx={{ fontWeight: 600 }}>{label}</Typography>} />
      <Typography sx={{ fontSize: 13, color: "text.secondary", ml: 6, mt: -0.5 }}>{help}</Typography>
    </Box>
  );
}

export function FormSettingsDialog({ open, settings, onClose, onApply }: {
  open: boolean; settings: FormSettings; onClose: () => void; onApply: (s: FormSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);
  const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Form settings</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25}>
          <Toggle checked={draft.is_active} onChange={(v) => set("is_active", v)} label="Accepting responses" help="Turn off to close the form. Existing responses are kept." />
          <Toggle checked={draft.is_public} onChange={(v) => set("is_public", v)} label="Anyone with the link can respond" help="Off: people must log in before they can open the form." />
          <Toggle checked={draft.allow_multiple_submissions} onChange={(v) => set("allow_multiple_submissions", v)} label="Allow more than one response per person" help="Applies to logged-in respondents." />
          <Toggle checked={draft.allow_response_edit} onChange={(v) => set("allow_response_edit", v)} label="Respondents can edit their answers" help="Logged-in respondents can change their response while the form is open. Every change is kept in the history." />
          <TextField
            label="Confirmation message"
            value={draft.submit_message ?? ""}
            onChange={(e) => set("submit_message", e.target.value || null)}
            placeholder="Thank you! Your response has been recorded."
            multiline
            minRows={2}
            helperText="Shown after someone submits the form."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { onApply(draft); onClose(); }}>Apply settings</Button>
      </DialogActions>
    </Dialog>
  );
}
