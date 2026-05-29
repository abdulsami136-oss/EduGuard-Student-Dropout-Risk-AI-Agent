import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const COLORS = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#f43f5e"
};

export function RiskPie({ riskCounts }) {
  const data = Object.entries(riskCounts || {}).map(([name, value]) => ({
    name,
    value
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={90}>
            {data.map((d) => (
              <Cell key={d.name} fill={COLORS[d.name] || "#3b82f6"} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BreakdownBar({ breakdown }) {
  const data = Object.entries(breakdown || {}).map(([name, value]) => ({
    name,
    value
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 10, right: 10 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

