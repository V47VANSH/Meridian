import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import { announcements, useMockData, notifyMockDataChanged, Announcement } from "../../../api/mockData";
import AnnouncementDetailModal from "../../../components/modals/AnnouncementDetailModal";

export default function AnnouncementComposerPage() {
  useMockData();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("All residents");
  const [posted, setPosted] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    // Create fresh announcement record
    const newAnn: Announcement = {
      id: `ANN-${Math.floor(40 + Math.random() * 60)}`,
      title: title.trim(),
      body: `${audience ? `[Target: ${audience}] ` : ""}${message.trim()}`,
      postedBy: "Society Official",
      postedAt: new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
      comments: [],
    };

    announcements.unshift(newAnn);
    notifyMockDataChanged();

    // Reset fields
    setTitle("");
    setMessage("");
    setPosted(true);
  };

  return (
    <div>
      <PageHeader code="A-02 / COMPOSER" title="Post an Announcement" />

      <div className="grid grid-cols-2 gap-6">
        <div className="bp-card p-6">
          {posted ? (
            <div className="text-center py-6">
              <p className="text-signal font-display text-lg mb-2">Announcement posted successfully.</p>
              <button className="btn-secondary" onClick={() => setPosted(false)}>
                Compose Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label-field">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                  placeholder="Announcement title"
                />
              </div>
              <div>
                <label className="label-field">Message</label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input-field"
                  placeholder="Write the announcement…"
                />
              </div>
              <div>
                <label className="label-field">Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="input-field"
                >
                  <option>All residents</option>
                  <option>Residential owners only</option>
                  <option>Non-residential owners only</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-full">
                Post Announcement
              </button>
            </form>
          )}
        </div>

        <div>
          <p className="bp-eyebrow mb-3">RECENT POSTED</p>
          <div className="space-y-3">
            {announcements.slice(0, 3).map((a) => (
              <div
                key={a.id}
                onClick={() => setSelectedAnnouncement(a)}
                className="bp-card p-4 hover:border-signal/50 cursor-pointer transition"
              >
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm text-ink-100 font-medium">{a.title}</p>
                  <span className="text-[10px] font-mono text-signal opacity-0 hover:opacity-100 transition-opacity">
                    [View]
                  </span>
                </div>
                <p className="text-xs text-ink-500 font-mono mt-1">{a.postedAt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail overlay modal */}
      {selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}
    </div>
  );
}
