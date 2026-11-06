import { createClient } from "redis";

export const redis = createClient({ url: process.env.REDIS_URL });
export const sessionPrefix = "portfolio:sess:";

redis.on("error", (err) => console.error("Redis error:", err));

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}
