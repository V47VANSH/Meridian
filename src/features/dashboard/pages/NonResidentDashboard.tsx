import { Link } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import { invoices, complaints, announcements } from "../../../api/mockData";

export default function NonResidentDashboard() {
  const pendingInvoice = invoices.find((i) => i.status !== "PAID");
  const openComplaints = complaints.filter((c) => c.status !== "RESOLVED");

  return (
    <div>
      <PageHeader
        code="D-03 / NON-RESIDENT DASHBOARD"
        title="Manage your property remotely"
        description="Track dues, complaint status, and society updates from anywhere."
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Maintenance Due"
          value={pendingInvoice ? `₹${pendingInvoice.amount}` : "All clear"}
          hint={pendingInvoice ? `Due ${pendingInvoice.dueDate}` : "No dues pending"}
        />
        <StatCard label="Open Complaints" value={String(openComplaints.length)} />
        <StatCard label="Latest Announcement" value={announcements[0].title.slice(0, 18) + "…"} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link to="/non-resident/property-status" className="btn-secondary py-3">Property Status</Link>
        <Link to="/non-resident/guest-pass" className="btn-secondary py-3">Guest Pass</Link>
        <Link to="/non-resident/announcements" className="btn-secondary py-3">Announcements</Link>
      </div>
    </div>
  );
}
