import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Drawer, IconButton, Tab, Tabs, Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { publicApi, responsesApi } from "../../api/endpoints";
import { useNotify } from "../../context/NotifyContext";
import { downloadFile } from "../../lib/download";
import { errorMessage } from "../../lib/errors";
import { formatAnswer, formatDateTime } from "../../lib/format";
import { tokens } from "../../theme";
import type { FormField, FormResponse, HistoryEntry } from "../../types";
import { ResponseEditDialog } from "./ResponseEditDialog";

interface Props {
  responseId: number | null;
  /** Field definitions (owner view). When missing they are loaded from the public form for editing. */
  fields?: FormField[];
  slug?: string;
  onClose: () => void;
  onChanged?: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  RESPONSE_SUBMITTED: "Submitted",
  RESPONSE_UPDATED: "Edited",
};

function show(value: unknown, type: string | undefined, field?: FormField) {
  const text = formatAnswer(type ?? "text", value, field?.options);
  return text || <Box component="span" sx={{ color: "text.disabled" }}>empty</Box>;
}

export function ResponseDrawer({ responseId, fields, slug, onClose, onChanged }: Props) {
  const { notify, confirm } = useNotify();
  const [response, setResponse] = useState<FormResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [tab, setTab] = useState<"answers" | "history">("answers");
  const [error, setError] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<FormField[] | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setResponse(null);
    setHistory(null);
    setError(null);
    setTab("answers");
    if (!responseId) return;
    responsesApi.get(responseId).then(setResponse).catch((e) => setError(errorMessage(e)));
  }, [responseId]);

  useEffect(() => {
    if (tab === "history" && responseId && history === null) {
      responsesApi.history(responseId).then(setHistory).catch((e) => setError(errorMessage(e)));
    }
  }, [tab, responseId, history]);

  const fieldByKey = useMemo(() => new Map((fields ?? editFields ?? []).map((f) => [f.field_key, f])), [fields, editFields]);
  const labelByKey = useMemo(() => {
    const m = new Map<string, { label: string; type: string }>();
    response?.details.forEach((d) => m.set(d.field_key, { label: d.field_label, type: d.field_type }));
    fieldByKey.forEach((f, k) => m.set(k, { label: f.label, type: f.field_type }));
    return m;
  }, [response, fieldByKey]);

  const startEdit = async () => {
    if (!response) return;
    if (fields) {
      setEditFields(fields);
      setEditing(true);
      return;
    }
    const formSlug = slug ?? response.form_slug;
    if (!formSlug) {
      notify("This form can't be edited from here.", "error");
      return;
    }
    try {
      const form = await publicApi.get(formSlug);
      setEditFields(form.fields);
      setEditing(true);
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  const remove = async () => {
    if (!response) return;
    const ok = await confirm({ title: `Delete response #${response.id}?`, message: "The answers and any uploaded files are removed permanently.", confirmText: "Delete response", danger: true });
    if (!ok) return;
    try {
      await responsesApi.remove(response.id);
      notify("Response deleted.");
      onChanged?.();
      onClose();
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  return (
    <Drawer anchor="right" open={!!responseId} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 520 } } } }}>
      <Box sx={{ p: 2.5, display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" component="h2">Response #{responseId}</Typography>
          {response && (
            <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
              {response.form_title}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2.5 }}>{error}</Alert>}
      {!response && !error && <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>}

      {response && (
        <>
          <Box sx={{ px: 2.5, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.5, fontSize: 14 }}>
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Submitted by</Typography>
            <Typography sx={{ fontSize: 14 }}>{response.submitter_name ? `${response.submitter_name} (${response.submitter_email})` : "Anonymous"}</Typography>
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Submitted</Typography>
            <Typography sx={{ fontSize: 14 }}>{formatDateTime(response.created_at)}</Typography>
            {response.version > 1 && (
              <>
                <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Last edited</Typography>
                <Typography sx={{ fontSize: 14 }}>{formatDateTime(response.updated_at)}{response.updated_by_name ? ` by ${response.updated_by_name}` : ""} <Chip size="small" label={`v${response.version}`} sx={{ ml: 0.5 }} /></Typography>
              </>
            )}
          </Box>

          <Box sx={{ px: 2.5, pt: 2, display: "flex", gap: 1 }}>
            {response.can_edit && <Button variant="contained" onClick={startEdit}>Edit answers</Button>}
            {response.can_delete && <Button color="error" onClick={remove}>Delete</Button>}
          </Box>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2.5, mt: 1.5, borderBottom: 1, borderColor: "divider" }}>
            <Tab value="answers" label="Answers" />
            <Tab value="history" label="History" />
          </Tabs>

          <Box sx={{ p: 2.5, overflowY: "auto" }}>
            {tab === "answers" && (
              response.details.length === 0 ? <Typography color="text.secondary">No answers were given.</Typography> : (
                <Box component="dl" sx={{ m: 0 }}>
                  {response.details.map((d) => {
                    const field = fieldByKey.get(d.field_key);
                    return (
                      <Box key={d.id} sx={{ py: 1.25, borderBottom: `1px solid ${tokens.rule}` }}>
                        <Typography component="dt" sx={{ fontSize: 13.5, color: "text.secondary", fontWeight: 600 }}>
                          {d.field_label}{d.field_id === null && <Chip size="small" label="field removed" sx={{ ml: 1, height: 18, fontSize: 11 }} />}
                        </Typography>
                        <Typography component="dd" sx={{ m: 0, mt: 0.25, whiteSpace: "pre-line", wordBreak: "break-word" }}>
                          {d.field_type === "file" && d.value ? (
                            <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadFile(responsesApi.fileUrl(response.id, d.id), {}, String(d.value)).catch((e) => notify(errorMessage(e), "error"))}>
                              {formatAnswer("file", d.value)}
                            </Button>
                          ) : show(d.value, d.field_type, field)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )
            )}

            {tab === "history" && (
              history === null ? <CircularProgress size={24} /> : (
                <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, position: "relative", "&::before": { content: '""', position: "absolute", left: 5, top: 8, bottom: 8, width: 2, bgcolor: tokens.rule } }}>
                  {history.map((h, idx) => (
                    <Box component="li" key={h.id} sx={{ position: "relative", pl: 3.5, pb: 2.5 }}>
                      <Box sx={{ position: "absolute", left: 0, top: 5, width: 12, height: 12, borderRadius: "50%", bgcolor: idx === 0 ? tokens.ledger : tokens.highlighter, border: "2px solid #fff" }} />
                      <Typography sx={{ fontWeight: 700 }}>
                        {ACTION_LABEL[h.action] ?? h.action}{h.action === "RESPONSE_UPDATED" ? ` (version ${idx + 1})` : ""}
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                        {h.user_name ?? "Anonymous"}, {formatDateTime(h.created_at)}
                      </Typography>
                      {h.action === "RESPONSE_UPDATED" && h.new_values && (
                        <Box sx={{ mt: 1, border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
                          {Object.keys(h.new_values).map((key, i) => {
                            const meta = labelByKey.get(key);
                            const field = fieldByKey.get(key);
                            return (
                              <Box key={key}>
                                {i > 0 && <Divider />}
                                <Box sx={{ p: 1.25, fontSize: 14 }}>
                                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary" }}>{meta?.label ?? key}</Typography>
                                  <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
                                    <Box component="del" sx={{ color: "error.main", textDecorationThickness: 1 }}>{show(h.old_values?.[key], meta?.type, field)}</Box>
                                    <Box component="span" aria-hidden sx={{ color: "text.secondary" }}>to</Box>
                                    <Box component="ins" sx={{ textDecoration: "none", bgcolor: tokens.highlighterSoft, px: 0.5, borderRadius: 0.5 }}>{show(h.new_values?.[key], meta?.type, field)}</Box>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )
            )}
          </Box>
        </>
      )}

      <ResponseEditDialog
        response={editing ? response : null}
        fields={editFields}
        slug={slug ?? response?.form_slug}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setResponse(updated);
          setHistory(null);
          setEditing(false);
          onChanged?.();
        }}
      />
    </Drawer>
  );
}
