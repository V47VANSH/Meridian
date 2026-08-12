import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { staffTasks, useMockData, notifyMockDataChanged } from "../../../api/mockData";

export default function StaffTasksPage() {
  useMockData();

  function handleStatusChange(id: string, newStatus: "PENDING" | "IN_PROGRESS" | "DONE") {
    const task = staffTasks.find((t) => t.id === id);
    if (task) {
      task.status = newStatus;
      notifyMockDataChanged();
    }
  }

  return (
    <div>
      <PageHeader
        code="T-01 / ASSIGNED TASKS"
        title="My Tasks"
        description="Maintenance and cleaning tasks coordinated by society officials."
      />

      <div className="bp-card divide-y divide-blueprint-700">
        {staffTasks.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-ink-100">{t.task}</p>
              <p className="text-xs text-ink-500">{t.location} · Due {t.dueBy}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={t.status} />
              <select
                className="input-field py-1 text-xs w-32"
                value={t.status}
                onChange={(e) =>
                  handleStatusChange(t.id, e.target.value as "PENDING" | "IN_PROGRESS" | "DONE")
                }
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
