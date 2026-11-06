import type { ApiErrorBody } from "../../shared/contracts";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as Partial<ApiErrorBody>)
    : null;
  if (!response.ok)
    throw new ApiError(payload?.error ?? "The request could not be completed.", response.status);
  return payload as T;
}

export type {
  DashboardProfile,
  Education,
  Experience,
  PortfolioData,
  Project,
  SessionUser,
  Skill,
} from "../../shared/contracts";
