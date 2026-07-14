import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { invoices, residents } from "../../../api/mockData";

export default function OfficialInvoiceManagementPage() {
  return (
    <div>
      <PageHeader
        code="M-03 / INVOICE MANAGEMENT"
        title="Maintenance Records"
        description="Maintain accurate records to avoid sending incorrect reminders (Story 1.3)."
        action={<button className="btn-primary text-sm py-2">Generate Invoices</button>}
      />

      <div className="bp-card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
              <th className="px-5 py-3">Invoice</th>
              <th className="px-5 py-3">Period</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-blueprint-700 last:border-0">
                <td className="px-5 py-3 font-mono text-xs text-ink-300">{inv.id}</td>
                <td className="px-5 py-3">{inv.month}</td>
                <td className="px-5 py-3">₹{inv.amount}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={inv.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <button className="btn-secondary py-1.5 px-3 text-xs">Send Reminder</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="bp-eyebrow mb-3">R-01 / RESIDENTS WITH PENDING DUES</p>
      <div className="bp-card divide-y divide-blueprint-700">
        {residents.filter((r) => r.duesStatus === "PENDING").map((r) => (
          <div key={r.flatNo} className="flex items-center justify-between px-5 py-3 text-sm">
            <span>{r.flatNo} — {r.name}</span>
            <span className="text-ink-500 font-mono text-xs">{r.contact}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
