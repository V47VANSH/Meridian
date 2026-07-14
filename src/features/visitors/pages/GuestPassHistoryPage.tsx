import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { guestPasses } from "../../../api/mockData";

export default function GuestPassHistoryPage() {
  return (
    <div>
      <PageHeader code="V-02 / PASS HISTORY" title="Guest Pass History" />
      <div className="bp-card divide-y divide-blueprint-700">
        {guestPasses.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-ink-100">{p.guestName}</p>
              <p className="text-xs text-ink-500">{p.purpose} · {p.validOn}</p>
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
