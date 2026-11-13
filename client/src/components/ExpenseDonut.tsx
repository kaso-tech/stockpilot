import { formatCurrency } from "@/lib/format";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export const expenseLabels: Record<string, string> = {
  rent: "Loyer",
  energy: "Énergie",
  connection: "Connexion",
  salary: "Salaire",
  agent_payments: "Paiements agents",
  marketing: "Marketing",
  supplies: "Fournitures",
  taxes: "Impôts",
  other: "Autre",
};

/** Palette catégorielle sobre, lisible en clair comme en sombre. */
export const expenseColors: Record<string, string> = {
  rent: "#0B6E76",
  energy: "#1D4ED8",
  connection: "#7C3AED",
  salary: "#B54708",
  agent_payments: "#E8853D",
  marketing: "#C11574",
  supplies: "#157F4F",
  taxes: "#B42318",
  other: "#98A2B3",
};

export const chartTooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--popover-foreground)",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgb(var(--shadow-color) / 0.08)",
};

/** Répartition des dépenses en anneau, total au centre. */
export function ExpenseDonut({
  breakdown,
  total,
  label = (category: string) => expenseLabels[category] ?? category,
}: {
  breakdown: Array<{ category: string; amountCents: number }>;
  total: number;
  label?: (category: string) => string;
}) {
  return (
    <div className="relative h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={breakdown}
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
            {breakdown.map(item => (
              <Cell
                key={item.category}
                fill={expenseColors[item.category] ?? "#98A2B3"}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={value => formatCurrency(Number(value))}
            labelFormatter={category => label(String(category))}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xs text-faint">Total</p>
          <p className="mt-0.5 text-base font-semibold text-foreground">
            {formatCurrency(total)}
          </p>
        </div>
      </div>
    </div>
  );
}
