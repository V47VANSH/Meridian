import type { Role } from "./constants";

export interface NavItem {
  label: string;
  path: string;
  code?: string;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  RESIDENT_OWNER: [
    { label: "Dashboard", path: "/resident/dashboard" },
    { label: "Invoices", path: "/resident/maintenance/invoices" },
    { label: "Payment History", path: "/resident/maintenance/history" },
    { label: "Raise Complaint", path: "/resident/complaints/raise" },
    { label: "My Complaints", path: "/resident/complaints" },
    { label: "Facility Calendar", path: "/resident/bookings/calendar" },
    { label: "My Bookings", path: "/resident/bookings/mine" },
    { label: "Guest Pass", path: "/resident/visitors/guest-pass" },
    { label: "Pass History", path: "/resident/visitors/history" },
    { label: "Emergency SOS", path: "/resident/sos" },
    { label: "Announcements", path: "/resident/announcements" },
  ],
  SOCIETY_OFFICIAL: [
    { label: "Dashboard", path: "/official/dashboard" },
    { label: "Resident Directory", path: "/official/residents" },
    { label: "Invoice Management", path: "/official/maintenance/invoices" },
    { label: "Complaint Triage", path: "/official/complaints/triage" },
    { label: "Booking Schedule", path: "/official/bookings/schedule" },
    { label: "Announcement Composer", path: "/official/announcements/compose" },
  ],
  NON_RESIDENT_OWNER: [
    { label: "Dashboard", path: "/non-resident/dashboard" },
    { label: "Property Status", path: "/non-resident/property-status" },
    { label: "Guest Pass", path: "/non-resident/guest-pass" },
    { label: "Announcements", path: "/non-resident/announcements" },
  ],
  SECURITY_GUARD: [
    { label: "Verify Guest Pass", path: "/guard/verify" },
    { label: "SOS Inbox", path: "/guard/sos-inbox" },
  ],
  MAINTENANCE_STAFF: [{ label: "Assigned Tasks", path: "/staff/tasks" }],
};
