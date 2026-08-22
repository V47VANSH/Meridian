import { useMemo, useState, type FormEvent } from "react";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import InvoiceDetailModal from "../../../components/modals/InvoiceDetailModal";
import { useCreateInvoice, useInvoices, useMaintenanceSummary } from "../../../api/maintenance";
import { useFlatLabels, useFlats } from "../../../api/directory";
import { formatCurrency, formatDate, formatPeriod } from "../../../lib/format";

/** `YYYY-MM` for the current month, the period a new invoice defaults to. */
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function OfficialInvoiceManagementPage() {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [showForm, setShowForm] = useState(false);

  const invoices = useInvoices();
  const summary = useMaintenanceSummary();
  const { data: flats } = useFlats();
  const flatLabel = useFlatLabels();
  const createInvoice = useCreateInvoice();

  const [flatId, setFlatId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const rows = useMemo(() => {
    const all = invoices.data ?? [];
    if (statusFilter === "PAID") return all.filter((i) => i.status === "PAID");
    if (statusFilter === "UNPAID") return all.filter((i) => i.status !== "PAID");
    return all;
  }, [invoices.data, statusFilter]);

  /**
   * Outstanding balance per flat.
   *
   * The previous version listed residents flagged PENDING in a fixture array,
   * which had no relationship to what was actually owed. Summing the unpaid
   * invoices is the same question answered from the records.
   */
  const outstandingByFlat = useMemo(() => {
    const totals = new Map<string, number>();
    for (const invoice of invoices.data ?? []) {
      if (invoice.status === "PAID") continue;
      totals.set(invoice.flat_id, (totals.get(invoice.flat_id) ?? 0) + invoice.amount);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [invoices.data]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await createInvoice.mutateAsync({
      flat_id: flatId,
      period,
      amount: Number(amount),
      // The API takes a timestamp; a date input gives a date, so it is due at
      // the end of that day rather than at midnight as it starts.
      due_date: new Date(`${dueDate}T23:59:59`).toISOString(),
    });
    setShowForm(false);
    setAmount("");
    setDueDate("");
  }

  return (
    <div>
      <PageHeader
        code="M-03 / INVOICE MANAGEMENT"
        title="Maintenance Records"
        description="Maintain accurate records to avoid sending incorrect reminders (Story 1.3)."
        action={
          <button className="btn-primary text-xs" onClick={() => setShowForm((open) => !open)}>
            {showForm ? "Cancel" : "Raise Invoice"}
          </button>
        }
      />

      {summary.data && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Collected" value={formatCurrency(summary.data.total_collected)} />
          <StatCard label="Outstanding" value={formatCurrency(summary.data.total_outstanding)} />
          <StatCard label="Overdue Invoices" value={String(summary.data.overdue_count)} />
          <StatCard label="Total Invoices" value={String(summary.data.total_invoices)} />
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bp-card p-5 mb-6 space-y-4">
          <p className="bp-eyebrow">RAISE A NEW INVOICE</p>
          <ErrorBanner error={createInvoice.error} />
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="label-field">Flat</label>
              <select
                className="input-field"
                required
                value={flatId}
                onChange={(e) => setFlatId(e.target.value)}
              >
                <option value="">Select a flat</option>
                {(flats ?? []).map((flat) => (
                  <option key={flat.id} value={flat.id}>
                    {flat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Period</label>
              <input
                type="month"
                className="input-field"
                required
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Amount (₹)</label>
              <input
                type="number"
                min="1"
                step="1"
                className="input-field"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Due date</label>
              <input
                type="date"
                className="input-field"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary text-xs" disabled={createInvoice.isPending}>
            {createInvoice.isPending ? "Raising…" : "Raise Invoice"}
          </button>
        </form>
      )}

      <div className="flex gap-4 mb-5 items-center justify-between text-xs font-mono">
        <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
          {(["ALL", "UNPAID", "PAID"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-xs px-2.5 py-1 transition ${
                statusFilter === filter
                  ? "bg-blueprint-700 text-signal font-semibold"
                  : "text-ink-300 hover:text-ink-100"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <span className="text-ink-500">Invoices matching: {rows.length}</span>
      </div>

      <QueryState
        isLoading={invoices.isPending}
        error={invoices.error}
        onRetry={() => invoices.refetch()}
        loadingLabel="Loading invoices…"
      >
        <div className="bp-card overflow-hidden mb-6">
          {rows.length === 0 ? (
            <EmptyState title="No invoice records matching the selected status" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Flat</th>
                  <th className="px-5 py-3">Period</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Due</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className="border-b border-blueprint-700 last:border-0 hover:bg-blueprint-800/40 transition cursor-pointer"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-ink-300">{inv.id}</td>
                    <td className="px-5 py-3 font-mono text-xs">{flatLabel(inv.flat_id)}</td>
                    <td className="px-5 py-3">{formatPeriod(inv.period)}</td>
                    <td className="px-5 py-3">{formatCurrency(inv.amount)}</td>
                    <td className="px-5 py-3 text-ink-300">{formatDate(inv.due_date)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button className="btn-secondary py-1 px-2.5 text-xs">Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </QueryState>

      <p className="bp-eyebrow mb-3">FLATS WITH OUTSTANDING DUES</p>
      <div className="bp-card divide-y divide-blueprint-700">
        {outstandingByFlat.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-ink-500 font-mono">
            Every invoice is settled.
          </div>
        ) : (
          outstandingByFlat.map(([id, total]) => (
            <div key={id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span>{flatLabel(id)}</span>
              <span className="font-mono text-xs text-ink-300">{formatCurrency(total)} due</span>
            </div>
          ))
        )}
      </div>

      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
        />
      )}
    </div>
  );
}
