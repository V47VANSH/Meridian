import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { QueryState } from "../../../components/QueryState";
import { useComplaints } from "../../../api/complaints";
import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS, labelFor } from "../../../lib/labels";
import { formatDateTime } from "../../../lib/format";
import type { ComplaintStatus } from "../../../api/types";

const FILTERS: (ComplaintStatus | "ALL")[] = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function ComplaintListPage() {
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "ALL">("ALL");
  const [selected, setSelected] = useState<string | null>(null);

  // The endpoint already restricts a resident to the complaints they raised,
  // so there is nothing to filter by owner on the client.
  const complaints = useComplaints(
    statusFilter === "ALL" ? undefined : { status: statusFilter },
  );

  const displayed = complaints.data ?? [];
  const activeId = selected && displayed.some((c) => c.id === selected) ? selected : displayed[0]?.id ?? null;
  const active = displayed.find((c) => c.id === activeId);

  return (
    <div>
      <PageHeader code="C-02 / MY COMPLAINTS" title="Complaint Status" description="Track every complaint you've raised." />

      <div className="flex gap-4 mb-5 items-center justify-between text-xs font-mono">
        <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
          {FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setSelected(null);
              }}
              className={`rounded-xs px-2.5 py-1 transition ${
                statusFilter === status
                  ? "bg-blueprint-700 text-signal font-semibold"
                  : "text-ink-300 hover:text-ink-100"
              }`}
            >
              {status === "ALL" ? "ALL" : COMPLAINT_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <span className="text-ink-500 font-mono">Count: {displayed.length}</span>
      </div>

      <QueryState
        isLoading={complaints.isPending}
        error={complaints.error}
        onRetry={() => complaints.refetch()}
        loadingLabel="Loading your complaints…"
      >
        {displayed.length === 0 ? (
          <EmptyState title="No complaints raised yet" hint="Use Raise Complaint to report an issue." />
        ) : (
          <div className="grid grid-cols-5 gap-6">
            <div className="col-span-2 bp-card divide-y divide-blueprint-700 max-h-[450px] overflow-y-auto">
              {displayed.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full text-left px-4 py-3.5 transition ${
                    activeId === c.id ? "bg-blueprint-700/50" : "hover:bg-blueprint-800"
                  }`}
                >
                  <p className="text-sm text-ink-100 truncate">{c.title}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs font-mono text-ink-500">
                      {labelFor(COMPLAINT_CATEGORY_LABELS, c.category)}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                </button>
              ))}
            </div>

            <div className="col-span-3 bp-card p-6">
              {active && (
                <>
                  <p className="bp-eyebrow mb-1.5">
                    {labelFor(COMPLAINT_CATEGORY_LABELS, active.category)}
                  </p>
                  <h3 className="text-lg font-semibold mb-1">{active.title}</h3>
                  <p className="text-xs font-mono text-ink-500 mb-4">
                    Raised {formatDateTime(active.created_at)}
                  </p>
                  {active.description && (
                    <p className="text-sm text-ink-300 mb-4 leading-relaxed">{active.description}</p>
                  )}
                  <ol className="space-y-4">
                    {(active.history ?? []).map((entry, idx, entries) => (
                      <li key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <span className="h-2 w-2 rounded-full bg-signal" />
                          {idx < entries.length - 1 && (
                            <span className="w-px flex-1 bg-blueprint-600 mt-1" />
                          )}
                        </div>
                        <div className="pb-2">
                          <p className="text-sm text-ink-100">
                            {entry.note || `Status changed to ${labelFor(COMPLAINT_STATUS_LABELS, entry.status)}`}
                          </p>
                          <p className="text-xs text-ink-500 font-mono">
                            {formatDateTime(entry.changed_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}
