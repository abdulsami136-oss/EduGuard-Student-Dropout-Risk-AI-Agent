export default function ProgressBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const color =
    v < 33 ? "bg-emerald-500" : v < 66 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>0%</span>
        <span className="font-semibold text-slate-900">{v.toFixed(1)}%</span>
        <span>100%</span>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

