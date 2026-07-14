import { useState } from "react";
import PageHeader from "../../../components/PageHeader";

export default function SOSButtonPage() {
  const [state, setState] = useState<"idle" | "sent" | "acknowledged">("idle");

  function handleSOS() {
    setState("sent");
    // Mock realtime flow — real build emits `sos.raised` over the socket
    // to the guard room, then listens for `sos.acknowledged` (see arch doc §6).
    setTimeout(() => setState("acknowledged"), 2500);
  }

  return (
    <div className="max-w-md">
      <PageHeader code="S-01 / EMERGENCY SOS" title="Emergency Assistance" />

      <div className="bp-card p-8 text-center">
        {state === "idle" && (
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
        {state === "sent" && (
          <>
            <div className="h-32 w-32 rounded-full bg-red-500/20 border-2 border-red-400 mx-auto flex items-center justify-center animate-pulse mb-4">
              <span className="font-display text-lg text-red-300">SOS</span>
            </div>
            <p className="text-sm text-ink-300">Alert sent to security. Waiting for acknowledgment…</p>
          </>
        )}
        {state === "acknowledged" && (
          <>
            <div className="h-32 w-32 rounded-full bg-emerald-500/15 border-2 border-emerald-400 mx-auto flex items-center justify-center mb-4">
              <span className="text-emerald-300 text-2xl">✓</span>
            </div>
            <p className="text-sm text-emerald-300 font-medium">Security has acknowledged your alert.</p>
            <p className="text-xs text-ink-500 mt-1">Help is on the way.</p>
            <button className="btn-secondary mt-6" onClick={() => setState("idle")}>Reset</button>
          </>
        )}
      </div>
    </div>
  );
}
