import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../store/authStore";
import { ROLE_HOME, ROLE_LABELS, type Role } from "../../../lib/constants";
import logo from "../../../assets/logo.svg";

const ROLES: Role[] = [
  "RESIDENT_OWNER",
  "SOCIETY_OFFICIAL",
  "NON_RESIDENT_OWNER",
  "SECURITY_GUARD",
  "MAINTENANCE_STAFF",
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("RESIDENT_OWNER");
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Mock auth — no backend call. Swap for a real POST /auth/login once
    // the API contract is published, then decode role/tenant from the JWT.
    login({ name: email ? email.split("@")[0] : "Demo User", role, flatNo: "B-304" });
    navigate(ROLE_HOME[role]);
  }

  return (
    <div className="min-h-screen bp-canvas flex">
      {/* Left: brand panel */}
      <div className="hidden lg:flex w-[42%] flex-col justify-between border-r border-blueprint-700 bg-blueprint-950/50 px-12 py-12">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-9 w-9" />
          <span className="font-display text-lg font-semibold">Meridian</span>
        </div>
        <div>
          <p className="bp-eyebrow mb-3">D-00 / SOCIETY OPERATING SYSTEM</p>
          <h1 className="font-display text-4xl font-semibold leading-tight max-w-md">
            One structure for every resident, official, and gate.
          </h1>
          <p className="mt-4 text-sm text-ink-300 max-w-sm">
            Maintenance, complaints, bookings, visitor passes, and emergency alerts —
            drafted into a single, transparent plan.
          </p>
        </div>
        <p className="text-xs font-mono text-ink-500">© 2026 Meridian Society Systems</p>
      </div>

      {/* Right: form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="bp-eyebrow mb-2">D-01 / SIGN IN</p>
          <h2 className="text-2xl font-semibold mb-1">Welcome back</h2>
          <p className="text-sm text-ink-300 mb-8">Sign in to continue to your dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-field">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@meridian.app"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Sign in as (demo role switch)</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="input-field"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ink-500">
                No backend is wired up yet — this stands in for JWT-decoded role until then.
              </p>
            </div>
            <button type="submit" className="btn-primary w-full">
              Sign In
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            New resident?{" "}
            <Link to="/register" className="text-signal hover:text-signal-soft">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
