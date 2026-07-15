import { Line, Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const PALETTE = ["#1E7A5F", "#E4572E", "#C9A227", "#12213A", "#2E9C7A", "#F17A54", "#1B3153", "#8C6D1F"];

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const baseFont = { family: "Inter" };

/** Income vs. expenses over time — the primary trend line for spotting
 * cash-flow direction and seasonality. */
export function TrendChart({ data }) {
  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: "Income",
        data: data.map((d) => d.income),
        borderColor: "#1E7A5F",
        backgroundColor: "rgba(30, 122, 95, 0.08)",
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: "Expenses",
        data: data.map((d) => d.expenses),
        borderColor: "#E4572E",
        backgroundColor: "rgba(228, 87, 46, 0.06)",
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { font: baseFont, color: "#4A5568" } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${inr(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#4A5568", font: baseFont } },
      y: {
        grid: { color: "rgba(18,33,58,0.06)" },
        ticks: {
          color: "#4A5568",
          font: baseFont,
          callback: (v) => inr(v),
        },
      },
    },
  };

  return <Line data={chartData} options={options} />;
}

/** Spending by category, largest first, with % of total and rupee amount
 * both visible in the tooltip and legend so the split is easy to read. */
export function CategoryDoughnut({ data }) {
  const sorted = [...data].sort((a, b) => b.total - a.total);
  const total = sorted.reduce((sum, d) => sum + d.total, 0);

  const chartData = {
    labels: sorted.map((d) => d.category),
    datasets: [
      {
        data: sorted.map((d) => d.total),
        backgroundColor: sorted.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    ],
  };

  const options = {
    responsive: true,
    cutout: "62%",
    plugins: {
      legend: {
        position: "right",
        labels: {
          font: baseFont,
          color: "#4A5568",
          generateLabels: (chart) => {
            const ds = chart.data.datasets[0];
            return chart.data.labels.map((label, i) => {
              const value = ds.data[i];
              const pct = total ? Math.round((value / total) * 100) : 0;
              return {
                text: `${label} — ${pct}%`,
                fillStyle: ds.backgroundColor[i],
                strokeStyle: ds.backgroundColor[i],
                index: i,
              };
            });
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
            return `${ctx.label}: ${inr(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}

/** Horizontal ranked bar of spending categories — easier than a doughnut
 * for comparing exact magnitudes between categories. */
export function CategoryBarChart({ data }) {
  const sorted = [...data].sort((a, b) => b.total - a.total);

  const chartData = {
    labels: sorted.map((d) => d.category),
    datasets: [
      {
        label: "Spent",
        data: sorted.map((d) => d.total),
        backgroundColor: sorted.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => inr(ctx.parsed.x) } },
    },
    scales: {
      x: { grid: { color: "rgba(18,33,58,0.06)" }, ticks: { color: "#4A5568", font: baseFont, callback: (v) => inr(v) } },
      y: { grid: { display: false }, ticks: { color: "#4A5568", font: baseFont } },
    },
  };

  return <Bar data={chartData} options={options} />;
}

/** Budgeted limit vs. actual spend per category — the clearest way to see
 * which budgets are on track and which are blown. */
export function BudgetVsActualChart({ data }) {
  const chartData = {
    labels: data.map((d) => d.category),
    datasets: [
      {
        label: "Budget",
        data: data.map((d) => d.limit_amount),
        backgroundColor: "rgba(18,33,58,0.15)",
        borderRadius: 4,
        maxBarThickness: 22,
      },
      {
        label: "Actual spend",
        data: data.map((d) => d.spent),
        backgroundColor: data.map((d) => (d.spent > d.limit_amount ? "#E4572E" : "#1E7A5F")),
        borderRadius: 4,
        maxBarThickness: 22,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { labels: { font: baseFont, color: "#4A5568" } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${inr(ctx.parsed.y)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#4A5568", font: baseFont } },
      y: {
        grid: { color: "rgba(18,33,58,0.06)" },
        ticks: { color: "#4A5568", font: baseFont, callback: (v) => inr(v) },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

/** Monthly savings rate (%) — bars flip red below zero so a
 * negative-savings month is immediately visible. */
export function SavingsRateChart({ data }) {
  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: "Savings rate",
        data: data.map((d) => d.savings_rate),
        backgroundColor: data.map((d) => (d.savings_rate < 0 ? "#E4572E" : d.savings_rate < 15 ? "#C9A227" : "#1E7A5F")),
        borderRadius: 4,
        maxBarThickness: 36,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}% saved` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#4A5568", font: baseFont } },
      y: {
        grid: { color: "rgba(18,33,58,0.06)" },
        ticks: { color: "#4A5568", font: baseFont, callback: (v) => `${v}%` },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

/** Stacked monthly spend across the top categories — shows how the mix
 * of where money goes shifts month to month, not just the total. */
export function CategoryTrendChart({ data }) {
  const categoryKeys = Array.from(
    data.reduce((set, point) => {
      Object.keys(point.values).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  // Keep "Other" last regardless of magnitude, sort the rest by total desc.
  const totals = Object.fromEntries(categoryKeys.map((k) => [k, data.reduce((s, p) => s + (p.values[k] || 0), 0)]));
  const ordered = categoryKeys
    .filter((k) => k !== "Other")
    .sort((a, b) => totals[b] - totals[a])
    .concat(categoryKeys.includes("Other") ? ["Other"] : []);

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: ordered.map((key, i) => ({
      label: key,
      data: data.map((d) => d.values[key] || 0),
      backgroundColor: key === "Other" ? "rgba(18,33,58,0.25)" : PALETTE[i % PALETTE.length],
      stack: "spend",
      maxBarThickness: 40,
    })),
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "bottom", labels: { font: baseFont, color: "#4A5568" } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${inr(ctx.parsed.y)}` } },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: "#4A5568", font: baseFont } },
      y: {
        stacked: true,
        grid: { color: "rgba(18,33,58,0.06)" },
        ticks: { color: "#4A5568", font: baseFont, callback: (v) => inr(v) },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

/** Income by source — same visual language as CategoryBarChart but for
 * the income side of the ledger. */
export function IncomeSourceChart({ data }) {
  const sorted = [...data].sort((a, b) => b.total - a.total);

  const chartData = {
    labels: sorted.map((d) => d.source),
    datasets: [
      {
        label: "Income",
        data: sorted.map((d) => d.total),
        backgroundColor: "#1E7A5F",
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => inr(ctx.parsed.x) } },
    },
    scales: {
      x: { grid: { color: "rgba(18,33,58,0.06)" }, ticks: { color: "#4A5568", font: baseFont, callback: (v) => inr(v) } },
      y: { grid: { display: false }, ticks: { color: "#4A5568", font: baseFont } },
    },
  };

  return <Bar data={chartData} options={options} />;
}
