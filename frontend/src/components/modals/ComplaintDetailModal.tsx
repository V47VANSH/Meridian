import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import {
  ALLOWED_TRANSITIONS,
  useAssignComplaint,
  useComplaint,
  useUpdateComplaintPriority,
  useUpdateComplaintStatus,
} from "../../api/complaints";
import { useFlatLabels, useUserNames, useUsers } from "../../api/directory";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  URGENCY_LABELS,
  URGENCY_LEVELS,
  labelFor,
} from "../../lib/labels";
import { formatDateTime } from "../../lib/format";
import { ErrorBanner, LoadingState } from "../QueryState";
import StatusBadge from "../StatusBadge";
import type { ComplaintStatus, ComplaintUrgency } from "../../api/types";

/** Roles the backend accepts as a complaint assignee. */
const ASSIGNABLE_ROLES = new Set([
  "MAINTENANCE_STAFF",
  "CLEANING_STAFF",
  "SERVICE_PROVIDER",
  "SECURITY_GUARD",
]);

interface ComplaintDetailModalProps {
  complaintId: string;
  onClose: () => void;
}

export default function ComplaintDetailModal({ complaintId, onClose }: ComplaintDetailModalProps) {
  const { user } = useAuthStore();
  const isOfficial = user?.role === "SOCIETY_OFFICIAL";

  const { data: complaint, isPending, error } = useComplaint(complaintId);
  const { data: users } = useUsers();
  const flatLabel = useFlatLabels();
  const userName = useUserNames();

  const updateStatus = useUpdateComplaintStatus();
  const assign = useAssignComplaint();
  const updatePriority = useUpdateComplaintPriority();

  const [note, setNote] = useState("");

  const staff = (users ?? []).filter((u) => ASSIGNABLE_ROLES.has(u.role));
  const writeError = updateStatus.error ?? assign.error ?? updatePriority.error;
  const isBusy = updateStatus.isPending || assign.isPending || updatePriority.isPending;

  // Only transitions the lifecycle permits are offered. Rendering every status
  // as a button meant most clicks returned 400 INVALID_STATUS_TRANSITION.
  const nextStatuses: ComplaintStatus[] = complaint
    ? ALLOWED_TRANSITIONS[complaint.status as ComplaintStatus] ?? []
    : [];

  const handleStatus = (status: ComplaintStatus) => {
    updateStatus.mutate(
      { id: complaintId, status, note: note.trim() },
      { onSuccess: () => setNote("") },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs" />

      <div className="relative z-10 w-full max-w-2xl bp-card p-6 max-h-[85vh] overflow-y-auto">
        {isPending && <LoadingState label="Loading complaint…" />}
        {error && <ErrorBanner error={error} />}

        {complaint && (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="bp-eyebrow mb-1">
                  {labelFor(COMPLAINT_CATEGORY_LABELS, complaint.category)}
                </p>
                <h3 className="text-lg font-semibold">{complaint.title}</h3>
                <p className="text-xs font-mono text-ink-500 mt-1">{complaint.id}</p>
              </div>
              <button
                onClick={onClose}
                className="text-ink-500 hover:text-ink-100 text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <StatusBadge status={complaint.status} />
              <StatusBadge status={complaint.urgency} />
              {complaint.needs_manual_triage && (
                <span className="badge badge-pending">Needs triage</span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm mb-5">
              <div>
                <dt className="text-ink-500 text-xs font-mono uppercase">Raised by</dt>
                <dd className="text-ink-100">
                  {userName(complaint.raised_by)} ({flatLabel(complaint.flat_id)})
                </dd>
              </div>
              <div>
                <dt className="text-ink-500 text-xs font-mono uppercase">Raised at</dt>
                <dd className="text-ink-100">{formatDateTime(complaint.created_at)}</dd>
              </div>
              <div>
                <dt className="text-ink-500 text-xs font-mono uppercase">Assigned to</dt>
                <dd className="text-ink-100">
                  {complaint.assigned_to ? userName(complaint.assigned_to) : "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500 text-xs font-mono uppercase">Resolved at</dt>
                <dd className="text-ink-100">
                  {complaint.resolved_at ? formatDateTime(complaint.resolved_at) : "—"}
                </dd>
              </div>
            </dl>

            <p className="text-sm text-ink-300 leading-relaxed mb-6">{complaint.description}</p>

            <p className="bp-eyebrow mb-3">HISTORY</p>
            <ol className="space-y-3 mb-6">
              {(complaint.history ?? []).map((entry) => (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-signal" />
                  <div>
                    <p className="text-ink-100">
                      {entry.note ||
                        `Status changed to ${labelFor(COMPLAINT_STATUS_LABELS, entry.status)}`}
                    </p>
                    <p className="text-xs font-mono text-ink-500">
                      {userName(entry.changed_by)} · {formatDateTime(entry.changed_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {isOfficial && (
              <div className="border-t border-blueprint-700 pt-5 space-y-4">
                <ErrorBanner error={writeError} />

                <div>
                  <label className="label-field">Note (recorded in the history)</label>
                  <input
                    className="input-field"
                    placeholder="Optional note for this update"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <div>
                  <p className="label-field">Advance status</p>
                  {nextStatuses.length === 0 ? (
                    <p className="text-xs font-mono text-ink-500">
                      This complaint is closed — no further transitions.
                    </p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {nextStatuses.map((status) => (
                        <button
                          key={status}
                          disabled={isBusy}
                          onClick={() => handleStatus(status)}
                          className="btn-secondary text-xs py-1 px-3"
                        >
                          Mark {COMPLAINT_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">Assign to staff</label>
                    <select
                      className="input-field"
                      disabled={isBusy}
                      value={complaint.assigned_to ?? ""}
                      onChange={(e) =>
                        e.target.value &&
                        assign.mutate({ id: complaintId, assignedTo: e.target.value })
                      }
                    >
                      <option value="">Unassigned</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-field">Priority</label>
                    <select
                      className="input-field"
                      disabled={isBusy}
                      value={complaint.urgency}
                      onChange={(e) =>
                        updatePriority.mutate({
                          id: complaintId,
                          urgency: e.target.value as ComplaintUrgency,
                          note: note.trim(),
                        })
                      }
                    >
                      {URGENCY_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {URGENCY_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
