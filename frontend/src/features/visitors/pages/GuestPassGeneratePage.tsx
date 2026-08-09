import { useState, type FormEvent } from "react";
import PageHeader from "../../../components/PageHeader";

// Deterministic pseudo-QR pattern generated from the pass id — a visual
// placeholder only. Swap for a real QR lib (e.g. qrcode.react) at integration.
function PseudoQR({ seed }: { seed: string }) {
  const cells = Array.from({ length: 64 }, (_, i) => {
    const code = seed.charCodeAt(i % seed.length) + i;
    return code % 3 !== 0;
  });
  return (
    <div className="grid grid-cols-8 gap-0.5 w-32 h-32 bg-ink-100 p-2 rounded-sm">
      {cells.map((filled, i) => (
        <div key={i} className={filled ? "bg-blueprint-950" : "bg-ink-100"} />
      ))}
    </div>
  );
}

export default function GuestPassGeneratePage() {
  const [pass, setPass] = useState<{ id: string; name: string; date: string } | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("2026-07-14");
  const [purpose, setPurpose] = useState("Personal visit");

  function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setPass({ id: `GP-${Math.floor(2000 + Math.random() * 500)}`, name, date });
  }

  return (
    <div className="max-w-lg">
      <PageHeader
        code="V-01 / GUEST PASS"
        title="Generate a Digital Guest Pass"
        description="Your guest shows this QR at the gate for quick, secure entry."
      />

      <div className="bp-card p-6">
        {pass ? (
          <div className="text-center py-4">
            <div className="flex justify-center mb-5">
              <PseudoQR seed={pass.id} />
            </div>
            <p className="font-mono text-xs text-ink-500 mb-1">{pass.id}</p>
            <p className="text-lg font-display font-semibold mb-1">{pass.name}</p>
            <p className="text-sm text-ink-300 mb-6">Valid on {pass.date} · {purpose}</p>
            <button className="btn-secondary" onClick={() => setPass(null)}>
              Generate Another
            </button>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label className="label-field">Guest Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Guest full name" />
            </div>
            <div>
              <label className="label-field">Purpose of Visit</label>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input-field">
                <option>Personal visit</option>
                <option>Delivery</option>
                <option>Cab/Taxi</option>
                <option>Service provider</option>
              </select>
            </div>
            <div>
              <label className="label-field">Valid On</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            </div>
            <button type="submit" className="btn-primary w-full">Generate Pass</button>
          </form>
        )}
      </div>
    </div>
  );
}
