import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

async function apiLogin({ email, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data.detail === "string" ? data.detail : "Login failed";
    throw new Error(msg);
  }
  return data;
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await apiLogin({
        email: email.trim(),
        password
      });
      localStorage.setItem("eduguard.session", JSON.stringify(session));
      navigate(`/${session.role.toLowerCase()}`);
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use the email and password from your registered account.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          No account yet?{" "}
          <Link
            to="/register"
            className="font-semibold text-brand-700 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Account types</h2>
        <ul className="mt-3 space-y-3 text-sm text-slate-700">
          <li>
            <span className="font-semibold">Student</span> — register with a
            student ID from the dataset (e.g. <span className="font-mono">S00001</span>
            ).
          </li>
          <li>
            <span className="font-semibold">Faculty</span> — view class risk and
            send notes to students.
          </li>
          <li>
            <span className="font-semibold">Admin</span> — view all students,
            charts, and export reports.
          </li>
        </ul>

        <div className="mt-6 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
          <div className="text-sm font-semibold text-brand-800">Database</div>
          <div className="mt-1 text-sm text-brand-900">
            Accounts are stored in <span className="font-mono">data/eduguard.db</span>{" "}
            (SQLite). Passwords are hashed securely.
          </div>
        </div>
      </div>
    </div>
  );
}
