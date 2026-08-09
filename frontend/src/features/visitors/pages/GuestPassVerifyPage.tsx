import { useState, type FormEvent } from "react";
import PageHeader from "../../../components/PageHeader";
import { guestPasses } from "../../../api/mockData";

export default function GuestPassVerifyPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<null | "valid" | "invalid">(null);

  function handleVerify(e: FormEvent) {
    e.preventDefault();
    const found = guestPasses.find((p) => p.id.toLowerCase() === code.trim().toLowerCase());
    setResult(found && found.status === "ACTIVE" ? "valid" : "invalid");
  }

  return (
    <div className="max-w-md">
      <PageHeader code="G-01 / VERIFY PASS" title="Verify Guest Pass" description="Scan or enter the pass code shown by the visitor." />

      <div className="bp-card p-6">
        <form onSubmit={handleVerify} className="flex gap-3 mb-6">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. GP-2201"
            className="input-field"
          />
          <button className="btn-primary px-5">Verify</button>
        </form>

        {result === "valid" && (
          <div className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Pass valid — entry approved.
          </div>
        )}
        {result === "invalid" && (
          <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Pass not found or already used/expired.
          </div>
        )}
      </div>
    </div>
  );
}
