import { useEffect, useState } from "react";
import client from "../api/client.js";
import ExportMenu from "../components/ExportMenu.jsx";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - i);

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category_id: "",
    description: "",
    source: "",
  });
  const [filters, setFilters] = useState({ month: "", year: "", type: "" });
  const [loading, setLoading] = useState(true);

  const filterParams = {
    ...(filters.month && { month: filters.month }),
    ...(filters.year && { year: filters.year }),
    ...(filters.type && { type: filters.type }),
  };

  const loadData = async () => {
    setLoading(true);
    const [txRes, catRes] = await Promise.all([
      client.get("/api/transactions/", { params: filterParams }),
      client.get("/api/categories/"),
    ]);
    setTransactions(txRes.data);
    setCategories(catRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filters.month, filters.year, filters.type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await client.post("/api/transactions/", {
      ...form,
      amount: parseFloat(form.amount),
      category_id: form.category_id || null,
    });
    setForm({ type: "expense", amount: "", category_id: "", description: "", source: "" });
    loadData();
  };

  const handleDelete = async (id) => {
    await client.delete(`/api/transactions/${id}`);
    loadData();
  };

  const handleMakeRecurring = async (id) => {
    const frequency = window.prompt("Repeat this how often? (weekly / monthly / yearly)", "monthly");
    if (!frequency) return;
    const normalized = frequency.trim().toLowerCase();
    if (!["weekly", "monthly", "yearly"].includes(normalized)) {
      window.alert("Please enter weekly, monthly, or yearly.");
      return;
    }
    await client.post(`/api/recurring/from-transaction/${id}`, { frequency: normalized });
    loadData();
  };

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || "Uncategorized";
  const filteredCategories = categories.filter((c) => c.type === form.type);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in-up">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Ledger entries</p>
          <h1 className="font-display text-3xl text-ink">Transactions</h1>
        </div>
        <ExportMenu
          endpoints={{
            excel: { url: "/api/reports/transactions/excel", filename: "transactions.xlsx", params: filterParams },
            pdf: { url: "/api/reports/transactions/pdf", filename: "transactions.pdf", params: filterParams },
          }}
        />
      </div>

      <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Month</label>
          <select
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            className="px-3 py-2 border border-ink/15 rounded-lg text-sm focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          >
            <option value="">All months</option>
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Year</label>
          <select
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            className="px-3 py-2 border border-ink/15 rounded-lg text-sm focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          >
            <option value="">All years</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Type</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="px-3 py-2 border border-ink/15 rounded-lg text-sm focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        {(filters.month || filters.year || filters.type) && (
          <button
            type="button"
            onClick={() => setFilters({ month: "", year: "", type: "" })}
            className="text-xs text-slate-text/60 hover:text-coral underline underline-offset-2 pb-2.5"
          >
            Clear filters
          </button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-5 mb-8 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
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
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
            placeholder="Optional note"
          />
        </div>
        <button
          type="submit"
          className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          Add entry
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 text-xs uppercase tracking-wide text-slate-text/60 font-semibold bg-paper border-b border-ink/5">
          <div className="col-span-2">Date</div>
          <div className="col-span-3">Category</div>
          <div className="col-span-3">Description</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 skeleton rounded-md" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="p-8 text-slate-text text-sm text-center">No transactions yet — add your first entry above.</p>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="ledger-row grid grid-cols-12 px-5 py-3 items-center text-sm">
              <div className="col-span-2 text-slate-text">
                {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="col-span-3">{categoryName(tx.category_id)}</div>
              <div className="col-span-3 text-slate-text">
                {tx.description || "—"}
                {tx.is_recurring && (
                  <span
                    title="Generated from a recurring rule"
                    className="ml-2 text-xs text-emerald-dark bg-emerald/10 px-1.5 py-0.5 rounded"
                  >
                    ↻ recurring
                  </span>
                )}
              </div>
              <div
                className={`col-span-2 text-right font-mono tabular font-medium ${
                  tx.type === "income" ? "text-emerald" : "text-coral"
                }`}
              >
                {tx.type === "income" ? "+" : "−"}
                {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(tx.amount)}
              </div>
              <div className="col-span-2 text-right space-x-3">
                {!tx.is_recurring && (
                  <button
                    onClick={() => handleMakeRecurring(tx.id)}
                    className="text-slate-text/50 hover:text-emerald-dark text-xs"
                  >
                    Make recurring
                  </button>
                )}
                <button
                  onClick={() => handleDelete(tx.id)}
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
