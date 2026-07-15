import { useEffect, useState } from "react";
import client from "../api/client.js";

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ category_id: "", limit_amount: "" });
  const [loading, setLoading] = useState(true);

  const now = new Date();

  const loadData = async () => {
    const [bRes, cRes] = await Promise.all([
      client.get("/api/budgets/"),
      client.get("/api/categories/"),
    ]);
    setBudgets(bRes.data);
    setCategories(cRes.data.filter((c) => c.type === "expense"));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await client.post("/api/budgets/", {
      category_id: form.category_id,
      limit_amount: parseFloat(form.limit_amount),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
    setForm({ category_id: "", limit_amount: "" });
    loadData();
  };

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || "Category";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in-up">
      <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">
        {now.toLocaleString("en-IN", { month: "long", year: "numeric" })}
      </p>
      <h1 className="font-display text-3xl text-ink mb-8">Budgets</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-5 mb-8 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Category</label>
          <select
            required
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Monthly limit</label>
          <input
            type="number"
            step="0.01"
            required
            value={form.limit_amount}
            onChange={(e) => setForm({ ...form, limit_amount: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150 font-mono tabular"
            placeholder="0.00"
          />
        </div>
        <button
          type="submit"
          className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          Set budget
        </button>
      </form>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-xl" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-12 text-slate-text text-sm bg-white rounded-xl border border-dashed border-ink/15">
          No budgets set for this month yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const pct = Math.min(100, (b.spent / b.limit_amount) * 100);
            const over = b.spent > b.limit_amount;
            return (
              <div
                key={b.id}
                className="bg-white rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 border border-ink/5 p-5"
              >
                <div className="flex justify-between items-baseline mb-2">
                  <p className="font-medium text-ink">{categoryName(b.category_id)}</p>
                  {over ? (
                    <span className="text-xs text-coral font-semibold uppercase tracking-wide bg-coral/10 px-2 py-0.5 rounded-full">
                      Over budget
                    </span>
                  ) : (
                    <span className="text-xs text-slate-text/50 font-mono tabular">{pct.toFixed(0)}%</span>
                  )}
                </div>
                <div className="w-full h-2.5 bg-paper rounded-full overflow-hidden mb-2 ring-1 ring-inset ring-ink/5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${
                      over ? "from-coral to-coral-light" : "from-emerald to-emerald-light"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="font-mono tabular text-sm text-slate-text">
                  {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(b.spent)} of{" "}
                  {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(b.limit_amount)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
