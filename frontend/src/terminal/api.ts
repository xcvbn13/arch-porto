/**
 * Klien REST API portfolio. Semua string dari API disanitasi (ANSI/control
 * chars dihapus) sebelum sampai ke konsumen.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api/v1";
const TIMEOUT_MS = 8000;

function clean(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  }
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}

function errorMessage(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (obj.errors && typeof obj.errors === "object") {
      const first = Object.values(obj.errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
    if (typeof obj.message === "string") return obj.message as string;
    if (typeof obj.error === "string") return obj.error as string;
  }
  return `Request failed (HTTP ${status}).`;
}

async function request<T>(
  path: string,
  init: RequestInit,
  external?: AbortSignal,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  external?.addEventListener("abort", onAbort);
  try {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal });
    } catch (e) {
      if (external?.aborted) throw new NetworkError("Cancelled.");
      throw new NetworkError("Cannot reach portfolio API. Is the backend running?");
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* body bukan JSON */
    }
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(json, res.status));
    }
    const cleaned = clean(json);
    return (cleaned as { data: T }).data;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  }
}

export interface ApiClient {
  get<T>(path: string, signal?: AbortSignal): Promise<T>;
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
  put<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
  delete<T>(path: string, signal?: AbortSignal): Promise<T>;
}

export const api: ApiClient = {
  get<T>(path: string, signal?: AbortSignal) {
    return request<T>(path, { method: "GET", headers: { Accept: "application/json" } }, signal);
  },
  post<T>(path: string, body: unknown, signal?: AbortSignal) {
    return request<T>(
      path,
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
  },
  put<T>(path: string, body: unknown, signal?: AbortSignal) {
    return request<T>(
      path,
      {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
  },
  delete<T>(path: string, signal?: AbortSignal) {
    return request<T>(path, { method: "DELETE", headers: { Accept: "application/json" } }, signal);
  },
};
