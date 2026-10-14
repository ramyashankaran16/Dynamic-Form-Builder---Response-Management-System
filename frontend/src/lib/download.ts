import { api } from "../api/client";

function filenameFrom(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : fallback;
}

/** Download an authenticated file from the API and save it in the browser. */
export async function downloadFile(path: string, params: Record<string, unknown> = {}, fallbackName = "download") {
  const res = await api.get<Blob>(path, { params, responseType: "blob" });
  const name = filenameFrom(res.headers["content-disposition"] as string | undefined, fallbackName);
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
