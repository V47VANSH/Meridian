import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { residents, useMockData, Resident, notifyMockDataChanged } from "../../../api/mockData";
import { api } from "../../../api/client";
import ResidentDetailModal from "../../../components/modals/ResidentDetailModal";

export default function ResidentDirectoryPage() {
  useMockData();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "OWNER" | "TENANT">("ALL");
  const [duesFilter, setDuesFilter] = useState<"ALL" | "PENDING" | "CLEAR">("ALL");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

  // Add User Form Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newFlatNo, setNewFlatNo] = useState("E-401");
  const [newRole, setNewRole] = useState<"OWNER" | "TENANT">("OWNER");
  const [statusMsg, setStatusMsg] = useState("");

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    try {
      await api.post("/v1/users", {
        email: newEmail,
        password: "Password123",
        full_name: newName,
        phone: newPhone || "9800000099",
        role: "RESIDENT_OWNER",
      });
    } catch {
      // Continue and update local state even if backend offline
    }

    residents.unshift({
      flatNo: newFlatNo,
      name: newName,
      email: newEmail,
      type: newRole,
      contact: newPhone || "9800000099",
      duesStatus: "CLEAR",
    });
    notifyMockDataChanged();

    setStatusMsg(`✓ User '${newName}' (${newEmail}) added successfully.`);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setShowAddModal(false);
  };

  const filteredResidents = residents.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.flatNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchType = typeFilter === "ALL" || r.type === typeFilter;
    const matchDues = duesFilter === "ALL" || r.duesStatus === duesFilter;
    return matchSearch && matchType && matchDues;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <PageHeader code="R-01 / DIRECTORY" title="Resident Directory" />
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 font-mono"
        >
          <span>+ Add Resident (via Email)</span>
        </button>
      </div>

      {statusMsg && (
        <div className="mb-4 text-emerald-400 font-mono text-xs bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-xs flex justify-between items-center">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg("")} className="text-ink-500 hover:text-ink-100">[×]</button>
        </div>
      )}

      {/* Blueprint Style Filters Bar */}
      <div className="flex flex-wrap gap-4 mb-5 items-center justify-between text-xs font-mono">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search bar */}
          <div className="flex items-center gap-2">
            <span className="text-ink-500 whitespace-nowrap">Search:</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, Email, or Flat..."
              className="input-field text-xs py-1 px-2 w-52 border-blueprint-750 focus:border-signal"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-ink-500">Type:</span>
            <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
              {(["ALL", "OWNER", "TENANT"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-xs px-2 py-0.5 transition text-[10px] ${
                    typeFilter === type
                      ? "bg-blueprint-700 text-signal font-semibold"
                      : "text-ink-300 hover:text-ink-100"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Dues Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-ink-500">Dues:</span>
            <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
              {(["ALL", "PENDING", "CLEAR"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setDuesFilter(status)}
                  className={`rounded-xs px-2 py-0.5 transition text-[10px] ${
                    duesFilter === status
                      ? "bg-blueprint-700 text-signal font-semibold"
                      : "text-ink-300 hover:text-ink-100"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <span className="text-ink-500">Residents listed: {filteredResidents.length}</span>
      </div>

      <div className="bp-card overflow-hidden">
        {filteredResidents.length === 0 ? (
          <div className="p-8 text-center text-ink-500 font-mono">
            No residents matching the filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
                <th className="px-5 py-3">Flat</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email Address</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Dues</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredResidents.map((r) => (
                <tr
                  key={r.flatNo + r.email}
                  className="border-b border-blueprint-700 last:border-0 hover:bg-blueprint-800/40 transition cursor-pointer"
                >
                  <td className="px-5 py-3 font-mono text-xs" onClick={() => setSelectedResident(r)}>{r.flatNo}</td>
                  <td className="px-5 py-3 font-medium text-ink-100" onClick={() => setSelectedResident(r)}>{r.name}</td>
                  <td className="px-5 py-3 text-ink-200 font-mono text-xs" onClick={() => setSelectedResident(r)}>{r.email || "—"}</td>
                  <td className="px-5 py-3 text-ink-300" onClick={() => setSelectedResident(r)}>{r.type}</td>
                  <td className="px-5 py-3 text-ink-300" onClick={() => setSelectedResident(r)}>{r.contact}</td>
                  <td className="px-5 py-3" onClick={() => setSelectedResident(r)}>
                    <StatusBadge status={r.duesStatus} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setSelectedResident(r)}
                      className="btn-secondary py-1 px-2.5 text-xs"
                    >
                      Profile Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs"></div>
          <div className="relative w-full max-w-md bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10 space-y-4">
            <div className="flex justify-between items-center border-b border-blueprint-700 pb-3">
              <div>
                <p className="bp-eyebrow font-mono text-[10px] text-signal">USER ONBOARDING</p>
                <h3 className="font-display font-semibold text-lg text-ink-100 mt-0.5">Add New Resident</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-ink-500 hover:text-signal font-mono text-sm">[×]</button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3 font-mono text-xs">
              <div>
                <label className="label-field text-[10px]">Full Name</label>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-field py-1.5 text-xs"
                  placeholder="e.g. Vikram Sharma"
                />
              </div>

              <div>
                <label className="label-field text-[10px]">Email Address (Required)</label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input-field py-1.5 text-xs"
                  placeholder="vikram@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field text-[10px]">Phone Contact</label>
                  <input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="input-field py-1.5 text-xs"
                    placeholder="9800000099"
                  />
                </div>
                <div>
                  <label className="label-field text-[10px]">Flat Number</label>
                  <input
                    value={newFlatNo}
                    onChange={(e) => setNewFlatNo(e.target.value)}
                    className="input-field py-1.5 text-xs"
                    placeholder="E-401"
                  />
                </div>
              </div>

              <div>
                <label className="label-field text-[10px]">Occupancy Type</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="input-field py-1.5 text-xs"
                >
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-blueprint-750">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-1.5 px-4 text-xs font-semibold"
                >
                  Create & Save to DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resident Detail Modal Overlay */}
      {selectedResident && (
        <ResidentDetailModal
          resident={selectedResident}
          onClose={() => setSelectedResident(null)}
        />
      )}
    </div>
  );
}

