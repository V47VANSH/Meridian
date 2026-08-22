import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { QueryState } from "../../../components/QueryState";
import { useInvoices } from "../../../api/maintenance";
import { useFlatLabels } from "../../../api/directory";
import { formatCurrency, formatDate, formatPeriod } from "../../../lib/format";

export default function InvoiceListPage() {
  const navigate = useNavigate();

  // Scoped by the API to the flats the caller occupies, and re-evaluated on
  // read so an invoice past its due date arrives as OVERDUE rather than
  // PENDING.
  const invoices = useInvoices();
  const flatLabel = useFlatLabels();

  const rows = invoices.data ?? [];

  return (
    <div>
      <PageHeader
        code="M-01 / INVOICES"
        title="Maintenance Invoices"
        description="Pay dues and get instant confirmation once payment is recorded."
      />

      <QueryState
        isLoading={invoices.isPending}
        error={invoices.error}
        onRetry={() => invoices.refetch()}
        loadingLabel="Loading your invoices…"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            hint="Invoices appear here once the society raises them for your flat."
          />
        ) : (
          <div className="bp-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Flat</th>
                  <th className="px-5 py-3">Period</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} className="border-b border-blueprint-700 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-ink-300">{inv.id}</td>
                    <td className="px-5 py-3 font-mono text-xs">{flatLabel(inv.flat_id)}</td>
                    <td className="px-5 py-3">{formatPeriod(inv.period)}</td>
                    <td className="px-5 py-3">{formatCurrency(inv.amount)}</td>
                    <td className="px-5 py-3 text-ink-300">{formatDate(inv.due_date)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {inv.status !== "PAID" && (
                        <button
                          onClick={() => navigate(`/resident/maintenance/pay/${inv.id}`)}
                          className="btn-primary py-1.5 px-3 text-xs"
                        >
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </div>
  );
}
