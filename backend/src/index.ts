import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { connectRedis } from "./redis.js";
import { sessionMiddleware } from "./session.js";
import { healthRouter } from "./routes/health.js";
import { publicRouter } from "./routes/public.js";
import { cvRouter } from "./routes/cv.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { educationRouter, experiencesRouter, projectsRouter, skillsRouter } from "./routes/content.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(sessionMiddleware);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/experiences", experiencesRouter);
app.use("/api/education", educationRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/public", publicRouter);
app.use("/api/cv", cvRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("API request failed", error);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  await connectRedis();
  app.listen(port, () => console.log(`API démarrée sur le port ${port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
