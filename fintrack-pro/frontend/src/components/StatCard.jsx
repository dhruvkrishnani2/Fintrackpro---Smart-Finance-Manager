const ICONS = {
  balance: (
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1h-4.5a2.5 2.5 0 0 0 0 5H20v3a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 15.5v-8Z" />
  ),
  income: <path d="M4 15 9 9l4 4 7-8M20 8v5m0-5h-5" />,
  expenses: <path d="M4 9l5 6 4-4 7 8M20 16v-5m0 5h-5" />,
  savings: (
    <path d="M6 10.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5c0 1.4-.5 2.5-1.3 3.4.4.7.6 1.5.4 2.3-.3 1-1.2 1.6-2.2 1.6H9c-2.2 0-4-1.7-4-3.9 0-.6.1-1.1.3-1.6A4.9 4.9 0 0 1 6 10.5Z" />
  ),
  flow: <path d="M3 12h4l3-7 4 14 3-7h4" />,
};

const ACCENTS = {
  ink: {
    text: "text-ink",
    bar: "from-ink to-ink-light",
    badge: "bg-ink/[0.06] text-ink",
  },
  emerald: {
    text: "text-emerald-dark",
    bar: "from-emerald to-emerald-light",
    badge: "bg-emerald/10 text-emerald-dark",
  },
  coral: {
    text: "text-coral",
    bar: "from-coral to-coral-light",
    badge: "bg-coral/10 text-coral",
  },
  gold: {
    text: "text-gold",
    bar: "from-gold to-gold",
    badge: "bg-gold/10 text-gold",
  },
};

function iconFor(label = "") {
  const l = label.toLowerCase();
  if (l.includes("balance")) return ICONS.balance;
  if (l.includes("income")) return ICONS.income;
  if (l.includes("expense")) return ICONS.expenses;
  if (l.includes("saving")) return ICONS.savings;
  return ICONS.flow;
}

export default function StatCard({ label, value, accent = "ink", eyebrow }) {
  const a = ACCENTS[accent] ?? ACCENTS.ink;

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <div className="group relative bg-white rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 border border-ink/5 hover:-translate-y-0.5 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${a.bar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            {eyebrow && (
              <p className="text-xs uppercase tracking-widest text-slate-text/60 mb-1">{eyebrow}</p>
            )}
            <p className="text-sm text-slate-text">{label}</p>
          </div>
          <span
            className={`shrink-0 grid place-items-center w-9 h-9 rounded-lg ${a.badge} transition-transform duration-300 group-hover:scale-110`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {iconFor(label)}
            </svg>
          </span>
        </div>
        <p className={`font-mono tabular text-2xl font-semibold ${a.text}`}>{formatted}</p>
      </div>
    </div>
  );
}
