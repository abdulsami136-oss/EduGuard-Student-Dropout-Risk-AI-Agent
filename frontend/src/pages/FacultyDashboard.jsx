import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import StudentTable from "../components/StudentTable.jsx";

async function fetchClass(facultyId) {
  const res = await fetch(
    `/api/faculty/${encodeURIComponent(facultyId)}/class?limit=80`
  );
  if (!res.ok) throw new Error("Failed to load faculty class");
  return await res.json();
}

async function sendNote({ facultyId, studentId, message }) {
  const res = await fetch("/api/faculty/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ facultyId, studentId, message })
  });
  if (!res.ok) throw new Error("Failed to send note");
  return await res.json();
}

export default function FacultyDashboard({ session }) {
  const facultyId = session?.userId || "F001";
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchClass(facultyId)
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
  }, [facultyId]);

  const needsAttention = useMemo(() => {
    const rows = data?.students || [];
    return rows.filter((r) => r.riskLabel === "High" || r.riskLabel === "Medium");
  }, [data]);

  const onSend = async () => {
    if (!selected) return;
    setStatus("");
    try {
      await sendNote({
        facultyId,
        studentId: selected.studentId,
        message
      });
      setStatus("Sent.");
      setMessage("");
    } catch (e) {
      setStatus(e?.message || "Failed.");
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Loading faculty dashboard…</div>;
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
        <Card title="Class summary" subtitle="Computed from your assigned class subset">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Class key</span>
              <span className="font-mono">{data?.classKey}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Students</span>
              <span className="font-semibold tabular-nums">
                {data?.students?.length ?? 0}
              </span>
            </div>
          </div>
        </Card>
        <Card title="Class averages" subtitle="Semester grade averages (if present)">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">1st sem avg</span>
              <span className="font-semibold tabular-nums">
                {data?.classAverages?.grade1Avg ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">2nd sem avg</span>
              <span className="font-semibold tabular-nums">
                {data?.classAverages?.grade2Avg ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Risk avg</span>
              <span className="font-semibold tabular-nums">
                {data?.classAverages?.riskAvg ?? 0}%
              </span>
            </div>
          </div>
        </Card>
        <Card title="Students needing attention" subtitle="Medium or High risk">
          <div className="text-3xl font-semibold tabular-nums">
            {needsAttention.length}
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Prioritize High-risk students for intervention.
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Your class" subtitle="Click View to select a student">
          <StudentTable rows={data?.students || []} onSelect={setSelected} />
        </Card>

        <Card
          title="Send an alert / note"
          subtitle="Demo-only: message is not persisted"
        >
          <div className="space-y-3">
            <div className="text-sm text-slate-700">
              Selected:{" "}
              <span className="font-mono">
                {selected?.studentId || "None"}
              </span>
            </div>
            <textarea
              className="h-28 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm"
              placeholder="Write a supportive note or action request…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">{status}</div>
              <button
                onClick={onSend}
                disabled={!selected || !message.trim()}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Send
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

