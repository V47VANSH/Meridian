import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { Role } from "../lib/constants";
import { ROLE_HOME } from "../lib/constants";
import AppShell from "./AppShell";

export default function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />;

  return <AppShell>{children}</AppShell>;
}
