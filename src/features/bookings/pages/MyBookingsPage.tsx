import PageHeader from "../../../components/PageHeader";
import EmptyState from "../../../components/EmptyState";
import { bookings } from "../../../api/mockData";

export default function MyBookingsPage() {
  return (
    <div>
      <PageHeader code="B-02 / MY BOOKINGS" title="My Facility Bookings" />
      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" hint="Book a slot from the Facility Calendar." />
      ) : (
        <div className="bp-card divide-y divide-blueprint-700">
          {bookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-ink-100">{b.facility}</p>
                <p className="text-xs font-mono text-ink-500">{b.id}</p>
              </div>
              <div className="text-right text-sm text-ink-300">
                <p>{b.date}</p>
                <p className="text-xs text-ink-500">{b.slot}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
