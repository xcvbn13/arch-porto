import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminApp from "./AdminApp";
import { jsonResponse, stubFetch } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminApp — alur save Fetch Info", () => {
  it("simpan baris baru memanggil POST dan menampilkan pesan sukses", async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    stubFetch((url, init) => {
      const u = String(url);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: u, method: init?.method ?? "GET", body });
      if (u.endsWith("/admin/me")) {
        return Promise.resolve(jsonResponse({ data: { name: "Root", email: "root@x" } }));
      }
      // Cek /admin/fetch LEBIH DULU — URL-nya juga berakhiran "/fetch"
      if (u.includes("/admin/fetch") && (init?.method === "GET" || !init?.method)) {
        return Promise.resolve(
          jsonResponse({ data: [{ id: 7, label: "Name", value: "Imam" }] }),
        );
      }
      if (u.includes("/admin/fetch") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({ data: { id: 1, label: body?.label, value: body?.value, sort_order: 0 } }, 201),
        );
      }
      if (u.includes("/admin/fetch") && init?.method === "PUT") {
        return Promise.resolve(jsonResponse({ data: { id: 7, label: body?.label, value: body?.value, sort_order: 0 } }));
      }
      if (u.endsWith("/fetch")) {
        return Promise.resolve(jsonResponse({ data: { entries: [], logo_url: null } }));
      }
      return Promise.resolve(jsonResponse({ data: [] }));
    });

    render(<AdminApp />);

    // Login terdeteksi → panel tampil
    await screen.findByText("admin panel");
    fireEvent.click(screen.getByText("Fetch Info"));

    fireEvent.click(screen.getByRole("button", { name: "+ Baris Baru" }));
    fireEvent.change(screen.getByLabelText(/Label/), { target: { value: "Hobi" } });
    fireEvent.change(screen.getByLabelText(/Value/), { target: { value: "Membaca" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(screen.getByText(/✓ Tersimpan/)).toBeInTheDocument());
    expect(calls.some((c) => c.method === "POST" && c.url.includes("/admin/fetch"))).toBe(true);
  });

  it("edit baris yang sudah ada memanggil PUT dengan id baris", async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    stubFetch((url, init) => {
      const u = String(url);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: u, method: init?.method ?? "GET", body });
      if (u.endsWith("/admin/me")) {
        return Promise.resolve(jsonResponse({ data: { name: "Root", email: "root@x" } }));
      }
      if (u.includes("/admin/fetch") && (init?.method === "GET" || !init?.method)) {
        return Promise.resolve(jsonResponse({ data: [{ id: 7, label: "Name", value: "Imam" }] }));
      }
      if (u.includes("/admin/fetch") && init?.method === "PUT") {
        return Promise.resolve(jsonResponse({ data: { id: 7, label: body?.label, value: body?.value, sort_order: 0 } }));
      }
      if (u.endsWith("/fetch")) {
        return Promise.resolve(jsonResponse({ data: { entries: [], logo_url: null } }));
      }
      return Promise.resolve(jsonResponse({ data: [] }));
    });

    render(<AdminApp />);
    await screen.findByText("admin panel");
    fireEvent.click(screen.getByText("Fetch Info"));

    // Klik baris yang ada → form terisi → ubah → Perbarui
    await waitFor(() => expect(screen.getByText(/Name: Imam/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Name: Imam/));
    fireEvent.change(screen.getByLabelText(/Value/), { target: { value: "Diedit" } });
    fireEvent.click(screen.getByRole("button", { name: "Perbarui" }));

    await waitFor(() => expect(screen.getByText(/✓ Tersimpan/)).toBeInTheDocument());
    expect(calls.some((c) => c.method === "PUT" && c.url.includes("/admin/fetch/7"))).toBe(true);
  });
});
