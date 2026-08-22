/**
 * Complaints: raising, tracking and triage.
 *
 * `GET /v1/complaints` is already scoped by the caller's role — a resident
 * receives only the complaints they raised, an official and staff receive the
 * society-wide queue — so no screen needs to filter the response by owner.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Complaint,
  ComplaintCreate,
  ComplaintStatus,
  ComplaintSummary,
  ComplaintUrgency,
} from "./types";

export const complaintKeys = {
  all: ["complaints"] as const,
  list: (filter?: string) => ["complaints", "list", filter ?? "all"] as const,
  detail: (id: string) => ["complaints", "detail", id] as const,
  summary: ["complaints", "summary"] as const,
};

/**
 * Status moves the backend accepts from each state.
 *
 * The lifecycle is enforced server-side, so offering a transition it rejects
 * only produces a 400 the user cannot act on. The UI reads the same table to
 * decide which buttons to show.
 */
export const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function listComplaints(params?: {
  status?: ComplaintStatus;
  assignedToMe?: boolean;
}): Promise<Complaint[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.assignedToMe) query.set("assigned_to_me", "true");
  const suffix = query.toString();
  return api.get<Complaint[]>(`/v1/complaints${suffix ? `?${suffix}` : ""}`);
}

export function getComplaint(id: string): Promise<Complaint> {
  return api.get<Complaint>(`/v1/complaints/${id}`);
}

export function getComplaintSummary(): Promise<ComplaintSummary> {
  return api.get<ComplaintSummary>("/v1/complaints/summary");
}

export function useComplaints(params?: { status?: ComplaintStatus; assignedToMe?: boolean }) {
  const filter = `${params?.status ?? "all"}:${params?.assignedToMe ? "mine" : "any"}`;
  return useQuery({
    queryKey: complaintKeys.list(filter),
    queryFn: () => listComplaints(params),
  });
}

export function useComplaint(id: string | null) {
  return useQuery({
    queryKey: complaintKeys.detail(id ?? ""),
    queryFn: () => getComplaint(id as string),
    enabled: id !== null,
  });
}

export function useComplaintSummary() {
  return useQuery({ queryKey: complaintKeys.summary, queryFn: getComplaintSummary });
}

/**
 * Invalidate every complaint query after a write.
 *
 * A status change alters the list, the detail record and the summary counters
 * at once, so refetching the lot is both correct and cheap at this scale.
 */
function useInvalidateComplaints() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: complaintKeys.all });
}

export function useRaiseComplaint() {
  const invalidate = useInvalidateComplaints();
  return useMutation({
    mutationFn: (payload: ComplaintCreate) => api.post<Complaint>("/v1/complaints", payload),
    onSuccess: invalidate,
  });
}

export function useUpdateComplaintStatus() {
  const invalidate = useInvalidateComplaints();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: ComplaintStatus; note?: string }) =>
      api.patch<Complaint>(`/v1/complaints/${id}/status`, { status, note: note ?? "" }),
    onSuccess: invalidate,
  });
}

export function useAssignComplaint() {
  const invalidate = useInvalidateComplaints();
  return useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      api.post<Complaint>(`/v1/complaints/${id}/assign`, { assigned_to: assignedTo }),
    onSuccess: invalidate,
  });
}

export function useUpdateComplaintPriority() {
  const invalidate = useInvalidateComplaints();
  return useMutation({
    mutationFn: ({ id, urgency, note }: { id: string; urgency: ComplaintUrgency; note?: string }) =>
      api.patch<Complaint>(`/v1/complaints/${id}/priority`, { urgency, note: note ?? "" }),
    onSuccess: invalidate,
  });
}
