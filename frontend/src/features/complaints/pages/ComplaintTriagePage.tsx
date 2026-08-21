import { useState, useEffect } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { complaints, useMockData, syncComplaintsFromBackend } from "../../../api/mockData";
import { api } from "../../../api/client";
import { useAuthStore } from "../../../store/authStore";
import ComplaintDetailModal from "../../../components/modals/ComplaintDetailModal";

const urgencyRank: Record<string, number> = { URGENT: 0, MEDIUM: 1, LOW: 2 };

export default function ComplaintTriagePage() {
  useMockData();
  const { user } = useAuthStore();
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("ALL");

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



  const filtered = complaints.filter((c) => {
    const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchUrgency = urgencyFilter === "ALL" || c.urgency === urgencyFilter;
    return matchStatus && matchUrgency;
  });

  const sorted = [...filtered].sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]);

  return (
    <div>
      <PageHeader
        code="C-03 / TRIAGE QUEUE"
        title="Complaint Triage"
        description="Centralized queue, sorted by urgency so critical issues surface first (Story 2.2 / 2.3)."
      />

      {/* Blueprint Style Filters Bar */}
      <div className="flex flex-wrap gap-4 mb-5 items-center justify-between text-xs font-mono">
        <div className="flex gap-4">
          <div>
            <label className="block text-[10px] uppercase text-ink-500 mb-1">Status Filter</label>
            <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
              {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
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
          </div>

          <div>
            <label className="block text-[10px] uppercase text-ink-500 mb-1">Urgency Filter</label>
            <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
              {["ALL", "URGENT", "MEDIUM", "LOW"].map((urg) => (
                <button
                  key={urg}
                  onClick={() => setUrgencyFilter(urg)}
                  className={`rounded-xs px-2.5 py-1 transition ${
                    urgencyFilter === urg
                      ? "bg-blueprint-700 text-signal font-semibold"
                      : "text-ink-300 hover:text-ink-100"
                  }`}
                >
                  {urg}
                </button>
              ))}
            </div>
          </div>
        </div>

        <span className="text-ink-500">Tickets listed: {sorted.length}</span>
      </div>

      <div className="bp-card overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-ink-500 font-mono">
            No complaints matching the selected filters.
          </div>
        ) : (
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
                <tr
                  key={c.id}
                  className="border-b border-blueprint-700 last:border-0 hover:bg-blueprint-800/40 transition cursor-pointer"
                >
                  <td className="px-5 py-3" onClick={() => setSelectedComplaintId(c.id)}>
                    <p className="text-ink-100 font-medium">{c.title}</p>
                    <p className="text-xs font-mono text-ink-500">{c.id}</p>
                  </td>
                  <td className="px-5 py-3" onClick={() => setSelectedComplaintId(c.id)}>{c.flatNo}</td>
                  <td className="px-5 py-3 text-ink-300" onClick={() => setSelectedComplaintId(c.id)}>
                    {c.category}
                  </td>
                  <td className="px-5 py-3" onClick={() => setSelectedComplaintId(c.id)}>
                    <StatusBadge status={c.urgency} />
                  </td>
                  <td className="px-5 py-3" onClick={() => setSelectedComplaintId(c.id)}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setSelectedComplaintId(c.id)}
                      className="btn-secondary py-1 px-2.5 text-xs"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Complaint Detail Modal Overlay */}
      {selectedComplaintId && (
        <ComplaintDetailModal
          complaintId={selectedComplaintId}
          onClose={() => setSelectedComplaintId(null)}
        />
      )}
    </div>
  );
}
