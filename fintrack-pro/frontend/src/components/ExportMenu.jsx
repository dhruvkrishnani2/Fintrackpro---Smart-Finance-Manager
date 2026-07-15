import { useState } from "react";
import { downloadFile } from "../utils/download.js";

/**
 * Two small buttons ("Excel" / "PDF") that download a report from the
 * backend. `endpoints` maps format -> { url, filename, params }.
 */
export default function ExportMenu({ endpoints, label = "Export" }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async (format) => {
    const config = endpoints[format];
    if (!config) return;
    setBusy(format);
    setError(null);
    try {
      await downloadFile(config.url, config.filename, config.params || {});
    } catch (err) {
      setError("Export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs uppercase tracking-wide text-slate-text/60 hidden sm:inline">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => handleExport("excel")}
        disabled={busy !== null}
        className="text-xs font-medium px-3 py-1.5 rounded-md border border-ink/15 text-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy === "excel" ? "Exporting…" : "Excel"}
      </button>
      <button
        type="button"
        onClick={() => handleExport("pdf")}
        disabled={busy !== null}
        className="text-xs font-medium px-3 py-1.5 rounded-md border border-ink/15 text-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy === "pdf" ? "Exporting…" : "PDF"}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
