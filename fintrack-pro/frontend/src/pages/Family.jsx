import { useEffect, useState } from "react";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export default function Family() {
  const { user, refreshUser } = useAuth();
  const [family, setFamily] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const loadFamily = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/family");
      setFamily(data);
      const { data: dash } = await client.get("/api/analytics/family/dashboard");
      setDashboard(dash);
    } catch (err) {
      if (err.response?.status === 404) {
        setFamily(null);
      } else {
        setError("Couldn't load family data.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFamily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await client.post("/api/family", { name: familyName });
      await refreshUser();
      setFamilyName("");
      loadFamily();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't create family.");
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await client.post("/api/family/join", { invite_code: inviteCode });
      await refreshUser();
      setInviteCode("");
      loadFamily();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't join family. Check the invite code.");
    }
  };

  const regenerateCode = async () => {
    try {
      const { data } = await client.post("/api/family/invite/regenerate");
      setFamily(data);
      setNotice("New invite code generated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't regenerate invite code.");
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm("Remove this member from the family?")) return;
    try {
      const { data } = await client.delete(`/api/family/members/${memberId}`);
      setFamily(data);
      loadFamily();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't remove member.");
    }
  };

  const promoteMember = async (memberId) => {
    try {
      const { data } = await client.post(`/api/family/members/${memberId}/promote`);
      setFamily(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't promote member.");
    }
  };

  const leaveFamily = async () => {
    if (!confirm("Leave this family account?")) return;
    try {
      await client.post("/api/family/leave");
      await refreshUser();
      setFamily(null);
      setDashboard(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't leave family.");
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(family.invite_code);
    setNotice("Invite code copied to clipboard.");
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-slate-text text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 animate-fade-in-up">
      <p className="text-xs uppercase tracking-widest text-emerald-dark/70 font-semibold mb-1">Shared account</p>
      <h1 className="font-display text-3xl text-ink mb-8">Family</h1>

      {notice && (
        <div className="mb-6 text-sm text-emerald-dark bg-emerald/10 border border-emerald/20 rounded-md px-3 py-2">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-6 text-sm text-coral bg-coral/10 border border-coral/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {!family ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-6"
          >
            <h2 className="font-display text-lg text-ink mb-2">Start a family account</h2>
            <p className="text-sm text-slate-text mb-4">
              Create a shared account and invite others to see a combined view of income and
              spending.
            </p>
            <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
              Family name
            </label>
            <input
              required
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150"
              placeholder="The Sharma Household"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              Create family
            </button>
          </form>

          <form
            onSubmit={handleJoin}
            className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-6"
          >
            <h2 className="font-display text-lg text-ink mb-2">Join with an invite code</h2>
            <p className="text-sm text-slate-text mb-4">
              Already have a code from a family member? Enter it here to join their account.
            </p>
            <label className="block text-xs uppercase tracking-wide text-slate-text/70 mb-1">
              Invite code
            </label>
            <input
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full mb-4 px-3 py-2 border border-ink/15 rounded-lg focus:border-emerald focus:ring-2 focus:ring-emerald/15 outline-none transition-all duration-150 font-mono tracking-widest"
              placeholder="A1B2C3D4"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-emerald to-emerald-dark hover:brightness-110 text-white font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              Join family
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl text-ink">{family.name}</h2>
              <button
                onClick={leaveFamily}
                className="text-xs text-coral font-medium hover:underline"
              >
                Leave family
              </button>
            </div>

            {user?.is_family_admin && (
              <div className="flex items-center gap-3 mb-5 bg-paper rounded-md px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-text/70 mb-0.5">
                    Invite code
                  </p>
                  <p className="font-mono text-lg tracking-widest text-ink">{family.invite_code}</p>
                </div>
                <button
                  onClick={copyCode}
                  className="text-xs text-emerald font-medium hover:underline ml-auto"
                >
                  Copy
                </button>
                <button
                  onClick={regenerateCode}
                  className="text-xs text-slate-text font-medium hover:underline"
                >
                  Regenerate
                </button>
              </div>
            )}

            <p className="text-xs uppercase tracking-wide text-slate-text/70 mb-2">Members</p>
            <div className="space-y-2">
              {family.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-paper"
                >
                  <div>
                    <p className="text-sm text-ink font-medium">
                      {m.full_name}
                      {m.id === user.id && <span className="text-slate-text/60 font-normal"> (you)</span>}
                    </p>
                    <p className="text-xs text-slate-text">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.is_family_admin && (
                      <span className="text-xs text-gold font-medium uppercase tracking-wide">
                        Admin
                      </span>
                    )}
                    {user?.is_family_admin && !m.is_family_admin && m.id !== user.id && (
                      <>
                        <button
                          onClick={() => promoteMember(m.id)}
                          className="text-xs text-emerald hover:underline"
                        >
                          Make admin
                        </button>
                        <button
                          onClick={() => removeMember(m.id)}
                          className="text-xs text-coral hover:underline"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {dashboard && (
            <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow duration-300 border border-ink/5 p-6">
              <h2 className="font-display text-lg text-ink mb-4">Combined this month</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-text/70 mb-1">Income</p>
                  <p className="font-mono tabular text-lg text-emerald-dark">
                    {fmt.format(dashboard.monthly_income)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-text/70 mb-1">Expenses</p>
                  <p className="font-mono tabular text-lg text-coral">
                    {fmt.format(dashboard.monthly_expenses)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-text/70 mb-1">Savings</p>
                  <p className="font-mono tabular text-lg text-ink">
                    {fmt.format(dashboard.monthly_savings)}
                  </p>
                </div>
              </div>

              <p className="text-xs uppercase tracking-wide text-slate-text/70 mb-2">By member</p>
              <div className="space-y-1">
                {dashboard.by_member.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between text-sm px-3 py-1.5">
                    <span className="text-ink">{m.full_name}</span>
                    <span className="font-mono tabular text-slate-text">
                      +{fmt.format(m.monthly_income)} / -{fmt.format(m.monthly_expenses)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
