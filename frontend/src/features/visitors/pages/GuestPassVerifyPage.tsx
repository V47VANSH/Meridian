import { useState, type FormEvent } from "react";
import PageHeader from "../../../components/PageHeader";
import { ErrorBanner } from "../../../components/QueryState";
import { useVerifyGuestPass } from "../../../api/visitors";
import { formatDateTime } from "../../../lib/format";

export default function GuestPassVerifyPage() {
  const [token, setToken] = useState("");
  const verify = useVerifyGuestPass();

  function handleVerify(e: FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    // Verification is a write: the API consumes the pass in the same
    // transaction that reports the result, so a captured QR cannot be replayed.
    verify.mutate(trimmed);
  }

  const result = verify.data;

  return (
    <div className="max-w-md">
      <PageHeader
        code="G-01 / VERIFY PASS"
        title="Verify Guest Pass"
        description="Scan the visitor's QR code, or paste the pass token it contains."
      />

      <div className="bp-card p-6">
        <form onSubmit={handleVerify} className="flex gap-3 mb-6">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Scan or paste the pass token"
            className="input-field font-mono text-xs"
          />
          <button className="btn-primary px-5" disabled={verify.isPending}>
            {verify.isPending ? "…" : "Verify"}
          </button>
        </form>

        {/* An unknown token is a 404; a known but unusable pass comes back as
            a successful response with valid:false and the reason why. The old
            page matched against a fixture array, so real passes always failed
            and two fabricated ones always passed. */}
        <ErrorBanner error={verify.error} />

        {result && (
          <div
            className={`rounded-sm border px-4 py-3 text-sm ${
              result.valid
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            <p className="font-semibold mb-1">
              {result.valid ? "Entry approved" : "Entry refused"}
            </p>
            <p>{result.reason}</p>
            {result.valid && (
              <dl className="mt-3 space-y-1 font-mono text-xs text-ink-200">
                <div className="flex justify-between">
                  <dt className="text-ink-400">Visitor</dt>
                  <dd>{result.visitor_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Visiting</dt>
                  <dd>{result.flat_label ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Verified</dt>
                  <dd>{formatDateTime(result.verified_at)}</dd>
                </div>
              </dl>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
