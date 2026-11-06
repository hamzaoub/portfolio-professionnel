import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { apiRequest, type PortfolioData, type SessionUser } from "./api";
import AuthPage from "./AuthPage";
import CVBuilder from "./CVBuilder";
import Dashboard from "./Dashboard";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function displayDate(value: string | null): string {
  if (!value) return "Present";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric" }).format(date);
}

function dateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (!start) return displayDate(end);
  return `${displayDate(start)} — ${end ? displayDate(end) : "Present"}`;
}

function externalLink(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function SectionHeading({ title, id }: { title: string; id?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-3xl font-semibold tracking-tight" id={id}>
        {title}
      </h2>
    </div>
  );
}

function PortfolioPage() {
  const { slug = "hamza-oubahim" } = useParams();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const loading = loadedSlug !== slug;

  useEffect(() => {
    let active = true;

    fetch(`${API_URL}/api/public/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "This portfolio is not available."
              : "The portfolio could not be loaded.",
          );
        return (await response.json()) as PortfolioData;
      })
      .then((data) => {
        if (active) {
          setPortfolio(data);
          setError(null);
          setLoadedSlug(slug);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setPortfolio(null);
          setError(reason instanceof Error ? reason.message : "The portfolio could not be loaded.");
          setLoadedSlug(slug);
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (portfolio?.profile.full_name) document.title = `${portfolio.profile.full_name} — Portfolio`;
  }, [portfolio]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-neutral-600" aria-live="polite">
        Loading portfolio…
      </main>
    );
  }

  if (error || !portfolio) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center"
        role="alert"
      >
        <h1 className="text-2xl font-semibold">Portfolio unavailable</h1>
        <p className="text-neutral-600">{error ?? "The requested profile could not be found."}</p>
        <p className="text-sm text-neutral-500">
          Make sure the API, PostgreSQL, and Redis services are running.
        </p>
        <Link className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100" to="/">
          Back to home
        </Link>
      </main>
    );
  }

  const { profile, experiences, education, skills, projects } = portfolio;
  const initials = profile.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const socials = [
    { label: "LinkedIn", url: externalLink(profile.linkedin_url) },
    { label: "GitHub", url: externalLink(profile.github_url) },
    { label: "Website", url: externalLink(profile.website_url) },
  ].filter((item): item is { label: string; url: string } => Boolean(item.url));

  return (
    <div>
      <a
        className="fixed left-3 top-3 -translate-y-20 rounded bg-black px-3 py-2 text-white focus:translate-y-0"
        href="#main"
      >
        Skip to content
      </a>
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <a
            className="flex items-center gap-2 font-semibold"
            href="#top"
            aria-label={`${profile.full_name} home`}
          >
            {externalLink(profile.photo_url) ? (
              <img
                className="h-9 w-9 rounded-full object-cover"
                src={externalLink(profile.photo_url) ?? undefined}
                alt=""
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-xs text-neutral-600">
                {initials}
              </span>
            )}
            <span>{profile.full_name}</span>
          </a>
          <nav
            className="order-3 flex w-full items-center gap-4 text-sm text-neutral-600 sm:order-none sm:w-auto"
            aria-label="Main navigation"
          >
            <a className="hover:text-black" href="#experience">
              Experience
            </a>
            <a className="hover:text-black" href="#projects">
              Projects
            </a>
            <a className="hover:text-black" href="#skills">
              Skills
            </a>
          </nav>
          <Link
            className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
            to="/login"
          >
            My workspace
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="mx-auto max-w-6xl px-5 py-16 md:py-24" id="top" aria-labelledby="hero-title">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm text-neutral-500">{profile.headline ?? "Full Stack Developer"}</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl" id="hero-title">
              I build web apps from frontend to backend.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-7 text-neutral-600">{profile.bio}</p>
            {profile.city && <p className="mt-3 text-sm text-neutral-500">{profile.city}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                className="rounded bg-black px-4 py-2.5 text-sm text-white hover:bg-neutral-800"
                href="#projects"
              >
                See my projects
              </a>
              <a
                className="rounded border border-neutral-300 px-4 py-2.5 text-sm hover:bg-neutral-100"
                href="#cv-builder"
              >
                Build a CV
              </a>
            </div>
            <div
              className="mt-6 flex flex-wrap gap-4 text-sm text-neutral-600"
              aria-label="Professional links"
            >
              {socials.map((item) => (
                <a
                  className="underline underline-offset-4 hover:text-black"
                  key={item.label}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.label}
                </a>
              ))}
              {profile.email && (
                <a className="underline underline-offset-4 hover:text-black" href={`mailto:${profile.email}`}>
                  Email
                </a>
              )}
              {profile.phone && <span>{profile.phone}</span>}
            </div>
          </div>
        </section>

        {experiences.length > 0 && (
          <section
            className="mx-auto max-w-6xl px-5 py-12"
            id="experience"
            aria-labelledby="experience-title"
          >
            <SectionHeading title="Experience" id="experience-title" />
            <div className="divide-y divide-neutral-200 border-y border-neutral-200">
              {experiences.map((item) => (
                <article className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:gap-6" key={item.id}>
                  <div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                      <h3 className="font-medium">{item.position}</h3>
                      {externalLink(item.company_url) ? (
                        <a
                          className="text-sm text-neutral-600 underline underline-offset-4"
                          href={externalLink(item.company_url) ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.company}
                          <span aria-hidden="true"> ↗</span>
                        </a>
                      ) : (
                        <p className="text-sm text-neutral-600">{item.company}</p>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">{item.description}</p>
                    )}
                  </div>
                  <span className="text-sm text-neutral-500">
                    {dateRange(item.start_date, item.end_date)}
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section
            className="border-y border-neutral-200 bg-neutral-50 py-12"
            id="projects"
            aria-labelledby="projects-title"
          >
            <div className="mx-auto max-w-6xl px-5">
              <SectionHeading title="Projects" id="projects-title" />
              <div className="grid gap-4 md:grid-cols-2">
                {projects.map((project) => (
                  <article className="rounded border border-neutral-200 bg-white p-5" key={project.id}>
                    {externalLink(project.image_url) && (
                      <img
                        className="mb-4 aspect-video w-full rounded object-cover"
                        src={externalLink(project.image_url) ?? undefined}
                        alt={`Screenshot of ${project.title}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-medium">{project.title}</h3>
                    </div>
                    {project.description && (
                      <p className="mt-3 text-sm leading-6 text-neutral-600">{project.description}</p>
                    )}
                    {project.technologies && project.technologies.length > 0 && (
                      <ul
                        className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500"
                        aria-label={`${project.title} technologies`}
                      >
                        {project.technologies.map((technology) => (
                          <li key={technology}>{technology}</li>
                        ))}
                      </ul>
                    )}
                    {externalLink(project.repo_url) && (
                      <a
                        className="mr-4 mt-4 inline-block text-sm underline underline-offset-4"
                        href={externalLink(project.repo_url) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Repository <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    {externalLink(project.demo_url) && (
                      <a
                        className="mt-4 inline-block text-sm underline underline-offset-4"
                        href={externalLink(project.demo_url) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View project <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {(skills.length > 0 || education.length > 0) && (
          <section className="mx-auto max-w-6xl px-5 py-12">
            {skills.length > 0 && (
              <div id="skills" aria-labelledby="skills-title">
                <SectionHeading title="Skills & tools" id="skills-title" />
                <div className="divide-y divide-neutral-200 border-y border-neutral-200">
                  {[...new Set(skills.map((skill) => skill.category || "Other"))].map((category) => (
                    <div className="py-4 sm:grid sm:grid-cols-[10rem_1fr]" key={category}>
                      <h3 className="mb-2 text-sm font-medium text-neutral-600 sm:mb-0">{category}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                        {skills
                          .filter((skill) => (skill.category || "Other") === category)
                          .map((skill) => (
                            <span key={skill.id}>
                              {skill.name}
                              {skill.level != null && (
                                <span className="text-neutral-600"> ({skill.level}/5)</span>
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {education.length > 0 && (
              <div className="mt-12" id="education" aria-labelledby="education-title">
                <SectionHeading title="Education" id="education-title" />
                <div className="divide-y divide-neutral-200 border-y border-neutral-200">
                  {education.map((item) => (
                    <article
                      className="flex flex-col gap-2 py-5 sm:flex-row sm:justify-between sm:gap-6"
                      key={item.id}
                    >
                      <div>
                        <h3 className="font-medium">{item.degree}</h3>
                        <p className="text-sm text-neutral-600">{item.school}</p>
                        {item.description && (
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-neutral-500">
                        {dateRange(item.start_date, item.end_date)}
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <CVBuilder portfolio={portfolio} />
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Thanks for taking a look at my work.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
            {socials.map((item) => (
              <a
                className="underline underline-offset-4"
                key={item.label}
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                {item.label}
              </a>
            ))}
            {profile.email && (
              <a className="underline underline-offset-4" href={`mailto:${profile.email}`}>
                Email
              </a>
            )}
          </div>
          <span className="text-sm text-neutral-500">
            © {new Date().getFullYear()} {profile.full_name}
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  async function refreshSession() {
    try {
      const result = await apiRequest<{ user: SessionUser }>("/api/auth/me");
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiRequest<{ user: SessionUser }>("/api/auth/me")
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/p/hamza-oubahim" replace />} />
      <Route path="/p/:slug" element={<PortfolioPage />} />
      <Route path="/login" element={<AuthPage mode="login" onAuthenticated={refreshSession} />} />
      <Route path="/register" element={<AuthPage mode="register" onAuthenticated={refreshSession} />} />
      <Route
        path="/dashboard"
        element={
          authLoading ? (
            <main
              className="flex min-h-screen items-center justify-center p-6 text-neutral-600"
              aria-live="polite"
            >
              Loading your workspace…
            </main>
          ) : user ? (
            <Dashboard user={user} onLoggedOut={() => setUser(null)} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
