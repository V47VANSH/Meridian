import { useState, type FormEvent } from "react";
import PageHeader from "../../../components/PageHeader";
import QrCode from "../../../components/QrCode";
import { ErrorBanner } from "../../../components/QueryState";
import { useCreateGuestPass } from "../../../api/visitors";
import { useMyFlats } from "../../../api/directory";
import { formatDate, toDateInput } from "../../../lib/format";
import type { GuestPass } from "../../../api/types";

const PURPOSES = ["Personal visit", "Delivery", "Cab/Taxi", "Service provider"];

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInput(date.toISOString());
}

export default function GuestPassGeneratePage() {
  const { data: myFlats, isPending: flatsPending } = useMyFlats();
  const createPass = useCreateGuestPass();

  const [pass, setPass] = useState<GuestPass | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(tomorrow);
  const [purpose, setPurpose] = useState(PURPOSES[0]);

  const flat = myFlats?.[0];

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!flat) return;

    // A pass is valid for the selected day in the society's local time. Using
    // the browser's own midnight boundaries keeps "valid on the 14th" meaning
    // the 14th on site rather than shifting by the UTC offset.
    const created = await createPass.mutateAsync({
      visitor_name: name.trim(),
      visitor_phone: phone.trim(),
      purpose,
      flat_id: flat.id,
      valid_from: new Date(`${date}T00:00:00`).toISOString(),
      valid_until: new Date(`${date}T23:59:59`).toISOString(),
    });
    setPass(created);
  }

  function reset() {
    setPass(null);
    setName("");
    setPhone("");
    createPass.reset();
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
              {/* The QR encodes the pass token, which is what the guard's
                  verify endpoint takes. It is returned only to the resident
                  who created the pass. */}
              {pass.qr_token ? (
                <QrCode value={pass.qr_token} />
              ) : (
                <p className="text-xs font-mono text-ink-500">
                  This pass has no scannable token.
                </p>
              )}
            </div>
            {pass.qr_token && (
              <p className="font-mono text-[10px] text-ink-500 mb-3 break-all px-4">
                {pass.qr_token}
              </p>
            )}
            <p className="text-lg font-display font-semibold mb-1">{pass.visitor_name}</p>
            <p className="text-sm text-ink-300 mb-6">
              Valid on {formatDate(pass.valid_from)} · {pass.purpose || "Visit"}
            </p>
            <button className="btn-secondary" onClick={reset}>
              Generate Another
            </button>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-5">
            <ErrorBanner error={createPass.error} />

            {/* A pass belongs to a flat, so a caller with none cannot raise
                one. Saying so beats a rejected submit. */}
            {!flatsPending && !flat && (
              <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
                Your account is not linked to a flat, so guest passes cannot be issued. Ask a
                society official to link your flat.
              </div>
            )}

            <div>
              <label className="label-field">Guest Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Guest full name"
              />
            </div>
            <div>
              <label className="label-field">Guest Phone (optional)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder="e.g. 9800001234"
              />
            </div>
            <div>
              <label className="label-field">Purpose of Visit</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="input-field"
              >
                {PURPOSES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Valid On</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Flat</label>
              <input className="input-field" value={flat?.label ?? "—"} readOnly disabled />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={createPass.isPending || !flat}
            >
              {createPass.isPending ? "Generating…" : "Generate Pass"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
