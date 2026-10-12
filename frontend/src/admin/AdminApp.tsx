import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../terminal/api";
import { THEME_PRESETS, type TerminalStyle } from "../terminal/style";

/**
 * Panel admin (/admin) — hanya terbuka setelah `sudo` sukses di terminal.
 * Sesi diperiksa lewat GET /api/v1/admin/me (cookie sesi httpOnly).
 * CRUD entitas portfolio + inbox pesan kontak + ganti password.
 */

interface AdminUser {
  name: string;
  email: string;
}

interface Field {
  key: string;
  label: string;
  type: "text" | "textarea" | "json" | "checkbox" | "number" | "select";
  /** Opsi untuk type "select". */
  options?: string[];
}

interface EntityConfig {
  label: string;
  listTitle: (row: Record<string, unknown>) => string;
  fields: Field[];
}

const ENTITIES: Record<string, EntityConfig> = {
  skills: {
    label: "Skills",
    listTitle: (r) => `${r.category}/${r.name}`,
    fields: [
      { key: "category", label: "Category", type: "text" },
      { key: "name", label: "Name", type: "text" },
      { key: "level", label: "Level", type: "select", options: ["Trainee", "Entry-Level", "Mid-Level", "Senior"] },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  projects: {
    label: "Projects",
    listTitle: (r) => String(r.title ?? r.id),
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "summary", label: "Summary", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "problem", label: "Problem solved", type: "textarea" },
      { key: "contribution", label: "My contribution", type: "textarea" },
      { key: "architecture", label: "Architecture", type: "textarea" },
      { key: "stack", label: 'Stack (JSON array, cth ["php","docker"])', type: "json" },
      { key: "repo_url", label: "Repository URL", type: "text" },
      { key: "demo_url", label: "Demo URL", type: "text" },
      { key: "metrics", label: 'Metrics (JSON object, cth {"latency":"10ms"})', type: "json" },
      { key: "year", label: "Year", type: "text" },
      { key: "featured", label: "Featured", type: "checkbox" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  experience: {
    label: "Experience",
    listTitle: (r) => `${r.role} @ ${r.company}`,
    fields: [
      { key: "company", label: "Company", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "period_start", label: "Period start", type: "text" },
      { key: "period_end", label: "Period end", type: "text" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "highlights", label: 'Highlights (JSON array, cth ["a","b"])', type: "json" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  education: {
    label: "Education",
    listTitle: (r) => `${r.degree} — ${r.institution}`,
    fields: [
      { key: "institution", label: "Institution", type: "text" },
      { key: "degree", label: "Degree", type: "text" },
      { key: "field", label: "Field", type: "text" },
      { key: "period_start", label: "Period start", type: "text" },
      { key: "period_end", label: "Period end", type: "text" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  certifications: {
    label: "Certifications",
    listTitle: (r) => String(r.name ?? r.id),
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "issuer", label: "Issuer", type: "text" },
      { key: "year", label: "Year", type: "text" },
      { key: "credential_url", label: "Credential URL", type: "text" },
    ],
  },
  publications: {
    label: "Publications",
    listTitle: (r) => String(r.title ?? r.id),
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "venue", label: "Venue", type: "text" },
      { key: "year", label: "Year", type: "text" },
      { key: "url", label: "URL", type: "text" },
      { key: "summary", label: "Summary", type: "textarea" },
    ],
  },
};

type Section = keyof typeof ENTITIES | "profile" | "messages" | "password" | "fetch" | "terminalstyle";

function useApi<T>(fn: () => Promise<T>): [T | null, boolean, string] {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // fn terbaru disimpan di ref: fetch selalu memakai fungsi terkini
  // (entitas aktif) tanpa memicu render loop.
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(() => {
    setLoading(true);
    setError("");
    fnRef
      .current()
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof ApiError ? e.message : "API error"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(run, [run]);
  return [data, loading, error];
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) return `${e.status}: ${e.message}`;
  return e instanceof Error ? e.message : "Terjadi kesalahan.";
}

/* ------------------------------------------------------------------ */

export default function AdminApp() {
  const [me, setMe] = useState<AdminUser | null | "loading">("loading");
  const [meError, setMeError] = useState("");

  useEffect(() => {
    api
      .get<AdminUser>("/admin/me")
      .then((u) => setMe(u))
      .catch((e) => {
        setMeError(errorText(e));
        setMe(null);
      });
  }, []);

  if (me === "loading") {
    return <Splash text="Memeriksa sesi admin…" />;
  }
  if (!me) {
    return (
      <Splash>
        <p className="mb-2 text-lg text-[--term-yellow]">Belum login sebagai admin.</p>
        <p className="mb-4 text-[--term-dim]">
          {meError || "Sesi tidak ditemukan."} Kembali ke terminal lalu jalankan{" "}
          <code className="text-[--term-green]">sudo</code> untuk login.
        </p>
        <a href="/" className="text-[--term-cyan] underline">
          → kembali ke terminal
        </a>
      </Splash>
    );
  }
  return <Panel me={me} />;
}

function Splash({ text, children }: { text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center font-mono">
        {text && <p className="mb-2 text-[--term-cyan]">{text}</p>}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Panel({ me }: { me: AdminUser }) {
  const [section, setSection] = useState<Section>("profile");

  const nav: [Section, string][] = [
    ["profile", "Profile"],
    ["fetch", "Fetch Info"],
    ["terminalstyle", "Terminal Style"],
    ["skills", "Skills"],
    ["projects", "Projects"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["certifications", "Certifications"],
    ["publications", "Publications"],
    ["messages", "Pesan Kontak"],
    ["password", "Password"],
  ];

  const logout = async () => {
    try {
      await api.post("/admin/logout", {});
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex h-full">
      <aside className="flex w-44 shrink-0 flex-col border-r border-[#1f2733] bg-[#0e1218] p-3">
        <div className="mb-3 border-b border-[#1f2733] pb-2 text-sm">
          <div className="text-[--term-green]">admin panel</div>
          <div className="truncate text-[--term-dim]" title={me.email}>
            {me.name}
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Menu admin">
          {nav.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`rounded px-2 py-1 text-left text-sm ${
                section === key
                  ? "bg-[#16202c] text-[--term-green]"
                  : "text-[--term-fg] hover:bg-[#141b25]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          onClick={logout}
          className="mt-auto rounded border border-[#2a313d] px-2 py-1 text-left text-sm text-[--term-red] hover:border-[--term-red]"
        >
          logout
        </button>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-4">
        {section === "profile" && <ProfileForm />}
        {section === "password" && <PasswordForm />}
        {section === "messages" && <MessagesView />}
        {section === "fetch" && <FetchSection />}
        {section === "terminalstyle" && <TerminalStyleSection />}
        {section in ENTITIES && (
          <EntityEditor key={section} entity={section as keyof typeof ENTITIES} />
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PROFILE_FIELDS: { key: string; label: string; type: Field["type"] }[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "tagline", label: "Tagline", type: "text" },
  { key: "bio", label: "Bio", type: "textarea" },
  { key: "email", label: "Email", type: "text" },
  { key: "github_url", label: "GitHub URL", type: "text" },
  { key: "linkedin_url", label: "LinkedIn URL", type: "text" },
  { key: "resume_url", label: "Resume URL", type: "text" },
  { key: "website_url", label: "Website URL", type: "text" },
];

interface AboutLayout {
  logo_width: number;
  logo_height: number;
  gap: number;
  font_size: number;
  line_height: number;
  text_width: number;
}

interface ProfileData {
  name: string;
  role: string;
  tagline: string | null;
  bio: string;
  email: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  website_url: string | null;
  avatar_url: string | null;
  about_layout?: AboutLayout | null;
}

function ProfileForm() {
  const [data] = useApi<ProfileData>(() => api.get("/profile"));
  const [form, setForm] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [aboutLayout, setAboutLayout] = useState<AboutLayout | null>(null);
  const [layoutMsg, setLayoutMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data) {
      const init: Record<string, string> = {};
      for (const f of PROFILE_FIELDS) init[f.key] = String((data as never)[f.key] ?? "");
      setForm(init);
      setAvatarUrl(data.avatar_url);
      setAboutLayout(data.about_layout ?? null);
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.put("/admin/profile", form);
      setMessage("✓ Profile tersimpan.");
    } catch (e) {
      setMessage(`✗ ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-3 text-lg text-[--term-green]">Profile</h1>
      <AvatarUploader url={avatarUrl} onChanged={setAvatarUrl} />
      {aboutLayout && (
        <div className="mb-3 rounded border border-[#1f2733] bg-[#0e1218] p-2">
          <p className="mb-2 text-sm text-[--term-dim]">
            Style foto & teks `about` (canvas foto kiri + teks kanan):
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {(
              [
                ["logo_width", "Lebar foto (40–480)"],
                ["logo_height", "Tinggi foto (40–480)"],
                ["gap", "Jarak ke teks (0–96)"],
                ["text_width", "Lebar teks (160–1000)"],
                ["font_size", "Font teks (9–28)"],
                ["line_height", "Jarak baris (10–48)"],
              ] as [keyof AboutLayout, string][]
            ).map(([key, hint]) => (
              <label key={key} className="flex items-center gap-1">
                <input
                  type="number"
                  value={aboutLayout[key]}
                  onChange={(e) =>
                    setAboutLayout({ ...aboutLayout, [key]: Number(e.target.value) || 0 })
                  }
                  className="field-input w-20 font-mono text-xs"
                  title={hint}
                />
                <span className="text-xs text-[--term-dim]">{hint.split(" (")[0]}</span>
              </label>
            ))}
            <button
              onClick={async () => {
                setLayoutMsg("");
                try {
                  await api.put("/admin/about-layout", aboutLayout);
                  setLayoutMsg("✓ Style about tersimpan.");
                } catch (e) {
                  setLayoutMsg(`✗ ${errorText(e)}`);
                }
              }}
              className="btn-primary"
            >
              Simpan Style About
            </button>
            <span className="text-xs text-[--term-dim]">{layoutMsg}</span>
          </div>
        </div>
      )}
      {form.name === undefined ? (
        <p className="text-[--term-dim]">memuat…</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {PROFILE_FIELDS.map((f) => (
            <FieldInput key={f.key} field={f} value={form[f.key] ?? ""} onChange={(v) => setForm({ ...form, [f.key]: v })} />
          ))}
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "menyimpan…" : "Simpan Profile"}
          </button>
          <p className="text-sm text-[--term-dim]">{message}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Upload avatar (multipart) — menggantikan isian URL.
 * Ditampilkan di terminal lewat command `about`.
 */
function AvatarUploader({
  url,
  onChanged,
}: {
  url: string | null;
  onChanged: (u: string | null) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/v1/admin/profile/avatar", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { data?: { avatar_url?: string }; message?: string } | null;
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      onChanged(json?.data?.avatar_url ?? null);
      setMessage("✓ Avatar di-upload.");
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "upload gagal"}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/v1/admin/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChanged(null);
      setMessage("✓ Avatar dihapus.");
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "gagal"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 flex items-center gap-3 rounded border border-[#1f2733] bg-[#0e1218] p-2">
      {url ? (
        <img src={url} alt="Avatar" className="h-16 w-16 rounded border border-[#1f2733] object-cover" />
      ) : (
        <div className="h-16 w-16 rounded border border-[#1f2733] bg-[#141b25]" title="Belum ada avatar" />
      )}
      <div className="flex flex-col gap-1 text-sm">
        <label className="text-[--term-dim]">
          Avatar (tampil di `about`) — PNG/JPG/WebP/GIF, maks 2 MB
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
            className="mt-1 block text-xs text-[--term-dim]"
          />
        </label>
        {url && (
          <button onClick={remove} disabled={busy} className="self-start text-xs text-[--term-red] hover:underline">
            hapus avatar
          </button>
        )}
        <span className="text-xs text-[--term-dim]">{message}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EntityEditor({ entity }: { entity: keyof typeof ENTITIES }) {
  const cfg = ENTITIES[entity];
  const [data, loading] = useApi<Record<string, unknown>[]>(() =>
    api.get<Record<string, unknown>[]>(`/admin/${entity}`),
  );
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | "new" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pendingCertFile, setPendingCertFile] = useState<File | null>(null);

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  useEffect(() => {
    if (editing === "new") {
      const init: Record<string, string> = {};
      for (const f of cfg.fields) init[f.key] = f.type === "checkbox" ? "" : "";
      setForm(init);
    } else if (editing) {
      const init: Record<string, string> = {};
      for (const f of cfg.fields) {
        const v = editing[f.key];
        if (f.type === "json") init[f.key] = v == null ? "" : JSON.stringify(v, null, 2);
        else if (f.type === "checkbox") init[f.key] = v ? "1" : "";
        else init[f.key] = v == null ? "" : String(v);
      }
      setForm(init);
    }
    setMessage("");
    setPendingCertFile(null);
  }, [editing, cfg]);

  const reload = () =>
    api.get<Record<string, unknown>[]>(`/admin/${entity}`).then(setRows);

  const buildPayload = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      const raw = (form[f.key] ?? "").trim();
      if (f.type === "checkbox") {
        out[f.key] = form[f.key] === "1";
      } else if (f.type === "number") {
        out[f.key] = raw === "" ? null : Number(raw);
      } else if (f.type === "json") {
        out[f.key] = raw === "" ? null : JSON.parse(raw);
      } else {
        out[f.key] = raw;
      }
    }
    return out;
  };

  const save = async () => {
    setMessage("");
    let payload: Record<string, unknown>;
    try {
      payload = buildPayload();
    } catch {
      setMessage("✗ JSON tidak valid — periksa formatnya.");
      return;
    }
    try {
      if (editing === "new") {
        const created = await api.post<{ id: number }>(`/admin/${entity}`, payload);
        // Sertifikat baru: langsung upload file bila dipilih
        if (entity === "certifications" && pendingCertFile) {
          try {
            const fd = new FormData();
            fd.append("file", pendingCertFile);
            await fetch(`/api/v1/admin/certifications/${created.id}/file`, {
              method: "POST",
              body: fd,
            });
            setPendingCertFile(null);
          } catch (fileErr) {
            setMessage(`✓ Tersimpan, tapi file gagal di-upload (${errorText(fileErr)}).`);
          }
        }
      } else if (editing) {
        await api.put(`/admin/${entity}/${String(editing.id)}`, payload);
      } else {
        return;
      }
      setEditing(null);
      await reload();
      if (!message) setMessage("✓ Tersimpan.");
    } catch (e) {
      setMessage(`✗ ${errorText(e)}`);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm(`Hapus ${cfg.label} #${id}?`)) return;
    try {
      await api.delete(`/admin/${entity}/${id}`);
      await reload();
      setMessage("✓ Dihapus.");
    } catch (e) {
      setMessage(`✗ ${errorText(e)}`);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-3 text-lg text-[--term-green]">{cfg.label}</h1>
      {entity === "projects" && <ProjectsLayoutBlock />}
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setEditing("new")} className="btn-primary">
          + Baru
        </button>
        <span className="text-sm text-[--term-dim]">{message}</span>
      </div>

      {editing ? (
        <div className="mb-4 rounded border border-[#1f2733] bg-[#0e1218] p-3">
          <div className="flex flex-col gap-2">
            {cfg.fields.map((f) => (
              <FieldInput key={f.key} field={f} value={form[f.key] ?? ""} onChange={(v) => setForm({ ...form, [f.key]: v })} />
            ))}
          </div>
          {entity === "projects" && editing !== "new" && editing.id != null && (
            <ScreenshotsUploader
              projectId={Number(editing.id)}
              screenshots={(editing.screenshots as string[]) ?? []}
              onChange={(list) => setEditing({ ...editing, screenshots: list })}
            />
          )}
          {entity === "projects" && editing === "new" && (
            <p className="mt-2 text-xs text-[--term-dim]">
              Screenshot bisa di-upload setelah proyek disimpan.
            </p>
          )}
          {entity === "certifications" && editing === "new" && (
            <div className="mt-3 border-t border-[#1f2733] pt-2">
              <p className="mb-1 text-sm text-[--term-dim]">
                File sertifikat (PDF/JPG/PNG ≤5 MB) — di-upload saat Simpan:
              </p>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={(e) => setPendingCertFile(e.target.files?.[0] ?? null)}
                className="text-xs text-[--term-dim]"
              />
              {pendingCertFile && (
                <span className="ml-2 text-xs text-[--term-green]">
                  ✓ {pendingCertFile.name}
                </span>
              )}
            </div>
          )}
          {entity === "certifications" && editing !== "new" && editing.id != null && (
            <CertificationFileUploader
              certificationId={Number(editing.id)}
              fileUrl={(editing.file_url as string | null) ?? null}
              onChange={(url) => setEditing({ ...editing, file_url: url })}
            />
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="btn-primary">
              {editing === "new" ? "Simpan" : "Perbarui"}
            </button>
            <button onClick={() => setEditing(null)} className="btn-ghost">
              Batal
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[--term-dim]">memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-[--term-dim]">Belum ada data.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={String(r.id)} className="flex items-center gap-2 rounded border border-[#1f2733] px-2 py-1">
              <button className="flex-1 truncate text-left text-sm hover:text-[--term-green]" onClick={() => setEditing(r)}>
                #{String(r.id)} — {cfg.listTitle(r)}
              </button>
              <button className="text-xs text-[--term-red] hover:underline" onClick={() => remove(Number(r.id))}>
                hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MessagesView() {
  const [data, loading] = useApi<{ data: { id: number; name: string; email: string; message: string; created_at: string }[]; meta: { total: number } }>(() =>
    api.get("/admin/contact-messages"),
  );
  const [rows, setRows] = useState(data?.data ?? []);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data) setRows(data.data);
  }, [data]);

  const remove = async (id: number) => {
    if (!window.confirm("Hapus pesan ini?")) return;
    try {
      await api.delete(`/admin/contact-messages/${id}`);
      setRows(rows.filter((r) => r.id !== id));
      setMessage("✓ Dihapus.");
    } catch (e) {
      setMessage(`✗ ${errorText(e)}`);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-lg text-[--term-green]">Pesan Kontak</h1>
      <p className="mb-3 text-sm text-[--term-dim]">
        {data ? `${data.meta.total} pesan total.` : ""} {message}
      </p>
      {loading ? (
        <p className="text-[--term-dim]">memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-[--term-dim]">Belum ada pesan.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded border border-[#1f2733] bg-[#0e1218] p-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm text-[--term-fg]">{r.name}</span>{" "}
                  <span className="text-xs text-[--term-cyan]">{r.email}</span>{" "}
                  <span className="text-xs text-[--term-dim]">{r.created_at}</span>
                </div>
                <button className="text-xs text-[--term-red] hover:underline" onClick={() => remove(r.id)}>
                  hapus
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[--term-fg]">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface FetchRow {
  id?: number;
  label: string;
  value: string;
  sort_order?: number;
}

interface FetchData {
  entries: FetchRow[];
  logo_url: string | null;
  layout: {
    logo_width: number;
    logo_height: number;
    gap: number;
    font_size: number;
    line_height: number;
    text_width: number;
  };
}

/**
 * Section "Fetch Info": baris komponen blok fetch (tambah/edit/hapus)
 * + logo gambar (upload, kosong → ASCII default di frontend).
 */
function FetchSection() {
  // Daftar baris dari endpoint ADMIN (menyertakan id) — endpoint publik
  // /fetch sengaja tanpa id (hanya untuk terminal).
  const [rowsData, loading] = useApi<FetchRow[]>(() => api.get("/admin/fetch"));
  const [rows, setRows] = useState<FetchRow[]>([]);
  const [editing, setEditing] = useState<FetchRow | "new" | null>(null);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [layout, setLayout] = useState<FetchData["layout"] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (rowsData) setRows(rowsData);
  }, [rowsData]);

  useEffect(() => {
    // Logo + layout dari endpoint publik /fetch (satu-satunya kebutuhan non-id)
    api
      .get<FetchData>("/fetch")
      .then((d) => {
        setLogoUrl(d.logo_url);
        setLayout(d.layout);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editing === "new") {
      setLabel("");
      setValue("");
    } else if (editing) {
      setLabel(editing.label);
      setValue(editing.value);
    }
    setMessage("");
  }, [editing]);

  const reload = () => api.get<FetchRow[]>("/admin/fetch").then(setRows);

  const save = async () => {
    if (!label.trim() || !value.trim()) {
      setMessage("✗ Label dan Value wajib diisi.");
      return;
    }
    if (editing !== "new" && editing?.id == null) {
      setMessage("✗ Baris tidak punya ID — muat ulang halaman lalu coba lagi.");
      return;
    }
    try {
      const payload = { label: label.trim(), value: value.trim() };
      if (editing === "new") {
        await api.post("/admin/fetch", payload);
      } else if (editing?.id != null) {
        await api.put(`/admin/fetch/${editing.id}`, payload);
      }
      setEditing(null);
      await reload();
      setMessage("✓ Tersimpan.");
    } catch (e) {
      setMessage(`✗ ${errorText(e)}`);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm(`Hapus baris #${id}?`)) return;
    try {
      await api.delete(`/admin/fetch/${id}`);
      await reload();
      setMessage("✓ Dihapus.");
    } catch (e) {
      setMessage(`✗ ${errorText(e)}`);
    }
  };

  const uploadLogo = async (file: File) => {
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/v1/admin/profile/fetch-logo", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { data?: { logo_url?: string }; message?: string } | null;
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      setLogoUrl(json?.data?.logo_url ?? null);
      setMessage("✓ Logo di-upload.");
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "upload gagal"}`);
    }
  };

  const deleteLogo = async () => {
    setMessage("");
    try {
      const res = await fetch("/api/v1/admin/profile/fetch-logo", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLogoUrl(null);
      setMessage("✓ Logo dihapus (ASCII default aktif).");
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "gagal"}`);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-lg text-[--term-green]">Fetch Info</h1>
      <p className="mb-3 text-sm text-[--term-dim]">
        Komponen di sisi kanan blok fastfetch/neofetch/banner. Logo kosong = ASCII art default.
      </p>

      <div className="mb-3 flex items-center gap-3 rounded border border-[#1f2733] bg-[#0e1218] p-2">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo fetch" className="h-16 w-16 rounded border border-[#1f2733] object-contain" />
        ) : (
          <div className="h-16 w-16 rounded border border-[#1f2733] bg-[#141b25]" title="ASCII default" />
        )}
        <div className="flex flex-col gap-1 text-sm">
          <label className="text-[--term-dim]">
            Logo (PNG/JPG/WebP/GIF, maks 5 MB)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLogo(f);
              }}
              className="mt-1 block text-xs text-[--term-dim]"
            />
          </label>
          {logoUrl && (
            <button onClick={deleteLogo} className="self-start text-xs text-[--term-red] hover:underline">
              hapus logo
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 rounded border border-[#1f2733] bg-[#0e1218] p-2">
        <p className="mb-2 text-sm text-[--term-dim]">Layout welcome (ukuran logo & jarak ke teks):</p>
        {layout ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {(
              [
                ["logo_width", "Lebar logo (40–480)"],
                ["logo_height", "Tinggi logo (40–480)"],
                ["gap", "Jarak ke teks (0–96)"],
                ["text_width", "Lebar teks (160–600)"],
                ["font_size", "Font teks (9–28)"],
                ["line_height", "Jarak baris (10–48)"],
              ] as [keyof FetchData["layout"], string][]
            ).map(([key, hint]) => (
              <label key={key} className="flex items-center gap-1">
                <input
                  type="number"
                  value={layout[key]}
                  onChange={(e) =>
                    setLayout({ ...layout, [key]: Number(e.target.value) || 0 })
                  }
                  className="field-input w-20 font-mono text-xs"
                  title={hint}
                />
                <span className="text-xs text-[--term-dim]">{hint.split(" (")[0]}</span>
              </label>
            ))}
            <button
              onClick={async () => {
                setMessage("");
                try {
                  await api.put("/admin/fetch-layout", layout);
                  setMessage("✓ Layout tersimpan.");
                } catch (e) {
                  setMessage(`✗ ${errorText(e)}`);
                }
              }}
              className="btn-primary"
            >
              Simpan Layout
            </button>
          </div>
        ) : (
          <p className="text-xs text-[--term-dim]">memuat…</p>
        )}
      </div>

      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setEditing("new")} className="btn-primary">
          + Baris Baru
        </button>
        <span className="text-sm text-[--term-dim]">{message}</span>
      </div>

      {editing ? (
        <div className="mb-4 rounded border border-[#1f2733] bg-[#0e1218] p-3">
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-[--term-dim]">Label (kiri, mis. "Name")</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="field-input font-mono" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[--term-dim]">Value (kanan, mis. "Imam Yabunaiya Ramadhani")</span>
              <input value={value} onChange={(e) => setValue(e.target.value)} className="field-input font-mono" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="btn-primary">
              {editing === "new" ? "Simpan" : "Perbarui"}
            </button>
            <button onClick={() => setEditing(null)} className="btn-ghost">
              Batal
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[--term-dim]">memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-[--term-dim]">Belum ada baris.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded border border-[#1f2733] px-2 py-1">
              <button className="flex-1 truncate text-left text-sm hover:text-[--term-green]" onClick={() => setEditing(r)}>
                {r.label}: {r.value}
              </button>
              <button className="text-xs text-[--term-red] hover:underline" onClick={() => r.id != null && remove(r.id)}>
                hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Section "Terminal Style": warna/ukuran terminal + prompt shell.
 * Tersimpan di DB; frontend menerapkan live ke xterm, bridge ke prompt bash.
 */
function TerminalStyleSection() {
  const [data] = useApi<TerminalStyle>(() => api.get("/terminal-style"));
  const [style, setStyle] = useState<TerminalStyle | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (data) setStyle(data);
  }, [data]);

  const patch = (key: keyof TerminalStyle, value: string | number | boolean) => {
    setStyle((s) => (s ? { ...s, [key]: value } : s));
  };

  const save = async () => {
    if (!style) return;
    setMessage("");
    try {
      await api.put("/admin/terminal-style", style);
      setMessage("✓ Tersimpan — berlaku untuk terminal dan prompt shell (sesi baru).");
    } catch (e) {
      setMessage(`✗ ${errorText(e)}`);
    }
  };

  if (!style) {
    return <p className="text-[--term-dim]">memuat…</p>;
  }

  const colors: [keyof TerminalStyle, string][] = [
    ["background", "Background"],
    ["foreground", "Foreground"],
    ["accent", "Accent (hijau/utama)"],
    ["cursor", "Cursor"],
  ];

  return (
    <div className="max-w-md">
      <h1 className="mb-1 text-lg text-[--term-green]">Terminal Style</h1>
      <p className="mb-3 text-sm text-[--term-dim]">
        Berlaku langsung untuk terminal; prompt shell mengikuti warna accent pada sesi baru.
      </p>
      <div className="mb-3 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <select
            value=""
            onChange={(e) => {
              const preset = THEME_PRESETS[e.target.value];
              if (preset && style) setStyle({ ...style, ...preset });
            }}
            className="field-input w-56 font-mono text-xs"
          >
            <option value="">— pilih preset tema —</option>
            {Object.keys(THEME_PRESETS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <span className="text-[--term-dim]">Preset sekali-klik</span>
        </label>
        {colors.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="color"
              value={String(style[key])}
              onChange={(e) => patch(key, e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-[#1f2733] bg-[#0c0f14]"
            />
            <span className="w-28 text-[--term-dim]">{label}</span>
            <input
              type="text"
              value={String(style[key])}
              onChange={(e) => patch(key, e.target.value)}
              className="field-input w-24 font-mono text-xs"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min={11}
            max={22}
            value={style.font_size}
            onChange={(e) => patch("font_size", Number(e.target.value) || 14)}
            className="field-input w-20 font-mono"
          />
          <span className="text-[--term-dim]">Font size (11–22)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <select
            value={style.font_family}
            onChange={(e) => patch("font_family", e.target.value)}
            className="field-input w-56 font-mono text-xs"
          >
            {["JetBrains Mono", "Fira Code", "ui-monospace", "Menlo", "Consolas", "monospace"].map(
              (f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ),
            )}
          </select>
          <span className="text-[--term-dim]">Font family</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <select
            value={style.font_weight}
            onChange={(e) => patch("font_weight", e.target.value)}
            className="field-input w-28 font-mono text-xs"
          >
            {["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"].map(
              (w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ),
            )}
          </select>
          <span className="text-[--term-dim]">Font weight</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={style.letter_spacing}
            onChange={(e) => patch("letter_spacing", Number(e.target.value) || 0)}
            className="field-input w-20 font-mono"
          />
          <span className="text-[--term-dim]">Letter spacing (0–10 px)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min={0.9}
            max={2}
            step={0.1}
            value={style.line_height}
            onChange={(e) => patch("line_height", Number(e.target.value) || 1)}
            className="field-input w-20 font-mono"
          />
          <span className="text-[--term-dim]">Line height (0.9–2.0)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min={0}
            max={48}
            value={style.padding}
            onChange={(e) => patch("padding", Number(e.target.value) || 0)}
            className="field-input w-20 font-mono"
          />
          <span className="text-[--term-dim]">Padding (0–48 px)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <select
            value={style.cursor_style}
            onChange={(e) => patch("cursor_style", e.target.value)}
            className="field-input w-28 font-mono text-xs"
          >
            {["block", "bar", "underline"].map((cs) => (
              <option key={cs} value={cs}>
                {cs}
              </option>
            ))}
          </select>
          <span className="text-[--term-dim]">Cursor style</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="color"
            value={style.selection_color}
            onChange={(e) => patch("selection_color", e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-[#1f2733] bg-[#0c0f14]"
          />
          <span className="w-28 text-[--term-dim]">Selection color</span>
          <input
            type="text"
            value={style.selection_color}
            onChange={(e) => patch("selection_color", e.target.value)}
            className="field-input w-24 font-mono text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={style.blink}
            onChange={(e) => patch("blink", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-[--term-dim]">Cursor berkedip</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="range"
            min={0.6}
            max={1}
            step={0.05}
            value={style.opacity}
            onChange={(e) => patch("opacity", Number(e.target.value))}
            className="w-40"
          />
          <span className="text-[--term-dim]">Opacity (glass): {Math.round(style.opacity * 100)}%</span>
        </label>
      </div>
      <button onClick={save} className="btn-primary">
        Simpan Style
      </button>
      <p className="mt-2 text-sm text-[--term-dim]">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.put("/admin/password", {
        current_password: current,
        new_password: next,
        new_password_confirmation: confirm,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage("✓ Password diganti.");
    } catch (e) {
      setMessage(`✗ ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="mb-3 text-lg text-[--term-green]">Ganti Password</h1>
      <div className="flex flex-col gap-2">
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Password saat ini" className="field-input" autoComplete="current-password" />
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Password baru (min. 8 karakter)" className="field-input" autoComplete="new-password" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi password baru" className="field-input" autoComplete="new-password" />
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "menyimpan…" : "Ganti Password"}
        </button>
        <p className="text-sm text-[--term-dim]">{message}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

interface ProjectsLayout {
  logo_width: number;
  logo_height: number;
  gap: number;
  shot_gap: number;
  font_size: number;
  line_height: number;
  text_width: number;
}

/** Style gambar detail project (canvas screenshot kiri + teks kanan). */
function ProjectsLayoutBlock() {
  const [layout, setLayout] = useState<ProjectsLayout | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api
      .get<ProjectsLayout>("/projects-layout")
      .then(setLayout)
      .catch(() => {});
  }, []);

  if (!layout) return null;

  const fields: [keyof ProjectsLayout, string][] = [
    ["logo_width", "Lebar gambar (40–480)"],
    ["logo_height", "Tinggi gambar (40–480)"],
    ["gap", "Jarak ke teks (0–96)"],
    ["shot_gap", "Jarak antar screenshot (0–48)"],
    ["font_size", "Font teks (9–28)"],
    ["line_height", "Jarak baris (10–48)"],
    ["text_width", "Lebar teks (160–1000)"],
  ];

  return (
    <div className="mb-3 rounded border border-[#1f2733] bg-[#0e1218] p-2">
      <p className="mb-2 text-sm text-[--term-dim]">
        Style gambar detail project (canvas screenshot kiri + detail kanan):
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {fields.map(([key, hint]) => (
          <label key={key} className="flex items-center gap-1">
            <input
              type="number"
              value={layout[key]}
              onChange={(e) => setLayout({ ...layout, [key]: Number(e.target.value) || 0 })}
              className="field-input w-20 font-mono text-xs"
              title={hint}
            />
            <span className="text-xs text-[--term-dim]">{hint.split(" (")[0]}</span>
          </label>
        ))}
        <button
          onClick={async () => {
            setMsg("");
            try {
              await api.put("/admin/projects-layout", layout);
              setMsg("✓ Style project tersimpan.");
            } catch (e) {
              setMsg(`✗ ${errorText(e)}`);
            }
          }}
          className="btn-primary"
        >
          Simpan Style Project
        </button>
        <span className="text-xs text-[--term-dim]">{msg}</span>
      </div>
    </div>
  );
}

/** Upload/hapus screenshot proyek (multipart). */
function ScreenshotsUploader({
  projectId,
  screenshots,
  onChange,
}: {
  projectId: number;
  screenshots: string[];
  onChange: (list: string[]) => void;
}) {
  const [message, setMessage] = useState("");

  const upload = async (file: File) => {
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("screenshot", file);
      const res = await fetch(`/api/v1/admin/projects/${projectId}/screenshots`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => null)) as { data?: string[]; message?: string } | null;
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      onChange(json?.data ?? []);
      setMessage("✓ Screenshot di-upload.");
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "upload gagal"}`);
    }
  };

  const remove = async (url: string) => {
    const name = url.split("/").pop() ?? "";
    setMessage("");
    try {
      const res = await fetch(
        `/api/v1/admin/projects/${projectId}/screenshots/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      const json = (await res.json().catch(() => null)) as { data?: string[]; message?: string } | null;
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      onChange(json?.data ?? []);
      setMessage("✓ Screenshot dihapus.");
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "gagal"}`);
    }
  };

  return (
    <div className="mt-3 border-t border-[#1f2733] pt-2">
      <p className="mb-1 text-sm text-[--term-dim]">Screenshots (upload file):</p>
      {screenshots.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {screenshots.map((u) => (
            <span key={u} className="relative">
              <a href={u} target="_blank" rel="noopener noreferrer">
                <img src={u} alt="screenshot" className="h-16 w-24 rounded border border-[#1f2733] object-cover" />
              </a>
              <button
                onClick={() => remove(u)}
                className="absolute -right-1 -top-1 rounded bg-[#0c0f14] px-1 text-xs text-[--term-red]"
                aria-label="Hapus screenshot"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <label className="text-xs text-[--term-dim]">
        Tambah (PNG/JPG/WebP/GIF ≤5 MB)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
          className="mt-1 block text-xs"
        />
      </label>
      <span className="ml-2 text-xs text-[--term-dim]">{message}</span>
    </div>
  );
}

/** Upload/hapus file sertifikat (PDF/gambar). */
function CertificationFileUploader({
  certificationId,
  fileUrl,
  onChange,
}: {
  certificationId: number;
  fileUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const [message, setMessage] = useState("");

  const upload = async (file: File) => {
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/v1/admin/certifications/${certificationId}/file`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { file_url?: string };
        message?: string;
      } | null;
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      onChange(json?.data?.file_url ?? null);
      setMessage("✓ File sertifikat di-upload.");
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "upload gagal"}`);
    }
  };

  const remove = async () => {
    setMessage("");
    try {
      const res = await fetch(`/api/v1/admin/certifications/${certificationId}/file`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChange(null);
      setMessage("✓ File dihapus.");
    } catch (e) {
      setMessage(`✗ ${e instanceof Error ? e.message : "gagal"}`);
    }
  };

  return (
    <div className="mt-3 border-t border-[#1f2733] pt-2">
      <p className="mb-1 text-sm text-[--term-dim]">File sertifikat (PDF/JPG/PNG ≤5 MB):</p>
      <div className="flex items-center gap-2">
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[--term-cyan] hover:underline"
          >
            ↗ buka file
          </a>
        ) : (
          <span className="text-xs text-[--term-dim]">belum ada file</span>
        )}
        <label className="text-xs text-[--term-dim]">
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
            className="text-xs"
          />
        </label>
        {fileUrl && (
          <button onClick={remove} className="text-xs text-[--term-red] hover:underline">
            hapus
          </button>
        )}
        <span className="text-xs text-[--term-dim]">{message}</span>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[--term-dim]">{field.label}</span>
      {field.type === "textarea" || field.type === "json" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={field.type === "json" ? 3 : 4}
          className="field-input font-mono"
        />
      ) : field.type === "checkbox" ? (
        <input type="checkbox" checked={value === "1"} onChange={(e) => onChange(e.target.checked ? "1" : "")} className="h-4 w-4 self-start" />
      ) : field.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-input font-mono"
        >
          <option value="">— tanpa level —</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-1">
          <input
            type={field.type === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="field-input font-mono"
          />
          {field.type === "text" && /^https?:\/\//i.test(value) && /url/i.test(field.key) && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[--term-cyan] hover:underline"
              title="Buka di tab baru"
            >
              ↗
            </a>
          )}
        </div>
      )}
    </label>
  );
}
