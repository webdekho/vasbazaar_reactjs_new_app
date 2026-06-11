import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaPlus, FaArrowLeft, FaUserPlus, FaAddressBook } from "react-icons/fa";
import { CURRENCIES, CATEGORIES, RB, newId, getCurrentUser } from "./utils";
import { pickContacts, normalizeMobile, isValidMobile, isUserCancelledError } from "./contacts";
import { rebuddyService } from "../../services/rebuddyService";

const NewGroupScreen = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [mobileInput, setMobileInput] = useState("");
  const [memberExpenseApprovalRequired, setMemberExpenseApprovalRequired] = useState(true);
  // Auto-add the creator so they're always part of their own group.
  const [members, setMembers] = useState(() => {
    const me = getCurrentUser();
    return me ? [me] : [];
  });
  const [currency, setCurrency] = useState("INR");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const addMember = () => {
    const trimmed = memberInput.trim();
    const mobile = normalizeMobile(mobileInput);
    if (!trimmed) { setError("Enter the member's name."); return; }
    if (!isValidMobile(mobile)) { setError("Enter a valid 10-digit mobile number."); return; }
    if (members.some((m) => m.mobile === mobile)) {
      setError("That mobile number is already added.");
      return;
    }
    setMembers((prev) => [...prev, {
      id: newId("m"),
      name: trimmed,
      mobile,
      expenseApprovalRequired: memberExpenseApprovalRequired,
    }]);
    setMemberInput("");
    setMobileInput("");
    setMemberExpenseApprovalRequired(true);
    setError("");
  };

  const addFromContacts = async () => {
    try {
      const picked = await pickContacts();
      if (!picked.length) return;
      setMembers((prev) => {
        const have = new Set(prev.map((m) => m.mobile));
        const fresh = picked
          .filter((c) => !have.has(c.mobile))
          .map((c) => ({ id: newId("m"), name: c.name, mobile: c.mobile, expenseApprovalRequired: true }));
        return [...prev, ...fresh];
      });
      setError("");
    } catch (err) {
      if (isUserCancelledError(err)) return;
      if (err?.code === "permission_denied") setError("Contacts permission is required.");
      else if (err?.code === "unsupported") setError("Contact picker is available in the VasBazaar app or supported browsers.");
      else setError("Could not open contacts. Please try again.");
    }
  };

  const removeMember = (id) =>
    setMembers((prev) => prev.filter((m) => m.isSelf || m.id !== id));

  const handleKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addMember();
    }
  };

  const create = async () => {
    if (!name.trim()) { setError("Please give your group a name."); return; }
    if (members.length < 2) { setError("Add at least 2 members to split with."); return; }
    setSaving(true);
    setError("");
    const id = newId("g");
    const res = await rebuddyService.saveGroup({
      id, name: name.trim(), currency, category: category.trim(),
      members, expenses: [], createdAt: Date.now(),
    });
    setSaving(false);
    if (!res.success) {
      setError(res.message || "Could not create the group. Please try again.");
      return;
    }
    navigate(`/customer/app/rebuddy/group/${res.data?.id || id}`, { replace: true });
  };

  const inputBase = {
    width: "100%", padding: "12px 14px", borderRadius: 12,
    border: `1px solid ${RB.borderDark}`, background: RB.surface,
    color: "inherit", fontSize: 14, outline: "none",
  };

  return (
    <div style={{ padding: "12px 4px 32px", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button
          type="button" onClick={() => navigate(-1)} aria-label="Back"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: "transparent", border: `1px solid ${RB.borderDark}`,
            color: "inherit", cursor: "pointer", padding: 0,
          }}
        >
          <FaArrowLeft size={13} />
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Create a group</h1>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--cm-muted, #A0A0A0)" }}>
        Add the people you’re splitting with. You can add more later.
      </p>

      {/* Group name */}
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        Group name
      </label>
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Trip to Goa" style={{ ...inputBase, marginBottom: 18 }}
      />

      {/* Category */}
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        Category
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {CATEGORIES.map((c) => {
          const active = category.trim().toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c} type="button" onClick={() => setCategory(c)}
              style={{
                padding: "6px 12px", borderRadius: 999, border: "none",
                background: active ? RB.coral : "transparent",
                color: active ? "#fff" : "var(--cm-muted, #A0A0A0)",
                outline: active ? "none" : `1px solid ${RB.borderDark}`,
                fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>
      <input
        type="text" value={category} onChange={(e) => setCategory(e.target.value)}
        placeholder="Or type your own category (optional)" style={{ ...inputBase, marginBottom: 18 }}
      />

      {/* Members */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12.5, fontWeight: 700 }}>Members</label>
        <button
          type="button" onClick={addFromContacts}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", color: RB.coral,
            fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0,
          }}
        >
          <FaAddressBook size={12} /> From contacts
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="text" value={memberInput}
          onChange={(e) => setMemberInput(e.target.value)}
          placeholder="Name (e.g. Riya)" style={{ ...inputBase, flex: 1 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="tel" inputMode="numeric" value={mobileInput}
          onChange={(e) => setMobileInput(e.target.value)} onKeyDown={handleKey}
          placeholder="Mobile number" maxLength={10} style={{ ...inputBase, flex: 1 }}
        />
        <button
          type="button" onClick={addMember}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "0 16px", borderRadius: 12, border: "none",
            background: RB.coral, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}
        >
          <FaUserPlus size={12} /> Add
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[
          { value: false, label: "Flexible Addition" },
          { value: true, label: "Admin Approval Addition" },
        ].map((opt) => {
          const active = memberExpenseApprovalRequired === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => setMemberExpenseApprovalRequired(opt.value)}
              style={{
                padding: "7px 12px", borderRadius: 999,
                border: `1px solid ${active ? RB.coral : RB.borderDark}`,
                background: active ? RB.coralSoft : "transparent",
                color: active ? RB.coralDark : "var(--cm-muted, #A0A0A0)",
                fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18, minHeight: 24 }}>
        {members.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--cm-muted, #A0A0A0)" }}>
            Add at least 2 members.
          </span>
        ) : members.map((m) => (
          <span
            key={m.id}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999,
              background: RB.coralSoft, color: RB.coralDark, fontSize: 12.5, fontWeight: 600,
            }}
          >
            {m.name}{m.isSelf ? " (You)" : ""}
            {m.mobile ? <span style={{ opacity: 0.7, fontWeight: 500 }}>· {m.mobile}</span> : null}
            {!m.isSelf && m.expenseApprovalRequired ? <span style={{ opacity: 0.75 }}>· approval</span> : null}
            {!m.isSelf && (
              <button
                type="button" onClick={() => removeMember(m.id)}
                aria-label={`Remove ${m.name}`}
                style={{
                  background: "transparent", border: "none", color: RB.coralDark,
                  cursor: "pointer", padding: 0, display: "grid", placeItems: "center",
                }}
              >
                <FaTimes size={10} />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Currency */}
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        Currency
      </label>
      <select
        value={currency} onChange={(e) => setCurrency(e.target.value)}
        style={{ ...inputBase, marginBottom: 22, appearance: "none" }}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>
        ))}
      </select>

      {error && (
        <div style={{
          padding: "10px 12px", borderRadius: 10, marginBottom: 14,
          background: "rgba(255,60,60,0.12)", color: "#ff6b6b", fontSize: 12.5, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <button
        type="button" onClick={create} disabled={saving}
        style={{
          width: "100%", padding: "14px 18px", borderRadius: 14, border: "none",
          background: RB.coral, color: "#fff", fontWeight: 700, fontSize: 15,
          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
          boxShadow: "0 12px 24px -16px rgba(0,123,255,0.45)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <FaPlus size={12} /> {saving ? "Creating…" : "Create group"}
      </button>
    </div>
  );
};

export default NewGroupScreen;
