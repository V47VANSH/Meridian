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
    raisedBy: "Resident",
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
    raisedBy: "Resident",
    flatNo: "C-101",
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
    raisedBy: "Resident",
    flatNo: "A-207",
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
      { id: "COM-01", author: "Resident C101", role: "Resident", body: "Will the clubhouse water also be turned off?", postedAt: "Jul 12, 4:15 PM" },
      { id: "COM-02", author: "Society Official", role: "Official", body: "Yes, the main supply header is being cleaned, so all outlets are affected.", postedAt: "Jul 12, 5:00 PM" }
    ]
  },
  {
    id: "ANN-30",
    title: "Annual General Meeting — Jul 27",
    body: "AGM will be held at the Community Hall at 6 PM. Attendance is encouraged for all flat owners.",
    postedBy: "Society Official",
    postedAt: "Jul 9, 2026",
    comments: [
      { id: "COM-03", author: "Resident A102", role: "Resident", body: "Can we submit agenda items in advance?", postedAt: "Jul 10, 9:00 AM" }
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
  type: "OWNER" | "TENANT";
  contact: string;
  duesStatus: "CLEAR" | "PENDING";
}

export const residents: Resident[] = [
  { flatNo: "A-102", name: "Resident A102", type: "OWNER", contact: "98xxxxxx02", duesStatus: "CLEAR" },
  { flatNo: "B-304", name: "Resident B304", type: "OWNER", contact: "98xxxxxx04", duesStatus: "PENDING" },
  { flatNo: "C-101", name: "Resident C101", type: "TENANT", contact: "98xxxxxx01", duesStatus: "CLEAR" },
  { flatNo: "D-205", name: "Resident D205", type: "OWNER", contact: "98xxxxxx05", duesStatus: "PENDING" },
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
