export default function RiskBadge({ label }) {
  const l = String(label || "").toLowerCase();
  const cls =
    l === "low"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : l === "medium"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";
  const text = l ? l[0].toUpperCase() + l.slice(1) : "Unknown";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}
    >
      {text}
    </span>
  );
}

