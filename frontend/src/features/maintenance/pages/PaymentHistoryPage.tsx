import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { QueryState } from "../../../components/QueryState";
import { usePayments } from "../../../api/maintenance";
import { formatCurrency, formatDateTime } from "../../../lib/format";

export default function PaymentHistoryPage() {
  // Payment records, not paid invoices. An invoice says what was owed; only
  // the payment carries the method, the gateway reference and the moment it
  // settled — the three things a receipt needs.
  const payments = usePayments();
  const rows = (payments.data ?? []).filter((p) => p.status === "CAPTURED");

  return (
    <div>
      <PageHeader
        code="M-02 / HISTORY"
        title="Payment History"
        description="Your recorded maintenance payments."
      />

      <QueryState
        isLoading={payments.isPending}
        error={payments.error}
        onRetry={() => payments.refetch()}
        loadingLabel="Loading your payments…"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No payments recorded yet"
            hint="Payments appear here once an invoice is settled."
          />
        ) : (
          <div className="bp-card divide-y divide-blueprint-700">
            {rows.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm text-ink-100">{formatDateTime(payment.created_at)}</p>
                  <p className="text-xs font-mono text-ink-500">
                    {payment.razorpay_payment_id ?? payment.razorpay_order_id} ·{" "}
                    {payment.method || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">{formatCurrency(payment.amount)}</span>
                  <StatusBadge status={payment.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
