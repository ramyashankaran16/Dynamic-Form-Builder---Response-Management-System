import { Dialog, DialogContent, DialogTitle, Typography } from "@mui/material";
import { responsesApi } from "../../api/endpoints";
import { useNotify } from "../../context/NotifyContext";
import type { FormField, FormResponse } from "../../types";
import { FormRenderer } from "../renderer/FormRenderer";

interface Props {
  response: FormResponse | null;
  fields: FormField[] | null;
  slug?: string;
  onClose: () => void;
  onSaved: (r: FormResponse) => void;
}

export function ResponseEditDialog({ response, fields, slug, onClose, onSaved }: Props) {
  const { notify } = useNotify();
  return (
    <Dialog open={!!response && !!fields} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>
        Edit response #{response?.id}
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          Saving creates version {(response?.version ?? 0) + 1}. The previous answers stay in the history.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {response && fields && (
          <FormRenderer
            fields={fields}
            slug={slug}
            initialAnswers={response.answers}
            submitLabel="Save changes"
            onCancel={onClose}
            onSubmit={async (answers) => {
              const updated = await responsesApi.update(response.id, answers);
              notify(updated.version === response.version ? "No changes to save." : "Response updated.", updated.version === response.version ? "info" : "success");
              onSaved(updated);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
