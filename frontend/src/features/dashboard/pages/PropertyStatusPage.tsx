import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { QueryState } from "../../../components/QueryState";
import { useInvoices } from "../../../api/maintenance";
import { useComplaints } from "../../../api/complaints";
import { useFlatLabels } from "../../../api/directory";
import { formatCurrency, formatDate, formatPeriod } from "../../../lib/format";

export default function PropertyStatusPage() {
  // Both endpoints are scoped by the API to the caller's own flats and
  // complaints, so an owner sees their property and nobody else's.
  const invoices = useInvoices();
  const complaints = useComplaints();
  const flatLabel = useFlatLabels();

  const invoiceRows = invoices.data ?? [];
  const complaintRows = complaints.data ?? [];

  return (
    <div>
      <PageHeader
        code="P-01 / PROPERTY STATUS"
        title="Your Property, Remotely"
        description="Maintenance payments and complaint status for your flat (Story 6.2)."
      />

      <div className="grid grid-cols-2 gap-6">
        <div className="bp-card p-5">
          <p className="bp-eyebrow mb-4">MAINTENANCE PAYMENTS</p>
          <QueryState
            isLoading={invoices.isPending}
            error={invoices.error}
            onRetry={() => invoices.refetch()}
            loadingLabel="Loading invoices…"
          >
            {invoiceRows.length === 0 ? (
              <p className="text-sm text-ink-500 italic">No invoices raised yet.</p>
            ) : (
              <ul className="space-y-3">
                {invoiceRows.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-ink-100">{formatPeriod(inv.period)}</p>
                      <p className="text-xs font-mono text-ink-500">
                        {flatLabel(inv.flat_id)} · {formatCurrency(inv.amount)} · due{" "}
                        {formatDate(inv.due_date)}
                      </p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>

        <div className="bp-card p-5">
          <p className="bp-eyebrow mb-4">COMPLAINT STATUS</p>
          <QueryState
            isLoading={complaints.isPending}
            error={complaints.error}
            onRetry={() => complaints.refetch()}
            loadingLabel="Loading complaints…"
          >
            {complaintRows.length === 0 ? (
              <p className="text-sm text-ink-500 italic">No complaints raised.</p>
            ) : (
              <ul className="space-y-3">
                {complaintRows.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-ink-100">{c.title}</p>
                      <p className="text-xs font-mono text-ink-500">
                        Raised {formatDate(c.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
