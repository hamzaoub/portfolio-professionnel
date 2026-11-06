import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";
import { apiRequest, type DashboardProfile, type Experience, type SessionUser } from "./api";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, apiRequest: vi.fn() };
});

const user: SessionUser = {
  id: 1,
  account_email: "jordan@example.test",
  slug: "jordan-example",
  is_public: true,
  allow_cv_download: true,
  full_name: "Jordan Example",
  headline: "Developer",
};

const profile: DashboardProfile = {
  ...user,
  bio: "A product-minded developer.",
  email: "public@example.test",
  phone: null,
  city: "Montreal",
  linkedin_url: null,
  github_url: null,
  website_url: null,
  photo_url: null,
};

const experiences: Experience[] = [
  {
    id: 10,
    position: "Frontend developer",
    company: "First Company",
    company_url: null,
    start_date: null,
    end_date: null,
    description: null,
    sort_order: 0,
  },
  {
    id: 11,
    position: "Junior developer",
    company: "Second Company",
    company_url: null,
    start_date: null,
    end_date: null,
    description: null,
    sort_order: 1,
  },
];

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard user={user} onLoggedOut={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
      if (init.method === "PUT" && path === "/api/profile") {
        const body = JSON.parse(String(init.body)) as Partial<DashboardProfile>;
        return Promise.resolve({ profile: { ...profile, ...body } }) as never;
      }

      if (init.method === "PUT") return Promise.resolve({ item: {} }) as never;
      if (path === "/api/profile") return Promise.resolve({ profile }) as never;
      if (path === "/api/experiences") return Promise.resolve({ items: experiences }) as never;
      if (path === "/api/education") return Promise.resolve({ items: [] }) as never;
      if (path === "/api/skills") return Promise.resolve({ items: [] }) as never;
      if (path === "/api/projects") return Promise.resolve({ items: [] }) as never;
      return Promise.resolve(undefined) as never;
    });
  });

  it("saves profile visibility and public CV download preferences", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Welcome, Jordan Example" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Jordan Example — Portfolio Studio"));
    fireEvent.click(screen.getByRole("checkbox", { name: /publish portfolio/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /allow public cv downloads/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await screen.findByText("Profile saved.");
    const saveCall = vi
      .mocked(apiRequest)
      .mock.calls.find(([path, init]) => path === "/api/profile" && init?.method === "PUT");
    expect(saveCall).toBeDefined();
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
      is_public: false,
      allow_cv_download: false,
    });
  });

  it("persists adjacent experience items with updated display order", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "Welcome, Jordan Example" });
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Move experience item up" })).toHaveLength(2),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Move experience item up" })[1]);
    await waitFor(() => {
      const updates = vi
        .mocked(apiRequest)
        .mock.calls.filter(([path, init]) => path.startsWith("/api/experiences/") && init?.method === "PUT");
      expect(updates).toHaveLength(2);
    });

    const updates = vi
      .mocked(apiRequest)
      .mock.calls.filter(([path, init]) => path.startsWith("/api/experiences/") && init?.method === "PUT");
    expect(updates.map(([path, init]) => [path, JSON.parse(String(init?.body))])).toEqual([
      ["/api/experiences/11", { sort_order: 0 }],
      ["/api/experiences/10", { sort_order: 1 }],
    ]);
  });
});
