/**
 * Friendly names for the generated schema components.
 *
 * Feature code imports from here rather than reaching into
 * `generated/schema.d.ts` directly, so a regenerated contract surfaces as a
 * single compile error in this file instead of dozens across the app.
 */

import type { components } from "./generated/schema";

type S = components["schemas"];

// Society administration
export type Flat = S["FlatResponse"];
export type User = S["UserResponse"];
export type AuditLog = S["AuditLogResponse"];

// Maintenance & payments
export type Invoice = S["InvoiceResponse"];
export type InvoiceCreate = S["InvoiceCreate"];
export type Payment = S["PaymentResponse"];
export type PaymentOrder = S["PaymentOrderResponse"];
export type PaymentConfirmRequest = S["PaymentConfirmRequest"];
export type OfflinePaymentRequest = S["OfflinePaymentRequest"];
export type MaintenanceSummary = S["MaintenanceSummaryResponse"];
export type RiskScore = S["RiskScoreResponse"];

// Complaints
export type Complaint = S["ComplaintResponse"];
export type ComplaintCreate = S["ComplaintCreate"];
export type ComplaintHistoryEntry = S["ComplaintHistoryEntry"];
export type ComplaintSummary = S["ComplaintSummaryResponse"];

// Facilities & bookings
export type Facility = S["FacilityResponse"];
export type Slot = S["SlotResponse"];
export type SlotCreate = S["SlotCreate"];
export type Booking = S["BookingResponse"];

// Visitors & emergency
export type GuestPass = S["GuestPassResponse"];
export type GuestPassCreate = S["GuestPassCreate"];
export type GuestPassVerify = S["GuestPassVerifyResponse"];
export type SOSIncident = S["SOSResponse"];

// Announcements & notifications
export type Announcement = S["AnnouncementResponse"];
export type AnnouncementCreate = S["AnnouncementCreate"];
export type Notification = S["NotificationResponse"];

// Dashboards
export type ResidentDashboard = S["ResidentDashboardResponse"];
export type OfficialDashboard = S["OfficialDashboardResponse"];
export type NonResidentDashboard = S["NonResidentDashboardResponse"];

// Shared
export type Message = S["MessageResponse"];

// Enum values. The response models type these fields as plain `string`, so the
// narrow unions come from the dedicated enum schemas the request bodies use.
export type ComplaintStatus = S["ComplaintStatus"];
export type ComplaintUrgency = S["UrgencyLevel"];
export type ComplaintCategory = S["ComplaintCategory"];
export type InvoiceStatus = S["InvoiceStatus"];
export type GuestPassStatus = S["GuestPassStatus"];
export type SOSStatus = S["SOSStatus"];
export type Audience = S["Audience"];
export type Role = S["Role"];
export type Relation = S["Relation"];
export type OccupancyType = S["OccupancyType"];
