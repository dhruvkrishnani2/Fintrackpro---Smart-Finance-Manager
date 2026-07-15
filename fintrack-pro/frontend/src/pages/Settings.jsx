import { useState } from "react";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [stage, setStage] = useState("idle"); // idle | setup | disable
  const [qr, setQr] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const startSetup = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await client.post("/api/auth/mfa/setup");
      setQr(data.qr_code_base64);
      setSecret(data.secret);
      setStage("setup");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't start MFA setup.");
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await client.post("/api/auth/mfa/enable", { code });
      await refreshUser();
      setStage("idle");
      setCode("");
      setNotice("Two-factor authentication is now enabled.");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid code. Check your authenticator app and try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await client.post("/api/auth/mfa/disable", { password, code });
      await refreshUser();
      setStage("idle");
      setPassword("");
      setCode("");
      setNotice("Two-factor authentication has been turned off.");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't disable MFA. Check your password and code.");
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setStage("idle");
    setQr(null);
    setSecret(null);
    setCode("");
    setPassword("");
    setError("");
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 animate-fade-in-up">
      <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Account</p>
      <h1 className="font-display text-3xl text-ink mb-8">Settings</h1>

      {notice && (
        <div className="mb-6 text-sm text-emerald-dark bg-emerald/10 border border-emerald/20 rounded-md px-3 py-2">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl text-ink">Two-factor authentication</h2>
          <span
            className={`text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-full ${
              user?.mfa_enabled ? "bg-emerald/10 text-emerald-dark" : "bg-ink/5 text-slate-text"
            }`}
          >
            {user?.mfa_enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <p className="text-sm text-slate-text mb-5">
          Require a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password,
          etc.) in addition to your password when signing in.
        </p>

        {error && (
          <div className="mb-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {stage === "idle" && !user?.mfa_enabled && (
          <button
            onClick={startSetup}
            disabled={loading}
            className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Starting…" : "Enable two-factor authentication"}
          </button>
        )}

        {stage === "idle" && user?.mfa_enabled && (
          <button
            onClick={() => setStage("disable")}
            className="text-coral border border-coral/30 hover:bg-coral/10 hover:border-coral/50 font-semibold px-4 py-2.5 rounded-lg transition-all duration-200"
          >
            Disable two-factor authentication
          </button>
        )}

        {stage === "setup" && (
          <form onSubmit={confirmEnable} className="mt-2">
            <p className="text-sm text-slate-text mb-3">
              Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
            </p>
            <div className="flex flex-col items-center gap-3 mb-5">
              {qr && <img src={qr} alt="MFA QR code" className="w-44 h-44 border border-ink/10 rounded-md" />}
              <p className="text-xs text-slate-text/70">
                Can't scan it? Enter this key manually:{" "}
                <span className="font-mono text-ink">{secret}</span>
              </p>
            </div>

            <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
              6-digit code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full mb-5 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150 text-center tracking-[0.5em] text-lg max-w-[220px]"
              placeholder="000000"
            />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Confirm & enable"}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="text-slate-text px-4 py-2.5 rounded-md hover:bg-paper transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {stage === "disable" && (
          <form onSubmit={confirmDisable} className="mt-2 max-w-sm">
            <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
              placeholder="••••••••"
            />
            <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
              Current 6-digit code
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full mb-5 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150 text-center tracking-[0.5em] text-lg max-w-[220px]"
              placeholder="000000"
            />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="bg-gradient-to-r from-coral to-coral-light hover:brightness-110 text-white font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? "Disabling…" : "Confirm & disable"}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="text-slate-text px-4 py-2.5 rounded-md hover:bg-paper transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
