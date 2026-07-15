import { useEffect, useState } from "react";
import client from "../api/client.js";
import {
  CategoryBarChart,
  BudgetVsActualChart,
  SavingsRateChart,
  CategoryTrendChart,
  IncomeSourceChart,
} from "../components/ExpenseChart.jsx";

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function Panel({ title, subtitle, children, empty }) {
  return (
    <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 p-6 border border-ink/5">
      <h2 className="font-display text-lg text-ink mb-1 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
        {title}
      </h2>
      {subtitle && <p className="text-sm text-slate-text mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {empty ? <p className="text-slate-text text-sm">{empty}</p> : children}
    </div>
  );
}

const INSIGHT_ICONS = {
  ink: <path d="M12 2 3 7l9 5 9-5-9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" />,
  coral: <path d="M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
  emerald: <path d="m20 6-11 11-5-5" />,
};

function Insight({ tone = "ink", children }) {
  const tones = {
    ink: "bg-gradient-to-br from-ink to-ink-light text-paper shadow-card",
    coral: "bg-coral/10 text-coral border border-coral/20",
    emerald: "bg-emerald/10 text-emerald-dark border border-emerald/20",
  };
  const iconTones = {
    ink: "bg-white/10 text-emerald-light",
    coral: "bg-coral/15 text-coral",
    emerald: "bg-emerald/15 text-emerald-dark",
  };
  return (
    <div className={`rounded-xl px-4 py-3.5 text-sm flex items-start gap-3 ${tones[tone]}`}>
      <span className={`shrink-0 grid place-items-center w-7 h-7 rounded-md mt-0.5 ${iconTones[tone]}`}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {INSIGHT_ICONS[tone]}
        </svg>
      </span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

export default function Analytics() {
  const [breakdown, setBreakdown] = useState([]);
  const [budgetVsActual, setBudgetVsActual] = useState([]);
  const [savingsRate, setSavingsRate] = useState([]);
  const [categoryTrend, setCategoryTrend] = useState([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [bd, bva, sr, ct, ib] = await Promise.all([
          client.get("/api/analytics/category-breakdown"),
          client.get("/api/analytics/budget-vs-actual"),
          client.get("/api/analytics/savings-rate"),
          client.get("/api/analytics/category-trend"),
          client.get("/api/analytics/income-breakdown"),
        ]);
        setBreakdown(bd.data);
        setBudgetVsActual(bva.data);
        setSavingsRate(sr.data);
        setCategoryTrend(ct.data);
        setIncomeBreakdown(ib.data);
      } catch (e) {
        setError("Couldn't load analytics right now. Try refreshing.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="h-8 w-40 skeleton rounded-md mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-coral/10 border border-coral/20 text-coral rounded-xl px-5 py-4 text-sm">{error}</div>
      </div>
    );
  }

  const topCategory = [...breakdown].sort((a, b) => b.total - a.total)[0];
  const overBudget = budgetVsActual.filter((b) => b.spent > b.limit_amount);
  const latestSavingsRate = savingsRate.length ? savingsRate[savingsRate.length - 1] : null;
  const priorSavingsRate = savingsRate.length > 1 ? savingsRate[savingsRate.length - 2] : null;
  const savingsDelta =
    latestSavingsRate && priorSavingsRate ? latestSavingsRate.savings_rate - priorSavingsRate.savings_rate : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in-up">
      <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Deep dive</p>
      <h1 className="font-display text-3xl text-ink mb-8">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {topCategory ? (
          <Insight tone="ink">
            Your biggest expense category is <strong>{topCategory.category}</strong> at {inr(topCategory.total)}.
          </Insight>
        ) : (
          <Insight tone="ink">Add some transactions to unlock spending insights.</Insight>
        )}

        {overBudget.length > 0 ? (
          <Insight tone="coral">
            {overBudget.length} budget{overBudget.length > 1 ? "s are" : " is"} over limit this month:{" "}
            {overBudget.map((b) => b.category).join(", ")}.
          </Insight>
        ) : (
          <Insight tone="emerald">All budgets are within limit this month.</Insight>
        )}

        {latestSavingsRate ? (
          <Insight tone={latestSavingsRate.savings_rate < 0 ? "coral" : "emerald"}>
            You saved <strong>{latestSavingsRate.savings_rate}%</strong> of income last period
            {savingsDelta !== null && (
              <> ({savingsDelta >= 0 ? "up" : "down"} {Math.abs(savingsDelta).toFixed(1)} pts vs. the month before)</>
            )}
            .
          </Insight>
        ) : (
          <Insight tone="ink">Not enough history yet to compute a savings rate trend.</Insight>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel
          title="Spending by category, ranked"
          subtitle="Where your rupees actually go, largest first."
          empty={breakdown.length === 0 ? "No expenses recorded yet." : null}
        >
          <CategoryBarChart data={breakdown} />
        </Panel>

        <Panel
          title="Budget vs. actual"
          subtitle="This month's limits against real spend, per category."
          empty={budgetVsActual.length === 0 ? "Set a budget to compare it against actual spend." : null}
        >
          <BudgetVsActualChart data={budgetVsActual} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel
          title="Savings rate over time"
          subtitle="Share of income kept each month — the health of your cash flow."
          empty={savingsRate.length === 0 ? "Add income and expenses to see your savings trend." : null}
        >
          <SavingsRateChart data={savingsRate} />
        </Panel>

        <Panel
          title="Income by source"
          subtitle="Salary, freelance, business, investment — where money comes in from."
          empty={incomeBreakdown.length === 0 ? "No income recorded yet." : null}
        >
          <IncomeSourceChart data={incomeBreakdown} />
        </Panel>
      </div>

      <Panel
        title="Category mix over time"
        subtitle="How your top spending categories shift month to month, stacked."
        empty={categoryTrend.length === 0 ? "Add a few months of transactions to see the mix evolve." : null}
      >
        <CategoryTrendChart data={categoryTrend} />
      </Panel>
    </div>
  );
}
