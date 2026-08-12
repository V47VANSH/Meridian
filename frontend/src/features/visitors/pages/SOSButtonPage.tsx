import PageHeader from "../../../components/PageHeader";
import { sosAlerts, useMockData, notifyMockDataChanged } from "../../../api/mockData";

export default function SOSButtonPage() {
  useMockData();

  const currentAlert = sosAlerts.find((a) => a.flatNo === "B-304");

  function handleSOS() {
    if (!currentAlert) {
      sosAlerts.unshift({
        id: `SOS-0${sosAlerts.length + 9}`,
        flatNo: "B-304",
        raisedBy: "Resident B304",
        raisedAt: "Just now",
        status: "ACTIVE",
      });
      notifyMockDataChanged();
    }
  }

  function handleReset() {
    const idx = sosAlerts.findIndex((a) => a.flatNo === "B-304");
    if (idx !== -1) {
      sosAlerts.splice(idx, 1);
      notifyMockDataChanged();
    }
  }

  const isSent = currentAlert?.status === "ACTIVE";
  const isAcknowledged = currentAlert?.status === "ACKNOWLEDGED";

  return (
    <div className="max-w-md">
      <PageHeader code="S-01 / EMERGENCY SOS" title="Emergency Assistance" />

      <div className="bp-card p-8 text-center">
        {!currentAlert && (
          <>
            <p className="text-sm text-ink-300 mb-6">
              Pressing this alerts on-duty security immediately with your flat number.
            </p>
            <button
              onClick={handleSOS}
              className="h-32 w-32 rounded-full bg-red-500/15 border-2 border-red-500 text-red-400 font-display text-lg font-semibold mx-auto flex items-center justify-center hover:bg-red-500/25 transition"
            >
              SOS
            </button>
          </>
        )}
        {isSent && (
          <>
            <div className="h-32 w-32 rounded-full bg-red-500/20 border-2 border-red-400 mx-auto flex items-center justify-center animate-pulse mb-4">
              <span className="font-display text-lg text-red-300">SOS</span>
            </div>
            <p className="text-sm text-ink-300 font-medium">Alert sent to security.</p>
            <p className="text-xs text-ink-500 mt-1">Waiting for security guard to acknowledge…</p>
            <button className="btn-secondary mt-6" onClick={handleReset}>Cancel Alert</button>
          </>
        )}
        {isAcknowledged && (
          <>
            <div className="h-32 w-32 rounded-full bg-emerald-500/15 border-2 border-emerald-400 mx-auto flex items-center justify-center mb-4">
              <span className="text-emerald-300 text-2xl">✓</span>
            </div>
            <p className="text-sm text-emerald-300 font-medium">Security has acknowledged your alert.</p>
            <p className="text-xs text-ink-500 mt-1">Help is on the way.</p>
            <button className="btn-secondary mt-6" onClick={handleReset}>Reset</button>
          </>
        )}
      </div>
    </div>
  );
}
