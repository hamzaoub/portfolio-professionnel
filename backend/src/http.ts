import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncRoute(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

export function sendValidationError(res: Response, issues: unknown): void {
  res.status(400).json({ error: "Invalid request", details: issues });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  next();
};
