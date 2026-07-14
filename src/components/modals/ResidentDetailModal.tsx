import { useState } from "react";
import { Resident, invoices, complaints, guestPasses } from "../../api/mockData";
import StatusBadge from "../StatusBadge";

interface ResidentDetailModalProps {
  resident: Resident;
  onClose: () => void;
}

type TabType = "billing" | "complaints" | "visitors";

export default function ResidentDetailModal({ resident, onClose }: ResidentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("billing");

  const residentInvoices = invoices.filter((i) => i.flatNo === resident.flatNo);
  const residentComplaints = complaints.filter((c) => c.flatNo === resident.flatNo);
  const residentPasses = guestPasses.filter((p) => p.flatNo === resident.flatNo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs"></div>

      {/* Modal Box */}
      <div className="relative w-full max-w-lg bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10">
        {/* Drafting corner ticks */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500"></div>

        {/* Header */}
        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">{resident.flatNo} / PROFILE WIDGET</p>
            <h3 className="font-display font-semibold text-lg text-ink-100 mt-1">{resident.name}</h3>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1">
            [×] Close
          </button>
        </div>

        {/* Resident Summary Info */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs font-mono">
          <div className="border border-blueprint-700 p-2 rounded-xs bg-blueprint-950/40">
            <span className="text-[9px] uppercase tracking-wider text-ink-500 block mb-0.5">Type</span>
            <span className="text-ink-100 font-semibold">{resident.type}</span>
          </div>
          <div className="border border-blueprint-700 p-2 rounded-xs bg-blueprint-950/40">
            <span className="text-[9px] uppercase tracking-wider text-ink-500 block mb-0.5">Contact</span>
            <span className="text-ink-100 font-semibold">{resident.contact}</span>
          </div>
          <div className="border border-blueprint-700 p-2 rounded-xs bg-blueprint-950/40">
            <span className="text-[9px] uppercase tracking-wider text-ink-500 block mb-0.5">Dues status</span>
            <StatusBadge status={resident.duesStatus} />
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-blueprint-700 mb-3 text-xs font-mono">
          <button
            onClick={() => setActiveTab("billing")}
            className={`px-3 py-1.5 border-b-2 uppercase tracking-wide transition ${
              activeTab === "billing"
                ? "border-signal text-signal font-semibold"
                : "border-transparent text-ink-500 hover:text-ink-300"
            }`}
          >
            Bills ({residentInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab("complaints")}
            className={`px-3 py-1.5 border-b-2 uppercase tracking-wide transition ${
              activeTab === "complaints"
                ? "border-signal text-signal font-semibold"
                : "border-transparent text-ink-500 hover:text-ink-300"
            }`}
          >
            Complaints ({residentComplaints.length})
          </button>
          <button
            onClick={() => setActiveTab("visitors")}
            className={`px-3 py-1.5 border-b-2 uppercase tracking-wide transition ${
              activeTab === "visitors"
                ? "border-signal text-signal font-semibold"
                : "border-transparent text-ink-500 hover:text-ink-300"
            }`}
          >
            Passes ({residentPasses.length})
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="max-h-52 overflow-y-auto pr-1 text-xs">
          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="space-y-2">
              {residentInvoices.length === 0 ? (
                <p className="text-ink-500 italic py-2 text-center">No billing history found.</p>
              ) : (
                residentInvoices.map((inv) => (
                  <div key={inv.id} className="p-2.5 border border-blueprint-800 bg-blueprint-950/20 rounded-xs flex justify-between items-center font-mono">
                    <div>
                      <p className="font-semibold text-ink-100">{inv.month} ({inv.id})</p>
                      <p className="text-[10px] text-ink-500 mt-0.5">Due: {inv.dueDate}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-signal font-semibold block mb-0.5">₹{inv.amount}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Complaints Tab */}
          {activeTab === "complaints" && (
            <div className="space-y-2">
              {residentComplaints.length === 0 ? (
                <p className="text-ink-500 italic py-2 text-center">No complaints raised.</p>
              ) : (
                residentComplaints.map((c) => (
                  <div key={c.id} className="p-2.5 border border-blueprint-800 bg-blueprint-950/20 rounded-xs flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-ink-100">{c.title}</p>
                      <p className="text-[10px] font-mono text-ink-500 mt-0.5">{c.id} · {c.category}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <StatusBadge status={c.status} />
                      <div className="block"><StatusBadge status={c.urgency} /></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Visitors Tab */}
          {activeTab === "visitors" && (
            <div className="space-y-2">
              {residentPasses.length === 0 ? (
                <p className="text-ink-500 italic py-2 text-center">No guest passes generated.</p>
              ) : (
                residentPasses.map((p) => (
                  <div key={p.id} className="p-2.5 border border-blueprint-800 bg-blueprint-950/20 rounded-xs flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-ink-100">{p.guestName}</p>
                      <p className="text-[10px] text-ink-500 mt-0.5">{p.purpose} · {p.validOn}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-ink-500 block mb-0.5">{p.id}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
