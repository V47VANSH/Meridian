import type { Role } from "./constants";

export interface NavItem {
  label: string;
  path: string;
  code: string; // blueprint-style spec code, e.g. "F-01"
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  RESIDENT_OWNER: [
    { code: "D-01", label: "Dashboard", path: "/resident/dashboard" },
    { code: "M-01", label: "Invoices", path: "/resident/maintenance/invoices" },
    { code: "M-02", label: "Payment History", path: "/resident/maintenance/history" },
    { code: "C-01", label: "Raise Complaint", path: "/resident/complaints/raise" },
    { code: "C-02", label: "My Complaints", path: "/resident/complaints" },
    { code: "B-01", label: "Facility Calendar", path: "/resident/bookings/calendar" },
    { code: "B-02", label: "My Bookings", path: "/resident/bookings/mine" },
    { code: "V-01", label: "Guest Pass", path: "/resident/visitors/guest-pass" },
    { code: "V-02", label: "Pass History", path: "/resident/visitors/history" },
    { code: "S-01", label: "Emergency SOS", path: "/resident/sos" },
    { code: "A-01", label: "Announcements", path: "/resident/announcements" },
  ],
  SOCIETY_OFFICIAL: [
    { code: "D-02", label: "Dashboard", path: "/official/dashboard" },
    { code: "R-01", label: "Resident Directory", path: "/official/residents" },
    { code: "M-03", label: "Invoice Management", path: "/official/maintenance/invoices" },
    { code: "C-03", label: "Complaint Triage", path: "/official/complaints/triage" },
    { code: "B-03", label: "Booking Schedule", path: "/official/bookings/schedule" },
    { code: "A-02", label: "Announcement Composer", path: "/official/announcements/compose" },
  ],
  NON_RESIDENT_OWNER: [
    { code: "D-03", label: "Dashboard", path: "/non-resident/dashboard" },
    { code: "P-01", label: "Property Status", path: "/non-resident/property-status" },
    { code: "V-03", label: "Guest Pass", path: "/non-resident/guest-pass" },
    { code: "A-03", label: "Announcements", path: "/non-resident/announcements" },
  ],
  SECURITY_GUARD: [
    { code: "G-01", label: "Verify Guest Pass", path: "/guard/verify" },
    { code: "G-02", label: "SOS Inbox", path: "/guard/sos-inbox" },
  ],
  MAINTENANCE_STAFF: [{ code: "T-01", label: "Assigned Tasks", path: "/staff/tasks" }],
};
