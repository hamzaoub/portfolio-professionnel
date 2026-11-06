import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiRequest,
  type DashboardProfile,
  type Education,
  type Experience,
  type PortfolioData,
  type Project,
  type SessionUser,
  type Skill,
} from "./api";
import CVBuilder from "./CVBuilder";

type Kind = "experiences" | "education" | "skills" | "projects";
type Item = (Experience | Education | Skill | Project) & Record<string, unknown>;
type Field = {
  name: string;
  label: string;
  type?: "text" | "url" | "date" | "number" | "textarea" | "list";
  required?: boolean;
};
type ResourceConfig = {
  key: Kind;
  title: string;
  titleField: string;
  subtitleFields: string[];
  fields: Field[];
};
type DashboardData = {
  profile: DashboardProfile;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
};

const resources: ResourceConfig[] = [
  {
    key: "experiences",
    title: "Experience",
    titleField: "position",
    subtitleFields: ["company"],
    fields: [
      { name: "position", label: "Position", required: true },
      { name: "company", label: "Company", required: true },
      { name: "company_url", label: "Company website", type: "url" },
      { name: "start_date", label: "Start date", type: "date" },
      { name: "end_date", label: "End date", type: "date" },
      { name: "description", label: "Description and achievements", type: "textarea" },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
  {
    key: "education",
    title: "Education",
    titleField: "degree",
    subtitleFields: ["school"],
    fields: [
      { name: "degree", label: "Degree", required: true },
      { name: "school", label: "School", required: true },
      { name: "start_date", label: "Start date", type: "date" },
      { name: "end_date", label: "End date", type: "date" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
  {
    key: "skills",
    title: "Skills",
    titleField: "name",
    subtitleFields: ["category", "level"],
    fields: [
      { name: "name", label: "Skill", required: true },
      { name: "category", label: "Category (language, framework, tool, soft skill)" },
      { name: "level", label: "Level (1–5)", type: "number" },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
  {
    key: "projects",
    title: "Projects",
    titleField: "title",
    subtitleFields: ["demo_url"],
    fields: [
      { name: "title", label: "Project title", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "technologies", label: "Technologies (comma separated)", type: "list" },
      { name: "repo_url", label: "Repository URL", type: "url" },
      { name: "demo_url", label: "Demo URL", type: "url" },
      { name: "image_url", label: "Image URL", type: "url" },
      { name: "sort_order", label: "Display order", type: "number" },
    ],
  },
];

const profileFields: Field[] = [
  { name: "full_name", label: "Full name", required: true },
  { name: "headline", label: "Professional title" },
  { name: "bio", label: "Biography", type: "textarea" },
  { name: "email", label: "Public contact email", type: "text" },
  { name: "phone", label: "Public contact phone" },
  { name: "city", label: "City" },
  { name: "linkedin_url", label: "LinkedIn URL", type: "url" },
  { name: "github_url", label: "GitHub URL", type: "url" },
  { name: "website_url", label: "Personal website", type: "url" },
  { name: "photo_url", label: "Profile image URL", type: "url" },
  { name: "slug", label: "Public URL slug", required: true },
];

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function makeForm(item: Item | null, config: ResourceConfig, defaultOrder: number): Record<string, string> {
  return Object.fromEntries(
    config.fields.map((field) => {
      const value = item?.[field.name];
      if (field.name === "sort_order" && value === undefined) return [field.name, String(defaultOrder)];
      return [field.name, field.type === "date" ? cleanValue(value).slice(0, 10) : cleanValue(value)];
    }),
  );
}

function makePayload(form: Record<string, string>, config: ResourceConfig): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of config.fields) {
    const value = form[field.name]?.trim() ?? "";
    if (field.type === "list") {
      payload[field.name] = value
        ? value
            .split(/[\n,]/)
            .map((part) => part.trim())
            .filter(Boolean)
        : null;
    } else if (field.type === "number") {
      payload[field.name] = value === "" ? (field.name === "sort_order" ? 0 : null) : Number(value);
    } else if (["url", "date", "textarea"].includes(field.type ?? "") && value === "") {
      payload[field.name] = null;
    } else {
      payload[field.name] = value;
    }
  }
  return payload;
}

function ResourceManager({
  config,
  items,
  onSave,
  onDelete,
  onReorder,
}: {
  config: ResourceConfig;
  items: Item[];
  onSave: (kind: Kind, id: number | null, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (kind: Kind, id: number) => Promise<void>;
  onReorder: (kind: Kind, reordered: Item[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function openEditor(item: Item | null) {
    setEditing(item);
    setAdding(item === null);
    setForm(makeForm(item, config, items.length));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(config.key, editing?.id ?? null, makePayload(form, config));
      setEditing(null);
      setAdding(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this item.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Item) {
    if (!window.confirm(`Delete “${cleanValue(item[config.titleField])}”?`)) return;
    setError("");
    try {
      await onDelete(config.key, item.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this item.");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    await onReorder(
      config.key,
      reordered.map((item, order) => ({ ...item, sort_order: order })),
    );
  }

  return (
    <section
      className="rounded border border-neutral-200 bg-white p-5"
      aria-labelledby={`resource-${config.key}`}
    >
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="text-sm text-neutral-500">Portfolio content</p>
          <h2 className="mt-1 text-xl font-semibold" id={`resource-${config.key}`}>
            {config.title}
          </h2>
        </div>
        <button
          className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
          type="button"
          onClick={() => openEditor(null)}
        >
          + Add
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 && !adding && (
        <p className="text-sm text-neutral-500">No {config.title.toLowerCase()} added yet.</p>
      )}
      <div className="divide-y divide-neutral-200">
        {items.map((item, index) => (
          <article
            className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
            key={item.id}
          >
            <div>
              <h3 className="font-medium">{cleanValue(item[config.titleField])}</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {config.subtitleFields
                  .map((field) => cleanValue(item[field]))
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 text-sm underline underline-offset-4"
                onClick={() => openEditor(item)}
              >
                Edit
              </button>
              <button
                type="button"
                className="px-2 py-1 text-sm text-red-700 underline underline-offset-4"
                onClick={() => void remove(item)}
              >
                Delete
              </button>
              <button
                type="button"
                className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:opacity-40"
                aria-label={`Move ${config.title.toLowerCase()} item up`}
                disabled={index === 0}
                onClick={() => void move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:opacity-40"
                aria-label={`Move ${config.title.toLowerCase()} item down`}
                disabled={index === items.length - 1}
                onClick={() => void move(index, 1)}
              >
                ↓
              </button>
            </div>
          </article>
        ))}
      </div>
      {(adding || editing) && (
        <form className="mt-4 border-t border-neutral-200 pt-4" onSubmit={submit}>
          <h3 className="mb-3 font-medium">
            {editing ? `Edit ${config.title.toLowerCase()}` : `Add ${config.title.toLowerCase()}`}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {config.fields.map((field) => (
              <label
                className={`block space-y-1 text-sm ${field.type === "textarea" ? "md:col-span-2" : ""}`}
                key={field.name}
              >
                {field.label}
                {field.type === "textarea" ? (
                  <textarea
                    className="w-full rounded border border-neutral-300 px-3 py-2"
                    maxLength={5000}
                    required={field.required}
                    value={form[field.name] ?? ""}
                    onChange={(event) => setForm((value) => ({ ...value, [field.name]: event.target.value }))}
                  />
                ) : (
                  <input
                    className="w-full rounded border border-neutral-300 px-3 py-2"
                    type={field.type === "list" ? "text" : (field.type ?? "text")}
                    min={field.name === "level" ? 1 : field.type === "number" ? 0 : undefined}
                    max={field.name === "level" ? 5 : undefined}
                    required={field.required}
                    value={form[field.name] ?? ""}
                    onChange={(event) => setForm((value) => ({ ...value, [field.name]: event.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
              type="submit"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save item"}
            </button>
            <button
              className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
              type="button"
              onClick={() => {
                setEditing(null);
                setAdding(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function Dashboard({ user, onLoggedOut }: { user: SessionUser; onLoggedOut: () => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const fetchDashboard = useCallback((): Promise<DashboardData> => {
    return Promise.all([
      apiRequest<{ profile: DashboardProfile }>("/api/profile"),
      apiRequest<{ items: Experience[] }>("/api/experiences"),
      apiRequest<{ items: Education[] }>("/api/education"),
      apiRequest<{ items: Skill[] }>("/api/skills"),
      apiRequest<{ items: Project[] }>("/api/projects"),
    ]).then(([profileResult, experiences, education, skills, projects]) => ({
      profile: profileResult.profile,
      experiences: experiences.items,
      education: education.items,
      skills: skills.items,
      projects: projects.items,
    }));
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setPageError("");
    try {
      setData(await fetchDashboard());
    } catch (reason) {
      setPageError(reason instanceof Error ? reason.message : "Your workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((dashboard) => {
        if (active) setData(dashboard);
      })
      .catch((reason: unknown) => {
        if (active)
          setPageError(reason instanceof Error ? reason.message : "Your workspace could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchDashboard]);

  useEffect(() => {
    document.title = `${data?.profile.full_name || user.full_name} — Portfolio Studio`;
    return () => {
      document.title = "Portfolio Studio";
    };
  }, [data?.profile.full_name, user.full_name]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const profile = data.profile;
    setProfileBusy(true);
    setProfileError("");
    setProfileMessage("");
    const nullableFields = [
      "headline",
      "bio",
      "email",
      "phone",
      "city",
      "linkedin_url",
      "github_url",
      "website_url",
      "photo_url",
    ] as const;
    const payload: Record<string, unknown> = {
      full_name: profile.full_name,
      slug: profile.slug,
      is_public: profile.is_public,
      allow_cv_download: profile.allow_cv_download,
    };
    for (const field of nullableFields)
      payload[field] = profile[field]?.trim() ? profile[field]!.trim() : null;
    try {
      const result = await apiRequest<{ profile: DashboardProfile }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setData((current) => (current ? { ...current, profile: result.profile } : current));
      setProfileMessage("Profile saved.");
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function saveContent(kind: Kind, id: number | null, payload: Record<string, unknown>) {
    const endpoint = `/api/${kind}${id ? `/${id}` : ""}`;
    const result = await apiRequest<{ item: Item }>(endpoint, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    setData((current) => {
      if (!current) return current;
      const updated = current[kind] as Item[];
      const next = id
        ? updated.map((item) => (item.id === id ? result.item : item))
        : [...updated, result.item];
      return { ...current, [kind]: next.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id) };
    });
  }

  async function deleteContent(kind: Kind, id: number) {
    await apiRequest(`/api/${kind}/${id}`, { method: "DELETE" });
    setData((current) =>
      current ? { ...current, [kind]: (current[kind] as Item[]).filter((item) => item.id !== id) } : current,
    );
  }

  async function reorderContent(kind: Kind, reordered: Item[]) {
    await Promise.all(
      reordered.map((item) =>
        apiRequest(`/api/${kind}/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({ sort_order: item.sort_order }),
        }),
      ),
    );
    setData((current) =>
      current ? { ...current, [kind]: reordered as DashboardData[typeof kind] } : current,
    );
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordMessage("");
    try {
      await apiRequest("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Password updated. Your other active sessions have been signed out.");
    } catch (reason) {
      setPasswordMessage(reason instanceof Error ? reason.message : "Could not update your password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function logout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      onLoggedOut();
      navigate("/login", { replace: true });
    }
  }

  async function deleteAccount() {
    setDeleteError("");
    if (!window.confirm("Delete this account and all of its portfolio data? This cannot be undone.")) return;
    try {
      await apiRequest("/api/auth/account", { method: "DELETE" });
      onLoggedOut();
      navigate("/register", { replace: true });
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "Could not delete your account.");
    }
  }

  const portfolio = useMemo<PortfolioData | null>(() => {
    if (!data) return null;
    const {
      account_email: _accountEmail,
      id: _id,
      is_public: _isPublic,
      allow_cv_download: _allowCvDownload,
      ...profile
    } = data.profile;
    return {
      profile,
      experiences: data.experiences,
      education: data.education,
      skills: data.skills,
      projects: data.projects,
    };
  }, [data]);

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-neutral-600" aria-live="polite">
        Loading your workspace…
      </main>
    );
  if (!data)
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center"
        role="alert"
      >
        <h1 className="text-2xl font-semibold">Workspace unavailable</h1>
        <p className="text-neutral-600">{pageError}</p>
        <button
          className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          onClick={() => void loadDashboard()}
        >
          Try again
        </button>
      </main>
    );

  const profile = data.profile;
  const updateProfileField = (name: string, value: string | boolean) =>
    setData((current) =>
      current ? { ...current, profile: { ...current.profile, [name]: value } } : current,
    );

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link className="font-semibold" to="/dashboard">
            <span>Portfolio Studio</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {profile.is_public && (
              <Link
                className="text-sm underline underline-offset-4"
                to={`/p/${profile.slug}`}
                target="_blank"
              >
                Open public portfolio ↗
              </Link>
            )}
            <button
              className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
              type="button"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-5 py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-neutral-500">Your private workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Welcome, {profile.full_name || user.full_name}
            </h1>
            <p className="mt-2 text-neutral-600">
              Manage the details visitors see and the content in your CV.
            </p>
          </div>
          <span
            className={`w-fit rounded border px-3 py-1 text-sm ${profile.is_public ? "border-green-300 text-green-800" : "border-neutral-300 text-neutral-600"}`}
          >
            {profile.is_public ? "Portfolio public" : "Portfolio private"}
          </span>
        </div>

        <section className="rounded border border-neutral-200 bg-white p-5" aria-labelledby="profile-heading">
          <div className="mb-4 flex flex-col justify-between gap-2 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-neutral-500">Account & visibility</p>
              <h2 className="mt-1 text-xl font-semibold" id="profile-heading">
                Profile
              </h2>
            </div>
            <span className="text-sm text-neutral-500">{profile.account_email}</span>
          </div>
          <form onSubmit={saveProfile}>
            <div className="grid gap-4 md:grid-cols-2">
              {profileFields.map((field) => (
                <label
                  className={`block space-y-1 text-sm ${field.type === "textarea" ? "md:col-span-2" : ""}`}
                  key={field.name}
                >
                  {field.label}
                  {field.type === "textarea" ? (
                    <textarea
                      className="w-full rounded border border-neutral-300 px-3 py-2"
                      maxLength={5000}
                      required={field.required}
                      value={cleanValue(profile[field.name as keyof DashboardProfile])}
                      onChange={(event) => updateProfileField(field.name, event.target.value)}
                    />
                  ) : (
                    <input
                      className="w-full rounded border border-neutral-300 px-3 py-2"
                      type={field.type ?? "text"}
                      maxLength={field.name === "full_name" ? 150 : field.name === "slug" ? 100 : undefined}
                      required={field.required}
                      value={cleanValue(profile[field.name as keyof DashboardProfile])}
                      onChange={(event) => updateProfileField(field.name, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="my-4 space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  className="mt-1 accent-black"
                  type="checkbox"
                  checked={profile.is_public}
                  onChange={(event) => updateProfileField("is_public", event.target.checked)}
                />
                <span>
                  <b className="block">Publish portfolio</b>
                  <small className="mt-1 block text-neutral-500">
                    Allow visitors to open /p/{profile.slug}.
                  </small>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  className="mt-1 accent-black"
                  type="checkbox"
                  checked={profile.allow_cv_download}
                  onChange={(event) => updateProfileField("allow_cv_download", event.target.checked)}
                />
                <span>
                  <b className="block">Allow public CV downloads</b>
                  <small className="mt-1 block text-neutral-500">
                    Visitors can download the PDF when your portfolio is public.
                  </small>
                </span>
              </label>
            </div>
            {profileError && (
              <p className="mb-3 text-sm text-red-700" role="alert">
                {profileError}
              </p>
            )}
            {profileMessage && (
              <p className="mb-3 text-sm text-green-700" role="status">
                {profileMessage}
              </p>
            )}
            <button
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
              type="submit"
              disabled={profileBusy}
            >
              {profileBusy ? "Saving…" : "Save profile"}
            </button>
          </form>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {resources.map((config) => (
            <ResourceManager
              key={config.key}
              config={config}
              items={data[config.key] as Item[]}
              onSave={saveContent}
              onDelete={deleteContent}
              onReorder={reorderContent}
            />
          ))}
        </div>

        <section
          className="rounded border border-neutral-200 bg-white p-5"
          aria-labelledby="password-heading"
        >
          <div className="mb-4 border-b border-neutral-200 pb-4">
            <div>
              <p className="text-sm text-neutral-500">Keep your account secure</p>
              <h2 className="mt-1 text-xl font-semibold" id="password-heading">
                Change password
              </h2>
            </div>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={changePassword}>
            <label className="block space-y-1 text-sm">
              Current password
              <input
                className="w-full rounded border border-neutral-300 px-3 py-2"
                type="password"
                autoComplete="current-password"
                minLength={8}
                maxLength={72}
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              New password
              <input
                className="w-full rounded border border-neutral-300 px-3 py-2"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <button
              className="w-fit rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
              type="submit"
              disabled={passwordBusy}
            >
              {passwordBusy ? "Updating…" : "Update password"}
            </button>
          </form>
          {passwordMessage && (
            <p
              className={`mt-3 text-sm ${passwordMessage.startsWith("Password updated") ? "text-green-700" : "text-red-700"}`}
              role="status"
            >
              {passwordMessage}
            </p>
          )}
        </section>

        <section
          className="rounded border border-red-200 bg-white p-5"
          aria-labelledby="delete-account-heading"
        >
          <div>
            <p className="text-sm text-neutral-500">Account</p>
            <h2 className="mt-1 text-xl font-semibold" id="delete-account-heading">
              Delete account
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Remove your account and all associated portfolio data.
            </p>
          </div>
          <button
            className="mt-4 rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
            type="button"
            onClick={() => void deleteAccount()}
          >
            Delete account
          </button>
          {deleteError && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {deleteError}
            </p>
          )}
        </section>

        {portfolio && <CVBuilder portfolio={portfolio} />}
      </main>
    </div>
  );
}
