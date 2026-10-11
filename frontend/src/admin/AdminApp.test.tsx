import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminApp from "./AdminApp";
import { jsonResponse, stubFetch } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminApp", () => {
  it("menampilkan panduan sudo ketika belum login", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ message: "Unauthenticated." }, 401)));
    render(<AdminApp />);

    expect(await screen.findByText(/Belum login sebagai admin/)).toBeInTheDocument();
    expect(screen.getByText("sudo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /kembali ke terminal/ })).toHaveAttribute("href", "/");
  });

  it("menampilkan panel dengan menu setelah login", async () => {
    stubFetch((url) => {
      const u = String(url);
      if (u.endsWith("/admin/me")) {
        return Promise.resolve(jsonResponse({ data: { name: "Administrator", email: "admin@x.local" } }));
      }
      if (u.includes("/admin/profile")) {
        return Promise.resolve(
          jsonResponse({
            data: {
              name: "Imam",
              role: "Fullstack",
              tagline: null,
              bio: "Bio",
              email: null,
              github_url: null,
              linkedin_url: null,
              resume_url: null,
              website_url: null,
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ data: [] }));
    });

    render(<AdminApp />);

    expect(await screen.findByText("admin panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("Pesan Kontak")).toBeInTheDocument();
    expect(screen.getByText("logout")).toBeInTheDocument();
  });
});
