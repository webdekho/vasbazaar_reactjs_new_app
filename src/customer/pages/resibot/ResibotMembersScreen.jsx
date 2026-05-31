import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaEdit, FaTrash, FaUser } from "react-icons/fa";
import { resibotService } from "../../services/resibotService";
import { RB, ResibotHeader, Spinner, Card, Field, TextInput, Select, PrimaryButton, EmptyState, fmtDate } from "./resibotUi";

const empty = { id: null, name: "", relation: "", mobileNumber: "", dob: "", gender: "" };

const ResibotMembersScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const res = await resibotService.listMembers();
    setMembers(res?.success && Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setForm(empty); setShowForm(true); };
  const openEdit = (m) => {
    setForm({ id: m.id, name: m.name || "", relation: m.relation || "", mobileNumber: m.mobileNumber || "", dob: m.dob || "", gender: m.gender || "" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(), relation: form.relation || null,
      mobileNumber: form.mobileNumber ? form.mobileNumber.trim() : null,
      dob: form.dob || null, gender: form.gender || null,
    };
    if (form.id) {
      payload.id = form.id;
      await resibotService.updateMember(payload);
    } else {
      await resibotService.addMember(payload);
    }
    setShowForm(false);
    setForm(empty);
    await load();
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this member? Their reminders/health stay but get unlinked.")) return;
    await resibotService.deleteMember(id);
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="rb-page">
      <ResibotHeader
        title="Family members"
        subtitle={`${members.length} member(s)`}
        onBack={() => navigate("/customer/app/resibot")}
        right={
          <button type="button" onClick={openNew}
            style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: RB.brand, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <FaPlus size={14} />
          </button>
        }
      />

      {showForm && (
        <Card style={{ marginBottom: 18 }}>
          <Field label="Name"><TextInput value={form.name} onChange={set("name")} placeholder="Member name" /></Field>
          <Field label="Mobile number (their VasBazaar number to share reminders)">
            <TextInput type="tel" inputMode="numeric" value={form.mobileNumber} onChange={set("mobileNumber")} placeholder="e.g. 9876543210" />
          </Field>
          <div style={{ fontSize: 11.5, color: RB.muted, margin: "-6px 0 14px", lineHeight: 1.5 }}>
            If this number belongs to a VasBazaar user, reminders you assign to this member will automatically appear in their app too — no action needed from them.
          </div>
          <Field label="Relation">
            <Select value={form.relation} onChange={set("relation")}>
              <option value="">Select</option>
              {["Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister", "Other"].map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date of birth"><TextInput type="date" value={form.dob} onChange={set("dob")} /></Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={set("gender")}>
                <option value="">Select</option><option value="Male">Male</option>
                <option value="Female">Female</option><option value="Other">Other</option>
              </Select>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving…" : form.id ? "Update" : "Add member"}</PrimaryButton>
            <button type="button" onClick={() => { setShowForm(false); setForm(empty); }}
              style={{ padding: "13px 18px", borderRadius: 12, border: `1px solid ${RB.border}`, background: "transparent", color: "inherit", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </Card>
      )}

      {members.length === 0 ? (
        <EmptyState>No family members yet. Tap + to add one — you can attach reminders and health records to them.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {members.map((m) => (
            <Card key={m.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: RB.brandSoft, color: RB.brand, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <FaUser size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{m.name}</div>
                <div style={{ fontSize: 12.5, color: RB.muted }}>
                  {[m.relation, m.mobileNumber, m.dob ? fmtDate(m.dob) : null].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <button type="button" onClick={() => openEdit(m)} aria-label="Edit"
                style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid #2563EB`, background: "transparent", color: "#2563EB", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <FaEdit size={12} />
              </button>
              <button type="button" onClick={() => remove(m.id)} aria-label="Delete"
                style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid #DC2626`, background: "transparent", color: "#DC2626", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <FaTrash size={12} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResibotMembersScreen;
