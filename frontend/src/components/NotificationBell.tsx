import { useState } from "react";
import { useMarkNotificationRead, useNotifications } from "../api/announcements";
import { formatDateTime } from "../lib/format";

/**
 * The unread badge and drop-down for the caller's notifications.
 *
 * The backend has been writing notification rows all along — a complaint
 * changing status, a payment settling, a reminder, an announcement, an SOS
 * acknowledgement — and no screen ever read them, so none of it reached the
 * person it was addressed to.
 */
const POLL_MS = 60_000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useNotifications(false, { refetchInterval: POLL_MS });
  const markRead = useMarkNotificationRead();

  const rows = notifications.data ?? [];
  const unread = rows.filter((n) => n.read_at === null);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="btn-secondary w-full text-xs flex items-center justify-between"
      >
        <span>Notifications</span>
        {unread.length > 0 && (
          <span className="ml-2 rounded-full bg-signal px-1.5 py-0.5 text-[10px] font-mono font-semibold text-blueprint-950">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-h-96 overflow-y-auto rounded-sm border border-blueprint-700 bg-blueprint-900 shadow-2xl z-40">
          {notifications.isPending ? (
            <p className="px-4 py-6 text-center text-xs font-mono text-ink-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs font-mono text-ink-500">
              Nothing to catch up on.
            </p>
          ) : (
            <ul className="divide-y divide-blueprint-800">
              {rows.map((notification) => (
                <li
                  key={notification.id}
                  className={`px-4 py-3 ${notification.read_at === null ? "bg-blueprint-800/40" : ""}`}
                >
                  <p className="text-sm text-ink-100">{notification.title}</p>
                  {notification.body && (
                    <p className="mt-0.5 text-xs text-ink-300 leading-relaxed">
                      {notification.body}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-ink-500">
                      {formatDateTime(notification.sent_at)}
                    </span>
                    {notification.read_at === null && (
                      <button
                        onClick={() => markRead.mutate(notification.id)}
                        disabled={markRead.isPending}
                        className="text-[10px] font-mono text-signal hover:underline"
                      >
                        mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
