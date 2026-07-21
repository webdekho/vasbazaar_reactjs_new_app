import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeartbeat, FaPlus, FaUsers, FaChevronRight, FaTint, FaWeight, FaBoxOpen, FaWallet, FaBell } from "react-icons/fa";
import { App as CapApp } from "@capacitor/app";
import { resibotService, getResibotModule } from "../../services/resibotService";
import { useCustomerModern } from "../../context/CustomerModernContext";
import { useToast } from "../../context/ToastContext";
import { computeDueAlerts, syncResibotNotifications, registerResibotTapHandler, checkDueResibotRemindersNow } from "../../services/resibotNotifier";
import { RB, Spinner, Card, EmptyState, StatusChip, dueLabel } from "./resibotUi";
import { formatDisplayDate } from "../../../utils/dateFormat";

const ResibotDashboardScreen = () => {
  const navigate = useNavigate();
  const { userData } = useCustomerModern();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState({ countsByModule: {}, upcoming: [], overdue: 0, totalActive: 0 });
  const [health, setHealth] = useState(null);
  const [activeOrders, setActiveOrders] = useState(0);
  const [expense, setExpense] = useState(null);
  const [dueAlerts, setDueAlerts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, h, o, ex] = await Promise.all([
        resibotService.getDashboard(),
        resibotService.getHealthSummary(),
        resibotService.listOrders("active"),
        resibotService.getExpenseSummary(),
      ]);
      if (cancelled) return;
      if (d?.success && d.data) setDash(d.data);
      if (h?.success && h.data) setHealth(h.data);
      if (o?.success && Array.isArray(o.data)) setActiveOrders(o.data.length);
      if (ex?.success && ex.data) setExpense(ex.data);
      setLoading(false);

      // ---- In-app reminder engine (fires from internal data) ----
      const reminders = d?.data?.upcoming || [];
      setDueAlerts(computeDueAlerts(reminders));
      // Pop in-app toast / web notification for anything due right now.
      checkDueResibotRemindersNow({ showToast, reminders });
      // Schedule device heads-up notifications (native; fires even when closed).
      syncResibotNotifications();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate whenever the app returns to the foreground.
  useEffect(() => {
    let sub;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) { checkDueResibotRemindersNow({ showToast }); syncResibotNotifications(); }
    }).then((s) => { sub = s; }).catch(() => {});
    const cleanupTap = registerResibotTapHandler(navigate);
    return () => { if (sub?.remove) sub.remove(); cleanupTap(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spinner />;

  const greeting = (() => {
    const hr = new Date().getHours();
    const part = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : "Good Evening";
    return `${part}, ${userData?.firstName || userData?.name || "there"}`;
  })();

  const upcoming = dash.upcoming || [];

  return (
    <div className="rb-page">
      {/* Hero */}
      <section style={{
        background: RB.gradient, borderRadius: 20, padding: "22px 20px", color: "#fff",
        marginBottom: 16, boxShadow: "0 18px 38px -22px rgba(225,29,72,0.5)",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.18)", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, marginBottom: 10 }}>
          <FaHeartbeat size={11} /> RESIBOT 360
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{greeting}</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, opacity: 0.92 }}>
          Never miss a payment, renewal, service or delivery again.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{dash.totalActive || 0}</div>
            <div style={{ fontSize: 11.5, opacity: 0.9 }}>Active reminders</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{dash.overdue || 0}</div>
            <div style={{ fontSize: 11.5, opacity: 0.9 }}>Overdue</div>
          </div>
        </div>
      </section>

      {/* Due-now alerts (fired from internal reminder data) */}
      {dueAlerts.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <Card style={{ borderColor: "rgba(220,38,38,0.35)", background: "rgba(220,38,38,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(220,38,38,0.14)", color: "#DC2626", display: "grid", placeItems: "center" }}>
                <FaBell size={13} />
              </span>
              <strong style={{ fontSize: 14.5 }}>
                {dueAlerts.length} reminder{dueAlerts.length > 1 ? "s" : ""} need attention
              </strong>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {dueAlerts.slice(0, 6).map((a) => (
                <button key={a.reminder.id} type="button"
                  onClick={() => navigate(`/customer/app/resibot/reminder/${a.reminder.id}`)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1px solid ${RB.border}`, background: RB.cardBg, color: "inherit", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.reminder.title || a.reminder.category || a.reminder.module}
                    </div>
                    <div style={{ fontSize: 12, color: a.daysLeft < 0 ? "#DC2626" : RB.muted }}>
                      {dueLabel(a.reminder.dueDate)}
                    </div>
                  </div>
                  <FaChevronRight size={12} style={{ color: RB.muted, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Quick sections: Reminders · Health · Tracking */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>Quick access</h3>
          <button type="button" onClick={() => navigate("/customer/app/resibot/reminder/new")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid ${RB.brand}`, background: "transparent", color: RB.brand, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <FaPlus size={10} /> New
          </button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {/* Reminders */}
          <Card onClick={() => navigate("/customer/app/resibot/reminders")} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: RB.brandSoft, color: RB.brand, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <FaBell size={18} />
            </span>
            <div style={{ flex: 1, display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{dash.totalActive || 0}</div>
                <div style={{ fontSize: 11, color: RB.muted }}><FaBell size={9} /> Active</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: dash.overdue ? "#DC2626" : undefined }}>{dash.overdue || 0}</div>
                <div style={{ fontSize: 11, color: RB.muted }}>Overdue</div>
              </div>
            </div>
            <FaChevronRight size={13} style={{ color: RB.muted }} />
          </Card>

          {/* Health */}
          <Card onClick={() => navigate("/customer/app/resibot/health")} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: RB.brandSoft, color: RB.brand, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <FaHeartbeat size={18} />
            </span>
            <div style={{ flex: 1, display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{health?.bmi ?? "—"}</div>
                <div style={{ fontSize: 11, color: RB.muted }}><FaWeight size={9} /> BMI</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  {health?.waterConsumedMl ?? 0}{health?.waterTargetMl ? `/${health.waterTargetMl}` : ""} ml
                </div>
                <div style={{ fontSize: 11, color: RB.muted }}><FaTint size={9} /> Water today</div>
              </div>
            </div>
            <FaChevronRight size={13} style={{ color: RB.muted }} />
          </Card>

          {/* Tracking */}
          <Card onClick={() => navigate("/customer/app/resibot/orders")} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "#DDEBFF", color: "#2563EB", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <FaBoxOpen size={18} />
            </span>
            <div style={{ flex: 1, display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{activeOrders}</div>
                <div style={{ fontSize: 11, color: RB.muted }}><FaBoxOpen size={9} /> Orders</div>
              </div>
              <div onClick={(e) => { e.stopPropagation(); navigate("/customer/app/resibot/expenses"); }} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>₹{Number(expense?.currentMonthTotal || 0).toLocaleString("en-IN")}</div>
                <div style={{ fontSize: 11, color: RB.muted }}><FaWallet size={9} /> This month</div>
              </div>
            </div>
            <FaChevronRight size={13} style={{ color: RB.muted }} />
          </Card>
        </div>
      </section>

      {/* Upcoming */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Upcoming</h3>
        {upcoming.length === 0 ? (
          <EmptyState>No upcoming reminders. Tap <strong style={{ color: RB.brand }}>New</strong> to add one.</EmptyState>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {upcoming.slice(0, 12).map((r) => {
              const m = getResibotModule(r.module);
              return (
                <Card key={r.id} onClick={() => navigate(`/customer/app/resibot/reminder/${r.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: m?.accentColor || RB.brandSoft, color: m?.highlightColor || RB.brand, display: "grid", placeItems: "center", flexShrink: 0, fontWeight: 800, fontSize: 12 }}>
                    {(r.category || m?.label || "?").slice(0, 2).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.title || r.category || m?.label}
                    </div>
                    <div style={{ fontSize: 12, color: RB.muted }}>
                      {formatDisplayDate(r.dueDate, "—")} · {dueLabel(r.dueDate)}
                    </div>
                  </div>
                  <StatusChip status={r.status} />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer actions */}
      <button type="button" onClick={() => navigate("/customer/app/resibot/members")}
        style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: `1px solid ${RB.border}`, background: RB.cardBg, color: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <FaUsers size={13} /> Manage family members
      </button>
    </div>
  );
};

export default ResibotDashboardScreen;
