import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import { complaints, notifyMockDataChanged } from "../../../api/mockData";
import { useAuthStore } from "../../../store/authStore";
import { api } from "../../../api/client";

export default function RaiseComplaintPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [newId, setNewId] = useState("");
  const [error, setError] = useState("");

  const [category, setCategory] = useState("Plumbing");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "URGENT">("LOW");

  // Map frontend display labels → backend enum values (ComplaintCategory)
  const categoryToBackend: Record<string, string> = {
    "Plumbing": "PLUMBING",
    "Electrical/Mechanical": "ELECTRICAL",
    "Common Area": "GENERAL",
    "Security": "SECURITY",
    "Other": "GENERAL",
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Please enter a title for your complaint.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the issue in detail.");
      return;
    }

    let complaintId = `CMP-${1043 + complaints.length}`;
    let backendId: string | undefined;
    try {
      const res: any = await api.post("/v1/complaints", {
        title: title.trim(),
        description: description.trim(),
        // Map to backend enum values; fallback to GENERAL if unknown
        category: categoryToBackend[category] ?? "GENERAL",
        urgency: urgency === "URGENT" ? "HIGH" : urgency,
      });
      // apiFetch returns the parsed JSON body directly — not wrapped in { data: ... }
      if (res?.id) {
        complaintId = res.id;
        backendId = res.id;
      }
    } catch {
      // Gracefully fall back to local store if backend offline
    }

    const now = new Date();
    const dateLabel =
      now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      ", " +
      now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    const newComplaint = {
      id: complaintId,
      title: title.trim(),
      category,
      raisedBy: user?.name || "Resident",
      // Store the backend UUID so after a page refresh the filter still matches
      raisedById: backendId ?? (user?.id || undefined),
      flatNo: user?.flatNo || "B-304",
      status: "OPEN" as const,
      urgency,
      createdAt: now.toISOString().slice(0, 10),
      description: description.trim(),
      timeline: [{ label: "Complaint raised", date: dateLabel }],
    };

    complaints.unshift(newComplaint);
    notifyMockDataChanged();
    setNewId(complaintId);
    setSubmitted(true);
  };


  return (
    <div className="max-w-lg">
      <PageHeader code="C-01 / RAISE COMPLAINT" title="Report an Issue" />

      <div className="bp-card p-6">
        {submitted ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-signal/10 flex items-center justify-center text-signal text-2xl">
              ✓
            </div>
            <p className="font-display text-lg text-signal mb-1">Complaint {newId} raised</p>
            <p className="text-sm text-ink-300 mb-6">
              You'll be able to track its status from your complaint list.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                className="btn-secondary"
                onClick={() => {
                  setSubmitted(false);
                  setTitle("");
                  setDescription("");
                  setError("");
                }}
              >
                Raise Another
              </button>
              <button className="btn-primary" onClick={() => navigate("/resident/complaints")}>
                View My Complaints
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
            <div>
              <label className="label-field">Category</label>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>Plumbing</option>
                <option>Electrical/Mechanical</option>
                <option>Common Area</option>
                <option>Security</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label-field">Title</label>
              <input
                className="input-field"
                placeholder="Brief summary of the issue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Description</label>
              <textarea
                rows={4}
                className="input-field"
                placeholder="Describe the issue in detail"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Urgency</label>
              <select
                className="input-field"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as "LOW" | "MEDIUM" | "URGENT")}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="label-field">Attach Photo (optional)</label>
              <input
                type="file"
                className="input-field file:mr-3 file:rounded-sm file:border-0 file:bg-blueprint-700 file:px-3 file:py-1.5 file:text-ink-100"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Submit Complaint
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
