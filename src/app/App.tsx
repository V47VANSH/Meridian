import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { ROLE_HOME } from "../lib/constants";
import RequireRole from "../components/RequireRole";

import LoginPage from "../features/auth/pages/LoginPage";
import ResidentDashboard from "../features/dashboard/pages/ResidentDashboard";

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={user ? ROLE_HOME[user.role] : "/login"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/resident/dashboard" element={<RequireRole role="RESIDENT_OWNER"><ResidentDashboard /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
