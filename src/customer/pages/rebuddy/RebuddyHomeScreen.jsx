import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers, FaPlus, FaArrowRight, FaCalculator, FaShareAlt, FaGlobe,
  FaPlaneDeparture, FaHome, FaUmbrellaBeach, FaMusic, FaCampground, FaUtensils,
} from "react-icons/fa";
import { loadGroups, RB, formatMoney, simplifySettlements } from "./utils";

const featureCards = [
  { icon: FaCalculator, title: "Smart settle-up", body: "Our algorithm cuts your group down to the fewest possible payments." },
  { icon: FaShareAlt, title: "No sign-up needed", body: "Share a private link and your friends are in. No accounts, no friction." },
  { icon: FaGlobe, title: "Any currency, anywhere", body: "Pick INR for home or USD, EUR, JPY for that next big trip." },
];

const useCases = [
  { icon: FaPlaneDeparture, label: "Trips" },
  { icon: FaHome, label: "Flatmates" },
  { icon: FaUmbrellaBeach, label: "Vacations" },
  { icon: FaMusic, label: "Festivals" },
  { icon: FaCampground, label: "Camping" },
  { icon: FaUtensils, label: "Dinners" },
];

const steps = [
  { n: 1, title: "Create a group", body: "Name your event and add the gang. Pick a currency if you’re abroad." },
  { n: 2, title: "Share the link", body: "Send the private group link via WhatsApp, SMS or any messenger." },
  { n: 3, title: "Log expenses", body: "Anyone can record who paid, how much, and who it was for." },
  { n: 4, title: "Settle up", body: "See the cleanest set of payments to zero everyone out." },
];

const RebuddyHomeScreen = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState({});

  useEffect(() => { setGroups(loadGroups()); }, []);

  const groupList = useMemo(
    () => Object.values(groups).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [groups]
  );

  const goNew = () => navigate("/customer/app/rebuddy/new");

  return (
    <div style={{ padding: "12px 4px 32px", width: "100%" }}>
      {/* Hero */}
      <section
        style={{
          position: "relative",
          background: RB.gradient,
          borderRadius: 20,
          padding: "24px 22px",
          color: "#fff",
          overflow: "hidden",
          marginBottom: 16,
          boxShadow: "0 18px 38px -22px rgba(64, 224, 208, 0.35)",
        }}
      >
        <div
          style={{
            position: "absolute", right: -40, top: -40, width: 180, height: 180,
            borderRadius: "50%", background: "rgba(255,255,255,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute", right: 30, bottom: -50, width: 120, height: 120,
            borderRadius: "50%", background: "rgba(255,255,255,0.08)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.18)",
            fontSize: 11, fontWeight: 700, letterSpacing: 0.4, marginBottom: 10,
          }}>
            <FaUsers size={11} /> REBUDDY · GROUP EXPENSES
          </div>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 800 }}>
            Never wonder who owes whom again.
          </h1>
          <p style={{ margin: "8px 0 16px", fontSize: 14, opacity: 0.92, lineHeight: 1.5 }}>
            Split shared expenses with friends, flatmates and travel buddies — free, fast, no sign-up.
          </p>
          <button
            type="button"
            onClick={goNew}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 18px", borderRadius: 999, border: "none",
              background: "#fff", color: RB.coralDark, fontWeight: 700, fontSize: 14,
              cursor: "pointer", boxShadow: "0 8px 18px -10px rgba(0,0,0,0.4)",
            }}
          >
            <FaPlus size={12} /> Create a group
          </button>
        </div>
      </section>

      {/* My groups */}
      <section style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>Your groups</h3>
          <button
            type="button" onClick={goNew}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999, border: `1px solid ${RB.coral}`,
              background: "transparent", color: RB.coral, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            <FaPlus size={10} /> New
          </button>
        </div>
        {groupList.length === 0 ? (
          <div
            style={{
              padding: "20px 16px", borderRadius: 14,
              border: `1px dashed ${RB.borderDark}`, background: RB.cardBg,
              textAlign: "center", color: "var(--cm-muted, #A0A0A0)", fontSize: 13,
            }}
          >
            No groups yet. Tap <strong style={{ color: RB.coral }}>Create a group</strong> to get started.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {groupList.map((g) => {
              const settle = simplifySettlements(g);
              const total = (g.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
              return (
                <button
                  key={g.id} type="button"
                  onClick={() => navigate(`/customer/app/rebuddy/group/${g.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 14px", borderRadius: 14,
                    border: `1px solid ${RB.borderDark}`,
                    background: RB.cardBg, color: "inherit", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: RB.coralSoft, color: RB.coralDark,
                    display: "grid", placeItems: "center", flexShrink: 0, fontWeight: 800,
                  }}>
                    {(g.name || "G").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--cm-muted, #A0A0A0)" }}>
                      {(g.members || []).length} members · {(g.expenses || []).length} expenses · {settle.length} settle-up{settle.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{formatMoney(total, g.currency)}</div>
                    <div style={{ fontSize: 11, color: "var(--cm-muted, #A0A0A0)" }}>spent</div>
                  </div>
                  <FaArrowRight size={12} style={{ color: RB.coral }} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Features */}
      <section style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Why ReBuddy</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {featureCards.map((f) => (
            <div
              key={f.title}
              style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "14px", borderRadius: 14,
                border: `1px solid ${RB.borderDark}`, background: RB.cardBg,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: RB.coralSoft, color: RB.coralDark,
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                <f.icon size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--cm-muted, #A0A0A0)", lineHeight: 1.5 }}>{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Made for moments like</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {useCases.map((u) => (
            <span
              key={u.label}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 999,
                background: RB.coralSoft, color: RB.coralDark, fontSize: 12.5, fontWeight: 600,
              }}
            >
              <u.icon size={11} /> {u.label}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>How it works</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {steps.map((s) => (
            <div
              key={s.n}
              style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "14px", borderRadius: 14,
                border: `1px solid ${RB.borderDark}`, background: RB.cardBg,
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: RB.coral, color: "#fff",
                display: "grid", placeItems: "center", flexShrink: 0,
                fontWeight: 800, fontSize: 13,
              }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--cm-muted, #A0A0A0)", lineHeight: 1.5 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <button
        type="button" onClick={goNew}
        style={{
          width: "100%", padding: "14px 18px", borderRadius: 14, border: "none",
          background: RB.coral, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
          boxShadow: "0 12px 24px -16px rgba(0,123,255,0.45)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <FaPlus size={12} /> Create your first group
      </button>
    </div>
  );
};

export default RebuddyHomeScreen;
