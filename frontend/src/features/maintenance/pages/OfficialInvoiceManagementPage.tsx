import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { invoices, residents, useMockData } from "../../../api/mockData";
import InvoiceDetailModal from "../../../components/modals/InvoiceDetailModal";

export default function OfficialInvoiceManagementPage() {
  useMockData();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === "PAID") return inv.status === "PAID";
    if (statusFilter === "UNPAID") return inv.status !== "PAID";
    return true;
  });

  return (
    <div>
      <PageHeader
        code="M-03 / INVOICE MANAGEMENT"
        title="Maintenance Records"
        description="Maintain accurate records to avoid sending incorrect reminders (Story 1.3)."
      />

      {/* Segemented Filter bar */}
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
        <span className="text-ink-500">Invoices matching: {filteredInvoices.length}</span>
      </div>

      <div className="bp-card overflow-hidden mb-6">
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-ink-500 font-mono">
            No invoice records matching the selected status.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Flat</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-blueprint-700 last:border-0 hover:bg-blueprint-800/40 transition cursor-pointer"
                >
                  <td className="px-5 py-3 font-mono text-xs text-ink-300" onClick={() => setSelectedInvoiceId(inv.id)}>
                    {inv.id}
                  </td>
                  <td className="px-5 py-3" onClick={() => setSelectedInvoiceId(inv.id)}>
                    {inv.flatNo || "N/A"}
                  </td>
                  <td className="px-5 py-3" onClick={() => setSelectedInvoiceId(inv.id)}>{inv.month}</td>
                  <td className="px-5 py-3" onClick={() => setSelectedInvoiceId(inv.id)}>₹{inv.amount}</td>
                  <td className="px-5 py-3" onClick={() => setSelectedInvoiceId(inv.id)}>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setSelectedInvoiceId(inv.id)}
                      className="btn-secondary py-1 px-2.5 text-xs"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="bp-eyebrow mb-3">RESIDENTS WITH PENDING DUES</p>
      <div className="bp-card divide-y divide-blueprint-700">
        {residents.filter((r) => r.duesStatus === "PENDING").map((r) => (
          <div key={r.flatNo} className="flex items-center justify-between px-5 py-3 text-sm">
            <span>{r.flatNo} — {r.name}</span>
            <span className="text-ink-500 font-mono text-xs">{r.contact}</span>
          </div>
        ))}
      </div>

      {/* Invoice Detail Modal Overlay */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
        />
      )}
    </div>
  );
}
