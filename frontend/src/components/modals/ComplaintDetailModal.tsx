import { useState } from "react";
import { api } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { Complaint, complaints, notifyMockDataChanged } from "../../api/mockData";
import StatusBadge from "../StatusBadge";

interface ComplaintDetailModalProps {
  complaintId: string;
  onClose: () => void;
}

export default function ComplaintDetailModal({ complaintId, onClose }: ComplaintDetailModalProps) {
  const { user } = useAuthStore();
  const [complaint, setComplaint] = useState<Complaint | undefined>(
    complaints.find((c) => c.id === complaintId)
  );

  if (!complaint) return null;

  const isOfficial = user?.role === "SOCIETY_OFFICIAL";

  const handleUpdateStatus = async (newStatus: "IN_PROGRESS" | "RESOLVED" | "OPEN") => {
    try {
      await api.patch(`/v1/complaints/${complaint.id}/status`, {
        status: newStatus,
        note: `Status marked as ${newStatus.replace("_", " ")} by ${user?.name || "Official"}`,
      });
    } catch {
      // Backend may fail or not be reachable, proceed with local update
    }
    const target = complaints.find((c) => c.id === complaint.id);
    if (target) {
      target.status = newStatus;
      target.timeline.unshift({
        label: `Status marked as ${newStatus.replace("_", " ")}`,
        date: new Date().toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setComplaint({ ...target });
      notifyMockDataChanged();
    }
  };

  const handleAssign = async (assignee: string) => {
    if (!assignee) return;
    const target = complaints.find((c) => c.id === complaint.id);
    if (target) {
      target.status = "IN_PROGRESS";
      target.timeline.unshift({
        label: `Assigned to ${assignee}`,
        date: new Date().toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setComplaint({ ...target });
      notifyMockDataChanged();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs"></div>

      {/* Modal Card Box */}
      <div className="relative w-full max-w-lg bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10">
        {/* Drafting corner ticks */}
        <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t border-l border-blueprint-500"></div>
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b border-r border-blueprint-500"></div>

        {/* Header */}
        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">{complaint.id} / {complaint.category}</p>
            <h3 className="font-display font-semibold text-lg text-ink-100 mt-1">{complaint.title}</h3>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1">
            [×] Close
          </button>
        </div>

        {/* Info Rows */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-xs font-mono">
          <div className="border border-blueprint-700 p-2.5 rounded-xs bg-blueprint-950/40">
            <p className="text-ink-500 uppercase text-[9px] mb-1">Raised By</p>
            <p className="text-ink-100 font-semibold">{complaint.raisedBy} (Flat {complaint.flatNo})</p>
          </div>
          <div className="border border-blueprint-700 p-2.5 rounded-xs bg-blueprint-950/40">
            <p className="text-ink-500 uppercase text-[9px] mb-1">Created At</p>
            <p className="text-ink-100 font-semibold">{complaint.createdAt}</p>
          </div>
          <div className="border border-blueprint-700 p-2.5 rounded-xs bg-blueprint-950/40">
            <p className="text-ink-500 uppercase text-[9px] mb-1">Urgency</p>
            <StatusBadge status={complaint.urgency} />
          </div>
          <div className="border border-blueprint-700 p-2.5 rounded-xs bg-blueprint-950/40">
            <p className="text-ink-500 uppercase text-[9px] mb-1">Current Status</p>
            <StatusBadge status={complaint.status} />
          </div>
        </div>

        {/* Description */}
        <div className="mb-5 text-xs text-ink-300 leading-relaxed border-t border-b border-blueprint-700/60 py-3 bg-blueprint-950/20 px-1 font-body">
          <p className="font-mono text-[9px] uppercase tracking-wider text-ink-500 mb-1.5 font-bold">Details</p>
          {complaint.description || "No detailed description provided."}
        </div>

        {/* Timeline */}
        <div className="mb-6">
          <p className="bp-eyebrow text-[10px] mb-3">Timeline Logs</p>
          <ol className="space-y-3 max-h-32 overflow-y-auto pr-1">
            {complaint.timeline.map((t, idx) => (
              <li key={idx} className="flex gap-2.5 text-xs font-body">
                <div className="flex flex-col items-center pt-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                  {idx < complaint.timeline.length - 1 && (
                    <span className="w-px flex-1 bg-blueprint-700 mt-1" />
                  )}
                </div>
                <div>
                  <p className="text-ink-100 leading-none">{t.label}</p>
                  <p className="text-[10px] text-ink-500 font-mono mt-0.5">{t.date}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Action Console (Officials Only) */}
        {isOfficial && (
          <div className="border-t border-blueprint-700 pt-4 bg-blueprint-950/40 -mx-6 -mb-6 p-6 rounded-b-sm">
            <p className="bp-eyebrow text-[10px] mb-3">Triage Controls</p>
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                {complaint.status === "OPEN" && (
                  <button
                    onClick={() => handleUpdateStatus("IN_PROGRESS")}
                    className="btn-primary py-1.5 px-3 text-xs bg-blueprint-700 hover:bg-blueprint-600 text-ink-100 border border-blueprint-600"
                  >
                    Start Work
                  </button>
                )}
                {complaint.status !== "RESOLVED" ? (
                  <button
                    onClick={() => handleUpdateStatus("RESOLVED")}
                    className="btn-primary py-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-ink-100"
                  >
                    Resolve Ticket
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus("OPEN")}
                    className="btn-secondary py-1.5 px-3 text-xs border-blueprint-500"
                  >
                    Re-open Ticket
                  </button>
                )}
              </div>

              <div>
                <select
                  onChange={(e) => handleAssign(e.target.value)}
                  className="input-field py-1 text-xs w-40"
                  defaultValue=""
                >
                  <option value="" disabled>Assign order to…</option>
                  <option value="Maintenance Staff">Maintenance Staff</option>
                  <option value="Cleaning Staff">Cleaning Staff</option>
                  <option value="Service Provider">Service Provider</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
