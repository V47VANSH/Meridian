import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import { useGuestPasses, useRevokeGuestPass } from "../../../api/visitors";
import { useFlatLabels } from "../../../api/directory";
import { formatDate, formatDateTime } from "../../../lib/format";

export default function GuestPassHistoryPage() {
  const passes = useGuestPasses();
  const revoke = useRevokeGuestPass();
  const flatLabel = useFlatLabels();

  const rows = passes.data ?? [];

  return (
    <div>
      <PageHeader
        code="V-02 / PASS HISTORY"
        title="Guest Pass History"
        description="Every pass you have issued, and whether it has been used at the gate."
      />

      <div className="mb-4">
        <ErrorBanner error={revoke.error} />
      </div>

      <QueryState
        isLoading={passes.isPending}
        error={passes.error}
        onRetry={() => passes.refetch()}
        loadingLabel="Loading your passes…"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No guest passes generated yet"
            hint="Issue one from the Guest Pass screen."
          />
        ) : (
          <div className="bp-card divide-y divide-blueprint-700">
            {rows.map((pass) => (
              <div key={pass.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm text-ink-100">{pass.visitor_name}</p>
                  <p className="text-xs text-ink-500">
                    {pass.purpose || "Visit"} · {formatDate(pass.valid_from)} ·{" "}
                    {flatLabel(pass.flat_id)}
                  </p>
                  {pass.used_at && (
                    <p className="text-xs font-mono text-ink-500 mt-0.5">
                      Entered {formatDateTime(pass.used_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={pass.status} />
                  {/* Only an unused, unexpired pass can be revoked; anything
                      else is a 409. */}
                  {pass.status === "ACTIVE" && (
                    <button
                      onClick={() => revoke.mutate(pass.id)}
                      disabled={revoke.isPending}
                      className="btn-secondary py-1 px-2.5 text-xs border-red-500/30 text-red-400 hover:border-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
