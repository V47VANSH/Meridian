import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { ROLE_LABELS } from "../lib/constants";
import { NAV_BY_ROLE } from "../lib/nav";
import { logout as revokeSession } from "../api/auth";
import logo from "../assets/logo.svg";
import AiChatBox from "./AiChatBox";
import NotificationBell from "./NotificationBell";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    const { refreshToken } = useAuthStore.getState();
    if (refreshToken) {
      // Revoke server-side so the refresh token cannot be rotated again. A
      // failure here is not worth blocking on — the local session is cleared
      // either way and the token expires on its own.
      await revokeSession(refreshToken).catch(() => undefined);
    }
    logout();
    // Drop every cached response so the next account cannot read this one's data.
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  if (!user) return null;
  const items = NAV_BY_ROLE[user.role];

  return (
    <div className="min-h-screen bp-canvas flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-blueprint-700 bg-blueprint-950/60 flex flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-blueprint-700">
          <img src={logo} alt="" className="h-8 w-8" />
          <div>
            <p className="font-display text-sm font-semibold leading-tight">Meridian</p>
            <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500">Society OS</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-sm px-3.5 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-blueprint-700/70 text-signal font-semibold"
                    : "text-ink-300 hover:bg-blueprint-800 hover:text-ink-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-blueprint-700 px-5 py-4">
          <p className="text-sm text-ink-100">{user.name}</p>
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-3">
            {ROLE_LABELS[user.role]}
          </p>
          <div className="space-y-2">
            <NotificationBell />
            <button
              onClick={() => void handleLogout()}
              className="btn-secondary w-full text-xs"
            >
              Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>

      {/* AI Chat Assistant */}
      <AiChatBox />
    </div>
  );
}

