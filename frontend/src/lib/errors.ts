import axios from "axios";

/** Turn any API error into one readable sentence. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Can't reach the server. Check that the backend is running.";
    const data = err.response.data as { detail?: unknown; errors?: unknown } | undefined;
    const detail = data?.detail;
    if (typeof detail === "string") {
      if (Array.isArray(data?.errors) && data.errors.length) return `${detail} ${(data.errors as string[]).join(" ")}`;
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg}`)
        .join("; ");
    }
  }
  return err instanceof Error ? err.message : fallback;
}

/** Per-field errors returned by the submission endpoint ({field_key: message}). */
export function fieldErrors(err: unknown): Record<string, string> | null {
  if (axios.isAxiosError(err) && err.response?.status === 422) {
    const errors = (err.response.data as { errors?: unknown })?.errors;
    if (errors && typeof errors === "object" && !Array.isArray(errors)) return errors as Record<string, string>;
  }
  return null;
}

export function statusOf(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}
