import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { residents } from "../../../api/mockData";

export default function ResidentDirectoryPage() {
  return (
    <div>
      <PageHeader code="R-01 / DIRECTORY" title="Resident Directory" />
      <div className="bp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-blueprint-700 text-left text-ink-500 font-mono text-[11px] uppercase tracking-wide">
              <th className="px-5 py-3">Flat</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Dues</th>
            </tr>
          </thead>
          <tbody>
            {residents.map((r) => (
              <tr key={r.flatNo} className="border-b border-blueprint-700 last:border-0">
                <td className="px-5 py-3 font-mono text-xs">{r.flatNo}</td>
                <td className="px-5 py-3">{r.name}</td>
                <td className="px-5 py-3 text-ink-300">{r.type}</td>
                <td className="px-5 py-3 text-ink-300">{r.contact}</td>
                <td className="px-5 py-3"><StatusBadge status={r.duesStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
