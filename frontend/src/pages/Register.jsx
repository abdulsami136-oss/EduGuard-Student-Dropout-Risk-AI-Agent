import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

async function apiRegister(body) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d) => d.msg).join(", ")
          : "Registration failed";
    throw new Error(msg);
  }
  return data;
}

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("S00001");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const helper = useMemo(() => {
    if (role === "Student")
      return "Link your account to a dataset student ID (e.g. S00001 = row 1). Each ID can only be registered once.";
    return "Create an Admin or Faculty account with your email and password.";
  }, [role]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const body = {
        email: email.trim(),
        password,
        role,
        full_name: fullName.trim() || null
      };
      if (role === "Student") {
        body.student_id = studentId.trim().toUpperCase();
      }
      const session = await apiRegister(body);
      localStorage.setItem("eduguard.session", JSON.stringify(session));
      navigate(`/${session.role.toLowerCase()}`);
    } catch (err) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Register to access your EduGuard dashboard.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700">Full name</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Optional"
            />
          </div>

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
              minLength={6}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <input
              type="password"
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Role</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option>Student</option>
              <option>Faculty</option>
              <option>Admin</option>
            </select>
            <div className="mt-1 text-xs text-slate-500">{helper}</div>
          </div>

          {role === "Student" ? (
            <div>
              <label className="text-sm font-medium text-slate-700">
                Student ID
              </label>
              <input
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="S00001"
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
