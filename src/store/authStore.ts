import { create } from "zustand";
import type { Role } from "../lib/constants";

interface AuthUser {
  name: string;
  role: Role;
  flatNo?: string;
}

interface AuthState {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

// NOTE: This is a frontend-only mock. There is no backend call here —
// "login" just sets local state so pages behind each role can be reviewed.
// Replace with a real API call + JWT decode once the backend contract lands.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
