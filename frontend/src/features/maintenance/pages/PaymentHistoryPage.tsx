import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { invoices, useMockData } from "../../../api/mockData";

export default function PaymentHistoryPage() {
  useMockData();
  const paid = invoices.filter((i) => i.status === "PAID");

  return (
    <div>
      <PageHeader code="M-02 / HISTORY" title="Payment History" description="Your recorded maintenance payments." />
      <div className="bp-card divide-y divide-blueprint-700">
        {paid.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-ink-100">{inv.month}</p>
              <p className="text-xs font-mono text-ink-500">{inv.id}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm">₹{inv.amount}</span>
              <StatusBadge status={inv.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
