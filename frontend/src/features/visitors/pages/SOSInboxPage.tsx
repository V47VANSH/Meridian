import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import { useAcknowledgeSOS, useResolveSOS, useSOSIncidents } from "../../../api/visitors";
import { useFlatLabels } from "../../../api/directory";
import { formatDateTime } from "../../../lib/format";

/** The inbox is an emergency feed, so it refreshes on its own. */
const POLL_MS = 10_000;

export default function SOSInboxPage() {
  // Guards and officials receive every incident in the society. This screen
  // previously read a module-level fixture array and never called the API at
  // all, so no alert a resident raised ever reached the gate.
  const incidents = useSOSIncidents(undefined, { refetchInterval: POLL_MS });
  const acknowledge = useAcknowledgeSOS();
  const resolve = useResolveSOS();
  const flatLabel = useFlatLabels();

  const rows = incidents.data ?? [];
  const open = rows.filter((incident) => incident.status !== "RESOLVED");
  const closed = rows.filter((incident) => incident.status === "RESOLVED");

  return (
    <div>
      <PageHeader
        code="G-02 / SOS INBOX"
        title="Emergency Alerts"
        description="Live feed of SOS alerts raised by residents."
      />

      <div className="mb-4">
        <ErrorBanner error={acknowledge.error ?? resolve.error} />
      </div>

      <QueryState
        isLoading={incidents.isPending}
        error={incidents.error}
        onRetry={() => incidents.refetch()}
        loadingLabel="Loading alerts…"
      >
        {open.length === 0 ? (
          <EmptyState title="No active alerts" hint="Alerts appear here as residents raise them." />
        ) : (
          <div className="bp-card divide-y divide-blueprint-700 mb-8">
            {open.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm text-ink-100">
                    {flatLabel(incident.flat_id)}
                    {incident.location_note && (
                      <span className="text-ink-300"> — {incident.location_note}</span>
                    )}
                  </p>
                  <p className="text-xs font-mono text-ink-500">
                    {incident.id} · raised {formatDateTime(incident.created_at)}
                  </p>
                  {incident.acknowledged_at && (
                    <p className="text-xs font-mono text-ink-500">
                      Acknowledged {formatDateTime(incident.acknowledged_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={incident.status} />
                  {incident.status === "OPEN" && (
                    <button
                      onClick={() => acknowledge.mutate(incident.id)}
                      disabled={acknowledge.isPending}
                      className="btn-primary py-1.5 px-3 text-xs"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => resolve.mutate(incident.id)}
                    disabled={resolve.isPending}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {closed.length > 0 && (
          <>
            <p className="bp-eyebrow mb-3">RESOLVED</p>
            <div className="bp-card divide-y divide-blueprint-700">
              {closed.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <div>
                    <p className="text-ink-300">{flatLabel(incident.flat_id)}</p>
                    <p className="text-xs font-mono text-ink-500">
                      {incident.id} · closed {formatDateTime(incident.resolved_at)}
                    </p>
                  </div>
                  <StatusBadge status={incident.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
