import PageHeader from "../../../components/PageHeader";
import { announcements, useMockData } from "../../../api/mockData";

export default function AnnouncementFeedPage() {
  useMockData();

  return (
    <div>
      <PageHeader code="A-01 / ANNOUNCEMENTS" title="Society Announcements" description="Stay updated, wherever you are." />
      <div className="space-y-4">
        {announcements.map((a) => (
          <div key={a.id} className="bp-card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-ink-100">{a.title}</p>
              <span className="text-xs font-mono text-ink-500">{a.postedAt}</span>
            </div>
            <p className="text-sm text-ink-300 leading-relaxed">{a.body}</p>
            <p className="mt-2 text-xs text-ink-500">— {a.postedBy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
