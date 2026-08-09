import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore, setAuthTokens, clearAuth } from "../../../store/authStore";
import { ROLE_HOME } from "../../../lib/constants";
import { login as loginRequest, getCurrentUser, toAuthUser } from "../../../api/auth";
import { ApiError } from "../../../api/client";
import logo from "../../../assets/logo.svg";

/** Accounts created by the backend seeder, shown so the app can be demoed. */
const DEMO_ACCOUNTS = [
  { email: "resident@greenvalley.example", label: "Resident / Flat Owner" },
  { email: "official@greenvalley.example", label: "Society Official" },
  { email: "owner@greenvalley.example", label: "Non-Resident Owner" },
  { email: "guard@greenvalley.example", label: "Security Guard" },
  { email: "staff@greenvalley.example", label: "Maintenance Staff" },
];
const DEMO_PASSWORD = "Password123";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const signIn = useMutation({
    mutationFn: async () => {
      const tokens = await loginRequest({
        email,
        password,
        // Only sent once the backend has told us this email spans societies.
        tenant_id: tenantId.trim() || null,
      });

      // The token has to be readable by the client before /me can be called.
      setAuthTokens(tokens.access_token, tokens.refresh_token);
      try {
        const user = toAuthUser(await getCurrentUser());
        setSession(user, tokens.access_token, tokens.refresh_token);
        return user;
      } catch (error) {
        // Never leave a half-open session behind: the tokens are valid but we
        // have no user to render.
        clearAuth();
        throw error;
      }
    },
    onSuccess: (user) => navigate(ROLE_HOME[user.role], { replace: true }),
  });

  // The backend asks for a society only when one email exists in several.
  const needsTenant = signIn.error instanceof ApiError && signIn.error.code === "TENANT_REQUIRED";
  const errorMessage = signIn.error instanceof Error ? signIn.error.message : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    signIn.mutate();
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
              <label className="label-field" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@meridian.app"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
              />
            </div>

            {needsTenant && (
              <div>
                <label className="label-field" htmlFor="tenantId">Society ID</label>
                <input
                  id="tenantId"
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Society identifier"
                  className="input-field"
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  This email is registered in more than one society.
                </p>
              </div>
            )}

            {errorMessage && (
              <p role="alert" className="text-sm text-red-400">
                {errorMessage}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={signIn.isPending}>
              {signIn.isPending ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShowDemoAccounts((v) => !v)}
              className="text-xs font-mono text-ink-500 hover:text-signal"
            >
              {showDemoAccounts ? "Hide demo accounts" : "Show demo accounts"}
            </button>
            {showDemoAccounts && (
              <ul className="mt-3 space-y-1.5 text-left">
                {DEMO_ACCOUNTS.map((account) => (
                  <li key={account.email}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(account.email);
                        setPassword(DEMO_PASSWORD);
                      }}
                      className="w-full text-left text-xs font-mono text-ink-300 hover:text-signal"
                    >
                      {account.email}
                      <span className="text-ink-500"> — {account.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
