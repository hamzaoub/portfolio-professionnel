import { redis } from "./redis.js";
import { pool } from "./db.js";

export async function invalidatePortfolioCache(
  userId: number,
  slugs: Array<string | null | undefined> = [],
): Promise<void> {
  const { rows } = await pool.query<{ slug: string }>("SELECT slug FROM users WHERE id = $1", [userId]);
  const keys = [rows[0]?.slug, ...slugs]
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => `portfolio:${slug}`);

  if (keys.length) await redis.del(keys);
}
