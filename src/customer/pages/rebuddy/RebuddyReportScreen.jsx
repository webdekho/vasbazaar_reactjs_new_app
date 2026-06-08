import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChartPie } from "react-icons/fa";
import { RB, formatMoney, buildBalanceReport } from "./utils";
import { rebuddyService } from "../../services/rebuddyService";

const GREEN = "#22C55E";
const RED = "#EF4444";

const RebuddyReportScreen = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [member, setMember] = useState("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await rebuddyService.getMyGroups();
      if (!alive) return;
      setGroups(res.success && Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // Distinct categories present across all groups.
  const categories = useMemo(() => {
    const set = new Set();
    groups.forEach((g) => { if (g.category && g.category.trim()) set.add(g.category.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [groups]);

  // Groups after the category filter.
  const catGroups = useMemo(
    () => (category === "all"
      ? groups
      : groups.filter((g) => (g.category || "").trim().toLowerCase() === category.toLowerCase())),
    [groups, category]
  );

  // Full report for the category-filtered groups.
  const report = useMemo(() => buildBalanceReport(catGroups), [catGroups]);

  // Member dropdown options = everyone you have a balance with (across currencies).
  const memberOptions = useMemo(() => {
    const byMobile = {};
    Object.values(report).forEach((bucket) => {
      Object.values(bucket.people).forEach((p) => {
        const key = p.mobile || p.name;
        byMobile[key] = { value: key, name: p.name, mobile: p.mobile };
      });
    });
    return Object.values(byMobile).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [report]);

  // Apply the member filter to produce the view (per currency).
  const view = useMemo(() => {
    return Object.entries(report).map(([currency, bucket]) => {
      let people = Object.values(bucket.people);
      if (member !== "all") people = people.filter((p) => (p.mobile || p.name) === member);
      let owed = 0, owe = 0;
      people.forEach((p) => { if (p.net > 0.009) owed += p.net; else if (p.net < -0.009) owe += -p.net; });
      owed = Math.round(owed * 100) / 100;
      owe = Math.round(owe * 100) / 100;
      return {
        currency, owed, owe, net: Math.round((owed - owe) * 100) / 100,
        people: people.filter((p) => Math.abs(p.net) > 0.009).sort((a, b) => b.net - a.net),
      };
    }).filter((b) => b.people.length > 0);
  }, [report, member]);

  const chipStyle = (active) => ({
    padding: "6px 12px", borderRadius: 999, border: "none",
    background: active ? RB.coral : "transparent",
    color: active ? "#fff" : "var(--cm-muted, #A0A0A0)",
    outline: active ? "none" : `1px solid ${RB.borderDark}`,
    fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  });

  return (
    <div style={{ padding: "12px 4px 32px", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button
          type="button" onClick={() => navigate("/customer/app/rebuddy")} aria-label="Back"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: "transparent", border: `1px solid ${RB.borderDark}`,
            color: "inherit", cursor: "pointer", padding: 0,
          }}
        >
          <FaArrowLeft size={13} />
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Balance report</h1>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--cm-muted, #A0A0A0)" }}>
        What you owe and what you’re owed across all your groups.
      </p>

      {/* Filters */}
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Category</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={() => setCategory("all")} style={chipStyle(category === "all")}>All</button>
        {categories.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} style={chipStyle(category === c)}>{c}</button>
        ))}
      </div>

      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Member</label>
      <select
        value={member} onChange={(e) => setMember(e.target.value)}
        style={{
          width: "100%", padding: "11px 14px", borderRadius: 12, marginBottom: 18,
          border: `1px solid ${RB.borderDark}`, background: RB.surface,
          color: "inherit", fontSize: 14, outline: "none", appearance: "none",
        }}
      >
        <option value="all">All members</option>
        {memberOptions.map((m) => (
          <option key={m.value} value={m.value}>{m.name}{m.mobile ? ` · ${m.mobile}` : ""}</option>
        ))}
      </select>

      {/* Body */}
      {loading ? (
        <Empty>Loading your report…</Empty>
      ) : view.length === 0 ? (
        <Empty>Nothing to settle for this filter. You’re all square. 🎉</Empty>
      ) : (
        view.map((b) => (
          <section key={b.currency} style={{ marginBottom: 18 }}>
            {/* Summary card */}
            <div
              style={{
                background: RB.gradient, borderRadius: 18, padding: "16px 18px",
                color: "#fff", marginBottom: 12,
                boxShadow: "0 18px 38px -22px rgba(64, 224, 208, 0.35)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, opacity: 0.9 }}>
                <FaChartPie size={11} /> NET POSITION {Object.keys(report).length > 1 ? `· ${b.currency}` : ""}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>You’re owed</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>+{formatMoney(b.owed, b.currency)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>You owe</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>−{formatMoney(b.owe, b.currency)}</div>
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Net {b.net >= 0 ? "(in your favour)" : "(you owe)"}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {b.net > 0 ? "+" : b.net < 0 ? "−" : ""}{formatMoney(Math.abs(b.net), b.currency)}
                </div>
              </div>
            </div>

            {/* Per-person breakdown */}
            <div style={{ display: "grid", gap: 8 }}>
              {b.people.map((p) => {
                const owedToYou = p.net > 0;
                const color = owedToYou ? GREEN : RED;
                return (
                  <div
                    key={(p.mobile || p.name) + b.currency}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 14px", borderRadius: 12,
                      background: RB.cardBg, border: `1px solid ${RB.borderDark}`,
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: RB.coralSoft, color: RB.coralDark,
                      display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, flexShrink: 0,
                    }}>
                      {(p.name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name || "Member"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--cm-muted, #A0A0A0)" }}>
                        {owedToYou ? "owes you" : "you owe"}{p.mobile ? ` · ${p.mobile}` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color }}>
                      {owedToYou ? "+" : "−"}{formatMoney(Math.abs(p.net), b.currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

const Empty = ({ children }) => (
  <div
    style={{
      padding: "20px 16px", borderRadius: 14,
      border: `1px dashed ${RB.borderDark}`, background: RB.cardBg,
      textAlign: "center", color: "var(--cm-muted, #A0A0A0)", fontSize: 13,
    }}
  >
    {children}
  </div>
);

export default RebuddyReportScreen;
