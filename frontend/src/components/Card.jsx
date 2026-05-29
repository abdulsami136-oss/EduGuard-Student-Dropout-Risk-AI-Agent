export default function Card({ title, subtitle, right, children }) {
  return (
    <div className="card p-5">
      {(title || right) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {title ? <div className="text-sm font-semibold">{title}</div> : null}
            {subtitle ? (
              <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
            ) : null}
          </div>
          {right ? <div>{right}</div> : null}
        </div>
      )}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </div>
  );
}

