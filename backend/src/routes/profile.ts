import { Router } from "express";
import { z } from "zod";
import { invalidatePortfolioCache } from "../cache.js";
import { asyncRoute, requireAuth, sendValidationError } from "../http.js";
import { pool } from "../db.js";
import type { DashboardProfile } from "../../../shared/contracts.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), "URL must use HTTP or HTTPS");
const profileSchema = z
  .object({
    full_name: z.string().trim().min(1).max(150).optional(),
    headline: z.string().trim().max(200).nullable().optional(),
    bio: z.string().trim().max(5000).nullable().optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    linkedin_url: httpUrlSchema.nullable().optional(),
    github_url: httpUrlSchema.nullable().optional(),
    website_url: httpUrlSchema.nullable().optional(),
    photo_url: httpUrlSchema.nullable().optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(2)
      .max(100)
      .optional(),
    is_public: z.boolean().optional(),
    allow_cv_download: z.boolean().optional(),
  })
  .strict();

const profileColumns: Record<string, string> = {
  full_name: "full_name",
  headline: "headline",
  bio: "bio",
  email: "email",
  phone: "phone",
  city: "city",
  linkedin_url: "linkedin_url",
  github_url: "github_url",
  website_url: "website_url",
  photo_url: "photo_url",
};
const userColumns: Record<string, string> = {
  slug: "slug",
  is_public: "is_public",
  allow_cv_download: "allow_cv_download",
};

async function readProfile(userId: number): Promise<DashboardProfile | null> {
  const { rows } = await pool.query<DashboardProfile>(
    `SELECT u.id, u.email AS account_email, u.slug, u.is_public, u.allow_cv_download,
            p.full_name, p.headline, p.bio, p.email, p.phone, p.city, p.linkedin_url,
            p.github_url, p.website_url, p.photo_url
       FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

profileRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const profile = await readProfile(req.session.userId!);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({ profile });
  }),
);

profileRouter.put(
  "/",
  asyncRoute(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues);
      return;
    }
    const changes = parsed.data;
    if (Object.keys(changes).length === 0) {
      res.status(400).json({ error: "Provide at least one profile field to update." });
      return;
    }

    const userId = req.session.userId!;
    const before = await pool.query<{ slug: string }>("SELECT slug FROM users WHERE id = $1", [userId]);
    if (!before.rows[0]) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const profileChanges = Object.entries(changes).filter(([key]) => key in profileColumns);
    const userChanges = Object.entries(changes).filter(([key]) => key in userColumns);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (profileChanges.length) {
        const assignments = profileChanges.map(([key], index) => `${profileColumns[key]} = $${index + 1}`);
        await client.query(
          `UPDATE profiles SET ${assignments.join(", ")} WHERE user_id = $${profileChanges.length + 1}`,
          [...profileChanges.map(([, value]) => value), userId],
        );
      }
      if (userChanges.length) {
        const assignments = userChanges.map(([key], index) => `${userColumns[key]} = $${index + 1}`);
        await client.query(
          `UPDATE users SET ${assignments.join(", ")} WHERE id = $${userChanges.length + 1}`,
          [...userChanges.map(([, value]) => value), userId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        res.status(409).json({ error: "That portfolio URL is already in use." });
        return;
      }
      throw error;
    } finally {
      client.release();
    }

    await invalidatePortfolioCache(userId, [before.rows[0].slug]);
    const profile = await readProfile(userId);
    res.json({ profile });
  }),
);
