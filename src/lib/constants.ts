export type Role =
  | "RESIDENT_OWNER"
  | "SOCIETY_OFFICIAL"
  | "NON_RESIDENT_OWNER"
  | "SECURITY_GUARD"
  | "MAINTENANCE_STAFF";

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
