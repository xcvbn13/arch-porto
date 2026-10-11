import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminApp from "./AdminApp";
import { jsonResponse, stubFetch } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Regresi: berpindah tab antar entitas tidak boleh menampilkan baris
 * dari entitas sebelumnya (state/hook yang tidak ter-reset).
 */
describe("AdminApp — pindah tab entitas", () => {
  it("projects kosong tidak menampilkan baris hantu dari skills", async () => {
    stubFetch((url, init) => {
      const u = String(url);
      if (u.endsWith("/admin/me")) {
        return Promise.resolve(jsonResponse({ data: { name: "Root", email: "root@x" } }));
      }
      if (u.includes("/admin/skills") && (init?.method === "GET" || !init?.method)) {
        return Promise.resolve(
          jsonResponse({
            data: [
              { id: 1, category: "frontend", name: "React" },
              { id: 2, category: "frontend", name: "Vite" },
              { id: 3, category: "backend", name: "Laravel" },
            ],
          }),
        );
      }
      if (u.includes("/admin/projects") && (init?.method === "GET" || !init?.method)) {
        return Promise.resolve(jsonResponse({ data: [] }));
      }
      if (u.includes("/admin/profile") || u.endsWith("/fetch") || u.endsWith("/terminal-style")) {
        return Promise.resolve(jsonResponse({ data: [] }));
      }
      return Promise.resolve(jsonResponse({ data: [] }));
    });

    render(<AdminApp />);
    await screen.findByText("admin panel");

    // Buka Skills → 3 baris tampil
    fireEvent.click(screen.getByText("Skills"));
    await waitFor(() => expect(screen.getByText(/frontend\/React/)).toBeInTheDocument());
    expect(screen.getByText(/backend\/Laravel/)).toBeInTheDocument();

    // Pindah ke Projects → harus kosong, TANPA baris hantu
    fireEvent.click(screen.getByText("Projects"));
    await waitFor(() => expect(screen.getByText("Belum ada data.")).toBeInTheDocument());
    expect(screen.queryByText(/frontend\/React/)).not.toBeInTheDocument();
    expect(screen.queryByText(/backend\/Laravel/)).not.toBeInTheDocument();
  });
});
