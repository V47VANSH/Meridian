import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";
import { ROLE_LABELS } from "../lib/constants";
import { NAV_BY_ROLE } from "../lib/nav";
import logo from "../assets/logo.svg";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;
  const items = NAV_BY_ROLE[user.role];
  const firstName = user.name.split(" ")[0];

  return (
    <div className="min-h-screen bp-canvas flex">
      <aside className="flex w-72 shrink-0 flex-col border-r border-blueprint-700/70 bg-blueprint-950/55 backdrop-blur-sm">
        <div className="border-b border-blueprint-700/70 px-6 py-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-8 w-8" />
            <div>
              <p className="font-display text-base font-semibold leading-tight">Meridian</p>
              <p className="text-xs text-ink-500">A calmer way to run everyday society life</p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-blueprint-700/70 bg-blueprint-800/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d8b16a]">
              Welcome back
            </p>
            <p className="mt-1 text-lg font-semibold text-ink-100">{firstName}</p>
            <p className="mt-1 text-sm text-ink-300">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center rounded-xl px-4 py-3 text-sm transition ${
                  isActive
                    ? "bg-blueprint-800 text-ink-100 shadow-[0_10px_25px_rgba(5,11,20,0.18)]"
                    : "text-ink-300 hover:bg-blueprint-800/80 hover:text-ink-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-blueprint-700/70 px-6 py-5">
          <p className="text-sm text-ink-100">{user.name}</p>
          <p className="mb-4 text-sm text-ink-500">{user.flatNo ?? "Resident"}</p>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="btn-secondary w-full text-sm"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
