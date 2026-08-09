import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/PageHeader";

export default function RaiseComplaintPage() {
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="max-w-lg">
      <PageHeader code="C-01 / RAISE COMPLAINT" title="Report an Issue" />

      <div className="bp-card p-6">
        {submitted ? (
          <div className="text-center py-6">
            <p className="font-display text-lg text-signal mb-1">Complaint CMP-1043 raised</p>
            <p className="text-sm text-ink-300 mb-6">
              You'll be able to track its status from your complaint list.
            </p>
            <button className="btn-primary" onClick={() => navigate("/resident/complaints")}>
              View My Complaints
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-field">Category</label>
              <select className="input-field">
                <option>Plumbing</option>
                <option>Electrical/Mechanical</option>
                <option>Common Area</option>
                <option>Security</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label-field">Title</label>
              <input required className="input-field" placeholder="Brief summary of the issue" />
            </div>
            <div>
              <label className="label-field">Description</label>
              <textarea required rows={4} className="input-field" placeholder="Describe the issue in detail" />
            </div>
            <div>
              <label className="label-field">Urgency</label>
              <select className="input-field">
                <option>Low</option>
                <option>Medium</option>
                <option>Urgent</option>
              </select>
            </div>
            <div>
              <label className="label-field">Attach Photo (optional)</label>
              <input type="file" className="input-field file:mr-3 file:rounded-sm file:border-0 file:bg-blueprint-700 file:px-3 file:py-1.5 file:text-ink-100" />
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
