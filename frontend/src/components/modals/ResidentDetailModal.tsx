import StatusBadge from "../StatusBadge";
import { LoadingState } from "../QueryState";
import { useInvoices } from "../../api/maintenance";
import { useComplaints } from "../../api/complaints";
import { useGuestPasses } from "../../api/visitors";
import { formatCurrency, formatDate, formatPeriod } from "../../lib/format";
import { COMPLAINT_CATEGORY_LABELS, labelFor } from "../../lib/labels";
import type { DirectoryEntry } from "../../api/residents";

interface ResidentDetailModalProps {
  entry: DirectoryEntry;
  onClose: () => void;
}

export default function ResidentDetailModal({ entry, onClose }: ResidentDetailModalProps) {
  // Filtering happens against the society-wide lists an official already
  // holds, so opening a profile costs no extra request.
  const invoices = useInvoices();
  const complaints = useComplaints();
  const passes = useGuestPasses();

  const theirInvoices = (invoices.data ?? []).filter((i) => i.flat_id === entry.flatId);
  const theirComplaints = (complaints.data ?? []).filter((c) => c.raised_by === entry.userId);
  const theirPasses = (passes.data ?? []).filter((p) => p.flat_id === entry.flatId);

  const isPending = invoices.isPending || complaints.isPending || passes.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs" />

      <div className="relative w-full max-w-lg bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">
              {entry.flatLabel} / PROFILE
            </p>
            <h3 className="font-display font-semibold text-base text-ink-100 mt-1">{entry.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1"
          >
            [×] Close
          </button>
        </div>

        <dl className="border border-blueprint-700 p-3.5 rounded-xs bg-blueprint-950/40 font-mono text-xs mb-5 space-y-2">
          <div className="flex justify-between">
            <dt className="text-ink-500">Email</dt>
            <dd className="text-ink-100">{entry.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Contact</dt>
            <dd className="text-ink-100">{entry.phone || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Occupancy</dt>
            <dd className="text-ink-100">
              {entry.relation === "OWNER" ? "Owner" : "Tenant"}
            </dd>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-blueprint-800">
            <dt className="text-ink-500">Outstanding</dt>
            <dd className="flex items-center gap-2">
              <span className="text-signal font-bold">{formatCurrency(entry.outstanding)}</span>
              <StatusBadge status={entry.duesStatus} />
            </dd>
          </div>
        </dl>

        {isPending ? (
          <LoadingState label="Loading this resident's records…" />
        ) : (
          <div className="space-y-5">
            <section>
              <p className="bp-eyebrow mb-2">INVOICES</p>
              {theirInvoices.length === 0 ? (
                <p className="text-xs font-mono text-ink-500">No invoices raised for this flat.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {theirInvoices.map((invoice) => (
                    <li key={invoice.id} className="flex justify-between items-center">
                      <span className="text-ink-300">
                        {formatPeriod(invoice.period)} · {formatCurrency(invoice.amount)}
                      </span>
                      <StatusBadge status={invoice.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <p className="bp-eyebrow mb-2">COMPLAINTS RAISED</p>
              {theirComplaints.length === 0 ? (
                <p className="text-xs font-mono text-ink-500">No complaints raised.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {theirComplaints.map((complaint) => (
                    <li key={complaint.id} className="flex justify-between items-center gap-3">
                      <span className="text-ink-300 truncate">
                        {complaint.title}
                        <span className="text-ink-500">
                          {" "}
                          · {labelFor(COMPLAINT_CATEGORY_LABELS, complaint.category)}
                        </span>
                      </span>
                      <StatusBadge status={complaint.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <p className="bp-eyebrow mb-2">GUEST PASSES</p>
              {theirPasses.length === 0 ? (
                <p className="text-xs font-mono text-ink-500">No guest passes issued.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {theirPasses.map((pass) => (
                    <li key={pass.id} className="flex justify-between items-center">
                      <span className="text-ink-300">
                        {pass.visitor_name} · {formatDate(pass.valid_from)}
                      </span>
                      <StatusBadge status={pass.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
