import { useEffect, useState } from "react";
import client from "../api/client.js";

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function Recurring() {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category_id: "",
    description: "",
    source: "",
    frequency: "monthly",
    start_date: "",
    end_date: "",
  });
  const [loading, setLoading] = useState(true);
  const [runMessage, setRunMessage] = useState(null);
  const [running, setRunning] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [rRes, cRes] = await Promise.all([
      client.get("/api/recurring/"),
      client.get("/api/categories/"),
    ]);
    setRules(rRes.data);
    setCategories(cRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || "Uncategorized";
  const filteredCategories = categories.filter((c) => c.type === form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await client.post("/api/recurring/", {
      type: form.type,
      amount: parseFloat(form.amount),
      category_id: form.category_id || null,
      description: form.description || null,
      source: form.source || null,
      frequency: form.frequency,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
    });
    setForm({
      type: "expense",
      amount: "",
      category_id: "",
      description: "",
      source: "",
      frequency: "monthly",
      start_date: "",
      end_date: "",
    });
    loadData();
  };

  const handleToggleActive = async (rule) => {
    await client.put(`/api/recurring/${rule.id}`, { is_active: !rule.is_active });
    loadData();
  };

  const handleDelete = async (id) => {
    await client.delete(`/api/recurring/${id}`);
    loadData();
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunMessage(null);
    try {
      const res = await client.post("/api/recurring/run");
      const count = res.data.generated_count;
      setRunMessage(count > 0 ? `Generated ${count} transaction${count > 1 ? "s" : ""}.` : "Nothing due right now.");
      loadData();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in-up">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Automate the ledger</p>
          <h1 className="font-display text-3xl text-ink">Recurring</h1>
        </div>
        <div className="text-right">
          <button
            onClick={handleRunNow}
            disabled={running}
            className="bg-gradient-to-r from-ink to-ink-light hover:brightness-125 text-paper text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            {running ? "Checking…" : "Run due now"}
          </button>
          {runMessage && <p className="text-xs text-slate-text mt-1">{runMessage}</p>}
        </div>
      </div>

      <p className="text-sm text-slate-text mb-6 max-w-2xl">
        Set up rent, salary, subscriptions, or any other repeating entry once. FinTrack Pro posts each
        occurrence to your transactions automatically — no more re-entering the same line every month.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-5 mb-8 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value, category_id: "" })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150 font-mono tabular"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Category</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          >
            <option value="">Uncategorized</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Frequency</label>
          <select
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
            placeholder="e.g. Rent, Netflix, Salary"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
            Starts on <span className="normal-case text-slate-text/50">(optional)</span>
          </label>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
            Ends on <span className="normal-case text-slate-text/50">(optional)</span>
          </label>
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          />
        </div>

        <button
          type="submit"
          className="md:col-span-4 bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          Add recurring entry
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 text-xs uppercase tracking-wide text-slate-text/60 bg-paper">
          <div className="col-span-3">Description</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Frequency</div>
          <div className="col-span-2">Next run</div>
          <div className="col-span-1 text-right">Amount</div>
          <div className="col-span-2 text-right">Manage</div>
        </div>
        {loading ? (
          <p className="p-5 text-slate-text text-sm">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="p-5 text-slate-text text-sm">
            No recurring entries yet — add rent, a subscription, or your salary above.
          </p>
        ) : (
          rules.map((r) => (
            <div key={r.id} className="ledger-row grid grid-cols-12 px-5 py-3 items-center text-sm">
              <div className="col-span-3">
                <p className="text-ink">{r.description || "Untitled"}</p>
                {!r.is_active && (
                  <span className="text-xs text-slate-text/50 uppercase tracking-wide">Paused</span>
                )}
              </div>
              <div className="col-span-2 text-slate-text">{categoryName(r.category_id)}</div>
              <div className="col-span-2 text-slate-text capitalize">{r.frequency}</div>
              <div className="col-span-2 text-slate-text">{fmtDate(r.next_run_date)}</div>
              <div
                className={`col-span-1 text-right font-mono tabular font-medium ${
                  r.type === "income" ? "text-emerald" : "text-coral"
                }`}
              >
                {r.type === "income" ? "+" : "−"}
                {inr(r.amount)}
              </div>
              <div className="col-span-2 text-right space-x-3">
                <button
                  onClick={() => handleToggleActive(r)}
                  className="text-slate-text/60 hover:text-ink text-xs"
                >
                  {r.is_active ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-slate-text/50 hover:text-coral text-xs"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
