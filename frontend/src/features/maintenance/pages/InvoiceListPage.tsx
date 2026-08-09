import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { invoices } from "../../../api/mockData";

export default function InvoiceListPage() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        code="M-01 / INVOICES"
        title="Maintenance Invoices"
        description="Pay dues and get instant confirmation once payment is recorded."
      />

      <div className="bp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
              <th className="px-5 py-3">Invoice</th>
              <th className="px-5 py-3">Period</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Due Date</th>
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
                <td className="px-5 py-3 text-ink-300">{inv.dueDate}</td>
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
    </div>
  );
}
