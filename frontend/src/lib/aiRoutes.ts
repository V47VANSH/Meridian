/**
 * Where each AI intent leads, per role.
 *
 * The assistant's job is to work out what someone wants; the screens already
 * do that work. Mapping the backend's `card_type` onto a route means the chat
 * hands the user to the real page instead of re-implementing it, so what they
 * see there is the same data every other screen shows.
 *
 * A route is per-role because the same intent lives at different paths — a
 * resident's guest pass screen is not the non-resident owner's.
 */

import type { Role } from "./constants";

/** Intents the assistant can return, mirroring `CARD_TYPES` in ai_service.py. */
export type AiIntent =
  | "booking"
  | "complaint"
  | "guestpass"
  | "announcements"
  | "dues"
  | "sos"
  | "mybookings"
  | "residentDirectory"
  | "complaintTriage"
  | "announcementCompose"
  | "bookingsSchedule"
  | "propertyStatus"
  | "verifyPass"
  | "sosInbox"
  | "staffTasks";

export interface AiDestination {
  label: string;
  path: string;
}

type RoleRoutes = Partial<Record<AiIntent, AiDestination>>;

const RESIDENT: RoleRoutes = {
  booking: { label: "Open Facility Calendar", path: "/resident/bookings/calendar" },
  mybookings: { label: "Open My Bookings", path: "/resident/bookings/mine" },
  complaint: { label: "Raise a Complaint", path: "/resident/complaints/raise" },
  complaintTriage: { label: "Open My Complaints", path: "/resident/complaints" },
  guestpass: { label: "Generate a Guest Pass", path: "/resident/visitors/guest-pass" },
  announcements: { label: "Open Announcements", path: "/resident/announcements" },
  dues: { label: "Open My Invoices", path: "/resident/maintenance/invoices" },
  sos: { label: "Open Emergency SOS", path: "/resident/sos" },
};

const OFFICIAL: RoleRoutes = {
  residentDirectory: { label: "Open Resident Directory", path: "/official/residents" },
  complaintTriage: { label: "Open Complaint Triage", path: "/official/complaints/triage" },
  complaint: { label: "Open Complaint Triage", path: "/official/complaints/triage" },
  announcementCompose: {
    label: "Compose an Announcement",
    path: "/official/announcements/compose",
  },
  announcements: { label: "Compose an Announcement", path: "/official/announcements/compose" },
  bookingsSchedule: { label: "Open Booking Schedule", path: "/official/bookings/schedule" },
  booking: { label: "Open Booking Schedule", path: "/official/bookings/schedule" },
  mybookings: { label: "Open Booking Schedule", path: "/official/bookings/schedule" },
  dues: { label: "Open Invoice Management", path: "/official/maintenance/invoices" },
};

const NON_RESIDENT: RoleRoutes = {
  propertyStatus: { label: "Open Property Status", path: "/non-resident/property-status" },
  dues: { label: "Open Property Status", path: "/non-resident/property-status" },
  complaintTriage: { label: "Open Property Status", path: "/non-resident/property-status" },
  guestpass: { label: "Generate a Guest Pass", path: "/non-resident/guest-pass" },
  announcements: { label: "Open Announcements", path: "/non-resident/announcements" },
};

const GUARD: RoleRoutes = {
  verifyPass: { label: "Open Pass Verification", path: "/guard/verify" },
  guestpass: { label: "Open Pass Verification", path: "/guard/verify" },
  sosInbox: { label: "Open SOS Inbox", path: "/guard/sos-inbox" },
  sos: { label: "Open SOS Inbox", path: "/guard/sos-inbox" },
};

const STAFF: RoleRoutes = {
  staffTasks: { label: "Open My Tasks", path: "/staff/tasks" },
  complaint: { label: "Open My Tasks", path: "/staff/tasks" },
  complaintTriage: { label: "Open My Tasks", path: "/staff/tasks" },
};

const ROUTES: Record<Role, RoleRoutes> = {
  RESIDENT_OWNER: RESIDENT,
  SOCIETY_OFFICIAL: OFFICIAL,
  NON_RESIDENT_OWNER: NON_RESIDENT,
  SECURITY_GUARD: GUARD,
  MAINTENANCE_STAFF: STAFF,
};

/**
 * The screen this intent leads to for this role, if there is one.
 *
 * Returns null rather than guessing: the classifier can return an intent a
 * role has no screen for (a guard asking about dues), and offering a link
 * that 403s or bounces off RequireRole is worse than saying nothing.
 */
export function destinationFor(role: Role, intent: string | null | undefined): AiDestination | null {
  if (!intent) return null;
  return ROUTES[role][intent as AiIntent] ?? null;
}

/** Suggestion chips, in the order each role is most likely to want them. */
export const SUGGESTIONS: Record<Role, string[]> = {
  RESIDENT_OWNER: [
    "Book a facility slot",
    "Raise a complaint",
    "Generate a guest pass",
    "Check my dues",
    "View announcements",
  ],
  SOCIETY_OFFICIAL: [
    "Show the resident directory",
    "Triage open complaints",
    "Post an announcement",
    "Show the booking schedule",
  ],
  NON_RESIDENT_OWNER: ["Check my property status", "Generate a guest pass", "View announcements"],
  SECURITY_GUARD: ["Verify a guest pass", "Show SOS alerts"],
  MAINTENANCE_STAFF: ["Show my assigned tasks"],
};
