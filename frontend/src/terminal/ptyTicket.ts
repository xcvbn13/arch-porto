import type { ApiClient } from "./api";

/**
 * Tiket sesi PTY: pakai ulang tiket yang masih berlaku (sessionStorage)
 * saat reload — menghindari jebolnya rate limit/cap saat refresh beruntun.
 */
export async function mintOrReuse(
  api: ApiClient,
  storage: Pick<Storage, "getItem" | "setItem">,
  key = "pty_ticket",
): Promise<string> {
  const cached = storage.getItem(key);
  if (cached) {
    try {
      await api.get(`/pty/verify/${cached}`);
      return cached; // masih berlaku — reuse
    } catch {
      /* kedaluwarsa/tertolak → buat baru */
    }
  }
  const { ticket } = await api.post<{ ticket: string }>("/pty/sessions", {});
  storage.setItem(key, ticket);
  return ticket;
}
