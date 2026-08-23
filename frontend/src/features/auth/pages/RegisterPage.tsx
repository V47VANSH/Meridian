import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { register as registerRequest } from "../../../api/auth";
import logo from "../../../assets/logo.svg";

/**
 * Roles a person may give themselves at signup.
 *
 * The backend rejects SUPER_ADMIN and SOCIETY_OFFICIAL here — an administrator
 * provisions those — so they are not offered.
 */
const OWNERSHIP_OPTIONS = [
  { value: "RESIDENT_OWNER", label: "Residential Owner" },
  { value: "NON_RESIDENT_OWNER", label: "Non-Residential Owner" },
] as const;

type OwnershipRole = (typeof OWNERSHIP_OPTIONS)[number]["value"];

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [societyId, setSocietyId] = useState("");
  const [role, setRole] = useState<OwnershipRole>("RESIDENT_OWNER");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const createAccount = useMutation({
    mutationFn: () =>
      registerRequest({
        tenant_id: societyId.trim(),
        email,
        password,
        full_name: fullName,
        phone,
        role,
        // Flats are keyed by id, not by the "B-304" label a resident knows, and
        // there is no endpoint to look one up before signing in. The society
        // office links the flat to the account afterwards.
        flat_id: null,
      }),
  });

  const errorMessage = createAccount.error instanceof Error ? createAccount.error.message : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createAccount.mutate();
  }

  return (
    <div className="min-h-screen bp-canvas flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={logo} alt="" className="h-9 w-9" />
          <span className="font-display text-lg font-semibold">Meridian</span>
        </div>

        <div className="bp-card px-8 py-8">
          <p className="bp-eyebrow mb-2">REGISTER</p>
          <h2 className="text-2xl font-semibold mb-1">Create your account</h2>
          <p className="text-sm text-ink-300 mb-6">
            For residential and non-residential flat owners.
          </p>

          {createAccount.isSuccess ? (
            <div className="text-center py-6">
              <p className="text-signal font-display text-lg mb-2">Account created</p>
              <p className="text-sm text-ink-300 mb-6">
                Your account is registered with the society. Sign in to continue — the
                office will link your flat to it.
              </p>
              <button className="btn-primary" onClick={() => navigate("/login")}>
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label-field" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="label-field" htmlFor="societyId">Society ID</label>
                <input
                  id="societyId"
                  required
                  value={societyId}
                  onChange={(e) => setSocietyId(e.target.value)}
                  className="input-field"
                  placeholder="Provided by your society office"
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  Ask your society office for this identifier.
                </p>
              </div>
              <div>
                <label className="label-field" htmlFor="role">Ownership Type</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as OwnershipRole)}
                  className="input-field"
                >
                  {OWNERSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field" htmlFor="regEmail">Email</label>
                <input
                  id="regEmail"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@meridian.app"
                />
              </div>
              <div>
                <label className="label-field" htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="+91 98xxxxxx02"
                />
              </div>
              <div>
                <label className="label-field" htmlFor="regPassword">Password</label>
                <input
                  id="regPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                />
                <p className="mt-1.5 text-xs text-ink-500">At least 8 characters.</p>
              </div>

              {errorMessage && (
                <p role="alert" className="text-sm text-red-400">
                  {errorMessage}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={createAccount.isPending}>
                {createAccount.isPending ? "Creating account…" : "Create Account"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <Link to="/login" className="text-signal hover:text-signal-soft">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
