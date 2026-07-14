import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { invoices, complaints } from "../../../api/mockData";

export default function PropertyStatusPage() {
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
          <ul className="space-y-3">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between text-sm">
                <span>{inv.month}</span>
                <StatusBadge status={inv.status} />
              </li>
            ))}
          </ul>
        </div>
        <div className="bp-card p-5">
          <p className="bp-eyebrow mb-4">COMPLAINT STATUS</p>
          <ul className="space-y-3">
            {complaints.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-3">{c.title}</span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
