import { useState } from "react";
import { Announcement, announcements, Comment, notifyMockDataChanged } from "../../api/mockData";
import { useAuthStore } from "../../store/authStore";
import { ROLE_LABELS } from "../../lib/constants";

interface AnnouncementDetailModalProps {
  announcement: Announcement;
  onClose: () => void;
}

export default function AnnouncementDetailModal({ announcement, onClose }: AnnouncementDetailModalProps) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>(
    announcements.find((a) => a.id === announcement.id)?.comments || []
  );
  const [newCommentText, setNewCommentText] = useState("");

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const targetAnn = announcements.find((a) => a.id === announcement.id);
    if (targetAnn) {
      if (!targetAnn.comments) {
        targetAnn.comments = [];
      }
      const roleLabel = user && user.role && ROLE_LABELS[user.role]
        ? ROLE_LABELS[user.role]
        : (user?.role ? user.role.replace("_", " ") : "Resident / Flat Owner");
      
      const flatLabel = user?.flatNo ? ` (Flat ${user.flatNo})` : "";
      const authorName = user ? `${user.name}${flatLabel}` : "Resident";

      const freshComment: Comment = {
        id: `COM-${Date.now()}`,
        author: authorName,
        role: roleLabel,
        body: newCommentText.trim(),
        postedAt: new Date().toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      targetAnn.comments.push(freshComment);
      setComments([...targetAnn.comments]);
      setNewCommentText("");
      notifyMockDataChanged();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-blueprint-950/80 backdrop-blur-xs"></div>

      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-blueprint-900 border border-blueprint-700 p-6 rounded-sm shadow-2xl bp-canvas z-10">
        {/* Drafting corner ticks */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-500"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-500"></div>

        {/* Header */}
        <div className="flex justify-between items-start border-b border-blueprint-700 pb-3 mb-4">
          <div>
            <p className="bp-eyebrow font-mono text-[10px] tracking-wider text-signal">{announcement.id} / CENTRAL NOTICE</p>
            <h3 className="font-display font-semibold text-base text-ink-100 mt-1">{announcement.title}</h3>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-signal font-mono text-sm leading-none p-1">
            [×] Close
          </button>
        </div>

        {/* Body content */}
        <div className="text-xs text-ink-300 leading-relaxed font-body mb-5 max-h-40 overflow-y-auto pr-1 whitespace-pre-wrap">
          {announcement.body}
        </div>

        {/* Comments Section */}
        <div className="border-t border-blueprint-850 pt-4 mb-4">
          <p className="bp-eyebrow text-[10px] mb-2.5">Comments ({comments.length})</p>

          <div className="space-y-2.5 max-h-36 overflow-y-auto mb-3 pr-1">
            {comments.length === 0 ? (
              <p className="text-[11px] text-ink-500 font-mono italic">No comments yet. Start the conversation below.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="text-xs border-b border-blueprint-800 pb-2 last:border-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-100 font-mono text-[11px]">{c.author}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blueprint-800 text-signal font-mono">
                        {c.role || "Resident / Flat Owner"}
                      </span>
                    </div>
                    <span className="text-[9px] text-ink-500 font-mono">{c.postedAt}</span>
                  </div>
                  <p className="text-ink-300 font-body leading-normal">{c.body}</p>
                </div>
              ))
            )}
          </div>

          {/* Comment Form */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="input-field text-xs py-1.5 px-2.5 flex-1 bg-blueprint-950/50"
              required
            />
            <button type="submit" className="btn-primary py-1.5 px-3 text-xs whitespace-nowrap">
              Post Comment
            </button>
          </form>
        </div>

        {/* Footer Meta */}
        <div className="border-t border-blueprint-800 pt-3 flex justify-between items-center text-[10px] font-mono text-ink-500 bg-blueprint-950/20 -mx-6 -mb-6 p-4 rounded-b-sm">
          <span>Posted: {announcement.postedAt}</span>
          <span>By: {announcement.postedBy}</span>
        </div>
      </div>
    </div>
  );
}
