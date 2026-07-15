import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleSignInButton from "./GoogleSignInButton.jsx";

/**
 * Combined authentication page: a single card with two tabs, "Sign in" and
 * "Register". The Sign in tab includes email/password plus
 * "Sign in with Google". The Register tab includes the sign-up form plus
 * "Sign up with Google".
 *
 * `initialMode` lets the /login and /register routes land on the right tab
 * while sharing one implementation.
 */
export default function AuthPage({ initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode); // "signin" | "register"

  // Sign in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState(null);

  // Register state
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register, verifyMfaLogin, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setTempToken(null);
    setCode("");
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.mfaRequired) {
        setTempToken(result.tempToken);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to sign in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(fullName, regEmail, regPassword);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential) => {
      setError("");
      setLoading(true);
      try {
        const result = await loginWithGoogle(credential);
        if (result?.mfaRequired) {
          setTempToken(result.tempToken);
          setMode("signin");
        } else {
          navigate("/");
        }
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            (mode === "signin" ? "Unable to sign in with Google." : "Unable to sign up with Google.")
        );
      } finally {
        setLoading(false);
      }
    },
    [loginWithGoogle, navigate, mode]
  );

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyMfaLogin(tempToken, code);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-ink px-6 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-emerald/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-light to-emerald text-ink font-display text-xl font-bold shadow-glow mb-4">
            F
          </span>
          <h1 className="font-display text-3xl text-paper mb-1">
            FinTrack <span className="text-emerald-light">Pro</span>
          </h1>
          <p className="text-paper/50 text-sm">Ledger in. Clarity out.</p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl shadow-black/30 overflow-hidden border border-white/10">
          {!tempToken && (
            <div className="relative grid grid-cols-2 bg-paper/60">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`relative py-3 text-sm font-medium transition-colors duration-200 ${
                  mode === "signin" ? "text-emerald-dark bg-white" : "text-slate-text/60 hover:text-ink"
                }`}
              >
                Sign in
                <span
                  className={`absolute left-0 right-0 -bottom-px h-[2px] bg-gradient-to-r from-emerald to-emerald-light transition-opacity duration-200 ${
                    mode === "signin" ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`relative py-3 text-sm font-medium transition-colors duration-200 ${
                  mode === "register" ? "text-emerald-dark bg-white" : "text-slate-text/60 hover:text-ink"
                }`}
              >
                Register
                <span
                  className={`absolute left-0 right-0 -bottom-px h-[2px] bg-gradient-to-r from-emerald to-emerald-light transition-opacity duration-200 ${
                    mode === "register" ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            </div>
          )}

          <div className="p-7">
            {tempToken ? (
              <form onSubmit={handleMfaSubmit}>
                <h2 className="font-display text-xl text-ink mb-1">Two-factor code</h2>
                <p className="text-sm text-slate-text mb-5">
                  Enter the 6-digit code from your authenticator app.
                </p>

                {error && (
                  <div className="mb-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full mb-6 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150 text-center tracking-[0.5em] text-lg"
                  placeholder="000000"
                />

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? "Verifying…" : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTempToken(null);
                    setCode("");
                    setError("");
                  }}
                  className="w-full text-center text-sm text-slate-text mt-4 hover:text-ink"
                >
                  ← Back to sign in
                </button>
              </form>
            ) : mode === "signin" ? (
              <form onSubmit={handleSignIn}>
                <h2 className="font-display text-xl text-ink mb-5">Sign in</h2>

                {error && (
                  <div className="mb-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mb-4 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
                  placeholder="you@example.com"
                />

                <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full mb-6 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
                  placeholder="••••••••"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                <div className="flex items-center gap-3 my-5">
                  <div className="h-px bg-ink/10 flex-1" />
                  <span className="text-xs uppercase tracking-wide text-slate-text/50">or</span>
                  <div className="h-px bg-ink/10 flex-1" />
                </div>

                <GoogleSignInButton onCredential={handleGoogleCredential} text="signin_with" />

                <p className="text-center text-sm text-slate-text mt-5">
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="text-emerald font-medium"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <h2 className="font-display text-xl text-ink mb-5">Create account</h2>

                {error && (
                  <div className="mb-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
                  Full name
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full mb-4 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
                  placeholder="Jordan Rivera"
                />

                <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full mb-4 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
                  placeholder="you@example.com"
                />

                <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full mb-6 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
                  placeholder="At least 8 characters"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>

                <div className="flex items-center gap-3 my-5">
                  <div className="h-px bg-ink/10 flex-1" />
                  <span className="text-xs uppercase tracking-wide text-slate-text/50">or</span>
                  <div className="h-px bg-ink/10 flex-1" />
                </div>

                <GoogleSignInButton onCredential={handleGoogleCredential} text="signup_with" />

                <p className="text-center text-sm text-slate-text mt-5">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-emerald font-medium"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
