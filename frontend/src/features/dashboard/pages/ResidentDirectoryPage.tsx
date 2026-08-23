import { useMemo, useState, type FormEvent } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import EmptyState from "../../../components/EmptyState";
import { ErrorBanner, QueryState } from "../../../components/QueryState";
import ResidentDetailModal from "../../../components/modals/ResidentDetailModal";
import { useCreateResident, useDirectory, type DirectoryEntry } from "../../../api/residents";
import { useFlats } from "../../../api/directory";
import { formatCurrency } from "../../../lib/format";
import type { Relation } from "../../../api/types";

const RELATION_LABELS: Record<Relation, string> = {
  OWNER: "Owner",
  RESIDENT_TENANT: "Tenant",
};

export default function ResidentDirectoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [relationFilter, setRelationFilter] = useState<Relation | "ALL">("ALL");
  const [duesFilter, setDuesFilter] = useState<"ALL" | "PENDING" | "CLEAR">("ALL");
  const [selected, setSelected] = useState<DirectoryEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const directory = useDirectory();
  const { data: flats } = useFlats();
  const createResident = useCreateResident();

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFlatId, setNewFlatId] = useState("");
  const [newRelation, setNewRelation] = useState<Relation>("OWNER");
  const [newRole, setNewRole] = useState("RESIDENT_OWNER");

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return directory.entries.filter((entry) => {
      const matchSearch =
        !term ||
        entry.name.toLowerCase().includes(term) ||
        entry.flatLabel.toLowerCase().includes(term) ||
        entry.email.toLowerCase().includes(term);
      const matchRelation = relationFilter === "ALL" || entry.relation === relationFilter;
      const matchDues = duesFilter === "ALL" || entry.duesStatus === duesFilter;
      return matchSearch && matchRelation && matchDues;
    });
  }, [directory.entries, searchTerm, relationFilter, duesFilter]);

  async function handleAddResident(e: FormEvent) {
    e.preventDefault();
    await createResident.mutateAsync({
      email: newEmail.trim(),
      password: newPassword,
      fullName: newName.trim(),
      phone: newPhone.trim(),
      role: newRole,
      flatId: newFlatId,
      relation: newRelation,
    });
    setShowAddModal(false);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewPassword("");
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <PageHeader code="R-01 / DIRECTORY" title="Resident Directory" />
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary py-1.5 px-3 text-xs font-mono"
        >
          + Add Resident
        </button>
      </div>

      <div className="mb-4">
        <ErrorBanner error={createResident.error} />
      </div>

      <div className="flex flex-wrap gap-4 mb-5 items-center justify-between text-xs font-mono">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-ink-500 whitespace-nowrap">Search:</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, Email, or Flat..."
              className="input-field text-xs py-1 px-2 w-52"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-ink-500">Type:</span>
            <div className="inline-flex rounded-sm border border-blueprint-700 bg-blueprint-950/40 p-0.5">
              {(["ALL", "OWNER", "RESIDENT_TENANT"] as const).map((relation) => (
                <button
                  key={relation}
                  onClick={() => setRelationFilter(relation)}
                  className={`rounded-xs px-2 py-0.5 transition text-[10px] ${
                    relationFilter === relation
                      ? "bg-blueprint-700 text-signal font-semibold"
                      : "text-ink-300 hover:text-ink-100"
                  }`}
                >
                  {relation === "ALL" ? "ALL" : RELATION_LABELS[relation].toUpperCase()}
                </button>
              ))}
            </div>
          </div>

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

        <span className="text-ink-500">Residents listed: {filtered.length}</span>
      </div>

      <QueryState
        isLoading={directory.isPending}
        error={directory.error}
        onRetry={directory.refetch}
        loadingLabel="Loading the directory…"
      >
        <div className="bp-card overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              title="No residents matching the filters"
              hint="Residents appear here once their account is linked to a flat."
            />
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
                {/* Keyed by occupant and flat: a flat may have several
                    occupants, which the flat-label key could not represent. */}
                {filtered.map((entry) => (
                  <tr
                    key={`${entry.userId}:${entry.flatId}`}
                    onClick={() => setSelected(entry)}
                    className="border-b border-blueprint-700 last:border-0 hover:bg-blueprint-800/40 transition cursor-pointer"
                  >
                    <td className="px-5 py-3 font-mono text-xs">{entry.flatLabel}</td>
                    <td className="px-5 py-3 font-medium text-ink-100">{entry.name}</td>
                    <td className="px-5 py-3 text-ink-200 font-mono text-xs">{entry.email}</td>
                    <td className="px-5 py-3 text-ink-300">{RELATION_LABELS[entry.relation]}</td>
                    <td className="px-5 py-3 text-ink-300">{entry.phone || "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={entry.duesStatus} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button className="btn-secondary py-1 px-2.5 text-xs">Profile Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </QueryState>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowAddModal(false)}
            className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs"
          />
          <div className="relative w-full max-w-md bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10 space-y-4">
            <div className="flex justify-between items-center border-b border-blueprint-700 pb-3">
              <div>
                <p className="bp-eyebrow font-mono text-[10px] text-signal">USER ONBOARDING</p>
                <h3 className="font-display font-semibold text-lg text-ink-100 mt-0.5">
                  Add New Resident
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-ink-500 hover:text-signal font-mono text-sm"
              >
                [×]
              </button>
            </div>

            <form onSubmit={handleAddResident} className="space-y-3 font-mono text-xs">
              <ErrorBanner error={createResident.error} />

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
                <label className="label-field text-[10px]">Email Address</label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input-field py-1.5 text-xs"
                  placeholder="vikram@example.com"
                />
              </div>

              <div>
                {/* Previously every account was created with the same
                    hardcoded password. */}
                <label className="label-field text-[10px]">Initial Password</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field py-1.5 text-xs"
                  placeholder="Shared with the resident to sign in"
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
                  <label className="label-field text-[10px]">Flat</label>
                  <select
                    required
                    value={newFlatId}
                    onChange={(e) => setNewFlatId(e.target.value)}
                    className="input-field py-1.5 text-xs"
                  >
                    <option value="">Select a flat</option>
                    {(flats ?? []).map((flat) => (
                      <option key={flat.id} value={flat.id}>
                        {flat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field text-[10px]">Occupancy</label>
                  <select
                    value={newRelation}
                    onChange={(e) => setNewRelation(e.target.value as Relation)}
                    className="input-field py-1.5 text-xs"
                  >
                    <option value="OWNER">Owner</option>
                    <option value="RESIDENT_TENANT">Tenant</option>
                  </select>
                </div>
                <div>
                  <label className="label-field text-[10px]">Account Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="input-field py-1.5 text-xs"
                  >
                    <option value="RESIDENT_OWNER">Resident / Flat Owner</option>
                    <option value="NON_RESIDENT_OWNER">Non-Resident Owner</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-1.5 text-xs"
                disabled={createResident.isPending}
              >
                {createResident.isPending ? "Creating…" : "Create & Link to Flat"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <ResidentDetailModal entry={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
