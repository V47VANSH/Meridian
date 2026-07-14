import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { complaints } from "../../../api/mockData";

const urgencyRank: Record<string, number> = { URGENT: 0, MEDIUM: 1, LOW: 2 };

export default function ComplaintTriagePage() {
  const sorted = [...complaints].sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]);

  return (
    <div>
      <PageHeader
        code="C-03 / TRIAGE QUEUE"
        title="Complaint Triage"
        description="Centralized queue, sorted by urgency so critical issues surface first (Story 2.2 / 2.3)."
      />

      <div className="bp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
              <th className="px-5 py-3">Complaint</th>
              <th className="px-5 py-3">Flat</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Urgency</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} className="border-b border-blueprint-700 last:border-0">
                <td className="px-5 py-3">
                  <p className="text-ink-100">{c.title}</p>
                  <p className="text-xs font-mono text-ink-500">{c.id}</p>
                </td>
                <td className="px-5 py-3">{c.flatNo}</td>
                <td className="px-5 py-3 text-ink-300">{c.category}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={c.urgency} />
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <select className="input-field py-1 text-xs w-32" defaultValue="">
                    <option value="" disabled>Assign to…</option>
                    <option>Maintenance Staff</option>
                    <option>Cleaning Staff</option>
                    <option>Service Provider</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
