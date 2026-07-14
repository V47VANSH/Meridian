import PageHeader from "../../../components/PageHeader";
import { facilities, bookings } from "../../../api/mockData";

export default function ScheduleManagementPage() {
  return (
    <div>
      <PageHeader
        code="B-03 / SCHEDULE MANAGEMENT"
        title="Facility Booking Schedule"
        description="Shared schedule across all facilities — prevents double bookings (Story 3.3)."
      />

      <div className="grid grid-cols-2 gap-4">
        {facilities.map((f) => {
          const rows = bookings.filter((b) => b.facility === f.name);
          return (
            <div key={f.id} className="bp-card p-5">
              <p className="bp-eyebrow mb-3">{f.name}</p>
              {rows.length === 0 ? (
                <p className="text-sm text-ink-500">No bookings scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((b) => (
                    <li key={b.id} className="flex justify-between text-sm">
                      <span className="text-ink-300">{b.date} · {b.slot}</span>
                      <span className="text-ink-500 text-xs font-mono">{b.flatNo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
