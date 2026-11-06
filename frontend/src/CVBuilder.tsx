import { useMemo, useState } from "react";
import type { PortfolioData } from "./api";

type CvSection = "profile" | "experiences" | "education" | "skills" | "projects";
const cvSections: { key: CvSection; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "experiences", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "projects", label: "Projects" },
];

function dateRange(start: string | null, end: string | null): string {
  const format = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric" }).format(
          new Date(`${value.slice(0, 10)}T00:00:00`),
        )
      : "Present";
  if (!start && !end) return "";
  if (!start) return format(end);
  return `${format(start)} — ${end ? format(end) : "Present"}`;
}

function CvPreviewDocument({
  portfolio,
  template,
  sections,
  items,
}: {
  portfolio: PortfolioData;
  template: "modern" | "classic";
  sections: Set<CvSection>;
  items: Set<string>;
}) {
  const { profile } = portfolio;
  const experiences = portfolio.experiences.filter(
    (item) => sections.has("experiences") && items.has(`experiences:${item.id}`),
  );
  const education = portfolio.education.filter(
    (item) => sections.has("education") && items.has(`education:${item.id}`),
  );
  const skills = portfolio.skills.filter((item) => sections.has("skills") && items.has(`skills:${item.id}`));
  const projects = portfolio.projects.filter(
    (item) => sections.has("projects") && items.has(`projects:${item.id}`),
  );
  const skillCategories = [...new Set(skills.map((skill) => skill.category || "Other"))];
  const contact = [
    profile.email,
    profile.phone,
    profile.city,
    profile.linkedin_url,
    profile.github_url,
    profile.website_url,
  ].filter(Boolean);

  return (
    <article
      className="mx-auto max-w-3xl border border-neutral-200 bg-white p-6 text-sm text-neutral-800"
      aria-label={`${template} CV preview`}
    >
      <header className={`border-b border-neutral-300 pb-4 ${template === "classic" ? "text-center" : ""}`}>
        <p className="text-xs text-neutral-500">Curriculum vitae</p>
        <h3 className="mt-1 text-2xl font-semibold">{profile.full_name}</h3>
        {profile.headline && <p className="mt-1 text-neutral-600">{profile.headline}</p>}
      </header>
      {sections.has("profile") && (profile.bio || contact.length > 0) && (
        <section className="mt-5">
          <h4 className="mb-2 border-b border-neutral-200 pb-1 font-semibold">Profile</h4>
          {profile.bio && <p className="leading-6">{profile.bio}</p>}
          {contact.length > 0 && (
            <p className="mt-2 break-words text-xs text-neutral-600">{contact.join(" · ")}</p>
          )}
        </section>
      )}
      {experiences.length > 0 && (
        <section className="mt-5">
          <h4 className="mb-2 border-b border-neutral-200 pb-1 font-semibold">Experience</h4>
          {experiences.map((item) => (
            <div className="mb-3" key={item.id}>
              <h5 className="font-medium">{item.position}</h5>
              <p className="text-xs text-neutral-600">
                {item.company}
                {dateRange(item.start_date, item.end_date)
                  ? ` · ${dateRange(item.start_date, item.end_date)}`
                  : ""}
              </p>
              {item.description && <p className="mt-1 leading-5">{item.description}</p>}
            </div>
          ))}
        </section>
      )}
      {education.length > 0 && (
        <section className="mt-5">
          <h4 className="mb-2 border-b border-neutral-200 pb-1 font-semibold">Education</h4>
          {education.map((item) => (
            <div className="mb-3" key={item.id}>
              <h5 className="font-medium">{item.degree}</h5>
              <p className="text-xs text-neutral-600">
                {item.school}
                {dateRange(item.start_date, item.end_date)
                  ? ` · ${dateRange(item.start_date, item.end_date)}`
                  : ""}
              </p>
              {item.description && <p className="mt-1 leading-5">{item.description}</p>}
            </div>
          ))}
        </section>
      )}
      {skills.length > 0 && (
        <section className="mt-5">
          <h4 className="mb-2 border-b border-neutral-200 pb-1 font-semibold">Skills</h4>
          <div>
            {skillCategories.map((category) => (
              <p key={category}>
                <b>{category}: </b>
                {skills
                  .filter((skill) => (skill.category || "Other") === category)
                  .map((skill) => skill.name)
                  .join(" · ")}
              </p>
            ))}
          </div>
        </section>
      )}
      {projects.length > 0 && (
        <section className="mt-5">
          <h4 className="mb-2 border-b border-neutral-200 pb-1 font-semibold">Projects</h4>
          {projects.map((item) => (
            <div className="mb-3" key={item.id}>
              <h5 className="font-medium">{item.title}</h5>
              {item.description && <p className="mt-1 leading-5">{item.description}</p>}
              {item.technologies && item.technologies.length > 0 && (
                <p className="mt-1 text-xs text-neutral-600">Technologies: {item.technologies.join(", ")}</p>
              )}
              {item.demo_url && <p className="mt-1 text-xs text-neutral-600">{item.demo_url}</p>}
            </div>
          ))}
        </section>
      )}
    </article>
  );
}

export default function CVBuilder({ portfolio }: { portfolio: PortfolioData }) {
  const groups = useMemo(
    () => [
      {
        key: "experiences" as const,
        label: "Experience",
        items: portfolio.experiences.map((item) => ({
          id: item.id,
          label: `${item.position} · ${item.company}`,
          detail: dateRange(item.start_date, item.end_date),
        })),
      },
      {
        key: "education" as const,
        label: "Education",
        items: portfolio.education.map((item) => ({
          id: item.id,
          label: `${item.degree} · ${item.school}`,
          detail: dateRange(item.start_date, item.end_date),
        })),
      },
      {
        key: "skills" as const,
        label: "Skills",
        items: portfolio.skills.map((item) => ({
          id: item.id,
          label: item.name,
          detail: item.category ?? "",
        })),
      },
      {
        key: "projects" as const,
        label: "Projects",
        items: portfolio.projects.map((item) => ({
          id: item.id,
          label: item.title,
          detail: item.demo_url ?? "",
        })),
      },
    ],
    [portfolio],
  );
  const [template, setTemplate] = useState<"modern" | "classic">("modern");
  const [sections, setSections] = useState<Set<CvSection>>(new Set(cvSections.map((section) => section.key)));
  const [items, setItems] = useState<Set<string>>(
    () => new Set(groups.flatMap((group) => group.items.map((item) => `${group.key}:${item.id}`))),
  );
  const [showPreview, setShowPreview] = useState(false);

  const toggleSection = (section: CvSection, checked: boolean) => {
    setSections((current) => {
      const next = new Set(current);
      if (checked) next.add(section);
      else next.delete(section);
      return next;
    });
    const group = groups.find((candidate) => candidate.key === section);
    if (group) {
      setItems((current) => {
        const next = new Set(current);
        for (const item of group.items) {
          const key = `${group.key}:${item.id}`;
          if (checked) next.add(key);
          else next.delete(key);
        }
        return next;
      });
    }
  };

  const toggleItem = (key: string, checked: boolean) => {
    setItems((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const buildUrl = (endpoint: "preview" | "download") => {
    const params = new URLSearchParams({
      slug: portfolio.profile.slug,
      template,
      sections: [...sections].join(","),
      include: [...items].join(","),
    });
    return `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/cv/${endpoint}?${params.toString()}`;
  };

  return (
    <section
      className="border-y border-neutral-200 bg-neutral-50 py-12"
      id="cv-builder"
      aria-labelledby="cv-title"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight" id="cv-title">
            Build a CV from this profile.
          </h2>
          <p className="mt-3 max-w-xl leading-6 text-neutral-600">
            Select the sections and entries you want to keep, choose a template, and preview the PDF before
            downloading it.
          </p>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-5">
          <div className="mb-5 border-b border-neutral-200 pb-4">
            <div>
              <h3 className="text-xl font-semibold">Set up your CV</h3>
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Choose a template</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-2 rounded border p-3 ${template === "modern" ? "border-black" : "border-neutral-200"}`}
              >
                <input
                  className="mt-1 accent-black"
                  type="radio"
                  name={`template-${portfolio.profile.slug}`}
                  value="modern"
                  checked={template === "modern"}
                  onChange={() => setTemplate("modern")}
                />
                <span className="text-sm">
                  <b className="block">Modern</b>
                  <small className="mt-1 block text-neutral-500">Bold header, teal accents</small>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded border p-3 ${template === "classic" ? "border-black" : "border-neutral-200"}`}
              >
                <input
                  className="mt-1 accent-black"
                  type="radio"
                  name={`template-${portfolio.profile.slug}`}
                  value="classic"
                  checked={template === "classic"}
                  onChange={() => setTemplate("classic")}
                />
                <span className="text-sm">
                  <b className="block">Classic</b>
                  <small className="mt-1 block text-neutral-500">Centered, understated layout</small>
                </span>
              </label>
            </div>
          </fieldset>
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium">
              Include in your CV{" "}
              <span className="font-normal text-neutral-500">({sections.size} sections)</span>
            </p>
            <label className="flex items-center gap-2 py-2 text-sm">
              <input
                className="accent-black"
                type="checkbox"
                aria-label="Include profile section"
                checked={sections.has("profile")}
                onChange={(event) => toggleSection("profile", event.target.checked)}
              />
              <span>Profile</span>
            </label>
            {groups.map((group) => (
              <fieldset className="border-t border-neutral-200 py-2" key={group.key}>
                <legend className="w-full">
                  <label className="flex cursor-pointer items-center gap-2 py-2 text-sm font-medium">
                    <input
                      className="accent-black"
                      type="checkbox"
                      aria-label={`Include ${group.label.toLowerCase()} section`}
                      checked={sections.has(group.key)}
                      onChange={(event) => toggleSection(group.key, event.target.checked)}
                    />
                    <span>{group.label}</span>
                    <span className="text-xs text-neutral-500">{group.items.length}</span>
                  </label>
                </legend>
                {sections.has(group.key) && group.items.length > 0 && (
                  <div className="grid gap-2 pl-6 sm:grid-cols-2">
                    {group.items.map((item) => {
                      const key = `${group.key}:${item.id}`;
                      return (
                        <label className="flex cursor-pointer items-start gap-2 text-sm" key={key}>
                          <input
                            className="mt-1 accent-black"
                            type="checkbox"
                            checked={items.has(key)}
                            onChange={(event) => toggleItem(key, event.target.checked)}
                          />
                          <span>
                            <b className="font-normal">{item.label}</b>
                            {item.detail && (
                              <small className="mt-0.5 block text-neutral-500">{item.detail}</small>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
            <button
              className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
              type="button"
              onClick={() => setShowPreview((open) => !open)}
            >
              {showPreview ? "Hide preview" : "Preview CV"}
              <span aria-hidden="true">↗</span>
            </button>
            <a
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
              href={buildUrl("download")}
            >
              Download PDF
            </a>
          </div>
          {showPreview && (
            <div className="mt-5 border-t border-neutral-200 pt-4">
              <div className="mb-3 flex justify-between gap-4 text-xs text-neutral-500">
                <span>Preview · {template === "modern" ? "Modern" : "Classic"}</span>
                <span>Updates as you edit</span>
              </div>
              <CvPreviewDocument
                portfolio={portfolio}
                template={template}
                sections={sections}
                items={items}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
