import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";
import { ErrorBanner } from "../../../components/QueryState";
import { useRaiseComplaint } from "../../../api/complaints";
import { useMyFlats } from "../../../api/directory";
import { COMPLAINT_CATEGORIES, COMPLAINT_CATEGORY_LABELS, URGENCY_LABELS, URGENCY_LEVELS } from "../../../lib/labels";
import type { ComplaintCategory, ComplaintUrgency } from "../../../api/types";

/**
 * Leaving both category and urgency unset asks the backend to classify the
 * complaint from its text instead. That is the default here: the resident
 * describing a leak should not have to decide whether it is PLUMBING or
 * STRUCTURAL, and the classifier flags anything it is unsure of for triage.
 */
const AUTO = "AUTO";

export default function RaiseComplaintPage() {
  const navigate = useNavigate();
  const raise = useRaiseComplaint();
  const { data: myFlats } = useMyFlats();

  const [newId, setNewId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState("");

  const [category, setCategory] = useState<ComplaintCategory | typeof AUTO>(AUTO);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<ComplaintUrgency | typeof AUTO>(AUTO);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!title.trim()) {
      setValidationError("Please enter a title for your complaint.");
      return;
    }
    if (!description.trim()) {
      setValidationError("Please describe the issue in detail.");
      return;
    }

    // Only a successful response marks the complaint as raised. The previous
    // version reported success even when the request failed, so a resident
    // could believe an issue was filed that the society never received.
    const complaint = await raise.mutateAsync({
      title: title.trim(),
      description: description.trim(),
      flat_id: myFlats?.[0]?.id ?? null,
      category: category === AUTO ? null : category,
      urgency: urgency === AUTO ? null : urgency,
    });
    setNewId(complaint.id);
  };

  const resetForm = () => {
    setNewId(null);
    setTitle("");
    setDescription("");
    setCategory(AUTO);
    setUrgency(AUTO);
    setValidationError("");
    raise.reset();
  };

  return (
    <div className="max-w-lg">
      <PageHeader code="C-01 / RAISE COMPLAINT" title="Report an Issue" />

      <div className="bp-card p-6">
        {newId ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-signal/10 flex items-center justify-center text-signal text-2xl">
              ✓
            </div>
            <p className="font-display text-lg text-signal mb-1">Complaint raised</p>
            <p className="text-xs font-mono text-ink-500 mb-3">{newId}</p>
            <p className="text-sm text-ink-300 mb-6">
              You'll be able to track its status from your complaint list.
            </p>
            <div className="flex gap-3 justify-center">
              <button className="btn-secondary" onClick={resetForm}>
                Raise Another
              </button>
              <button className="btn-primary" onClick={() => navigate("/resident/complaints")}>
                View My Complaints
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {validationError && (
              <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {validationError}
              </div>
            )}
            <ErrorBanner error={raise.error} />

            <div>
              <label className="label-field">Category</label>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory | typeof AUTO)}
              >
                <option value={AUTO}>Detect from description</option>
                {COMPLAINT_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {COMPLAINT_CATEGORY_LABELS[value]}
                  </option>
                ))}
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
                onChange={(e) => setUrgency(e.target.value as ComplaintUrgency | typeof AUTO)}
              >
                <option value={AUTO}>Detect from description</option>
                {URGENCY_LEVELS.map((value) => (
                  <option key={value} value={value}>
                    {URGENCY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={raise.isPending}>
              {raise.isPending ? "Submitting…" : "Submit Complaint"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
