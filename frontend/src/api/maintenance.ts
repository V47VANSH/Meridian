/**
 * Maintenance invoices, payments and collection reporting.
 *
 * `GET /v1/maintenance/invoices` is role-scoped: a resident or non-resident
 * owner receives the invoices for the flats they occupy, an official receives
 * the society's. It also re-evaluates PENDING invoices past their due date as
 * OVERDUE on read, so the status here is current without a nightly job.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Invoice,
  InvoiceCreate,
  InvoiceStatus,
  MaintenanceSummary,
  Message,
  OfflinePaymentRequest,
  Payment,
  PaymentConfirmRequest,
  PaymentOrder,
  RiskScore,
} from "./types";

export const maintenanceKeys = {
  all: ["maintenance"] as const,
  invoices: (filter?: string) => ["maintenance", "invoices", filter ?? "all"] as const,
  invoice: (id: string) => ["maintenance", "invoice", id] as const,
  payments: ["maintenance", "payments"] as const,
  summary: ["maintenance", "summary"] as const,
  riskScore: (flatId: string) => ["maintenance", "risk", flatId] as const,
};

export function listInvoices(params?: {
  status?: InvoiceStatus;
  flatId?: string;
}): Promise<Invoice[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.flatId) query.set("flat_id", params.flatId);
  const suffix = query.toString();
  return api.get<Invoice[]>(`/v1/maintenance/invoices${suffix ? `?${suffix}` : ""}`);
}

export function getInvoice(id: string): Promise<Invoice> {
  return api.get<Invoice>(`/v1/maintenance/invoices/${id}`);
}

export function listPayments(): Promise<Payment[]> {
  return api.get<Payment[]>("/v1/maintenance/payments");
}

export function getMaintenanceSummary(): Promise<MaintenanceSummary> {
  return api.get<MaintenanceSummary>("/v1/maintenance/summary");
}

export function useInvoices(params?: { status?: InvoiceStatus; flatId?: string }) {
  const filter = `${params?.status ?? "all"}:${params?.flatId ?? "any"}`;
  return useQuery({
    queryKey: maintenanceKeys.invoices(filter),
    queryFn: () => listInvoices(params),
  });
}

export function useInvoice(id: string | null | undefined) {
  return useQuery({
    queryKey: maintenanceKeys.invoice(id ?? ""),
    queryFn: () => getInvoice(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Captured payments, which is what a receipt history is.
 *
 * Distinct from the paid invoices it used to be derived from: a payment record
 * carries the method, the gateway reference and the moment it settled, none of
 * which an invoice has.
 */
export function usePayments() {
  return useQuery({ queryKey: maintenanceKeys.payments, queryFn: listPayments });
}

export function useMaintenanceSummary() {
  return useQuery({ queryKey: maintenanceKeys.summary, queryFn: getMaintenanceSummary });
}

export function useRiskScore(flatId: string | null | undefined) {
  return useQuery({
    queryKey: maintenanceKeys.riskScore(flatId ?? ""),
    queryFn: () => api.get<RiskScore>(`/v1/maintenance/flats/${flatId}/risk-score`),
    enabled: Boolean(flatId),
  });
}

function useInvalidateMaintenance() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
}

export function useCreateInvoice() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: (payload: InvoiceCreate) =>
      api.post<Invoice>("/v1/maintenance/invoices", payload),
    onSuccess: invalidate,
  });
}

/** Open a gateway order. The invoice stays unpaid until a confirmation lands. */
export function useCreatePaymentOrder() {
  return useMutation({
    mutationFn: (invoiceId: string) =>
      api.post<PaymentOrder>(`/v1/maintenance/invoices/${invoiceId}/pay`),
  });
}

/**
 * Settle an invoice with the signature the gateway handed back.
 *
 * The backend verifies an HMAC over `<order_id>|<payment_id>` with the secret
 * key before touching the invoice, so this cannot be called with made-up
 * values to mark an invoice paid.
 */
export function useConfirmPayment() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: ({ invoiceId, ...payload }: PaymentConfirmRequest & { invoiceId: string }) =>
      api.post<Payment>(`/v1/maintenance/invoices/${invoiceId}/payments/confirm`, payload),
    onSuccess: invalidate,
  });
}

/** Society official recording a cash, cheque or bank-transfer payment. */
export function useRecordOfflinePayment() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: ({
      invoiceId,
      ...payload
    }: OfflinePaymentRequest & { invoiceId: string }) =>
      api.post<Payment>(`/v1/maintenance/invoices/${invoiceId}/offline-payment`, payload),
    onSuccess: invalidate,
  });
}

export function useSendReminder() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      api.post<Message>(`/v1/maintenance/invoices/${invoiceId}/remind`),
    onSuccess: invalidate,
  });
}
