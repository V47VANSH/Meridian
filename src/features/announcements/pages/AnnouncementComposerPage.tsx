import { useState } from "react";
import PageHeader from "../../../components/PageHeader";
import { announcements } from "../../../api/mockData";

export default function AnnouncementComposerPage() {
  const [posted, setPosted] = useState(false);

  return (
    <div>
      <PageHeader code="A-02 / COMPOSER" title="Post an Announcement" />

      <div className="grid grid-cols-2 gap-6">
        <div className="bp-card p-6">
          {posted ? (
            <div className="text-center py-6">
              <p className="text-signal font-display text-lg mb-2">Announcement posted</p>
              <button className="btn-secondary" onClick={() => setPosted(false)}>Compose Another</button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPosted(true);
              }}
              className="space-y-5"
            >
              <div>
                <label className="label-field">Title</label>
                <input required className="input-field" placeholder="Announcement title" />
              </div>
              <div>
                <label className="label-field">Message</label>
                <textarea required rows={5} className="input-field" placeholder="Write the announcement…" />
              </div>
              <div>
                <label className="label-field">Audience</label>
                <select className="input-field">
                  <option>All residents</option>
                  <option>Residential owners only</option>
                  <option>Non-residential owners only</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-full">Post Announcement</button>
            </form>
          )}
        </div>

        <div>
          <p className="bp-eyebrow mb-3">RECENT</p>
          <div className="space-y-3">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="bp-card p-4">
                <p className="text-sm text-ink-100">{a.title}</p>
                <p className="text-xs text-ink-500 font-mono mt-1">{a.postedAt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
