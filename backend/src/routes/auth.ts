import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type Request } from "express";
import { z } from "zod";
import { invalidatePortfolioCache } from "../cache.js";
import { asyncRoute, sendValidationError } from "../http.js";
import { redis } from "../redis.js";
import { SESSION_COOKIE_NAME } from "../session.js";
import { pool } from "../db.js";
import type { AuthenticatedAccount, SessionUser } from "../../../shared/contracts.js";

export const authRouter = Router();
const PASSWORD_ROUNDS = 12;

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(1).max(150),
});

const loginSchema = z.object({ email: emailSchema, password: passwordSchema });
const changePasswordSchema = z.object({ current_password: passwordSchema, new_password: passwordSchema });

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

async function establishSession(req: Request, userId: number): Promise<void> {
  await regenerateSession(req);
  req.session.userId = userId;
  await saveSession(req);
}

async function rateLimit(
  req: Request,
  action: string,
  maximum: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = `auth:rate:${action}:${req.ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count > maximum;
}

function slugFromName(name: string): string {
  const base =
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 82) || "portfolio";
  return `${base}-${randomBytes(4).toString("hex")}`;
}

authRouter.post(
  "/register",
  asyncRoute(async (req, res) => {
    if (await rateLimit(req, "register", 8, 60 * 60)) {
      res.status(429).json({ error: "Too many registration attempts. Try again later." });
      return;
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues);
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const passwordHash = await bcrypt.hash(parsed.data.password, PASSWORD_ROUNDS);
    const client = await pool.connect();
    let userId: number;
    let slug: string;

    try {
      await client.query("BEGIN");
      const user = await client.query<{ id: number; slug: string }>(
        "INSERT INTO users (email, password_hash, slug) VALUES ($1, $2, $3) RETURNING id, slug",
        [email, passwordHash, slugFromName(parsed.data.full_name)],
      );
      userId = user.rows[0].id;
      slug = user.rows[0].slug;
      await client.query("INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)", [
        userId,
        parsed.data.full_name,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }
      throw error;
    } finally {
      client.release();
    }

    await establishSession(req, userId);
    const user: AuthenticatedAccount = { id: userId, email, slug };
    res.status(201).json({ user });
  }),
);

authRouter.post(
  "/login",
  asyncRoute(async (req, res) => {
    if (await rateLimit(req, "login", 12, 15 * 60)) {
      res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues);
      return;
    }

    const { rows } = await pool.query<{ id: number; email: string; slug: string; password_hash: string }>(
      "SELECT id, email, slug, password_hash FROM users WHERE email = $1",
      [parsed.data.email.toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    await establishSession(req, user.id);
    const authenticatedUser: AuthenticatedAccount = {
      id: user.id,
      email: user.email,
      slug: user.slug,
    };
    res.json({ user: authenticatedUser });
  }),
);

authRouter.get(
  "/me",
  asyncRoute(async (req, res) => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const { rows } = await pool.query<SessionUser>(
      `SELECT u.id, u.email AS account_email, u.slug, u.is_public, u.allow_cv_download,
            p.full_name, p.headline
       FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
      [req.session.userId],
    );
    if (!rows[0]) {
      await destroySession(req);
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.json({ user: rows[0] });
  }),
);

authRouter.post(
  "/logout",
  asyncRoute(async (req, res) => {
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.status(204).end();
  }),
);

authRouter.put(
  "/password",
  asyncRoute(async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues);
      return;
    }
    if (parsed.data.current_password === parsed.data.new_password) {
      res.status(400).json({ error: "Choose a password you have not used as the current password." });
      return;
    }

    const { rows } = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );
    if (!rows[0] || !(await bcrypt.compare(parsed.data.current_password, rows[0].password_hash))) {
      res.status(400).json({ error: "Current password is incorrect." });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.new_password, PASSWORD_ROUNDS);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
    res.json({ message: "Password updated." });
  }),
);

authRouter.delete(
  "/account",
  asyncRoute(async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { rows } = await pool.query<{ slug: string }>("SELECT slug FROM users WHERE id = $1", [userId]);
    await destroySession(req);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await invalidatePortfolioCache(userId, [rows[0]?.slug]);
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.status(204).end();
  }),
);
