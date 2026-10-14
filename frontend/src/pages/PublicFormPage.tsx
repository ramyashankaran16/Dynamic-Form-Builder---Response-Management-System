import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { Alert, Box, Button, Paper, Skeleton, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { publicApi } from "../api/endpoints";
import { BrandMark } from "../components/BrandMark";
import { FormRenderer } from "../components/renderer/FormRenderer";
import { useAuth } from "../context/AuthContext";
import { errorMessage, statusOf } from "../lib/errors";
import { tokens } from "../theme";
import type { PublicForm } from "../types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; form: PublicForm }
  | { kind: "login" }
  | { kind: "closed"; message: string }
  | { kind: "missing" }
  | { kind: "error"; message: string };

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        position: "relative", maxWidth: 720, mx: "auto", p: { xs: 3, sm: 6 }, pl: { xs: 4, sm: 8 }, borderRadius: 1,
        boxShadow: "0 1px 0 #E6EAEF, 0 18px 40px -24px rgba(29,43,58,0.3)",
        "&::before": { content: '""', position: "absolute", top: 0, bottom: 0, left: { xs: 16, sm: 40 }, width: "1px", bgcolor: tokens.marginRule },
      }}
    >
      {children}
    </Paper>
  );
}

export default function PublicFormPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [done, setDone] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    setState({ kind: "loading" });
    publicApi
      .get(slug)
      .then((form) => {
        setState({ kind: "ready", form });
        document.title = form.title;
      })
      .catch((err) => {
        const code = statusOf(err);
        if (code === 401) setState({ kind: "login" });
        else if (code === 403) setState({ kind: "closed", message: errorMessage(err) });
        else if (code === 404) setState({ kind: "missing" });
        else setState({ kind: "error", message: errorMessage(err) });
      });
    return () => {
      document.title = "Form Builder";
    };
  }, [slug, user]);

  const loginLink = `/login?redirect=${encodeURIComponent(`/f/${slug}`)}`;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: tokens.paper, py: { xs: 3, sm: 6 }, px: 2 }}>
      <Box sx={{ maxWidth: 720, mx: "auto", mb: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <RouterLinkBrand />
        {user ? (
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Responding as <strong>{user.full_name}</strong></Typography>
        ) : (
          <Button component={RouterLink} to={loginLink} size="small" color="inherit">Log in</Button>
        )}
      </Box>

      <Sheet>
        {state.kind === "loading" && (
          <>
            <Skeleton width="60%" height={48} />
            <Skeleton width="85%" />
            {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={64} sx={{ mt: 3 }} />)}
          </>
        )}

        {state.kind === "login" && (
          <Box>
            <Typography variant="h2" component="h1">Log in to open this form</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>The owner only accepts responses from people with an account.</Typography>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button variant="contained" component={RouterLink} to={loginLink}>Log in</Button>
              <Button component={RouterLink} to={`/register?redirect=${encodeURIComponent(`/f/${slug}`)}`}>Create an account</Button>
            </Box>
          </Box>
        )}

        {state.kind === "closed" && (
          <Box>
            <Typography variant="h2" component="h1">This form is closed</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>It isn't accepting responses right now. Contact the person who shared it if you think this is a mistake.</Typography>
          </Box>
        )}

        {state.kind === "missing" && (
          <Box>
            <Typography variant="h2" component="h1">Form not found</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Check the link. The form may have been deleted.</Typography>
          </Box>
        )}

        {state.kind === "error" && <Alert severity="error">{state.message}</Alert>}

        {state.kind === "ready" && (done ? (
          <Box sx={{ textAlign: "left" }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 44, color: "success.main" }} />
            <Typography variant="h2" component="h1" sx={{ mt: 1 }}>Response sent</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: "pre-line" }}>{done}</Typography>
            <Box sx={{ display: "flex", gap: 1.5, mt: 3, flexWrap: "wrap" }}>
              <Button variant="outlined" onClick={() => { setDone(null); setRound((r) => r + 1); }}>Submit another response</Button>
              {user && <Button component={RouterLink} to="/my-submissions">View my submissions</Button>}
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="h1">{state.form.title}</Typography>
            {state.form.description && <Typography color="text.secondary" sx={{ mt: 1.25, whiteSpace: "pre-line", maxWidth: "70ch" }}>{state.form.description}</Typography>}
            <Typography sx={{ fontSize: 13.5, color: "text.secondary", mt: 2, mb: 1 }}>
              <Box component="span" sx={{ color: "error.main" }}>*</Box> Required
            </Typography>
            <FormRenderer
              key={round}
              fields={state.form.fields}
              slug={slug}
              submitLabel="Submit response"
              onSubmit={async (answers) => {
                const res = await publicApi.submit(slug, answers);
                setDone(res.message);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </Box>
        ))}
      </Sheet>
    </Box>
  );
}

function RouterLinkBrand() {
  return (
    <Box component={RouterLink} to="/" sx={{ textDecoration: "none" }} aria-label="Form Builder home">
      <BrandMark />
    </Box>
  );
}
