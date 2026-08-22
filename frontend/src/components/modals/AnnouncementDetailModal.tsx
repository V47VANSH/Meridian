import { AUDIENCE_LABELS, labelFor } from "../../lib/labels";
import { formatDateTime } from "../../lib/format";
import { useUserNames } from "../../api/directory";
import type { Announcement } from "../../api/types";

interface AnnouncementDetailModalProps {
  announcement: Announcement;
  onClose: () => void;
}

export default function AnnouncementDetailModal({
  announcement,
  onClose,
}: AnnouncementDetailModalProps) {
  // Only an official can resolve the poster's name; for everyone else the
  // lookup is disabled and this falls back to a neutral label.
  const userName = useUserNames();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs" />

      <div className="relative w-full max-w-lg bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10 max-h-[85vh] overflow-y-auto">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500" />

        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">
              SOCIETY NOTICE
            </p>
            <h3 className="font-display font-semibold text-base text-ink-100 mt-1">
              {announcement.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1"
          >
            [×] Close
          </button>
        </div>

        <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-line mb-5">
          {announcement.body}
        </p>

        <dl className="border-t border-blueprint-700 pt-3 space-y-1.5 font-mono text-xs">
          <div className="flex justify-between">
            <dt className="text-ink-500">Posted</dt>
            <dd className="text-ink-100">{formatDateTime(announcement.created_at)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">By</dt>
            <dd className="text-ink-100">{userName(announcement.posted_by)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Audience</dt>
            <dd className="text-ink-100">
              {labelFor(AUDIENCE_LABELS, announcement.audience)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
