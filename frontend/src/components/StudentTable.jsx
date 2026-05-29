import RiskBadge from "./RiskBadge.jsx";

export default function StudentTable({ rows, onSelect, showRowIndex = false }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
      <table className="w-full border-collapse bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Student ID</th>
            {showRowIndex ? (
              <th className="px-3 py-2 font-semibold">Row</th>
            ) : null}
            <th className="px-3 py-2 font-semibold">Risk</th>
            <th className="px-3 py-2 font-semibold">Score</th>
            <th className="px-3 py-2 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r) => (
            <tr key={r.studentId} className="border-t border-slate-100">
              <td className="px-3 py-2 font-mono">{r.studentId}</td>
              {showRowIndex ? (
                <td className="px-3 py-2 text-slate-600">{r.rowIndex}</td>
              ) : null}
              <td className="px-3 py-2">
                <RiskBadge label={r.riskLabel} />
              </td>
              <td className="px-3 py-2 tabular-nums">{r.riskScore}%</td>
              <td className="px-3 py-2 text-right">
                {onSelect ? (
                  <button
                    onClick={() => onSelect(r)}
                    className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    View
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {rows?.length === 0 ? (
            <tr>
              <td
                className="px-3 py-6 text-center text-slate-500"
                colSpan={showRowIndex ? 5 : 4}
              >
                No students found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

