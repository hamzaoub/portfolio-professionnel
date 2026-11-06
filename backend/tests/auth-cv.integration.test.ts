import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

const apiUrl = process.env.PORTFOLIO_API_URL ?? "http://127.0.0.1:3000";
const email = `portfolio-test-${randomUUID()}@example.invalid`;
const password = `Portfolio-${randomBytes(28).toString("base64url")}!`;
let cookie = "";
let accountId: number | null = null;
let slug = "";
let accountDeleted = false;

async function api(path: string, options: { method?: string; body?: unknown; authenticated?: boolean } = {}) {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.authenticated !== false && cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const sessionCookie = response.headers.getSetCookie().find((value) => value.startsWith("portfolio.sid="));
  if (sessionCookie) cookie = sessionCookie.split(";", 1)[0];
  const contentType = response.headers.get("Content-Type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  const pdf = contentType.includes("application/pdf") ? Buffer.from(await response.arrayBuffer()) : null;
  return { response, data, pdf };
}

describe("account, portfolio cache, and CV API", () => {
  afterAll(async () => {
    if (accountId && !accountDeleted && cookie) {
      try {
        const cleanup = await api("/api/auth/account", { method: "DELETE" });
        accountDeleted = cleanup.response.status === 204;
      } catch {
        // The test service may be unavailable during cleanup; no credentials are logged.
      }
    }
  });

  it("registers, manages owner data, enforces privacy, generates a CV, and deletes the account", async () => {
    const registration = await api("/api/auth/register", {
      method: "POST",
      authenticated: false,
      body: { email, password, full_name: "Portfolio Test Account" },
    });
    expect(registration.response.status).toBe(201);
    expect(cookie).toContain("portfolio.sid=");
    accountId = registration.data.user.id;
    slug = registration.data.user.slug;

    const currentUser = await api("/api/auth/me");
    expect(currentUser.response.status).toBe(200);
    expect(currentUser.data.user.account_email).toBe(email);
    expect((await api("/api/profile", { authenticated: false })).response.status).toBe(401);

    const profile = await api("/api/profile", {
      method: "PUT",
      body: { full_name: "Portfolio Test Account", is_public: true, allow_cv_download: false },
    });
    expect(profile.response.status).toBe(200);
    expect(profile.data.profile.is_public).toBe(true);

    const experience = await api("/api/experiences", {
      method: "POST",
      body: {
        position: "Integration role",
        company: "Local test",
        start_date: "2025-01-01",
        end_date: null,
        description: "Temporary test data",
        sort_order: 0,
      },
    });
    expect(experience.response.status).toBe(201);
    const experienceId = experience.data.item.id as number;
    const updatedExperience = await api(`/api/experiences/${experienceId}`, {
      method: "PUT",
      body: { position: "Updated integration role" },
    });
    expect(updatedExperience.data.item.position).toBe("Updated integration role");
    expect((await api(`/api/experiences/${experienceId}`, { method: "DELETE" })).response.status).toBe(204);

    const project = await api("/api/projects", {
      method: "POST",
      body: {
        title: "Integration project",
        description: "Temporary test project",
        technologies: ["TypeScript"],
        sort_order: 0,
      },
    });
    expect(project.response.status).toBe(201);
    const projectId = project.data.item.id as number;
    const beforeEdit = await api(`/api/public/${slug}`, { authenticated: false });
    expect(beforeEdit.response.status).toBe(200);
    expect(
      beforeEdit.data.projects.some((item: { title: string }) => item.title === "Integration project"),
    ).toBe(true);

    const updatedProject = await api(`/api/projects/${projectId}`, {
      method: "PUT",
      body: { title: "Updated integration project" },
    });
    expect(updatedProject.response.status).toBe(200);
    const afterEdit = await api(`/api/public/${slug}`, { authenticated: false });
    expect(
      afterEdit.data.projects.some((item: { title: string }) => item.title === "Updated integration project"),
    ).toBe(true);

    const ownerPreview = await api(
      `/api/cv/preview?slug=${slug}&sections=projects&include=projects%3A${projectId}`,
    );
    expect(ownerPreview.response.status).toBe(200);
    expect(ownerPreview.pdf?.subarray(0, 4).toString()).toBe("%PDF");
    const allItems = await api(`/api/cv/preview?slug=${slug}&sections=projects`);
    const noItems = await api(`/api/cv/preview?slug=${slug}&sections=projects&include=`);
    expect(allItems.response.status).toBe(200);
    expect(noItems.response.status).toBe(200);
    expect(noItems.pdf!.length).toBeLessThan(allItems.pdf!.length);
    const cachedAllItems = await api(`/api/cv/preview?slug=${slug}&sections=projects`);
    expect(cachedAllItems.pdf?.equals(allItems.pdf!)).toBe(true);
    expect((await api(`/api/cv/preview?slug=${slug}`, { authenticated: false })).response.status).toBe(404);

    const publicPermission = await api("/api/profile", { method: "PUT", body: { allow_cv_download: true } });
    expect(publicPermission.response.status).toBe(200);
    const publicDownload = await api(`/api/cv/download?slug=${slug}&template=classic`, {
      authenticated: false,
    });
    expect(publicDownload.response.status).toBe(200);
    expect(publicDownload.response.headers.get("content-disposition")).toContain(
      "CV_Portfolio_Test_Account.pdf",
    );
    expect(publicDownload.pdf?.subarray(0, 4).toString()).toBe("%PDF");

    const privateProfile = await api("/api/profile", { method: "PUT", body: { is_public: false } });
    expect(privateProfile.response.status).toBe(200);
    expect((await api(`/api/public/${slug}`, { authenticated: false })).response.status).toBe(404);
    expect((await api(`/api/cv/download?slug=${slug}`, { authenticated: false })).response.status).toBe(404);

    const newPassword = `${password}Changed`;
    const passwordChange = await api("/api/auth/password", {
      method: "PUT",
      body: { current_password: password, new_password: newPassword },
    });
    expect(passwordChange.response.status).toBe(200);
    expect((await api("/api/auth/me")).response.status).toBe(200);
    expect((await api("/api/auth/logout", { method: "POST" })).response.status).toBe(204);
    expect((await api("/api/profile")).response.status).toBe(401);

    const login = await api("/api/auth/login", {
      method: "POST",
      authenticated: false,
      body: { email, password: newPassword },
    });
    expect(login.response.status).toBe(200);
    expect((await api("/api/auth/me")).response.status).toBe(200);

    const deletion = await api("/api/auth/account", { method: "DELETE" });
    expect(deletion.response.status).toBe(204);
    accountDeleted = true;
    expect((await api(`/api/public/${slug}`, { authenticated: false })).response.status).toBe(404);
  });
});
