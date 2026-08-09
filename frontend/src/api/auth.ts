/**
 * Auth endpoints, typed against the generated OpenAPI schema.
 *
 * Request and response shapes come from `generated/schema.d.ts`, so if the
 * backend contract changes and the spec is regenerated, the mismatch surfaces
 * as a compile error here rather than as a runtime bug in a page.
 */

import { api, ApiError } from "./client";
import type { components } from "./generated/schema";
import { isRoutableRole } from "../lib/constants";
import type { AuthUser } from "../store/authStore";

type LoginRequest = components["schemas"]["LoginRequest"];
type RegisterRequest = components["schemas"]["RegisterRequest"];
type TokenResponse = components["schemas"]["TokenResponse"];
type UserResponse = components["schemas"]["UserResponse"];
type MessageResponse = components["schemas"]["MessageResponse"];

/**
 * Convert an API user into the shape the UI renders.
 *
 * @throws {ApiError} when the account's role has no screens in this UI.
 */
export function toAuthUser(user: UserResponse): AuthUser {
  if (!isRoutableRole(user.role)) {
    // SUPER_ADMIN reaches here: a valid account with no UI since UI-V2. Failing
    // loudly beats signing them into a shell with an empty sidebar.
    throw new ApiError(
      403,
      "ROLE_NOT_SUPPORTED",
      `The ${user.role} role has no screens in this application.`,
      null,
    );
  }

  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    tenantId: user.tenant_id ?? null,
  };
}

export function login(payload: LoginRequest): Promise<TokenResponse> {
  return api.post<TokenResponse>("/v1/auth/login", payload, { anonymous: true });
}

export function register(payload: RegisterRequest): Promise<UserResponse> {
  return api.post<UserResponse>("/v1/auth/register", payload, { anonymous: true });
}

export function getCurrentUser(): Promise<UserResponse> {
  return api.get<UserResponse>("/v1/auth/me");
}

export function logout(refreshToken: string): Promise<MessageResponse> {
  return api.post<MessageResponse>("/v1/auth/logout", { refresh_token: refreshToken });
}

export type { LoginRequest, RegisterRequest, TokenResponse, UserResponse };
