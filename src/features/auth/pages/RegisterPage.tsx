import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../../assets/logo.svg";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bp-canvas flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={logo} alt="" className="h-9 w-9" />
          <span className="font-display text-lg font-semibold">Meridian</span>
        </div>

        <div className="bp-card px-8 py-8">
          <p className="bp-eyebrow mb-2">D-02 / REGISTER</p>
          <h2 className="text-2xl font-semibold mb-1">Create your account</h2>
          <p className="text-sm text-ink-300 mb-6">
            For residential and non-residential flat owners.
          </p>

          {submitted ? (
            <div className="text-center py-6">
              <p className="text-signal font-display text-lg mb-2">Request submitted</p>
              <p className="text-sm text-ink-300 mb-6">
                Your account request has been sent to the society office for verification.
                This is a static confirmation — no data is sent anywhere yet.
              </p>
              <button className="btn-primary" onClick={() => navigate("/login")}>
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Full Name</label>
                  <input required className="input-field" placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="label-field">Flat No.</label>
                  <input required className="input-field" placeholder="B-304" />
                </div>
              </div>
              <div>
                <label className="label-field">Ownership Type</label>
                <select className="input-field">
                  <option>Residential Owner</option>
                  <option>Non-Residential Owner</option>
                </select>
              </div>
              <div>
                <label className="label-field">Email</label>
                <input type="email" required className="input-field" placeholder="you@meridian.app" />
              </div>
              <div>
                <label className="label-field">Phone</label>
                <input type="tel" required className="input-field" placeholder="+91 98xxxxxx02" />
              </div>
              <div>
                <label className="label-field">Password</label>
                <input type="password" required className="input-field" placeholder="••••••••" />
              </div>
              <button type="submit" className="btn-primary w-full">
                Submit for Verification
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <Link to="/login" className="text-signal hover:text-signal-soft">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
