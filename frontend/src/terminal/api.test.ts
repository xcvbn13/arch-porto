import { describe, expect, it, vi, afterEach } from "vitest";
import { api, ApiError, NetworkError, memoPromise } from "./api";
import { jsonResponse, stubFetch } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("meng-unwrap envelope data", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ data: { hello: "world" } })));
    const res = await api.get<{ hello: string }>("/profile");
    expect(res).toEqual({ hello: "world" });
  });

  it("melempar ApiError dengan status untuk 4xx/5xx", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ message: "Bad." }, 422)));
    await expect(api.get("/x")).rejects.toThrow(ApiError);
    await expect(api.get("/x")).rejects.toMatchObject({ status: 422 });
  });

  it("melempar NetworkError ketika fetch gagal", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(api.get("/x")).rejects.toThrow(NetworkError);
  });

  it("mengambil pesan error dari body JSON", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({ message: "The given data was invalid.", errors: { name: ["Nama wajib diisi."] } }, 422),
      ),
    );
    await expect(api.post("/contact", {})).rejects.toThrow("Nama wajib diisi.");
  });

  it("mengirim header JSON pada POST", async () => {
    const fn = stubFetch(() => Promise.resolve(jsonResponse({ data: { ok: true } })));
    await api.post("/contact", { name: "a" });
    const [, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("mengikuti signal eksternal (Ctrl+C)", async () => {
    const ctrl = new AbortController();
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const p = api.get("/slow", ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toThrow(NetworkError);
  });
});

describe("memoPromise", () => {
  it("memanggil sekali dan berbagi hasil ke semua konsumen", async () => {
    const fn = vi.fn(() => Promise.resolve(42));
    const memo = memoPromise(fn);
    const [a, b] = await Promise.all([memo(), memo()]);
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("mereset setelah gagal sehingga panggilan berikutnya mencoba lagi", async () => {
    let n = 0;
    const memo = memoPromise(() => {
      n += 1;
      return n === 1 ? Promise.reject(new Error("boom")) : Promise.resolve(n);
    });
    await expect(memo()).rejects.toThrow("boom");
    await expect(memo()).resolves.toBe(2);
  });
});
