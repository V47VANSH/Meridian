import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { invoices, useMockData, syncInvoicesFromBackend } from "../../../api/mockData";
import { useAuthStore } from "../../../store/authStore";
import { api } from "../../../api/client";

export default function InvoiceListPage() {
  useMockData();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    api.get("/v1/maintenance/invoices")
      .then((res: any) => {
        // apiFetch returns parsed JSON body directly
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncInvoicesFromBackend(items, user);
      })
      .catch(() => undefined);
  }, [user]);

  return (
    <div>
      <PageHeader
        code="M-01 / INVOICES"
        title="Maintenance Invoices"
        description="Pay dues and get instant confirmation once payment is recorded."
      />

      <div className="bp-card overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-ink-500 font-mono">No invoices found.</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
