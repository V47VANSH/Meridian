import PageHeader from "../../../components/PageHeader";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import { useRaiseSOS, useSOSIncidents } from "../../../api/visitors";
import { useMyFlats } from "../../../api/directory";
import { formatDateTime } from "../../../lib/format";

/**
 * How often the resident's screen re-checks for an acknowledgement.
 *
 * The wait between raising an alert and a guard responding is the moment this
 * screen exists for, so it polls rather than waiting for a navigation.
 */
const ACK_POLL_MS = 10_000;

export default function SOSButtonPage() {
  const { data: myFlats } = useMyFlats();
  const raise = useRaiseSOS();

  // Residents receive only the incidents they raised, so the newest row here
  // is this resident's own alert.
  const incidents = useSOSIncidents(undefined, { refetchInterval: ACK_POLL_MS });

  const flat = myFlats?.[0];
  const live = (incidents.data ?? []).find((incident) => incident.status !== "RESOLVED");
  const isAcknowledged = live?.status === "ACKNOWLEDGED";

  function handleSOS() {
    raise.mutate({
      flat_id: flat?.id ?? null,
      location_note: flat ? `Emergency at ${flat.label}` : "Emergency raised from the app",
    });
  }

  return (
    <div className="max-w-md">
      <PageHeader code="S-01 / EMERGENCY SOS" title="Emergency Assistance" />

      <div className="mb-4">
        <ErrorBanner error={raise.error} />
      </div>

      <QueryState
        isLoading={incidents.isPending}
        error={incidents.error}
        onRetry={() => incidents.refetch()}
        loadingLabel="Checking for an active alert…"
      >
        <div className="bp-card p-8 text-center">
          {!live && (
            <>
              <p className="text-sm text-ink-300 mb-6">
                Pressing this alerts on-duty security immediately with your flat number.
              </p>
              <button
                onClick={handleSOS}
                disabled={raise.isPending}
                className="h-32 w-32 rounded-full bg-red-500/15 border-2 border-red-500 text-red-400 font-display text-lg font-semibold mx-auto flex items-center justify-center hover:bg-red-500/25 transition disabled:opacity-60"
              >
                {raise.isPending ? "…" : "SOS"}
              </button>
            </>
          )}

          {live && !isAcknowledged && (
            <>
              <div className="h-32 w-32 rounded-full bg-red-500/20 border-2 border-red-400 mx-auto flex items-center justify-center animate-pulse mb-4">
                <span className="font-display text-lg text-red-300">SOS</span>
              </div>
              <p className="text-sm text-ink-300 font-medium">Alert sent to security.</p>
              <p className="text-xs text-ink-500 mt-1">
                Raised {formatDateTime(live.created_at)} · waiting for a guard to acknowledge…
              </p>
            </>
          )}

          {live && isAcknowledged && (
            <>
              <div className="h-32 w-32 rounded-full bg-emerald-500/15 border-2 border-emerald-400 mx-auto flex items-center justify-center mb-4">
                <span className="text-emerald-300 text-2xl">✓</span>
              </div>
              <p className="text-sm text-emerald-300 font-medium">
                Security has acknowledged your alert.
              </p>
              <p className="text-xs text-ink-500 mt-1">
                Acknowledged {formatDateTime(live.acknowledged_at)} · help is on the way.
              </p>
            </>
          )}

          {live && (
            /* Standing down is a responder's call, not the resident's: the
               old Cancel button deleted the alert from the resident's own
               screen while security still had it open. */
            <p className="mt-6 text-xs font-mono text-ink-500">
              Incident {live.id} stays open until security closes it.
            </p>
          )}
        </div>
      </QueryState>
    </div>
  );
}
