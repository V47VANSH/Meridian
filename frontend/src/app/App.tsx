import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { ROLE_HOME } from "../lib/constants";
import RequireRole from "../components/RequireRole";

import LoginPage from "../features/auth/pages/LoginPage";
import RegisterPage from "../features/auth/pages/RegisterPage";

import ResidentDashboard from "../features/dashboard/pages/ResidentDashboard";
import OfficialDashboard from "../features/dashboard/pages/OfficialDashboard";
import NonResidentDashboard from "../features/dashboard/pages/NonResidentDashboard";
import ResidentDirectoryPage from "../features/dashboard/pages/ResidentDirectoryPage";
import PropertyStatusPage from "../features/dashboard/pages/PropertyStatusPage";

import InvoiceListPage from "../features/maintenance/pages/InvoiceListPage";
import PayNowPage from "../features/maintenance/pages/PayNowPage";
import PaymentHistoryPage from "../features/maintenance/pages/PaymentHistoryPage";
import OfficialInvoiceManagementPage from "../features/maintenance/pages/OfficialInvoiceManagementPage";

import RaiseComplaintPage from "../features/complaints/pages/RaiseComplaintPage";
import ComplaintListPage from "../features/complaints/pages/ComplaintListPage";
import ComplaintTriagePage from "../features/complaints/pages/ComplaintTriagePage";

import FacilityCalendarPage from "../features/bookings/pages/FacilityCalendarPage";
import MyBookingsPage from "../features/bookings/pages/MyBookingsPage";
import ScheduleManagementPage from "../features/bookings/pages/ScheduleManagementPage";

import GuestPassGeneratePage from "../features/visitors/pages/GuestPassGeneratePage";
import GuestPassHistoryPage from "../features/visitors/pages/GuestPassHistoryPage";
import SOSButtonPage from "../features/visitors/pages/SOSButtonPage";
import SOSInboxPage from "../features/visitors/pages/SOSInboxPage";
import GuestPassVerifyPage from "../features/visitors/pages/GuestPassVerifyPage";

import AnnouncementFeedPage from "../features/announcements/pages/AnnouncementFeedPage";
import AnnouncementComposerPage from "../features/announcements/pages/AnnouncementComposerPage";

import StaffTasksPage from "../features/staff/pages/StaffTasksPage";

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
        <Route path="/register" element={<RegisterPage />} />

        {/* Resident */}
        <Route path="/resident/dashboard" element={<RequireRole role="RESIDENT_OWNER"><ResidentDashboard /></RequireRole>} />
        <Route path="/resident/maintenance/invoices" element={<RequireRole role="RESIDENT_OWNER"><InvoiceListPage /></RequireRole>} />
        <Route path="/resident/maintenance/pay/:invoiceId" element={<RequireRole role="RESIDENT_OWNER"><PayNowPage /></RequireRole>} />
        <Route path="/resident/maintenance/history" element={<RequireRole role="RESIDENT_OWNER"><PaymentHistoryPage /></RequireRole>} />
        <Route path="/resident/complaints/raise" element={<RequireRole role="RESIDENT_OWNER"><RaiseComplaintPage /></RequireRole>} />
        <Route path="/resident/complaints" element={<RequireRole role="RESIDENT_OWNER"><ComplaintListPage /></RequireRole>} />
        <Route path="/resident/bookings/calendar" element={<RequireRole role="RESIDENT_OWNER"><FacilityCalendarPage /></RequireRole>} />
        <Route path="/resident/bookings/mine" element={<RequireRole role="RESIDENT_OWNER"><MyBookingsPage /></RequireRole>} />
        <Route path="/resident/visitors/guest-pass" element={<RequireRole role="RESIDENT_OWNER"><GuestPassGeneratePage /></RequireRole>} />
        <Route path="/resident/visitors/history" element={<RequireRole role="RESIDENT_OWNER"><GuestPassHistoryPage /></RequireRole>} />
        <Route path="/resident/sos" element={<RequireRole role="RESIDENT_OWNER"><SOSButtonPage /></RequireRole>} />
        <Route path="/resident/announcements" element={<RequireRole role="RESIDENT_OWNER"><AnnouncementFeedPage /></RequireRole>} />

        {/* Society Official */}
        <Route path="/official/dashboard" element={<RequireRole role="SOCIETY_OFFICIAL"><OfficialDashboard /></RequireRole>} />
        <Route path="/official/residents" element={<RequireRole role="SOCIETY_OFFICIAL"><ResidentDirectoryPage /></RequireRole>} />
        <Route path="/official/maintenance/invoices" element={<RequireRole role="SOCIETY_OFFICIAL"><OfficialInvoiceManagementPage /></RequireRole>} />
        <Route path="/official/complaints/triage" element={<RequireRole role="SOCIETY_OFFICIAL"><ComplaintTriagePage /></RequireRole>} />
        <Route path="/official/bookings/schedule" element={<RequireRole role="SOCIETY_OFFICIAL"><ScheduleManagementPage /></RequireRole>} />
        <Route path="/official/announcements/compose" element={<RequireRole role="SOCIETY_OFFICIAL"><AnnouncementComposerPage /></RequireRole>} />

        {/* Non-Resident Owner */}
        <Route path="/non-resident/dashboard" element={<RequireRole role="NON_RESIDENT_OWNER"><NonResidentDashboard /></RequireRole>} />
        <Route path="/non-resident/property-status" element={<RequireRole role="NON_RESIDENT_OWNER"><PropertyStatusPage /></RequireRole>} />
        <Route path="/non-resident/guest-pass" element={<RequireRole role="NON_RESIDENT_OWNER"><GuestPassGeneratePage /></RequireRole>} />
        <Route path="/non-resident/announcements" element={<RequireRole role="NON_RESIDENT_OWNER"><AnnouncementFeedPage /></RequireRole>} />

        {/* Security Guard */}
        <Route path="/guard/verify" element={<RequireRole role="SECURITY_GUARD"><GuestPassVerifyPage /></RequireRole>} />
        <Route path="/guard/sos-inbox" element={<RequireRole role="SECURITY_GUARD"><SOSInboxPage /></RequireRole>} />

        {/* Maintenance / Cleaning Staff */}
        <Route path="/staff/tasks" element={<RequireRole role="MAINTENANCE_STAFF"><StaffTasksPage /></RequireRole>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
