import { useEffect, useState } from "react";
import client from "../api/client.js";

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState({ name: "", target_amount: "" });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const { data } = await client.get("/api/goals/");
    setGoals(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await client.post("/api/goals/", {
      name: form.name,
      target_amount: parseFloat(form.target_amount),
    });
    setForm({ name: "", target_amount: "" });
    loadData();
  };

  const contribute = async (id) => {
    const amount = prompt("Amount to add towards this goal:");
    if (!amount || isNaN(parseFloat(amount))) return;
    await client.put(`/api/goals/${id}/contribute`, null, { params: { amount: parseFloat(amount) } });
    loadData();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in-up">
      <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Targets</p>
      <h1 className="font-display text-3xl text-ink mb-8">Savings goals</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-5 mb-8 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Goal name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
            placeholder="Emergency fund"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Target amount</label>
          <input
            type="number"
            step="0.01"
            required
            value={form.target_amount}
            onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150 font-mono tabular"
            placeholder="0.00"
          />
        </div>
        <button
          type="submit"
          className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          Create goal
        </button>
      </form>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-xl" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12 text-slate-text text-sm bg-white rounded-xl border border-dashed border-ink/15">
          No goals yet — set your first target above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = Math.min(100, (g.current_amount / g.target_amount) * 100);
            const completed = g.status === "completed";
            return (
              <div
                key={g.id}
                className={`relative overflow-hidden bg-white rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 border p-5 ${
                  completed ? "border-gold/30" : "border-ink/5"
                }`}
              >
                {completed && (
                  <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gold/10 blur-xl" />
                )}
                <div className="flex justify-between items-baseline mb-2">
                  <p className="font-medium text-ink">{g.name}</p>
                  {completed && (
                    <span className="flex items-center gap-1 text-xs text-gold font-semibold uppercase tracking-wide bg-gold/10 px-2 py-0.5 rounded-full">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                        <path d="M12 2 14.9 8.6 22 9.3l-5.3 4.6L18.2 21 12 17.3 5.8 21l1.5-7.1L2 9.3l7.1-.7L12 2Z" />
                      </svg>
                      Achieved
                    </span>
                  )}
                </div>
                <div className="w-full h-2.5 bg-paper rounded-full overflow-hidden mb-2 ring-1 ring-inset ring-ink/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold to-emerald-light transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="font-mono tabular text-sm text-slate-text">
                    {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(g.current_amount)} of{" "}
                    {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(g.target_amount)}
                  </p>
                  {!completed && (
                    <button
                      onClick={() => contribute(g.id)}
                      className="text-xs text-emerald font-semibold hover:text-emerald-dark hover:underline underline-offset-2"
                    >
                      Add funds →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
