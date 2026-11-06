import { Router } from "express";
import { pool } from "../db.js";
import { redis } from "../redis.js";
import type { Education, Experience, PortfolioData, Project, Skill } from "../../../shared/contracts.js";

export const publicRouter = Router();

const CACHE_TTL_SECONDS = 60 * 5;
type PublicProfileRow = PortfolioData["profile"] & { id: number; slug: string };

publicRouter.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `portfolio:${slug}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached) as PortfolioData);

    const { rows: users } = await pool.query<PublicProfileRow>(
      `SELECT u.id, u.slug, p.full_name, p.headline, p.bio, p.email, p.phone, p.city,
              p.linkedin_url, p.github_url, p.website_url, p.photo_url
         FROM users u
         JOIN profiles p ON p.user_id = u.id
        WHERE u.slug = $1 AND u.is_public = TRUE`,
      [slug],
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "Portfolio introuvable" });
    }

    const profile = users[0];
    const [experiences, education, skills, projects] = await Promise.all([
      pool.query<Experience>(
        `SELECT id, position, company, company_url, start_date, end_date, description, sort_order
           FROM experiences WHERE user_id = $1
          ORDER BY sort_order, start_date DESC NULLS LAST, id`,
        [profile.id],
      ),
      pool.query<Education>(
        `SELECT id, degree, school, start_date, end_date, description, sort_order
           FROM education WHERE user_id = $1
          ORDER BY sort_order, start_date DESC NULLS LAST, id`,
        [profile.id],
      ),
      pool.query<Skill>(
        `SELECT id, name, category, level, sort_order
           FROM skills WHERE user_id = $1
          ORDER BY sort_order, category, name`,
        [profile.id],
      ),
      pool.query<Project>(
        `SELECT id, title, description, technologies, repo_url, demo_url, image_url, sort_order
           FROM projects WHERE user_id = $1
          ORDER BY sort_order, id`,
        [profile.id],
      ),
    ]);

    const portfolio: PortfolioData = {
      profile: {
        slug: profile.slug,
        full_name: profile.full_name,
        headline: profile.headline,
        bio: profile.bio,
        email: profile.email,
        phone: profile.phone,
        city: profile.city,
        linkedin_url: profile.linkedin_url,
        github_url: profile.github_url,
        website_url: profile.website_url,
        photo_url: profile.photo_url,
      },
      experiences: experiences.rows,
      education: education.rows,
      skills: skills.rows,
      projects: projects.rows,
    };

    await redis.set(cacheKey, JSON.stringify(portfolio), { EX: CACHE_TTL_SECONDS });
    return res.json(portfolio);
  } catch (error) {
    console.error("Erreur lors du chargement du portfolio public:", error);
    return res.status(500).json({ error: "Impossible de charger ce portfolio" });
  }
});
