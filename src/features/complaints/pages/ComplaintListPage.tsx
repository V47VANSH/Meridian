import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { complaints } from "../../../api/mockData";

export default function ComplaintListPage() {
  const [selected, setSelected] = useState(complaints[0]?.id ?? null);
  const active = complaints.find((c) => c.id === selected);

  return (
    <div>
      <PageHeader code="C-02 / MY COMPLAINTS" title="Complaint Status" description="Track every complaint you've raised." />

      {complaints.length === 0 ? (
        <EmptyState title="No complaints raised yet" hint="Use Raise Complaint to report an issue." />
      ) : (
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-2 bp-card divide-y divide-blueprint-700">
            {complaints.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full text-left px-4 py-3.5 transition ${
                  selected === c.id ? "bg-blueprint-700/50" : "hover:bg-blueprint-800"
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
                <h3 className="text-lg font-semibold mb-4">{active.title}</h3>
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
