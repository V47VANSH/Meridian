import { useState, useEffect } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { complaints, useMockData, syncComplaintsFromBackend } from "../../../api/mockData";
import { useAuthStore } from "../../../store/authStore";
import { api } from "../../../api/client";

export default function ComplaintListPage() {
  useMockData();
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    api.get("/v1/complaints")
      .then((res: any) => {
        // apiFetch returns the parsed JSON body directly (not wrapped in { data })
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) {
          syncComplaintsFromBackend(items, user);
        }
      })
      .catch(() => undefined);
  }, [user]);

  // Show complaints belonging to the current logged-in user.
  // After a page refresh the backend returns raised_by as a UUID (raisedById),
  // so we match by that first, then fall back to name / flatNo.
  const mine = complaints.filter((c) => {
    if (user?.id && c.raisedById === user.id) return true;
    if (user?.name && c.raisedBy === user.name) return true;
    if (user?.flatNo && c.flatNo === user.flatNo) return true;
    return false;
  });


  const displayed = mine.filter(
    (c) => statusFilter === "ALL" || c.status === statusFilter
  );

  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected || displayed[0]?.id || null;
  const active = displayed.find((c) => c.id === activeId);

  return (
    <div>
      <PageHeader code="C-02 / MY COMPLAINTS" title="Complaint Status" description="Track every complaint you've raised." />

      {/* Segmented Filter Bar */}
      <div className="flex gap-4 mb-5 items-center justify-between text-xs font-mono">
        <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
          {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"].map((status) => (
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
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
        <span className="text-ink-500 font-mono">Count: {displayed.length}</span>
      </div>

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
                  <span className="text-xs font-mono text-ink-500">{c.id}</span>
                  <StatusBadge status={c.status} />
                </div>
              </button>
            ))}
          </div>

          <div className="col-span-3 bp-card p-6">
            {active && (
              <>
                <p className="bp-eyebrow mb-1.5">{active.category}</p>
                <h3 className="text-lg font-semibold mb-1">{active.title}</h3>
                {active.description && (
                  <p className="text-sm text-ink-300 mb-4 leading-relaxed">{active.description}</p>
                )}
                <ol className="space-y-4">
                  {active.timeline.map((t, idx) => (
                    <li key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center pt-1">
                        <span className="h-2 w-2 rounded-full bg-signal" />
                        {idx < active.timeline.length - 1 && (
                          <span className="w-px flex-1 bg-blueprint-600 mt-1" />
                        )}
                      </div>
                      <div className="pb-2">
                        <p className="text-sm text-ink-100">{t.label}</p>
                        <p className="text-xs text-ink-500 font-mono">{t.date}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
