import { useEffect, useState, useRef } from "react";
import client from "../api/client.js";

export default function Imports() {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    client.get("/api/categories/").then((res) => setCategories(res.data));
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setRows([]);
    setError("");
    setSuccess("");
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await client.post("/api/imports/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRows(
        data.rows.map((r) => ({
          ...r,
          category_id: r.suggested_category_id || "",
          include: true,
        }))
      );
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't read that file. Check the format and try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (rowId, field, value) => {
    setRows((prev) => prev.map((r) => (r.row_id === rowId ? { ...r, [field]: value } : r)));
  };

  const handleConfirm = async () => {
    const toImport = rows.filter((r) => r.include);
    if (toImport.length === 0) return;
    setLoading(true);
    setError("");
    try {
      await client.post("/api/imports/confirm", {
        rows: toImport.map((r) => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          type: r.type,
          category_id: r.category_id || null,
        })),
      });
      setSuccess(`Imported ${toImport.length} transaction${toImport.length === 1 ? "" : "s"}.`);
      setRows([]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err.response?.data?.detail || "Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const categoriesFor = (type) => categories.filter((c) => c.type === type);
  const includedCount = rows.filter((r) => r.include).length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in-up">
      <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Import</p>
      <h1 className="font-display text-3xl text-ink mb-2">Bank statement import</h1>
      <p className="text-sm text-slate-text mb-8">
        Upload a CSV or Excel statement. Rows are auto-categorized from merchant keywords and your past
        transactions — review and adjust before confirming.
      </p>

      <form onSubmit={handlePreview} className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-5 mb-8 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">Statement file</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-ink file:text-white file:text-sm file:cursor-pointer"
          />
        </div>
        <button
          type="submit"
          disabled={!file || loading}
          className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold py-2.5 px-5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {loading && rows.length === 0 ? "Reading…" : "Preview"}
        </button>
      </form>

      {error && (
        <div className="mb-6 text-sm text-coral bg-coral/10 border border-coral/20 rounded-md px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 text-sm text-emerald bg-emerald/10 border border-emerald/20 rounded-md px-4 py-3">
          {success}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 overflow-hidden mb-4">
            <div className="grid grid-cols-12 px-5 py-3 text-xs uppercase tracking-wide text-slate-text/60 bg-paper">
              <div className="col-span-1"></div>
              <div className="col-span-2">Date</div>
              <div className="col-span-4">Description</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-3">Category</div>
            </div>
            {rows.map((r) => (
              <div key={r.row_id} className="ledger-row grid grid-cols-12 px-5 py-3 items-center text-sm">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => updateRow(r.row_id, "include", e.target.checked)}
                  />
                </div>
                <div className="col-span-2 text-slate-text">
                  {new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </div>
                <div className="col-span-4 truncate" title={r.description}>
                  {r.description}
                </div>
                <div
                  className={`col-span-2 text-right font-mono tabular font-medium ${
                    r.type === "income" ? "text-emerald" : "text-coral"
                  }`}
                >
                  {r.type === "income" ? "+" : "−"}
                  {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(r.amount)}
                </div>
                <div className="col-span-3">
                  <select
                    value={r.category_id}
                    onChange={(e) => updateRow(r.row_id, "category_id", e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-md text-sm ${
                      r.suggested_category_id ? "border-emerald/30" : "border-gold/40"
                    }`}
                  >
                    <option value="">Uncategorized</option>
                    {categoriesFor(r.type).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-text">
              {includedCount} of {rows.length} rows selected for import
            </p>
            <button
              onClick={handleConfirm}
              disabled={loading || includedCount === 0}
              className="bg-gradient-to-r from-ink to-ink-light hover:brightness-125 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Importing…" : `Confirm import (${includedCount})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
