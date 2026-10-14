import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import LinkIcon from "@mui/icons-material/Link";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { Alert, Box, Button, Chip, Paper, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formsApi } from "../api/endpoints";
import { BuilderCanvas } from "../components/builder/BuilderCanvas";
import {
  builderProblems, createField, duplicateField, fromApi, toInput, toPreview, type BuilderField,
} from "../components/builder/builderState";
import { FieldPalette, PaletteTile } from "../components/builder/FieldPalette";
import { FieldProperties } from "../components/builder/FieldProperties";
import { FormSettingsDialog } from "../components/builder/FormSettingsDialog";
import { PageHeader } from "../components/PageHeader";
import { FullPageLoader } from "../components/ProtectedRoute";
import { FormRenderer } from "../components/renderer/FormRenderer";
import { useNotify } from "../context/NotifyContext";
import { errorMessage } from "../lib/errors";
import { fieldMeta, slugifyKey, uniqueKey } from "../lib/fieldTypes";
import { tokens } from "../theme";
import type { FieldType, FormSettings } from "../types";

const DEFAULT_SETTINGS: FormSettings = {
  title: "",
  description: null,
  is_public: true,
  is_active: true,
  allow_response_edit: false,
  allow_multiple_submissions: true,
  submit_message: null,
};

export default function FormBuilderPage() {
  const { id } = useParams();
  const formId = id ? Number(id) : null;
  const navigate = useNavigate();
  const { notify } = useNotify();

  const [loading, setLoading] = useState(!!formId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_SETTINGS);
  const [slug, setSlug] = useState<string | null>(null);
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"build" | "preview">("build");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [dragType, setDragType] = useState<FieldType | null>(null);

  useEffect(() => {
    if (!formId) return;
    formsApi
      .get(formId)
      .then((form) => {
        const { title, description, is_public, is_active, allow_response_edit, allow_multiple_submissions, submit_message } = form;
        setSettings({ title, description, is_public, is_active, allow_response_edit, allow_multiple_submissions, submit_message });
        setSlug(form.slug);
        setFields(form.fields.map(fromApi));
      })
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [formId]);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const touch = () => {
    setDirty(true);
    setProblems([]);
  };

  const insertField = (type: FieldType, index?: number) => {
    const field = createField(type, fields);
    const selIndex = fields.findIndex((f) => f.uid === selected);
    const at = index ?? (selIndex >= 0 ? selIndex + 1 : fields.length);
    const next = [...fields];
    next.splice(at, 0, field);
    setFields(next);
    setSelected(field.uid);
    touch();
  };

  const updateField = (uid: string, patch: Partial<BuilderField>) => {
    setFields((prev) => {
      const current = prev.find((f) => f.uid === uid);
      if (!current) return prev;
      const updated: BuilderField = { ...current, ...patch };
      // New fields: derive the key from the label until the key is edited by hand.
      if (patch.label !== undefined && !current.keyEdited && !current.id) {
        const taken = new Set(prev.filter((f) => f.uid !== uid).map((f) => f.field_key));
        updated.field_key = uniqueKey(slugifyKey(patch.label || fieldMeta(current.field_type).defaultLabel), taken);
      }
      const oldKey = current.field_key;
      const newKey = updated.field_key;
      return prev.map((f) => {
        if (f.uid === uid) return updated;
        // keep conditions pointing at the renamed key
        if (oldKey !== newKey && f.visibility_rules?.conditions.some((c) => c.field_key === oldKey)) {
          return {
            ...f,
            visibility_rules: {
              ...f.visibility_rules,
              conditions: f.visibility_rules.conditions.map((c) => (c.field_key === oldKey ? { ...c, field_key: newKey } : c)),
            },
          };
        }
        return f;
      });
    });
    touch();
  };

  const deleteField = (uid: string) => {
    const target = fields.find((f) => f.uid === uid);
    if (!target) return;
    let affected = 0;
    const next = fields
      .filter((f) => f.uid !== uid)
      .map((f) => {
        const conds = f.visibility_rules?.conditions ?? [];
        if (!conds.some((c) => c.field_key === target.field_key)) return f;
        affected++;
        const remaining = conds.filter((c) => c.field_key !== target.field_key);
        return { ...f, visibility_rules: remaining.length ? { ...f.visibility_rules!, conditions: remaining } : null };
      });
    setFields(next);
    if (selected === uid) setSelected(null);
    touch();
    if (affected) notify(`Removed "${target.label}" and the conditions that depended on it.`, "info");
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current?.type as FieldType | undefined;
    setDragType(e.active.data.current?.fromPalette ? type ?? null : null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragType(null);
    if (!over) return;
    if (active.data.current?.fromPalette) {
      const type = active.data.current.type as FieldType;
      const overIndex = fields.findIndex((f) => f.uid === over.id);
      insertField(type, overIndex >= 0 ? overIndex : fields.length);
      return;
    }
    if (active.id !== over.id) {
      const from = fields.findIndex((f) => f.uid === active.id);
      const to = over.id === "canvas" ? fields.length - 1 : fields.findIndex((f) => f.uid === over.id);
      if (from >= 0 && to >= 0) {
        setFields((prev) => arrayMove(prev, from, to));
        touch();
      }
    }
  };

  const save = async () => {
    const found = builderProblems(settings.title, fields);
    setProblems(found);
    if (found.length) return;
    setSaving(true);
    try {
      const payload = fields.map(toInput);
      const cleanSettings = { ...settings, title: settings.title.trim(), description: settings.description?.trim() || null };
      if (!formId) {
        const created = await formsApi.create({ ...cleanSettings, fields: payload });
        setDirty(false);
        notify("Form created.");
        navigate(`/forms/${created.id}/edit`, { replace: true });
        return;
      }
      await formsApi.update(formId, cleanSettings);
      const saved = await formsApi.saveFields(formId, payload);
      const selectedKey = fields.find((f) => f.uid === selected)?.field_key;
      const next = saved.fields.map(fromApi);
      setFields(next);
      setSelected(next.find((f) => f.field_key === selectedKey)?.uid ?? null);
      setDirty(false);
      notify("Changes saved.");
    } catch (err) {
      setProblems([errorMessage(err)]);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!slug) return;
    await navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`);
    notify("Link copied.");
  };

  const previewFields = useMemo(() => fields.map(toPreview), [fields]);
  const selectedField = fields.find((f) => f.uid === selected) ?? null;

  if (loading) return <FullPageLoader />;
  if (loadError) return <Alert severity="error">{loadError}</Alert>;

  return (
    <Box>
      <PageHeader
        backTo="/forms"
        title={formId ? "Edit form" : "New form"}
        subtitle={
          <Box component="span" sx={{ display: "inline-flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Chip size="small" label={settings.is_active ? "Accepting responses" : "Closed"} color={settings.is_active ? "success" : "default"} variant="outlined" />
            <Chip size="small" label={settings.is_public ? "Anyone with the link" : "Logged-in users only"} variant="outlined" />
            {dirty && <Typography component="span" sx={{ fontSize: 13.5, color: "warning.main", fontWeight: 600 }}>Unsaved changes</Typography>}
          </Box>
        }
        actions={
          <>
            {slug && <Button startIcon={<LinkIcon />} onClick={copyLink} color="inherit">Copy link</Button>}
            <Button startIcon={<SettingsOutlinedIcon />} onClick={() => setSettingsOpen(true)} color="inherit">Settings</Button>
            <Button variant="contained" onClick={save} disabled={saving}>{saving ? "Saving…" : formId ? "Save changes" : "Create form"}</Button>
          </>
        }
      />

      {problems.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setProblems([])}>
          {problems.length === 1 ? problems[0] : (
            <Box component="ul" sx={{ m: 0, pl: 2 }}>{problems.map((p) => <li key={p}>{p}</li>)}</Box>
          )}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab value="build" label="Build" />
        <Tab value="preview" label="Preview" />
      </Tabs>

      {tab === "preview" ? (
        <Paper variant="outlined" sx={{ maxWidth: 760, mx: "auto", p: { xs: 2.5, sm: 5 } }}>
          <Typography variant="h1" sx={{ mb: 1 }}>{settings.title || "Untitled form"}</Typography>
          {settings.description && <Typography color="text.secondary" sx={{ mb: 2, whiteSpace: "pre-line" }}>{settings.description}</Typography>}
          {previewFields.length ? (
            <FormRenderer key={JSON.stringify(previewFields)} fields={previewFields} preview submitLabel="Check answers" />
          ) : (
            <Typography color="text.secondary">Add fields to see the preview.</Typography>
          )}
        </Paper>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragType(null)}>
          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "230px minmax(0, 1fr) 340px" }, alignItems: "start" }}>
            <Box sx={{ position: { lg: "sticky" }, top: 24 }}>
              <FieldPalette onAdd={(t) => insertField(t)} />
            </Box>

            <BuilderCanvas
              title={settings.title}
              description={settings.description ?? ""}
              onTitle={(title) => { setSettings((s) => ({ ...s, title })); touch(); }}
              onDescription={(description) => { setSettings((s) => ({ ...s, description })); touch(); }}
              fields={fields}
              selectedUid={selected}
              onSelect={setSelected}
              onDuplicate={(uid) => {
                const src = fields.find((f) => f.uid === uid);
                if (!src) return;
                const copy = duplicateField(src, fields);
                setFields((prev) => {
                  const i = prev.findIndex((f) => f.uid === uid);
                  const next = [...prev];
                  next.splice(i + 1, 0, copy);
                  return next;
                });
                setSelected(copy.uid);
                touch();
              }}
              onDelete={deleteField}
              paletteDragging={dragType !== null}
            />

            <Paper variant="outlined" sx={{ p: 2.5, position: { lg: "sticky" }, top: 24, maxHeight: { lg: "calc(100vh - 48px)" }, overflowY: "auto" }}>
              {selectedField ? (
                <FieldProperties key={selectedField.uid} field={selectedField} all={fields} onChange={(patch) => updateField(selectedField.uid, patch)} />
              ) : (
                <Box>
                  <Typography variant="h6" component="h2">Field settings</Typography>
                  <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 1 }}>
                    Select a field on the form to edit its label, validation and when it is shown.
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 1.5 }}>
                    {fields.length} {fields.length === 1 ? "field" : "fields"}, {fields.filter((f) => f.is_required).length} required, {fields.filter((f) => f.visibility_rules).length} shown conditionally.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
          <DragOverlay dropAnimation={null}>
            {dragType ? <Box sx={{ width: 220, borderLeft: `3px solid ${tokens.highlighter}`, borderRadius: 1.5 }}><PaletteTile meta={fieldMeta(dragType)} dragging /></Box> : null}
          </DragOverlay>
        </DndContext>
      )}

      <FormSettingsDialog open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onApply={(s) => { setSettings(s); touch(); }} />
    </Box>
  );
}
