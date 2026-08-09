import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { residents, useMockData, Resident } from "../../../api/mockData";
import ResidentDetailModal from "../../../components/modals/ResidentDetailModal";

export default function ResidentDirectoryPage() {
  useMockData();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "OWNER" | "TENANT">("ALL");
  const [duesFilter, setDuesFilter] = useState<"ALL" | "PENDING" | "CLEAR">("ALL");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

  const filteredResidents = residents.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.flatNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === "ALL" || r.type === typeFilter;
    const matchDues = duesFilter === "ALL" || r.duesStatus === duesFilter;
    return matchSearch && matchType && matchDues;
  });

  return (
    <div>
      <PageHeader code="R-01 / DIRECTORY" title="Resident Directory" />

      {/* Blueprint Style Filters Bar */}
      <div className="flex flex-wrap gap-4 mb-5 items-center justify-between text-xs font-mono">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search bar */}
          <div className="flex items-center gap-2">
            <span className="text-ink-500 whitespace-nowrap">Search:</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name or Flat..."
              className="input-field text-xs py-1 px-2 w-44 border-blueprint-750 focus:border-signal"
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
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Dues</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredResidents.map((r) => (
                <tr
                  key={r.flatNo}
                  className="border-b border-blueprint-700 last:border-0 hover:bg-blueprint-800/40 transition cursor-pointer"
                >
                  <td className="px-5 py-3 font-mono text-xs" onClick={() => setSelectedResident(r)}>{r.flatNo}</td>
                  <td className="px-5 py-3 font-medium text-ink-100" onClick={() => setSelectedResident(r)}>{r.name}</td>
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
