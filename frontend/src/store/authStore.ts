import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "../lib/constants";

/**
 * Session state, backed by the real API.
 *
 * This module deliberately performs no network calls. `api/client.ts` reads
 * tokens from here to authorise every request, so if the store imported the
 * client the two would form a cycle. Login and registration live in
 * `api/auth.ts` instead, and write their result back through `setSession`.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  /** Display label such as "B-304". Resolved from GET /v1/flats after login. */
  flatNo?: string;
  /** Backend UUID of the user's flat — required for guest pass and SOS creation. */
  flatId?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

const STORAGE_KEY = "meridian.auth";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: STORAGE_KEY,
      // Tokens are persisted so a refresh does not sign the user out. This puts
      // them within reach of any script running on the page; the backend hands
      // tokens back in the response body, so a httpOnly cookie is not available
      // without changing the API contract. Access tokens are short-lived (15
      // minutes) and refresh tokens are rotated on every use, which bounds the
      // damage rather than eliminating it.
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name);
          return raw ? JSON.parse(raw) : null;
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

// --- Non-hook accessors -----------------------------------------------------
// `api/client.ts` runs outside React, so it reads and writes the session
// through these rather than through the hook.

export function getAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
  const { accessToken, refreshToken } = useAuthStore.getState();
  return { accessToken, refreshToken };
}

/** Store a rotated token pair, leaving the signed-in user untouched. */
export function setAuthTokens(accessToken: string, refreshToken: string): void {
  useAuthStore.setState({ accessToken, refreshToken });
}

export function clearAuth(): void {
  useAuthStore.getState().logout();
}
