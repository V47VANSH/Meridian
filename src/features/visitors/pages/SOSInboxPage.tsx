import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { sosAlerts } from "../../../api/mockData";

export default function SOSInboxPage() {
  return (
    <div>
      <PageHeader
        code="G-02 / SOS INBOX"
        title="Emergency Alerts"
        description="Live feed of SOS alerts raised by residents."
      />
      {sosAlerts.length === 0 ? (
        <EmptyState title="No active alerts" hint="Alerts will appear here in real time." />
      ) : (
        <div className="bp-card divide-y divide-blueprint-700">
          {sosAlerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-ink-100">Flat {a.flatNo}</p>
                <p className="text-xs font-mono text-ink-500">{a.id} · {a.raisedAt}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={a.status} />
                {a.status === "ACTIVE" && <button className="btn-primary py-1.5 px-3 text-xs">Acknowledge</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
