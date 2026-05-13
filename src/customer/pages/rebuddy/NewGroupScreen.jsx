import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaPlus, FaArrowLeft, FaUserPlus } from "react-icons/fa";
import { CURRENCIES, RB, newId, upsertGroup } from "./utils";

const NewGroupScreen = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [currency, setCurrency] = useState("INR");
  const [error, setError] = useState("");

  const addMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("That member is already added.");
      return;
    }
    setMembers((prev) => [...prev, { id: newId("m"), name: trimmed }]);
    setMemberInput("");
    setError("");
  };

  const removeMember = (id) =>
    setMembers((prev) => prev.filter((m) => m.id !== id));

  const handleKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addMember();
    }
  };

  const create = () => {
    if (!name.trim()) { setError("Please give your group a name."); return; }
    if (members.length < 2) { setError("Add at least 2 members to split with."); return; }
    const id = newId("g");
    upsertGroup({
      id, name: name.trim(), currency,
      members, expenses: [], createdAt: Date.now(),
    });
    navigate(`/customer/app/rebuddy/group/${id}`, { replace: true });
  };

  const inputBase = {
    width: "100%", padding: "12px 14px", borderRadius: 12,
    border: `1px solid ${RB.borderDark}`, background: RB.surface,
    color: "inherit", fontSize: 14, outline: "none",
  };

  return (
    <div style={{ padding: "12px 4px 32px", width: "100%" }}>
      <button
        type="button" onClick={() => navigate(-1)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", color: "inherit",
          fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
        }}
      >
        <FaArrowLeft size={11} /> Back
      </button>

      <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800 }}>Create a group</h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--cm-muted, #A0A0A0)" }}>
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

      {/* Members */}
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        Members
      </label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="text" value={memberInput}
          onChange={(e) => setMemberInput(e.target.value)} onKeyDown={handleKey}
          placeholder="Add a name (e.g. Riya)" style={{ ...inputBase, flex: 1 }}
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
            {m.name}
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
        type="button" onClick={create}
        style={{
          width: "100%", padding: "14px 18px", borderRadius: 14, border: "none",
          background: RB.coral, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
          boxShadow: "0 12px 24px -16px rgba(0,123,255,0.45)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <FaPlus size={12} /> Create group
      </button>
    </div>
  );
};

export default NewGroupScreen;
