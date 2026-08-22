import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import {
  ALLOWED_TRANSITIONS,
  pathToResolved,
  useComplaints,
  useResolveComplaint,
  useUpdateComplaintStatus,
} from "../../../api/complaints";
import { useFlatLabels } from "../../../api/directory";
import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS, labelFor } from "../../../lib/labels";
import { formatDate } from "../../../lib/format";
import type { ComplaintStatus } from "../../../api/types";

export default function StaffTasksPage() {
  // A staff member's task is a complaint assigned to them. The page used to
  // render three invented tasks that no official could create and no resident
  // could have raised, and changing a status only moved a local flag.
  const tasks = useComplaints({ assignedToMe: true });
  const updateStatus = useUpdateComplaintStatus();
  const resolveNow = useResolveComplaint();
  const flatLabel = useFlatLabels();
  const isBusy = updateStatus.isPending || resolveNow.isPending;

  const rows = (tasks.data ?? []).filter((task) => task.status !== "CLOSED");

  return (
    <div>
      <PageHeader
        code="T-01 / ASSIGNED TASKS"
        title="My Tasks"
        description="Complaints a society official has assigned to you."
      />

      <div className="mb-4">
        <ErrorBanner error={updateStatus.error ?? resolveNow.error} />
      </div>

      <QueryState
        isLoading={tasks.isPending}
        error={tasks.error}
        onRetry={() => tasks.refetch()}
        loadingLabel="Loading your tasks…"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing assigned to you"
            hint="Tasks appear here when an official assigns you a complaint."
          />
        ) : (
          <div className="bp-card divide-y divide-blueprint-700">
            {rows.map((task) => {
              // Only transitions the lifecycle permits; anything else is a 400.
              const next = ALLOWED_TRANSITIONS[task.status as ComplaintStatus] ?? [];
              // Feedback item 4: fixing something on the spot should be one
              // action, not two. This still issues both transitions so the
              // history records that work was started.
              const canResolveInOneStep =
                pathToResolved(task.status as ComplaintStatus).length > 1;
              return (
                <div key={task.id} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-100">{task.title}</p>
                    <p className="text-xs text-ink-500">
                      {flatLabel(task.flat_id)} ·{" "}
                      {labelFor(COMPLAINT_CATEGORY_LABELS, task.category)} · raised{" "}
                      {formatDate(task.created_at)}
                    </p>
                    {task.description && (
                      <p className="mt-1 text-xs text-ink-300 line-clamp-2">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={task.urgency} />
                    <StatusBadge status={task.status} />
                    {canResolveInOneStep && (
                      <button
                        onClick={() =>
                          resolveNow.mutate({
                            id: task.id,
                            status: task.status as ComplaintStatus,
                          })
                        }
                        disabled={isBusy}
                        className="btn-secondary py-1 px-2.5 text-xs border-signal/40 text-signal"
                        title="Records the in-progress step too, so the history stays complete"
                      >
                        Resolve now
                      </button>
                    )}
                    {next.length > 0 && (
                      <select
                        className="input-field py-1 text-xs w-36"
                        value=""
                        disabled={isBusy}
                        onChange={(e) =>
                          e.target.value &&
                          updateStatus.mutate({
                            id: task.id,
                            status: e.target.value as ComplaintStatus,
                          })
                        }
                      >
                        <option value="">Update status…</option>
                        {next.map((status) => (
                          <option key={status} value={status}>
                            {COMPLAINT_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
