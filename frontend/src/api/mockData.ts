// Mock/static data standing in for `src/api/generated/` (the OpenAPI-codegen'd
// client described in the architecture doc). Swap each of these for real
// React Query hooks once the backend publishes its OpenAPI spec.

import { useState, useEffect } from "react";

let listeners: (() => void)[] = [];

export function subscribeToMockData(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function notifyMockDataChanged() {
  listeners.forEach((l) => l());
}

export function useMockData() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeToMockData(() => setTick((t) => t + 1)), []);
}

export function syncComplaintsFromBackend(items: any[], currentUser?: any) {
  if (!Array.isArray(items)) return;
  let updated = false;

  items.forEach((item: any) => {
    const existingIndex = complaints.findIndex((c) => c.id === item.id);
    // Map backend urgency: HIGH -> URGENT (frontend vocabulary)
    const urgencyLabel = item.urgency === "HIGH" ? "URGENT" : (item.urgency || "MEDIUM");
    // Capitalise category label for display
    const categoryLabel = item.category
      ? item.category.charAt(0).toUpperCase() + item.category.slice(1).toLowerCase().replace(/_/g, " ")
      : "General";

    // Prefer existing display name if we already have the complaint locally,
    // otherwise fall back to the currentUser name or a placeholder.
    const existingRaisedBy = existingIndex !== -1 ? complaints[existingIndex].raisedBy : undefined;

    const formatted: Complaint = {
      id: item.id,
      title: item.title,
      category: categoryLabel,
      // Keep the human-readable name if we have it; never overwrite with a UUID
      raisedBy: existingRaisedBy || currentUser?.name || "Resident",
      // Always store the backend UUID so ComplaintListPage can filter by ID
      raisedById: item.raised_by,
      flatNo: currentUser?.flatNo || (existingIndex !== -1 ? complaints[existingIndex].flatNo : "B-304"),
      status: (item.status as any) || "OPEN",
      urgency: urgencyLabel as any,
      createdAt: item.created_at ? String(item.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: item.description || "",
      timeline: item.history && item.history.length > 0
        ? item.history.map((h: any) => ({
            label: h.note ? h.note : `Status changed to ${h.status}`,
            date: h.changed_at ? String(h.changed_at).slice(0, 10) : (h.created_at ? String(h.created_at).slice(0, 10) : "Today"),
          }))
        : [{ label: "Complaint raised", date: item.created_at ? String(item.created_at).slice(0, 10) : "Today" }],
    };

    if (existingIndex === -1) {
      complaints.unshift(formatted);
      updated = true;
    } else {
      complaints[existingIndex] = { ...complaints[existingIndex], ...formatted };
      updated = true;
    }
  });

  if (updated) {
    notifyMockDataChanged();
  }
}

export function syncAnnouncementsFromBackend(items: any[]) {
  if (!Array.isArray(items)) return;
  let updated = false;
  items.forEach((item: any) => {
    const existingIndex = announcements.findIndex((a) => a.id === item.id);
    const formatted: Announcement = {
      id: item.id,
      title: item.title,
      body: item.body,
      postedBy: "Society Official",
      postedAt: item.created_at
        ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "Today",
      comments: existingIndex !== -1 ? (announcements[existingIndex].comments ?? []) : [],
    };
    if (existingIndex === -1) {
      announcements.unshift(formatted);
      updated = true;
    } else {
      announcements[existingIndex] = { ...announcements[existingIndex], ...formatted };
      updated = true;
    }
  });
  if (updated) notifyMockDataChanged();
}

export function syncGuestPassesFromBackend(items: any[]) {
  if (!Array.isArray(items)) return;
  let updated = false;
  items.forEach((item: any) => {
    const existingIndex = guestPasses.findIndex((p) => p.id === item.id);
    const formatted: GuestPass = {
      id: item.id,
      guestName: item.visitor_name,
      purpose: item.purpose || "Visit",
      validOn: item.valid_from ? String(item.valid_from).slice(0, 10) : "",
      flatNo: "B-304", // will be resolved from flat_id elsewhere
      status: item.status === "ACTIVE" ? "ACTIVE" : item.status === "USED" ? "USED" : "EXPIRED",
    };
    if (existingIndex === -1) {
      guestPasses.unshift(formatted);
      updated = true;
    } else {
      guestPasses[existingIndex] = { ...guestPasses[existingIndex], ...formatted };
      updated = true;
    }
  });
  if (updated) notifyMockDataChanged();
}

export function syncBookingsFromBackend(items: any[], currentUser?: any) {
  if (!Array.isArray(items)) return;
  // Replace all bookings with backend data for the current user
  const backendIds = new Set(items.map((i: any) => i.id));
  // Remove bookings that exist in backend set or were added locally without id match
  const filtered = bookings.filter((b) => !backendIds.has(b.id) && !b.id.startsWith("BK-"));
  let updated = false;
  items.forEach((item: any) => {
    const existingIndex = bookings.findIndex((b) => b.id === item.id);
    const formatted: Booking = {
      id: item.id,
      facility: item.facility_name || "Facility",
      date: item.date || "",
      slot: item.start_time && item.end_time ? `${item.start_time}\u2013${item.end_time}` : "",
      bookedBy: currentUser?.name || "Resident",
      flatNo: currentUser?.flatNo || "B-304",
    };
    if (existingIndex === -1) {
      bookings.unshift(formatted);
      updated = true;
    } else {
      bookings[existingIndex] = { ...bookings[existingIndex], ...formatted };
      updated = true;
    }
  });
  if (updated) notifyMockDataChanged();
}

export function syncInvoicesFromBackend(items: any[], currentUser?: any) {
  if (!Array.isArray(items)) return;
  let updated = false;
  items.forEach((item: any) => {
    const existingIndex = invoices.findIndex((i) => i.id === item.id);
    // Map backend period (YYYY-MM) to a display month
    const periodDate = item.period ? new Date(item.period + "-01") : null;
    const monthLabel = periodDate
      ? periodDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : item.period || "";
    const formatted: Invoice = {
      id: item.id,
      month: monthLabel,
      amount: item.amount,
      status: item.status as "PAID" | "PENDING" | "OVERDUE",
      dueDate: item.due_date ? String(item.due_date).slice(0, 10) : "",
      flatNo: currentUser?.flatNo,
    };
    if (existingIndex === -1) {
      invoices.push(formatted);
      updated = true;
    } else {
      invoices[existingIndex] = { ...invoices[existingIndex], ...formatted };
      updated = true;
    }
  });
  if (updated) notifyMockDataChanged();
}



export interface Invoice {
  id: string;
  month: string;
  amount: number;
  status: "PAID" | "PENDING" | "OVERDUE";
  dueDate: string;
  flatNo?: string;
}

export const invoices: Invoice[] = [
  { id: "INV-2026-06", month: "June 2026", amount: 4200, status: "PAID", dueDate: "2026-06-10", flatNo: "B-304" },
  { id: "INV-2026-07", month: "July 2026", amount: 4200, status: "PENDING", dueDate: "2026-07-10", flatNo: "B-304" },
  { id: "INV-2026-05", month: "May 2026", amount: 4000, status: "PAID", dueDate: "2026-05-10", flatNo: "C-101" },
  { id: "INV-2026-04", month: "April 2026", amount: 4000, status: "OVERDUE", dueDate: "2026-04-10", flatNo: "B-304" },
  { id: "INV-2026-08", month: "August 2026", amount: 4500, status: "PENDING", dueDate: "2026-08-10", flatNo: "A-102" },
  { id: "INV-2026-09", month: "August 2026", amount: 4500, status: "PAID", dueDate: "2026-08-10", flatNo: "D-205" },
];

export interface Complaint {
  id: string;
  title: string;
  category: string;
  raisedBy: string;
  /** UUID from backend — used to match after page refresh when name is unknown */
  raisedById?: string;
  flatNo: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  urgency: "LOW" | "MEDIUM" | "URGENT";
  createdAt: string;
  timeline: { label: string; date: string }[];
  description?: string;
}

export const complaints: Complaint[] = [
  {
    id: "CMP-1042",
    title: "Water leakage in basement parking",
    category: "Plumbing",
    raisedBy: "Arjun Rao",
    flatNo: "B-304",
    status: "IN_PROGRESS",
    urgency: "URGENT",
    createdAt: "2026-07-08",
    description: "Heavy water leakage observed in basement parking row B. Water is dripping onto parked cars and creating a slippery surface. Urgent inspection needed.",
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
    raisedBy: "Arjun Rao",
    flatNo: "B-304",
    status: "OPEN",
    urgency: "MEDIUM",
    createdAt: "2026-07-10",
    description: "The elevator in Block C is vibrating heavily and making a loud screeching mechanical sound during operations, especially between 3rd and 5th floors.",
    timeline: [{ label: "Complaint raised", date: "Jul 10, 9:20 AM" }],
  },
  {
    id: "CMP-1039",
    title: "Garden light not working near Gate 2",
    category: "Common Area",
    raisedBy: "Arjun Rao",
    flatNo: "B-304",
    status: "RESOLVED",
    urgency: "LOW",
    createdAt: "2026-07-02",
    description: "The pedestrian garden light near the pathway of Gate 2 is completely out. It gets very dark in the evening, making it hazardous for residents walking.",
    timeline: [
      { label: "Complaint raised", date: "Jul 2, 6:40 PM" },
      { label: "Assigned to electrician", date: "Jul 3, 9:00 AM" },
      { label: "Resolved", date: "Jul 3, 4:30 PM" },
    ],
  },
];

export interface Facility {
  id: string;
  name: string;
}

export const facilities: Facility[] = [
  { id: "clubhouse", name: "Clubhouse" },
  { id: "tennis", name: "Tennis Court" },
  { id: "pool", name: "Swimming Pool" },
  { id: "hall", name: "Community Hall" },
  { id: "gym", name: "Gymnasium" },
];

export const timeSlots = ["06:00–07:00", "07:00–08:00", "17:00–18:00", "18:00–19:00", "19:00–20:00"];

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

export interface GuestPass {
  id: string;
  guestName: string;
  purpose: string;
  validOn: string;
  flatNo: string;
  status: "ACTIVE" | "USED" | "EXPIRED";
}

export const guestPasses: GuestPass[] = [
  { id: "GP-2201", guestName: "R. Kumar", purpose: "Personal visit", validOn: "2026-07-13", flatNo: "B-304", status: "ACTIVE" },
  { id: "GP-2189", guestName: "Swiggy Delivery", purpose: "Delivery", validOn: "2026-07-11", flatNo: "B-304", status: "USED" },
];

export interface SOSAlert {
  id: string;
  flatNo: string;
  raisedBy: string;
  raisedAt: string;
  status: "ACTIVE" | "ACKNOWLEDGED";
}

export const sosAlerts: SOSAlert[] = [
  { id: "SOS-08", flatNo: "C-101", raisedBy: "Resident", raisedAt: "Jul 12, 11:42 PM", status: "ACKNOWLEDGED" },
];

export interface Comment {
  id: string;
  author: string;
  role: string;
  body: string;
  postedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  postedBy: string;
  postedAt: string;
  comments?: Comment[];
}

export const announcements: Announcement[] = [
  {
    id: "ANN-31",
    title: "Water supply interruption — Jul 15",
    body: "Water supply will be suspended from 10 AM to 1 PM for tank cleaning across all blocks.",
    postedBy: "Society Official",
    postedAt: "Jul 12, 2026",
    comments: [
      { id: "COM-01", author: "Resident C101", role: "Resident / Flat Owner", body: "Will the clubhouse water also be turned off?", postedAt: "Jul 12, 4:15 PM" },
      { id: "COM-02", author: "Society Official", role: "Society Official", body: "Yes, the main supply header is being cleaned, so all outlets are affected.", postedAt: "Jul 12, 5:00 PM" }
    ]
  },
  {
    id: "ANN-30",
    title: "Annual General Meeting — Jul 27",
    body: "AGM will be held at the Community Hall at 6 PM. Attendance is encouraged for all flat owners.",
    postedBy: "Society Official",
    postedAt: "Jul 9, 2026",
    comments: [
      { id: "COM-03", author: "Resident A102", role: "Resident / Flat Owner", body: "Can we submit agenda items in advance?", postedAt: "Jul 10, 9:00 AM" }
    ]
  },
  {
    id: "ANN-29",
    title: "Festival decoration guidelines",
    body: "Please avoid nails/adhesives on common area walls. Contact the office for approved decoration points.",
    postedBy: "Society Official",
    postedAt: "Jul 5, 2026",
    comments: []
  },
];

export interface Resident {
  flatNo: string;
  name: string;
  email: string;
  type: "OWNER" | "TENANT";
  contact: string;
  duesStatus: "CLEAR" | "PENDING";
}

export const residents: Resident[] = [
  { flatNo: "A-102", name: "Aarav Sharma", email: "aarav@greenvalley.example", type: "OWNER", contact: "9800000010", duesStatus: "CLEAR" },
  { flatNo: "B-304", name: "Arjun Rao", email: "resident@greenvalley.example", type: "OWNER", contact: "9800000011", duesStatus: "PENDING" },
  { flatNo: "C-101", name: "Neha Gupta", email: "tenant@greenvalley.example", type: "TENANT", contact: "9800000012", duesStatus: "CLEAR" },
  { flatNo: "D-205", name: "Rohan Verma", email: "rohan@greenvalley.example", type: "OWNER", contact: "9800000013", duesStatus: "PENDING" },
];



export interface StaffTask {
  id: string;
  task: string;
  location: string;
  assignedTo: string;
  status: "PENDING" | "IN_PROGRESS" | "DONE";
  dueBy: string;
}

export const staffTasks: StaffTask[] = [
  { id: "TSK-11", task: "Fix basement leakage", location: "Block B, Basement", assignedTo: "Maintenance Staff", status: "IN_PROGRESS", dueBy: "Jul 10, 5 PM" },
  { id: "TSK-10", task: "Clean clubhouse after event", location: "Clubhouse", assignedTo: "Cleaning Staff", status: "PENDING", dueBy: "Jul 13, 9 AM" },
  { id: "TSK-09", task: "Inspect Block C lift", location: "Block C", assignedTo: "Maintenance Staff", status: "PENDING", dueBy: "Jul 13, 6 PM" },
];
