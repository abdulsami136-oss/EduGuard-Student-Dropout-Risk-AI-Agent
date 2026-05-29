import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import FacultyDashboard from "./pages/FacultyDashboard.jsx";

function useSession() {
  const raw = localStorage.getItem("eduguard.session");
  return raw ? JSON.parse(raw) : null;
}

export default function App() {
  const navigate = useNavigate();
  const session = useSession();

  const logout = () => {
    localStorage.removeItem("eduguard.session");
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white font-bold">
              EG
            </div>
            <div>
              <div className="text-lg font-semibold leading-tight">EduGuard</div>
              <div className="text-xs text-slate-500">
                Student Dropout Risk AI Agent
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                <div className="hidden sm:block text-sm text-slate-600">
                  Signed in as{" "}
                  <span className="font-medium text-slate-900">
                    {session.role}
                  </span>
                  {" · "}
                  <span className="font-mono">
                    {session.email || session.userId}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={<Navigate to={session ? `/${session.role.toLowerCase()}` : "/login"} replace />}
          />
          <Route
            path="/student"
            element={
              session?.role === "Student" ? (
                <StudentDashboard session={session} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin"
            element={
              session?.role === "Admin" ? (
                <AdminDashboard session={session} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/faculty"
            element={
              session?.role === "Faculty" ? (
                <FacultyDashboard session={session} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500">
          SDG 4 — Quality Education · Vision 2030/2035 alignment through early
          dropout risk intervention.
        </div>
      </footer>
    </div>
  );
}
