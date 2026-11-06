import { RedisStore } from "connect-redis";
import session from "express-session";
import { redis, sessionPrefix } from "./redis.js";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const secret = process.env.SESSION_SECRET;
if (
  !secret ||
  (process.env.NODE_ENV === "production" &&
    (secret.length < 32 || secret === "change_me_with_a_long_random_string"))
) {
  throw new Error("Set a strong SESSION_SECRET in the environment before starting the API.");
}

export const SESSION_COOKIE_NAME = "portfolio.sid";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  store: new RedisStore({ client: redis, prefix: sessionPrefix }),
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  },
});
