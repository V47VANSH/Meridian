import { useMemo, useState } from "react";
import PageHeader from "../../../components/PageHeader";
import EmptyState from "../../../components/EmptyState";
import { QueryState } from "../../../components/QueryState";
import AnnouncementDetailModal from "../../../components/modals/AnnouncementDetailModal";
import { useAnnouncements } from "../../../api/announcements";
import { AUDIENCE_LABELS, labelFor } from "../../../lib/labels";
import { formatDate } from "../../../lib/format";
import type { Announcement } from "../../../api/types";

export default function AnnouncementFeedPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Announcement | null>(null);

  // Already filtered by audience server-side, so what arrives is what this
  // role is entitled to read.
  const announcements = useAnnouncements();

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return announcements.data ?? [];
    return (announcements.data ?? []).filter(
      (a) => a.title.toLowerCase().includes(term) || a.body.toLowerCase().includes(term),
    );
  }, [announcements.data, searchQuery]);

  return (
    <div>
      <PageHeader
        code="A-01 / ANNOUNCEMENTS"
        title="Society Announcements"
        description="Stay updated, wherever you are."
      />

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

      <QueryState
        isLoading={announcements.isPending}
        error={announcements.error}
        onRetry={() => announcements.refetch()}
        loadingLabel="Loading announcements…"
      >
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <EmptyState
              title={
                searchQuery
                  ? `No notices found matching "${searchQuery}"`
                  : "No announcements yet"
              }
            />
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelected(a)}
                className="bp-card p-5 hover:border-signal/50 cursor-pointer transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-ink-100">{a.title}</p>
                  <span className="text-xs font-mono text-ink-500">
                    {formatDate(a.created_at)}
                  </span>
                </div>
                <p className="text-sm text-ink-300 leading-relaxed line-clamp-2">{a.body}</p>
                <div className="flex justify-between items-center mt-3">
                  <p className="text-xs text-ink-500">
                    For {labelFor(AUDIENCE_LABELS, a.audience).toLowerCase()}
                  </p>
                  <span className="text-[10px] font-mono text-signal font-medium uppercase tracking-wider hover:text-signal-soft">
                    [View Details]
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </QueryState>

      {selected && (
        <AnnouncementDetailModal announcement={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
