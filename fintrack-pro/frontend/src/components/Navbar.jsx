import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/analytics", label: "Analytics" },
  { to: "/transactions", label: "Transactions" },
  { to: "/budgets", label: "Budgets" },
  { to: "/goals", label: "Goals" },
  { to: "/recurring", label: "Recurring" },
  { to: "/imports", label: "Import" },
  { to: "/family", label: "Family" },
  { to: "/assistant", label: "Assistant" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const initial = user?.full_name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-10 bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/90 text-paper shadow-[0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-16px_rgba(0,0,0,0.6)]">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-10">
          <span className="flex items-center gap-2 font-display text-xl tracking-tight">
            <span className="grid place-items-center w-7 h-7 rounded-md bg-gradient-to-br from-emerald-light to-emerald text-ink text-sm font-bold font-body shadow-glow">
              F
            </span>
            FinTrack <span className="text-emerald-light">Pro</span>
          </span>
          <nav className="hidden md:flex gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `relative px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                    isActive
                      ? "text-white"
                      : "text-paper/65 hover:text-paper hover:bg-white/5"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    <span
                      className={`pointer-events-none absolute left-2 right-2 -bottom-[1px] h-[2px] rounded-full bg-gradient-to-r from-emerald-light to-gold transition-opacity duration-200 ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `text-sm px-3 py-1.5 rounded-md transition-colors duration-200 ${
                isActive ? "bg-white/10 text-white" : "text-paper/65 hover:text-paper hover:bg-white/5"
              }`
            }
          >
            Settings
          </NavLink>
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/10">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-gradient-to-br from-emerald-light/80 to-gold/70 text-ink text-xs font-bold">
              {initial}
            </span>
            <span className="text-sm text-paper/70">{user?.full_name}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-md border border-paper/20 hover:bg-paper/10 hover:border-paper/30 transition-colors duration-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
