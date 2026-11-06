import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CVBuilder from "./CVBuilder";
import type { PortfolioData } from "./api";

const portfolio: PortfolioData = {
  profile: {
    slug: "jordan-example",
    full_name: "Jordan Example",
    headline: "Software Developer",
    bio: "I build web apps across the frontend and backend.",
    email: null,
    phone: null,
    city: "Montreal",
    linkedin_url: null,
    github_url: null,
    website_url: null,
    photo_url: null,
  },
  experiences: [
    {
      id: 1,
      position: "Developer",
      company: "Example Co",
      company_url: null,
      start_date: "2024-01-01",
      end_date: null,
      description: "Built an app.",
      sort_order: 0,
    },
  ],
  education: [
    {
      id: 1,
      degree: "Web Development",
      school: "Example College",
      start_date: "2022-01-01",
      end_date: null,
      description: null,
      sort_order: 0,
    },
  ],
  skills: [{ id: 1, name: "TypeScript", category: "Language", level: 4, sort_order: 0 }],
  projects: [
    {
      id: 1,
      title: "Portfolio project",
      description: "A test project.",
      technologies: ["React"],
      repo_url: null,
      demo_url: null,
      image_url: null,
      sort_order: 0,
    },
    {
      id: 2,
      title: "Second project",
      description: "Another test project.",
      technologies: ["Node.js"],
      repo_url: null,
      demo_url: null,
      image_url: null,
      sort_order: 1,
    },
  ],
};

describe("CVBuilder", () => {
  it("updates the live preview when a section is removed", async () => {
    render(<CVBuilder portfolio={portfolio} />);
    fireEvent.click(screen.getByRole("button", { name: /preview cv/i }));
    const preview = await screen.findByRole("article", { name: "modern CV preview" });
    expect(within(preview).getByText("Portfolio project")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Include projects section" }));
    await waitFor(() => expect(within(preview).queryByText("Portfolio project")).not.toBeInTheDocument());
  });

  it("switches the preview template and keeps item selections available", async () => {
    render(<CVBuilder portfolio={portfolio} />);
    fireEvent.click(screen.getByDisplayValue("classic"));
    fireEvent.click(screen.getByRole("button", { name: /preview cv/i }));
    const preview = await screen.findByRole("article", { name: "classic CV preview" });
    expect(within(preview).getByText("Second project")).toBeInTheDocument();
  });
});
