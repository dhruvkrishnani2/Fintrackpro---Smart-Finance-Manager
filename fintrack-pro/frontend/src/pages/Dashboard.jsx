import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import { TrendChart, CategoryDoughnut } from "../components/ExpenseChart.jsx";
import ExportMenu from "../components/ExportMenu.jsx";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, t, b, f] = await Promise.all([
          client.get("/api/analytics/dashboard"),
          client.get("/api/analytics/trend"),
          client.get("/api/analytics/category-breakdown"),
          client.get("/api/analytics/forecast"),
        ]);
        setSummary(s.data);
        setTrend(t.data);
        setBreakdown(b.data);
        setForecast(f.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="h-8 w-48 skeleton rounded-md mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-40 skeleton rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in-up">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Overview</p>
          <h1 className="font-display text-3xl text-ink">Dashboard</h1>
        </div>
        <ExportMenu
          label="Full report"
          endpoints={{
            excel: { url: "/api/reports/full-report/excel", filename: "financial-report.xlsx" },
            pdf: { url: "/api/reports/full-report/pdf", filename: "financial-report.pdf" },
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard eyebrow="Balance" label="Total balance" value={summary.total_balance} accent="ink" />
        <StatCard eyebrow="This month" label="Income" value={summary.monthly_income} accent="emerald" />
        <StatCard eyebrow="This month" label="Expenses" value={summary.monthly_expenses} accent="coral" />
        <StatCard eyebrow="This month" label="Savings" value={summary.monthly_savings} accent="gold" />
        <StatCard eyebrow="This month" label="Net cash flow" value={summary.net_cash_flow} accent="ink" />
      </div>

      {forecast && (
        <div className="relative overflow-hidden bg-ink text-paper rounded-xl p-5 mb-8 flex items-center justify-between flex-wrap gap-3 shadow-card">
          <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
          <div className="relative flex items-center gap-4">
            <span className="hidden sm:grid place-items-center w-11 h-11 rounded-lg bg-white/10 text-emerald-light shrink-0">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l6-6 4 4 8-8M21 7v5m0-5h-5" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-widest text-paper/50 mb-1">Cash flow forecast</p>
              <p className="text-sm text-paper/80">{forecast.message}</p>
            </div>
          </div>
          <p className="relative font-mono tabular text-2xl text-emerald-light font-semibold">
            {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
              forecast.forecast_next_month
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 p-6 border border-ink/5">
          <h2 className="font-display text-lg text-ink mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
            Income vs. expenses
          </h2>
          {trend.length > 0 ? (
            <TrendChart data={trend} />
          ) : (
            <p className="text-slate-text text-sm">Add transactions to see your trend.</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 p-6 border border-ink/5">
          <h2 className="font-display text-lg text-ink mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            Spending by category
          </h2>
          {breakdown.length > 0 ? (
            <CategoryDoughnut data={breakdown} />
          ) : (
            <p className="text-slate-text text-sm">No expenses recorded yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link
          to="/analytics"
          className="inline-flex items-center gap-1 text-sm text-emerald hover:text-emerald-dark font-medium group"
        >
          See budget-vs-actual, savings rate, and category trends in Analytics
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </div>
  );
}
