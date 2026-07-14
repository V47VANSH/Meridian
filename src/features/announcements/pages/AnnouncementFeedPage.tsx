import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import { announcements, useMockData, Announcement } from "../../../api/mockData";
import AnnouncementDetailModal from "../../../components/modals/AnnouncementDetailModal";

export default function AnnouncementFeedPage() {
  useMockData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const filtered = announcements.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <PageHeader code="A-01 / ANNOUNCEMENTS" title="Society Announcements" description="Stay updated, wherever you are." />

      {/* Search Input Filter */}
      <div className="mb-5 flex gap-4 items-center justify-between text-xs font-mono">
        <div className="relative w-80">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search announcements by keywords..."
            className="input-field text-xs py-1.5 px-3 border-blueprint-700 focus:border-signal"
          />
        </div>
        <span className="text-ink-500">Notices matched: {filtered.length}</span>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bp-card p-6 text-center text-ink-500 font-mono">
            No notices found matching "{searchQuery}".
          </div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelectedAnnouncement(a)}
              className="bp-card p-5 hover:border-signal/50 cursor-pointer transition"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-ink-100">{a.title}</p>
                <span className="text-xs font-mono text-ink-500">{a.postedAt}</span>
              </div>
              <p className="text-sm text-ink-300 leading-relaxed line-clamp-2">{a.body}</p>
              <div className="flex justify-between items-center mt-3">
                <p className="text-xs text-ink-500">— {a.postedBy}</p>
                <span className="text-[10px] font-mono text-signal font-medium uppercase tracking-wider hover:text-signal-soft">
                  [View Details]
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Announcement Detail Popup overlay */}
      {selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}
    </div>
  );
}
