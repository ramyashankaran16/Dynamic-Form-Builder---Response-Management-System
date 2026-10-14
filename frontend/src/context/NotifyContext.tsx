import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Severity = "success" | "error" | "info" | "warning";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}

interface NotifyContextValue {
  notify: (message: string, severity?: Severity) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotifyContext = createContext<NotifyContextValue | null>(null);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; severity: Severity; key: number } | null>(null);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const notify = useCallback((message: string, severity: Severity = "success") => {
    setToast({ message, severity, key: Date.now() });
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setDialog(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  };

  return (
    <NotifyContext.Provider value={{ notify, confirm }}>
      {children}
      <Snackbar
        key={toast?.key}
        open={!!toast}
        autoHideDuration={toast?.severity === "error" ? 7000 : 3500}
        onClose={(_, reason) => reason !== "clickaway" && setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast?.severity ?? "info"} variant="filled" onClose={() => setToast(null)} sx={{ maxWidth: 560 }}>
          {toast?.message}
        </Alert>
      </Snackbar>
      <Dialog open={!!dialog} onClose={() => close(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog?.title}</DialogTitle>
        {dialog?.message && (
          <DialogContent>
            <DialogContentText>{dialog.message}</DialogContentText>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => close(false)} color="inherit">Cancel</Button>
          <Button variant="contained" color={dialog?.danger ? "error" : "primary"} onClick={() => close(true)} autoFocus>
            {dialog?.confirmText ?? "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error("useNotify must be used inside NotifyProvider");
  return ctx;
}
