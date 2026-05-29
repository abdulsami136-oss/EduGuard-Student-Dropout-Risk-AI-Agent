import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import RiskBadge from "../components/RiskBadge.jsx";

async function fetchStudent(studentId) {
  const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`);
  if (!res.ok) throw new Error("Failed to load student");
  return await res.json();
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {value ?? "—"}
      </div>
    </div>
  );
}

export default function StudentDashboard({ session }) {
  const studentId = session?.userId || "S00001";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchStudent(studentId)
      .then((d) => {
        if (!alive) return;
        setData(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || "Error");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [studentId]);

  if (loading) {
    return <div className="text-sm text-slate-600">Loading student profile…</div>;
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
        {error}
      </div>
    );
  }

  const m = data?.metrics || {};

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Your Dropout Risk"
          subtitle="0–100 score from the Random Forest model"
          right={<RiskBadge label={data.riskLabel} />}
        >
          <ProgressBar value={data.riskScore} />
        </Card>

        <Card title="Performance Snapshot" subtitle="Best-effort from available CSV columns">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Admission grade" value={m.admissionGrade?.toFixed?.(1) ?? m.admissionGrade} />
            <Metric label="Age" value={m.ageAtEnrollment} />
            <Metric label="1st sem grade" value={m.grade1?.toFixed?.(2) ?? m.grade1} />
            <Metric label="2nd sem grade" value={m.grade2?.toFixed?.(2) ?? m.grade2} />
          </div>
        </Card>

        <Card title="Status Flags" subtitle="Signals correlated with withdrawal in many institutions">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <span className="text-slate-700">Tuition up to date</span>
              <span className="font-semibold">
                {m.tuitionUpToDate == null ? "—" : m.tuitionUpToDate ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <span className="text-slate-700">Debtor</span>
              <span className="font-semibold">
                {m.debtor == null ? "—" : m.debtor ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Why you might be at risk" subtitle="Top factors for your profile (heuristic explanation)">
          <div className="space-y-3">
            {(data?.reasons || []).length ? (
              data.reasons.map((r) => (
                <div
                  key={`${r.feature}-${r.impact}`}
                  className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
                >
                  <div className="text-sm font-semibold">{r.feature}</div>
                  <div className="mt-1 text-xs text-slate-600">{r.detail}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-600">
                Explanation not available for this profile.
              </div>
            )}
          </div>
        </Card>

        <Card title="Improvement suggestions" subtitle="Actionable steps generated from your signals">
          <ul className="space-y-2 text-sm text-slate-800">
            {(data?.suggestions || []).map((s) => (
              <li key={s} className="rounded-xl bg-brand-50 px-3 py-2 ring-1 ring-brand-100">
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

