import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import StudentTable from "../components/StudentTable.jsx";
import { BreakdownBar, RiskPie } from "../components/Charts.jsx";
import RiskBadge from "../components/RiskBadge.jsx";

async function fetchStudents({ risk }) {
  const url = new URL("/api/students", window.location.origin);
  if (risk && risk !== "All") url.searchParams.set("risk", risk);
  url.searchParams.set("limit", "250");
  const res = await fetch(url.pathname + url.search);
  if (!res.ok) throw new Error("Failed to load students");
  return await res.json();
}

async function fetchOverview() {
  const res = await fetch("/api/admin/overview");
  if (!res.ok) throw new Error("Failed to load overview");
  return await res.json();
}

function downloadCsv(rows) {
  const header = ["studentId", "rowIndex", "riskLabel", "riskScore"];
  const lines = [
    header.join(","),
    ...(rows || []).map((r) =>
      [r.studentId, r.rowIndex, r.riskLabel, r.riskScore].join(",")
    )
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eduguard-risk-report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [risk, setRisk] = useState("All");
  const [rows, setRows] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([fetchStudents({ risk }), fetchOverview()])
      .then(([r, o]) => {
        if (!alive) return;
        setRows(r);
        setOverview(o);
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
  }, [risk]);

  const atRisk = useMemo(() => {
    if (!overview?.riskCounts) return 0;
    return (overview.riskCounts.Medium || 0) + (overview.riskCounts.High || 0);
  }, [overview]);

  if (loading) {
    return <div className="text-sm text-slate-600">Loading admin dashboard…</div>;
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Total students">
          <div className="text-3xl font-semibold tabular-nums">
            {overview?.totalStudents ?? "—"}
          </div>
        </Card>
        <Card title="At-risk students" subtitle="Medium + High">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-semibold tabular-nums">{atRisk}</div>
            <div className="flex gap-2">
              <RiskBadge label="Medium" />
              <RiskBadge label="High" />
            </div>
          </div>
        </Card>
        <Card
          title="Download report"
          subtitle="CSV export of current table"
          right={
            <button
              onClick={() => downloadCsv(rows)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Download CSV
            </button>
          }
        >
          <div className="text-sm text-slate-600">
            Includes student ID, risk label, and risk score.
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Risk distribution" subtitle="Across the dataset (demo subset)">
          <RiskPie riskCounts={overview?.riskCounts} />
        </Card>
        <Card title="Department-wise breakdown" subtitle="Using the `Course` column as a proxy">
          <BreakdownBar breakdown={overview?.breakdownByCourse} />
        </Card>
      </div>

      <Card
        title="All students"
        subtitle="Filter by risk label"
        right={
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
          >
            <option>All</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        }
      >
        <StudentTable rows={rows} showRowIndex />
      </Card>
    </div>
  );
}

