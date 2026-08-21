import { useEffect } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { guestPasses, useMockData, syncGuestPassesFromBackend } from "../../../api/mockData";
import { api } from "../../../api/client";

export default function GuestPassHistoryPage() {
  useMockData();

  useEffect(() => {
    api.get("/v1/visitors/guest-passes")
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(items)) syncGuestPassesFromBackend(items);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <PageHeader code="V-02 / PASS HISTORY" title="Guest Pass History" />
      {guestPasses.length === 0 ? (
        <div className="bp-card p-6 text-center text-ink-500 font-mono">No guest passes generated yet.</div>
      ) : (
        <div className="bp-card divide-y divide-blueprint-700">
          {guestPasses.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-ink-100">{p.guestName}</p>
                <p className="text-xs text-ink-500">{p.purpose} · {p.validOn}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
