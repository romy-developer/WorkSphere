import type { AuthenticatedUser } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

interface UserResponse {
  user: AuthenticatedUser;
}

interface CsrfResponse {
  csrfToken: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
    credentials: "include",
  });
  const result = await readJson(response, parseCsrfResponse);
  return result.csrfToken;
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser> {
  const result = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: "include",
  });
  return (await readJson(result, parseUserResponse)).user;
}

export async function login(email: string, password: string): Promise<AuthenticatedUser> {
  const csrfToken = await fetchCsrfToken();
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ email, password }),
  });
  return (await readJson(response, parseUserResponse)).user;
}

export async function logout(): Promise<void> {
  const csrfToken = await fetchCsrfToken();
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });

  if (!response.ok && response.status !== 204) {
    await readJson(response, () => undefined);
  }
}

export async function fetchDashboard(): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
    credentials: "include",
  });
  return readJson(response, parseDashboardResponse);
}

export async function fetchRoleMatrix(): Promise<{ roles: RoleMatrixEntry[] }> {
  const response = await fetch(`${API_BASE_URL}/api/access-control`, {
    credentials: "include",
  });
  return readJson(response, parseRoleMatrixResponse);
}

export interface RoleMatrixEntry {
  name: string;
  description: string;
  permissions: string[];
}

async function readJson<T>(response: Response, parse: (payload: unknown) => T): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "The server could not complete the request.";
    throw new AuthApiError(message, response.status);
  }

  return parse(payload);
}

function parseCsrfResponse(payload: unknown): CsrfResponse {
  if (isRecord(payload) && typeof payload.csrfToken === "string") {
    return { csrfToken: payload.csrfToken };
  }
  throw new AuthApiError("The server returned an invalid response.", 502);
}

function parseUserResponse(payload: unknown): UserResponse {
  if (!isRecord(payload) || !isRecord(payload.user)) {
    throw new AuthApiError("The server returned an invalid response.", 502);
  }

  const user = payload.user;
  if (
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.name !== "string" ||
    !isStringArray(user.roles) ||
    !isStringArray(user.permissions)
  ) {
    throw new AuthApiError("The server returned an invalid response.", 502);
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      permissions: user.permissions,
    },
  };
}

function parseDashboardResponse(payload: unknown): { message: string } {
  if (isRecord(payload) && typeof payload.message === "string") {
    return { message: payload.message };
  }
  throw new AuthApiError("The server returned an invalid response.", 502);
}

function parseRoleMatrixResponse(payload: unknown): { roles: RoleMatrixEntry[] } {
  if (!isRecord(payload) || !Array.isArray(payload.roles)) {
    throw new AuthApiError("The server returned an invalid response.", 502);
  }

  const roles = payload.roles.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.name !== "string" ||
      typeof entry.description !== "string" ||
      !isStringArray(entry.permissions)
    ) {
      throw new AuthApiError("The server returned an invalid response.", 502);
    }
    return { name: entry.name, description: entry.description, permissions: entry.permissions };
  });

  return { roles };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}