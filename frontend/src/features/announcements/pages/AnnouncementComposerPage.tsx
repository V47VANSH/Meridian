import { useState, type FormEvent } from "react";
import PageHeader from "../../../components/PageHeader";
import { ErrorBanner } from "../../../components/QueryState";
import AnnouncementDetailModal from "../../../components/modals/AnnouncementDetailModal";
import { useAnnouncements, usePostAnnouncement } from "../../../api/announcements";
import { AUDIENCE_LABELS } from "../../../lib/labels";
import { formatDateTime } from "../../../lib/format";
import type { Announcement, Audience } from "../../../api/types";

const AUDIENCES = Object.keys(AUDIENCE_LABELS) as Audience[];

export default function AnnouncementComposerPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [posted, setPosted] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const announcements = useAnnouncements();
  const post = usePostAnnouncement();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    // Only a successful post counts. The previous version fell back to
    // inserting a local entry whenever the request failed, so an official saw
    // 'posted successfully' for a notice nobody had been sent.
    await post.mutateAsync({
      title: title.trim(),
      body: message.trim(),
      audience,
    });

    setTitle("");
    setMessage("");
    setPosted(true);
  }

  return (
    <div>
      <PageHeader code="A-02 / COMPOSER" title="Post an Announcement" />

      <div className="grid grid-cols-2 gap-6">
        <div className="bp-card p-6">
          {posted ? (
            <div className="text-center py-6">
              <p className="text-signal font-display text-lg mb-2">
                Announcement posted successfully.
              </p>
              <p className="text-sm text-ink-300 mb-5">
                Everyone in the selected audience has been notified.
              </p>
              <button
                className="btn-secondary"
                onClick={() => {
                  setPosted(false);
                  post.reset();
                }}
              >
                Compose Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <ErrorBanner error={post.error} />
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
                  onChange={(e) => setAudience(e.target.value as Audience)}
                  className="input-field"
                >
                  {AUDIENCES.map((value) => (
                    <option key={value} value={value}>
                      {AUDIENCE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={post.isPending}>
                {post.isPending ? "Posting…" : "Post Announcement"}
              </button>
            </form>
          )}
        </div>

        <div>
          <p className="bp-eyebrow mb-3">RECENT POSTED</p>
          <div className="space-y-3">
            {(announcements.data ?? []).slice(0, 5).map((a) => (
              <div
                key={a.id}
                onClick={() => setSelected(a)}
                className="bp-card p-4 hover:border-signal/50 cursor-pointer transition"
              >
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm text-ink-100 font-medium">{a.title}</p>
                  <span className="text-[10px] font-mono text-signal opacity-0 hover:opacity-100 transition-opacity">
                    [View]
                  </span>
                </div>
                <p className="text-xs text-ink-500 font-mono mt-1">
                  {formatDateTime(a.created_at)} · {AUDIENCE_LABELS[a.audience as Audience]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <AnnouncementDetailModal announcement={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
