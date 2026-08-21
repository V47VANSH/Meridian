import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import { announcements, useMockData, notifyMockDataChanged, Announcement, syncAnnouncementsFromBackend } from "../../../api/mockData";
import { api } from "../../../api/client";
import AnnouncementDetailModal from "../../../components/modals/AnnouncementDetailModal";

// Map frontend display labels → backend Audience enum values
const audienceToBackend: Record<string, string> = {
  "All residents": "ALL",
  "Residential owners only": "RESIDENTS",
  "Non-residential owners only": "NON_RESIDENT_OWNERS",
  "Staff": "STAFF",
};

export default function AnnouncementComposerPage() {
  useMockData();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("All residents");
  const [posted, setPosted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setError("");
    setIsSubmitting(true);

    try {
      const res: any = await api.post("/v1/announcements", {
        title: title.trim(),
        body: message.trim(),
        audience: audienceToBackend[audience] ?? "ALL",
      });

      // Sync newly created announcement into the local store
      if (res?.id) {
        syncAnnouncementsFromBackend([res]);
      } else {
        // Fallback: create local entry if backend didn't respond with data
        const newAnn: Announcement = {
          id: `ANN-${Math.floor(40 + Math.random() * 60)}`,
          title: title.trim(),
          body: message.trim(),
          postedBy: "Society Official",
          postedAt: new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
          comments: [],
        };
        announcements.unshift(newAnn);
        notifyMockDataChanged();
      }
    } catch (err: any) {
      // If backend unavailable, still add locally
      const newAnn: Announcement = {
        id: `ANN-${Math.floor(40 + Math.random() * 60)}`,
        title: title.trim(),
        body: message.trim(),
        postedBy: "Society Official",
        postedAt: new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
        comments: [],
      };
      announcements.unshift(newAnn);
      notifyMockDataChanged();
      // Show error only if it's not a network error (backend might just be offline)
      if (err?.code && err.code !== "NETWORK_ERROR") {
        setError(err.message || "Failed to post announcement.");
        setIsSubmitting(false);
        return;
      }
    }

    setTitle("");
    setMessage("");
    setPosted(true);
    setIsSubmitting(false);
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
              {error && (
                <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}
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
                  <option>Staff</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
                {isSubmitting ? "Posting…" : "Post Announcement"}
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
