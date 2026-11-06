import { Router } from "express";
import { z } from "zod";
import { invalidatePortfolioCache } from "../cache.js";
import { asyncRoute, requireAuth, sendValidationError } from "../http.js";
import { pool } from "../db.js";

type ContentConfig = {
  table: "experiences" | "education" | "skills" | "projects";
  columns: Record<string, string>;
  schema: z.ZodObject;
  orderBy: string;
};

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), "URL must use HTTP or HTTPS");
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid date")
  .nullable();
const sortOrderSchema = z.number().int().min(0).max(10000);

const configs: Record<string, ContentConfig> = {
  experiences: {
    table: "experiences",
    orderBy: "sort_order, start_date DESC NULLS LAST, id",
    columns: {
      position: "position",
      company: "company",
      company_url: "company_url",
      start_date: "start_date",
      end_date: "end_date",
      description: "description",
      sort_order: "sort_order",
    },
    schema: z
      .object({
        position: z.string().trim().min(1).max(150),
        company: z.string().trim().min(1).max(150),
        company_url: httpUrlSchema.nullable().optional(),
        start_date: dateSchema.optional(),
        end_date: dateSchema.optional(),
        description: z.string().trim().max(5000).nullable().optional(),
        sort_order: sortOrderSchema.optional(),
      })
      .strict(),
  },
  education: {
    table: "education",
    orderBy: "sort_order, start_date DESC NULLS LAST, id",
    columns: {
      degree: "degree",
      school: "school",
      start_date: "start_date",
      end_date: "end_date",
      description: "description",
      sort_order: "sort_order",
    },
    schema: z
      .object({
        degree: z.string().trim().min(1).max(150),
        school: z.string().trim().min(1).max(150),
        start_date: dateSchema.optional(),
        end_date: dateSchema.optional(),
        description: z.string().trim().max(5000).nullable().optional(),
        sort_order: sortOrderSchema.optional(),
      })
      .strict(),
  },
  skills: {
    table: "skills",
    orderBy: "sort_order, category, name, id",
    columns: { name: "name", category: "category", level: "level", sort_order: "sort_order" },
    schema: z
      .object({
        name: z.string().trim().min(1).max(100),
        category: z.string().trim().max(50).nullable().optional(),
        level: z.number().int().min(1).max(5).nullable().optional(),
        sort_order: sortOrderSchema.optional(),
      })
      .strict(),
  },
  projects: {
    table: "projects",
    orderBy: "sort_order, id",
    columns: {
      title: "title",
      description: "description",
      technologies: "technologies",
      repo_url: "repo_url",
      demo_url: "demo_url",
      image_url: "image_url",
      sort_order: "sort_order",
    },
    schema: z
      .object({
        title: z.string().trim().min(1).max(150),
        description: z.string().trim().max(5000).nullable().optional(),
        technologies: z.array(z.string().trim().min(1).max(50)).max(30).nullable().optional(),
        repo_url: httpUrlSchema.nullable().optional(),
        demo_url: httpUrlSchema.nullable().optional(),
        image_url: httpUrlSchema.nullable().optional(),
        sort_order: sortOrderSchema.optional(),
      })
      .strict(),
  },
};

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function contentRouter(config: ContentConfig) {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/",
    asyncRoute(async (req, res) => {
      const { rows } = await pool.query(
        `SELECT * FROM ${config.table} WHERE user_id = $1 ORDER BY ${config.orderBy}`,
        [req.session.userId],
      );
      res.json({ items: rows });
    }),
  );

  router.post(
    "/",
    asyncRoute(async (req, res) => {
      const parsed = config.schema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error.issues);
        return;
      }
      const values = Object.entries(parsed.data as Record<string, unknown>);
      const columns = values.map(([key]) => config.columns[key]);
      const placeholders = values.map((_, index) => `$${index + 2}`);
      const { rows } = await pool.query(
        `INSERT INTO ${config.table} (user_id, ${columns.join(", ")}) VALUES ($1, ${placeholders.join(", ")}) RETURNING *`,
        [req.session.userId, ...values.map(([, value]) => value)],
      );
      await invalidatePortfolioCache(req.session.userId!);
      res.status(201).json({ item: rows[0] });
    }),
  );

  router.put(
    "/:id",
    asyncRoute(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "Invalid item id" });
        return;
      }
      const updateSchema = config.schema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error.issues);
        return;
      }
      const values = Object.entries(parsed.data as Record<string, unknown>);
      if (values.length === 0) {
        res.status(400).json({ error: "Provide at least one field to update." });
        return;
      }
      const assignments = values.map(([key], index) => `${config.columns[key]} = $${index + 1}`);
      const { rows } = await pool.query(
        `UPDATE ${config.table} SET ${assignments.join(", ")} WHERE id = $${values.length + 1} AND user_id = $${values.length + 2} RETURNING *`,
        [...values.map(([, value]) => value), id, req.session.userId],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Item not found" });
        return;
      }
      await invalidatePortfolioCache(req.session.userId!);
      res.json({ item: rows[0] });
    }),
  );

  router.delete(
    "/:id",
    asyncRoute(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "Invalid item id" });
        return;
      }
      const { rowCount } = await pool.query(`DELETE FROM ${config.table} WHERE id = $1 AND user_id = $2`, [
        id,
        req.session.userId,
      ]);
      if (!rowCount) {
        res.status(404).json({ error: "Item not found" });
        return;
      }
      await invalidatePortfolioCache(req.session.userId!);
      res.status(204).end();
    }),
  );

  return router;
}

export const experiencesRouter = contentRouter(configs.experiences);
export const educationRouter = contentRouter(configs.education);
export const skillsRouter = contentRouter(configs.skills);
export const projectsRouter = contentRouter(configs.projects);
