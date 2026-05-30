import { FaArrowLeft } from "react-icons/fa";
import "./resibot.css";

/** Shared Resibot 360 theme + reusable UI pieces. Visual styling lives in
 *  resibot.css (theme-aware via --rb-* tokens); these tokens are exposed for
 *  the few inline-styled spots in the screens so everything adapts to light
 *  and dark themes. */
export const RB = {
  brand: "#E11D48",
  brandSoft: "var(--rb-brand-soft)",
  brandDark: "#9F1239",
  gradient: "var(--rb-grad)",
  border: "var(--rb-border)",
  cardBg: "var(--rb-surface)",
  surface2: "var(--rb-surface-2)",
  muted: "var(--rb-muted)",
};

export const STATUS_COLORS = {
  ACTIVE: { bg: "rgba(37,99,235,0.14)", fg: "#2563EB" },
  SNOOZED: { bg: "rgba(180,83,9,0.14)", fg: "#B45309" },
  OVERDUE: { bg: "rgba(220,38,38,0.14)", fg: "#DC2626" },
  PAID: { bg: "rgba(22,163,74,0.14)", fg: "#16A34A" },
  COMPLETED: { bg: "rgba(22,163,74,0.14)", fg: "#16A34A" },
  CANCELLED: { bg: "rgba(120,120,120,0.16)", fg: "#888" },
};

export const ResibotHeader = ({ title, subtitle, onBack, right }) => (
  <div className="rb-header">
    {onBack && (
      <button type="button" className="rb-back" onClick={onBack} aria-label="Back">
        <FaArrowLeft size={14} />
      </button>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1 className="rb-title">{title}</h1>
      {subtitle && <div className="rb-subtitle">{subtitle}</div>}
    </div>
    {right}
  </div>
);

export const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
    <div className="md-spinner" />
  </div>
);

export const StatusChip = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.ACTIVE;
  return (
    <span className="rb-chip" style={{ background: c.bg, color: c.fg }}>
      {status || "ACTIVE"}
    </span>
  );
};

export const Card = ({ children, style, onClick }) => (
  <div className={`rb-card${onClick ? " rb-card--tap" : ""}`} onClick={onClick} style={style}>
    {children}
  </div>
);

export const PrimaryButton = ({ children, onClick, type = "button", disabled, style }) => (
  <button type={type} className="rb-btn" onClick={onClick} disabled={disabled} style={style}>
    {children}
  </button>
);

export const Field = ({ label, children }) => (
  <label className="rb-field">
    <span className="rb-label">{label}</span>
    {children}
  </label>
);

export const TextInput = ({ className = "", ...props }) => (
  <input className={`rb-input ${className}`} {...props} />
);
export const Select = ({ children, className = "", ...props }) => (
  <select className={`rb-select ${className}`} {...props}>{children}</select>
);
export const TextArea = ({ className = "", ...props }) => (
  <textarea className={`rb-textarea ${className}`} {...props} />
);

export const EmptyState = ({ children }) => <div className="rb-empty">{children}</div>;

export const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
};

export const daysUntil = (d) => {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

export const dueLabel = (d) => {
  const n = daysUntil(d);
  if (n === null) return "";
  if (n < 0) return `Overdue by ${Math.abs(n)} day(s)`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due in ${n} days`;
};
