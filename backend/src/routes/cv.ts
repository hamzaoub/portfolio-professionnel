import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import { pool } from "../db.js";
import { redis } from "../redis.js";

export const cvRouter = Router();

const CACHE_TTL_SECONDS = 60 * 30;
const availableSections = ["profile", "experiences", "education", "skills", "projects"] as const;
type CvSection = (typeof availableSections)[number];
type CvTemplate = "classic" | "modern";
type GeneratedPdf = { buffer: Buffer; pages: number };

type Profile = {
  id: number;
  full_name: string;
  headline: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  website_url: string | null;
};

type Experience = {
  id: number;
  position: string;
  company: string;
  company_url: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

type Education = {
  id: number;
  degree: string;
  school: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

type Skill = { id: number; name: string; category: string | null; level: number | null };
type Project = {
  id: number;
  title: string;
  description: string | null;
  technologies: string[] | null;
  repo_url: string | null;
  demo_url: string | null;
};

type CvData = {
  userId: number;
  profile: Profile;
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
};

const themes: Record<CvTemplate, { accent: string; ink: string; muted: string; banner: string }> = {
  classic: { accent: "#273449", ink: "#202a38", muted: "#657184", banner: "#f2f4f7" },
  modern: { accent: "#176b68", ink: "#172b36", muted: "#607681", banner: "#123842" },
};

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function csvSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function displayDate(value: string | null): string {
  if (!value) return "Present";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(date);
}

function displayRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (!start) return displayDate(end);
  return `${displayDate(start)} – ${end ? displayDate(end) : "Present"}`;
}

function includeItem(
  section: Exclude<CvSection, "profile">,
  id: number,
  sections: Set<string>,
  items: Set<string>,
  hasItemSelection: boolean,
): boolean {
  return sections.has(section) && (!hasItemSelection || items.has(`${section}:${id}`));
}

function ensureSpace(document: PDFKit.PDFDocument, minimumHeight: number, startNextPage: () => void): void {
  const bottom = document.page.height - 48;
  if (document.y + minimumHeight > bottom) startNextPage();
}

function addSectionTitle(
  document: PDFKit.PDFDocument,
  title: string,
  accent: string,
  startNextPage: () => void,
  minimumHeight = 42,
): void {
  ensureSpace(document, minimumHeight, startNextPage);
  document.moveDown(0.45);
  const y = document.y;
  document
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(accent)
    .text(title.toLocaleUpperCase("en-CA"), 48, y);
  document
    .moveTo(48, y + 17)
    .lineTo(document.page.width - 48, y + 17)
    .lineWidth(0.7)
    .strokeColor("#dce2e7")
    .stroke();
  document.y = y + 23;
}

function addEntry(
  document: PDFKit.PDFDocument,
  title: string,
  organization: string,
  range: string,
  description: string | null,
  accent: string,
  muted: string,
  startNextPage: () => void,
): void {
  const width = document.page.width - 96;
  const titleHeight = document.font("Helvetica-Bold").fontSize(10.5).heightOfString(title, { width });
  const organizationHeight = document.font("Helvetica").fontSize(9.5).heightOfString(organization, { width });
  const rangeHeight = range
    ? document.font("Helvetica-Oblique").fontSize(8.5).heightOfString(range, { width })
    : 0;
  const descriptionHeight = description
    ? document.font("Helvetica").fontSize(9).heightOfString(description, { width, lineGap: 2 }) + 2
    : 0;
  ensureSpace(
    document,
    titleHeight + organizationHeight + rangeHeight + descriptionHeight + 14,
    startNextPage,
  );
  document.font("Helvetica-Bold").fontSize(10.5).fillColor(accent).text(title, { continued: false });
  document.font("Helvetica").fontSize(9.5).fillColor("#25313c").text(organization, { continued: false });
  if (range)
    document.font("Helvetica-Oblique").fontSize(8.5).fillColor(muted).text(range, { continued: false });
  if (description) {
    document
      .moveDown(0.2)
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#34414b")
      .text(description, { width: document.page.width - 96, lineGap: 2 });
  }
  document.moveDown(0.45);
}

export async function generatePdf(
  data: CvData,
  template: CvTemplate,
  sections: Set<string>,
  items: Set<string>,
  hasItemSelection: boolean,
): Promise<GeneratedPdf> {
  const theme = themes[template];
  const document = new PDFDocument({
    size: "LETTER",
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: { Title: `CV — ${data.profile.full_name}`, Author: data.profile.full_name },
    lang: "en-CA",
  });
  const chunks: Buffer[] = [];
  let pages = 1;

  const output = new Promise<GeneratedPdf>((resolve, reject) => {
    document.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    document.on("pageAdded", () => pages++);
    document.on("end", () => resolve({ buffer: Buffer.concat(chunks), pages }));
    document.on("error", reject);
  });

  const startNextPage = (): void => {
    document.addPage();
    if (template === "modern") {
      document.rect(0, 0, document.page.width, 66).fill(theme.banner);
      document
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor("#ffffff")
        .text(data.profile.full_name, 48, 17, { width: document.page.width - 96 });
      if (data.profile.headline)
        document
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor("#dceceb")
          .text(data.profile.headline, 48, 40, { width: document.page.width - 96 });
      document.y = 82;
    } else {
      document
        .font("Helvetica-Bold")
        .fontSize(12.5)
        .fillColor(theme.ink)
        .text(data.profile.full_name, 48, 46, { align: "center", width: document.page.width - 96 });
      if (data.profile.headline)
        document
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(theme.muted)
          .text(data.profile.headline, { align: "center", width: document.page.width - 96 });
      document
        .moveTo(48, 82)
        .lineTo(document.page.width - 48, 82)
        .lineWidth(0.7)
        .strokeColor("#dce2e7")
        .stroke();
      document.y = 94;
    }
  };

  if (template === "modern") {
    document.rect(0, 0, document.page.width, 128).fill(theme.banner);
    document
      .font("Helvetica-Bold")
      .fontSize(25)
      .fillColor("#ffffff")
      .text(data.profile.full_name, 48, 34, { width: document.page.width - 96 });
    if (data.profile.headline)
      document
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#dceceb")
        .text(data.profile.headline, 48, 72, { width: document.page.width - 96 });
    document.y = 151;
  } else {
    document
      .font("Helvetica-Bold")
      .fontSize(23)
      .fillColor(theme.ink)
      .text(data.profile.full_name, { align: "center" });
    if (data.profile.headline)
      document
        .font("Helvetica")
        .fontSize(11)
        .fillColor(theme.muted)
        .text(data.profile.headline, { align: "center" });
    document.moveDown(0.7);
  }

  const contact = [
    data.profile.email,
    data.profile.phone,
    data.profile.city,
    data.profile.linkedin_url,
    data.profile.github_url,
    data.profile.website_url,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (sections.has("profile") && contact) {
    document
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(theme.muted)
      .text(contact, { align: template === "classic" ? "center" : "left", width: document.page.width - 96 });
    document.moveDown(0.4);
  }

  if (sections.has("profile") && data.profile.bio) {
    addSectionTitle(document, "Profile", theme.accent, startNextPage);
    document
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(theme.ink)
      .text(data.profile.bio, { width: document.page.width - 96, lineGap: 3 });
  }

  const experiences = data.experiences.filter((item) =>
    includeItem("experiences", item.id, sections, items, hasItemSelection),
  );
  if (experiences.length) {
    addSectionTitle(document, "Experience", theme.accent, startNextPage);
    experiences.forEach((item) =>
      addEntry(
        document,
        item.position,
        item.company,
        displayRange(item.start_date, item.end_date),
        item.description,
        theme.accent,
        theme.muted,
        startNextPage,
      ),
    );
  }

  const education = data.education.filter((item) =>
    includeItem("education", item.id, sections, items, hasItemSelection),
  );
  if (education.length) {
    addSectionTitle(document, "Education", theme.accent, startNextPage);
    education.forEach((item) =>
      addEntry(
        document,
        item.degree,
        item.school,
        displayRange(item.start_date, item.end_date),
        item.description,
        theme.accent,
        theme.muted,
        startNextPage,
      ),
    );
  }

  const skills = data.skills.filter((item) =>
    includeItem("skills", item.id, sections, items, hasItemSelection),
  );
  if (skills.length) {
    addSectionTitle(document, "Skills", theme.accent, startNextPage);
    const categories = new Map<string, string[]>();
    for (const skill of skills) {
      const category = skill.category || "Other";
      categories.set(category, [...(categories.get(category) ?? []), skill.name]);
    }
    for (const [category, names] of categories) {
      ensureSpace(document, 22, startNextPage);
      document
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(theme.ink)
        .text(`${category}: `, { continued: true });
      document.font("Helvetica").text(names.join(" · "), { width: document.page.width - 96 });
    }
  }

  const projects = data.projects.filter((item) =>
    includeItem("projects", item.id, sections, items, hasItemSelection),
  );
  if (projects.length) {
    const projectContentHeight = projects.reduce((height, item) => {
      const details = [
        item.description,
        item.technologies?.length ? `Technologies: ${item.technologies.join(", ")}` : null,
        item.demo_url,
      ]
        .filter(Boolean)
        .join("\n");
      return (
        height +
        document
          .font("Helvetica-Bold")
          .fontSize(10.5)
          .heightOfString(item.title, { width: document.page.width - 96 }) +
        document
          .font("Helvetica")
          .fontSize(9.5)
          .heightOfString("Selected project", { width: document.page.width - 96 }) +
        (details
          ? document
              .font("Helvetica")
              .fontSize(9)
              .heightOfString(details, { width: document.page.width - 96, lineGap: 2 }) + 16
          : 14)
      );
    }, 34);
    const bottom = document.page.height - 48;
    const continuationTop = template === "modern" ? 82 : 94;
    if (projectContentHeight <= bottom - continuationTop && document.y + projectContentHeight > bottom)
      startNextPage();
    const firstProject = projects[0];
    const firstProjectDetails = [
      firstProject.description,
      firstProject.technologies?.length ? `Technologies: ${firstProject.technologies.join(", ")}` : null,
      firstProject.demo_url,
    ]
      .filter(Boolean)
      .join("\n");
    const firstProjectHeight =
      document
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .heightOfString(firstProject.title, { width: document.page.width - 96 }) +
      document
        .font("Helvetica")
        .fontSize(9.5)
        .heightOfString("Selected project", { width: document.page.width - 96 }) +
      (firstProjectDetails
        ? document
            .font("Helvetica")
            .fontSize(9)
            .heightOfString(firstProjectDetails, { width: document.page.width - 96, lineGap: 2 }) + 16
        : 14);
    addSectionTitle(document, "Projects", theme.accent, startNextPage, 34 + firstProjectHeight);
    projects.forEach((item) => {
      const details = [
        item.description,
        item.technologies?.length ? `Technologies: ${item.technologies.join(", ")}` : null,
        item.demo_url,
      ]
        .filter(Boolean)
        .join("\n");
      addEntry(
        document,
        item.title,
        "Selected project",
        "",
        details || null,
        theme.accent,
        theme.muted,
        startNextPage,
      );
    });
  }

  document.end();
  return output;
}

async function loadCvData(slug: string, requesterId: number | undefined): Promise<CvData | null> {
  const { rows: users } = await pool.query<Profile & { id: number }>(
    `SELECT u.id, p.full_name, p.headline, p.bio, p.email, p.phone, p.city,
            p.linkedin_url, p.github_url, p.website_url
       FROM users u
       JOIN profiles p ON p.user_id = u.id
      WHERE u.slug = $1 AND ((u.is_public = TRUE AND u.allow_cv_download = TRUE) OR u.id = $2)`,
    [slug, requesterId ?? null],
  );
  if (users.length === 0) return null;

  const profile = users[0];
  const [experiences, education, skills, projects] = await Promise.all([
    pool.query<Experience>(
      `SELECT id, position, company, company_url, start_date::text, end_date::text, description
         FROM experiences WHERE user_id = $1 ORDER BY sort_order, start_date DESC NULLS LAST, id`,
      [profile.id],
    ),
    pool.query<Education>(
      `SELECT id, degree, school, start_date::text, end_date::text, description
         FROM education WHERE user_id = $1 ORDER BY sort_order, start_date DESC NULLS LAST, id`,
      [profile.id],
    ),
    pool.query<Skill>(
      `SELECT id, name, category, level FROM skills WHERE user_id = $1 ORDER BY sort_order, category, name`,
      [profile.id],
    ),
    pool.query<Project>(
      `SELECT id, title, description, technologies, repo_url, demo_url
         FROM projects WHERE user_id = $1 ORDER BY sort_order, id`,
      [profile.id],
    ),
  ]);

  return {
    userId: profile.id,
    profile,
    experiences: experiences.rows,
    education: education.rows,
    skills: skills.rows,
    projects: projects.rows,
  };
}

export function filenameFor(name: string): string {
  const safeName = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `CV_${safeName || "Portfolio"}.pdf`;
}

async function respondWithCv(req: Request, res: Response, mode: "inline" | "attachment"): Promise<void> {
  const slug = queryString(req.query.slug) ?? "hamza-oubahim";
  const requestedTemplate = queryString(req.query.template) ?? "modern";
  if (!/^[a-z0-9-]{2,100}$/.test(slug)) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  if (requestedTemplate !== "classic" && requestedTemplate !== "modern") {
    res.status(400).json({ error: "Template must be classic or modern" });
    return;
  }

  const sections = csvSet(queryString(req.query.sections) ?? availableSections.join(","));
  for (const section of sections) {
    if (!(availableSections as readonly string[]).includes(section)) {
      res.status(400).json({ error: `Unknown section: ${section}` });
      return;
    }
  }
  const hasItemSelection = Object.prototype.hasOwnProperty.call(req.query, "include");
  const items = csvSet(queryString(req.query.include));

  try {
    const data = await loadCvData(slug, req.session.userId);
    if (!data) {
      res.status(404).json({ error: "This CV is not available for download" });
      return;
    }

    const template = requestedTemplate as CvTemplate;
    const contentHash = createHash("sha256")
      .update(
        JSON.stringify({
          data,
          template,
          sections: [...sections].sort(),
          items: [...items].sort(),
          hasItemSelection,
        }),
      )
      .digest("hex");
    const cacheKey = `cv:${data.userId}:${template}:${contentHash}`;
    const cachedPdf = await redis.get(cacheKey);
    let pdf: Buffer;
    if (cachedPdf) {
      pdf = Buffer.from(cachedPdf, "base64");
    } else {
      const generated = await generatePdf(data, template, sections, items, hasItemSelection);
      if (generated.pages > 2) {
        res.status(422).json({ error: "Select fewer sections or items to keep the CV within two pages." });
        return;
      }
      pdf = generated.buffer;
      await redis.set(cacheKey, pdf.toString("base64"), { EX: CACHE_TTL_SECONDS });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${mode}; filename="${filenameFor(data.profile.full_name)}"`);
    res.send(pdf);
  } catch (error) {
    console.error("Error generating CV:", error);
    res.status(500).json({ error: "Could not generate CV" });
  }
}

cvRouter.get("/download", (req, res) => {
  void respondWithCv(req, res, "attachment");
});

cvRouter.get("/preview", (req, res) => {
  void respondWithCv(req, res, "inline");
});
