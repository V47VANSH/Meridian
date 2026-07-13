import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../store/authStore";
import { ROLE_HOME } from "../../../lib/constants";
import logo from "../../../assets/logo.svg";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login({ name: email ? email.split("@")[0] : "Demo User", role: "RESIDENT_OWNER", flatNo: "B-304" });
    navigate(ROLE_HOME.RESIDENT_OWNER);
  }

  return (
    <div className="min-h-screen bp-canvas flex">
      <div className="hidden w-[42%] flex-col justify-between border-r border-blueprint-700/70 bg-blueprint-950/45 px-12 py-12 lg:flex">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-9 w-9" />
          <span className="font-display text-lg font-semibold">Meridian</span>
        </div>
        <div>
          <p className="bp-eyebrow mb-3">Made for everyday society life</p>
          <h1 className="max-w-md font-display text-4xl font-semibold leading-tight">
            A calmer place for dues, complaints, visitor passes, and daily updates.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-300">
            Less chasing in chat groups, fewer missed notices, and one place residents
            can actually come back to.
          </p>
          <div className="mt-8 space-y-3 text-sm text-ink-300">
            <p>Track pending dues without digging through old messages.</p>
            <p>Raise complaints and actually see what is still open.</p>
            <p>Share passes and notices in a way that feels organized, not robotic.</p>
          </div>
        </div>
        <p className="text-xs text-ink-500">A warm, practical dashboard for residents and staff.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="bp-eyebrow mb-2">Welcome back</p>
          <h2 className="mb-1 text-2xl font-semibold">Sign in to your space</h2>
          <p className="mb-8 text-sm text-ink-300">
            Sign in to preview the resident login and home-page flow.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-field">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
            <div className="rounded-2xl border border-blueprint-700/70 bg-blueprint-800/45 px-4 py-4">
              <p className="label-field mb-2">Preview scope</p>
              <p className="text-sm text-ink-100">Resident login and resident dashboard only.</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                The multi-role demo has been turned off so no other dashboards or feature pages are reachable from this build.
              </p>
            </div>
            <button type="submit" className="btn-primary w-full">
              Enter Dashboard
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
