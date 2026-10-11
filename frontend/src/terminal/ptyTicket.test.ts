import { describe, expect, it, vi } from "vitest";
import { mintOrReuse } from "./ptyTicket";

function fakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  };
}

describe("mintOrReuse (tiket PTY)", () => {
  it("menggunakan tiket lama yang masih valid tanpa POST", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true });
    const post = vi.fn();
    const api = { get, post, put: vi.fn(), delete: vi.fn() } as never;

    const ticket = await mintOrReuse(
      api as Parameters<typeof mintOrReuse>[0],
      fakeStorage({ pty_ticket: "cached-ticket" }),
    );
    expect(ticket).toBe("cached-ticket");
    expect(get).toHaveBeenCalledWith("/pty/verify/cached-ticket");
    expect(post).not.toHaveBeenCalled();
  });

  it("membuat tiket baru bila lama ditolak", async () => {
    const get = vi.fn().mockRejectedValue(new Error("404"));
    const post = vi.fn().mockResolvedValue({ ticket: "fresh-ticket" });
    const api = { get, post, put: vi.fn(), delete: vi.fn() } as never;
    const storage = fakeStorage({ pty_ticket: "expired" });

    const ticket = await mintOrReuse(
      api as Parameters<typeof mintOrReuse>[0],
      storage,
    );
    expect(ticket).toBe("fresh-ticket");
    expect(post).toHaveBeenCalledWith("/pty/sessions", {});
    expect(storage.getItem("pty_ticket")).toBe("fresh-ticket");
  });

  it("membuat tiket bila belum ada", async () => {
    const get = vi.fn();
    const post = vi.fn().mockResolvedValue({ ticket: "first" });
    const api = { get, post, put: vi.fn(), delete: vi.fn() } as never;

    const ticket = await mintOrReuse(
      api as Parameters<typeof mintOrReuse>[0],
      fakeStorage(),
    );
    expect(ticket).toBe("first");
    expect(get).not.toHaveBeenCalled();
  });
});
