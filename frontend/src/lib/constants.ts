/**
 * Roles this UI has screens for.
 *
 * The backend also issues `SUPER_ADMIN`, which was removed from the UI in
 * UI-V2. It is deliberately absent here so that every `Role` is guaranteed to
 * have an entry in ROLE_HOME and NAV_BY_ROLE; `isRoutableRole` is the boundary
 * check for anything arriving from the API.
 */
export type Role =
  | "RESIDENT_OWNER"
  | "SOCIETY_OFFICIAL"
  | "NON_RESIDENT_OWNER"
  | "SECURITY_GUARD"
  | "MAINTENANCE_STAFF";

const ROUTABLE_ROLES = new Set<string>([
  "RESIDENT_OWNER",
  "SOCIETY_OFFICIAL",
  "NON_RESIDENT_OWNER",
  "SECURITY_GUARD",
  "MAINTENANCE_STAFF",
]);

/** Narrows a role string from the API to one this UI can actually route. */
export function isRoutableRole(role: string): role is Role {
  return ROUTABLE_ROLES.has(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  RESIDENT_OWNER: "Resident / Flat Owner",
  SOCIETY_OFFICIAL: "Society Official",
  NON_RESIDENT_OWNER: "Non-Resident Owner",
  SECURITY_GUARD: "Security Guard",
  MAINTENANCE_STAFF: "Maintenance / Cleaning Staff",
};

export const ROLE_HOME: Record<Role, string> = {
  RESIDENT_OWNER: "/resident/dashboard",
  SOCIETY_OFFICIAL: "/official/dashboard",
  NON_RESIDENT_OWNER: "/non-resident/dashboard",
  SECURITY_GUARD: "/guard/sos-inbox",
  MAINTENANCE_STAFF: "/staff/tasks",
};
