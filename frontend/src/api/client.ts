/**
 * The single place the frontend talks to the API.
 *
 * Everything the backend guarantees is handled here once, so feature code never
 * repeats it:
 *
 *  - the bearer token is attached from the auth store
 *  - the uniform error body is unwrapped into a typed `ApiError`
 *  - a 401 triggers one refresh attempt and one replay of the request
 *
 * Access tokens live 15 minutes (see backend `ACCESS_TOKEN_EXPIRE_MINUTES`), so
 * transparent refresh is required, not a nicety.
 */

import { getAuthTokens, setAuthTokens, clearAuth } from "../store/authStore";
import type { components } from "./generated/schema";

type ErrorResponse = components["schemas"]["ErrorResponse"];
type TokenResponse = components["schemas"]["TokenResponse"];

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * A failed API call, carrying the backend's machine-readable code.
 *
 * `code` is what callers should branch on — `message` is prose meant for the
 * user and may be reworded server-side at any time.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Correlation id from the backend; quote it when reporting a failure. */
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, requestId: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }

  /** True when the failure is a lost connection rather than a server response. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/** Endpoints that must never trigger the refresh-and-replay path. */
const AUTH_FREE_PATHS = ["/v1/auth/login", "/v1/auth/register", "/v1/auth/refresh"];

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header. Used by login/register. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-Id");
  try {
    const body = (await response.json()) as Partial<ErrorResponse>;
    return new ApiError(
      response.status,
      body.error ?? "HTTP_ERROR",
      body.message ?? response.statusText,
      body.requestId ?? requestId,
    );
  } catch {
    // A non-JSON body means something upstream of the app failed — a proxy
    // error, or the backend not running at all.
    return new ApiError(
      response.status,
      "HTTP_ERROR",
      response.statusText || "The server returned an unreadable response",
      requestId,
    );
  }
}

/**
 * In-flight refresh, shared by every caller.
 *
 * Several queries commonly fail with 401 in the same tick. Without this,
 * each would rotate the refresh token, and because the backend revokes a
 * refresh token as it rotates it, all but the first would be rejected and log
 * the user out.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken } = getAuthTokens();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;

      const tokens = (await response.json()) as TokenResponse;
      setAuthTokens(tokens.access_token, tokens.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared in a microtask so callers awaiting this promise all observe the
      // same result before the next refresh can start.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  if (!options.anonymous) {
    const { accessToken } = getAuthTokens();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

/**
 * Perform an API request and return the parsed body.
 *
 * @throws {ApiError} on any non-2xx response, or on a network failure.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(path, options);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not reach the server. Check that the backend is running.",
      null,
    );
  }

  const refreshable = !options.anonymous && !AUTH_FREE_PATHS.includes(path);
  if (response.status === 401 && refreshable) {
    if (await refreshTokens()) {
      response = await send(path, options);
    } else {
      // The session is genuinely over; drop it so the router sends the user to
      // /login rather than leaving stale credentials in place.
      clearAuth();
    }
  }

  if (!response.ok) throw await toApiError(response);

  // 204 and other empty bodies are valid successes.
  if (response.status === 204 || response.headers.get("Content-Length") === "0") {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
