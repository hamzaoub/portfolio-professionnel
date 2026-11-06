import { describe, expect, it, vi } from "vitest";

vi.stubEnv("SESSION_SECRET", "unit-test-only-placeholder-not-a-real-secret");
const { registerSchema } = await import("../src/routes/auth.js");
const { filenameFor, generatePdf } = await import("../src/routes/cv.js");

describe("registration validation", () => {
  const account = {
    full_name: "Example Student",
    email: "student@example.invalid",
    password: "test-only-password",
  };

  it("accepts a valid account and trims its name and email", () => {
    const result = registerSchema.parse({
      ...account,
      full_name: " Example Student ",
      email: " student@example.invalid ",
    });
    expect(result.full_name).toBe(account.full_name);
    expect(result.email).toBe(account.email);
  });

  it("rejects an invalid email, empty name, and short password", () => {
    expect(registerSchema.safeParse({ ...account, email: "invalid" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...account, full_name: " " }).success).toBe(false);
    expect(registerSchema.safeParse({ ...account, password: "short" }).success).toBe(false);
  });

  it("rejects passwords longer than bcrypt's 72-byte limit", () => {
    expect(registerSchema.safeParse({ ...account, password: "é".repeat(40) }).success).toBe(false);
  });
});

describe("PDF generation", () => {
  const data = {
    userId: 1,
    profile: {
      id: 1,
      full_name: "Example Student",
      headline: "Developer",
      bio: "Student portfolio.",
      email: null,
      phone: null,
      city: null,
      linkedin_url: null,
      github_url: null,
      website_url: null,
    },
    experiences: [],
    education: [],
    skills: [],
    projects: [
      {
        id: 1,
        title: "Student project",
        description: "A web application for a course.",
        technologies: ["TypeScript"],
        repo_url: null,
        demo_url: null,
      },
    ],
  };

  it.each(["classic", "modern"] as const)(
    "generates the %s template with the chosen content",
    async (template) => {
      const all = await generatePdf(data, template, new Set(["profile", "projects"]), new Set(), false);
      const none = await generatePdf(data, template, new Set(["profile", "projects"]), new Set(), true);
      expect(all.buffer.subarray(0, 4).toString()).toBe("%PDF");
      expect(all.pages).toBe(1);
      expect(none.buffer.length).toBeLessThan(all.buffer.length);
    },
  );

  it("uses the required filename format and removes accents", () => {
    expect(filenameFor("Prénom Nom")).toBe("CV_Prenom_Nom.pdf");
  });
});
