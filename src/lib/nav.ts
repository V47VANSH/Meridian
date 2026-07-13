import type { Role } from "./constants";

export interface NavItem {
  label: string;
  path: string;
  code: string; // blueprint-style spec code, e.g. "F-01"
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  RESIDENT_OWNER: [
    { code: "D-01", label: "Dashboard", path: "/resident/dashboard" },
  ],
};
