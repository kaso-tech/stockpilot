import { formatCurrency } from "@/lib/format";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export const expenseColors: Record<string, string> = {
  rent: "#2563EB",
  energy: "#0D9488",
  connection: "#7C3AED",
  salary: "#B54708",
  agent_payments: "#E8853D",
  marketing: "#C11574",
  supplies: "#157F4F",
  taxes: "#B42318",
  food: "#CA8504",
  other: "#667085",
};

/** Anneau de répartition des dépenses, sans dépendance aux styles d’un thème spécifique. */
export function ExpenseDonut({
  breakdown,
  total,
  labels,
}: {
  breakdown: Array<{ category: string; amountCents: number }>;
  total: number;
  labels: Record<string, string>;
}) {
  const rows = breakdown.filter(item => Number.isFinite(item.amountCents) && item.amountCents > 0);
  return (
    <div className="relative mx-auto h-[220px] w-full max-w-[280px]" role="img" aria-label={`Répartition des dépenses, total ${formatCurrency(total)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="amountCents"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {rows.map(item => <Cell key={item.category} fill={expenseColors[item.category] ?? expenseColors.other} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--popover-foreground)" }}
            formatter={value => formatCurrency(Number(value))}
            labelFormatter={category => labels[String(category)] ?? String(category)}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-0.5 text-base font-semibold text-foreground">{formatCurrency(total)}</p>
        </div>
      </div>
    </div>
  );
}
