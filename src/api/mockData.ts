// Mock/static data standing in for `src/api/generated/` (the OpenAPI-codegen'd
// client described in the architecture doc). Swap each of these for real
// React Query hooks once the backend publishes its OpenAPI spec.

export interface Invoice {
  id: string;
  month: string;
  amount: number;
  status: "PAID" | "PENDING" | "OVERDUE";
  dueDate: string;
}

export const invoices: Invoice[] = [
  { id: "INV-2026-06", month: "June 2026", amount: 4200, status: "PAID", dueDate: "2026-06-10" },
  { id: "INV-2026-07", month: "July 2026", amount: 4200, status: "PENDING", dueDate: "2026-07-10" },
  { id: "INV-2026-05", month: "May 2026", amount: 4000, status: "PAID", dueDate: "2026-05-10" },
  { id: "INV-2026-04", month: "April 2026", amount: 4000, status: "OVERDUE", dueDate: "2026-04-10" },
];

export interface Complaint {
  id: string;
  title: string;
  category: string;
  raisedBy: string;
  flatNo: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  urgency: "LOW" | "MEDIUM" | "URGENT";
  createdAt: string;
  timeline: { label: string; date: string }[];
}

export const complaints: Complaint[] = [
  {
    id: "CMP-1042",
    title: "Water leakage in basement parking",
    category: "Plumbing",
    raisedBy: "Resident",
    flatNo: "B-304",
    status: "IN_PROGRESS",
    urgency: "URGENT",
    createdAt: "2026-07-08",
    timeline: [
      { label: "Complaint raised", date: "Jul 8, 10:04 AM" },
      { label: "Assigned to maintenance staff", date: "Jul 8, 2:15 PM" },
      { label: "Staff visited site", date: "Jul 9, 11:00 AM" },
    ],
  },
  {
    id: "CMP-1041",
    title: "Lift making unusual noise — Block C",
    category: "Electrical/Mechanical",
    raisedBy: "Resident",
    flatNo: "C-101",
    status: "OPEN",
    urgency: "MEDIUM",
    createdAt: "2026-07-10",
    timeline: [{ label: "Complaint raised", date: "Jul 10, 9:20 AM" }],
  },
  {
    id: "CMP-1039",
    title: "Garden light not working near Gate 2",
    category: "Common Area",
    raisedBy: "Resident",
    flatNo: "A-207",
    status: "RESOLVED",
    urgency: "LOW",
    createdAt: "2026-07-02",
    timeline: [
      { label: "Complaint raised", date: "Jul 2, 6:40 PM" },
      { label: "Assigned to electrician", date: "Jul 3, 9:00 AM" },
      { label: "Resolved", date: "Jul 3, 4:30 PM" },
    ],
  },
];

export interface Booking {
  id: string;
  facility: string;
  date: string;
  slot: string;
  bookedBy: string;
  flatNo: string;
}

export const bookings: Booking[] = [
  { id: "BK-501", facility: "Clubhouse", date: "2026-07-14", slot: "18:00–19:00", bookedBy: "Resident", flatNo: "B-304" },
  { id: "BK-498", facility: "Tennis Court", date: "2026-07-13", slot: "07:00–08:00", bookedBy: "Resident", flatNo: "A-102" },
];

export interface Announcement {
  id: string;
  title: string;
  body: string;
  postedBy: string;
  postedAt: string;
}

export const announcements: Announcement[] = [
  {
    id: "ANN-31",
    title: "Water supply interruption — Jul 15",
    body: "Water supply will be suspended from 10 AM to 1 PM for tank cleaning across all blocks.",
    postedBy: "Society Official",
    postedAt: "Jul 12, 2026",
  },
  {
    id: "ANN-30",
    title: "Annual General Meeting — Jul 27",
    body: "AGM will be held at the Community Hall at 6 PM. Attendance is encouraged for all flat owners.",
    postedBy: "Society Official",
    postedAt: "Jul 9, 2026",
  },
  {
    id: "ANN-29",
    title: "Festival decoration guidelines",
    body: "Please avoid nails/adhesives on common area walls. Contact the office for approved decoration points.",
    postedBy: "Society Official",
    postedAt: "Jul 5, 2026",
  },
];
