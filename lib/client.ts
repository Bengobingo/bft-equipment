import type { Locale } from "@/components/preferences";
export class RequestError extends Error {
  constructor(message: string, public loanId?: string) { super(message); }
}
export async function request<T = Record<string, unknown>>(path: string, locale: Locale, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    headers: { "Accept-Language": locale, ...(method === "GET" ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => { throw new Error(locale === "en" ? "Unexpected server response. Try again." : "伺服器回應異常，請稍後重試。"); }) as T & { error?: string; loanId?: string };
  if (!response.ok) throw new RequestError(result.error || (locale === "en" ? "The action failed." : "操作失敗。"), result.loanId);
  return result;
}
export function exportCsv(name: string, headers: string[], rows: unknown[][]) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const url = URL.createObjectURL(new Blob(["\uFEFF" + [headers, ...rows].map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name + ".csv"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
