import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FaPlus, FaListUl } from "react-icons/fa";
import {
  resibotService, RESIBOT_MODULES, RESIBOT_REPEAT_OPTIONS, getResibotModule,
} from "../../services/resibotService";
import {
  ResibotHeader, Spinner, Card, Field, TextInput, Select, TextArea, PrimaryButton,
} from "./resibotUi";

// Keep raw SQL / stack-trace style messages out of the UI.
const friendlyError = (msg) => {
  if (!msg) return "Could not save reminder. Please try again.";
  if (msg.length > 140 || /could not execute|SQL \[|Table '|insert into|Exception/i.test(msg)) {
    return "Could not save right now. Please try again in a moment.";
  }
  return msg;
};

const emptyForm = (module) => ({
  module: module || "BILL",
  category: "",
  title: "",
  providerName: "",
  accountIdentifier: "",
  amount: "",
  dueDate: "",
  lastActionDate: "",
  repeatFrequency: "NONE",
  repeatIntervalDays: "",
  alertOffsetsDays: "",
  paymentMethod: "",
  memberId: "",
  notes: "",
});

const ResibotReminderFormScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState([]);
  const [options, setOptions] = useState({ modules: [], categoriesByModule: {} });
  const [customModule, setCustomModule] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", mobileNumber: "" });
  const [memberSaving, setMemberSaving] = useState(false);
  const [form, setForm] = useState(emptyForm(params.get("module") || "BILL"));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mRes, oRes] = await Promise.all([
        resibotService.listMembers(),
        resibotService.getReminderOptions(),
      ]);
      if (!cancelled && mRes?.success && Array.isArray(mRes.data)) setMembers(mRes.data);
      if (!cancelled && oRes?.success && oRes.data) {
        setOptions({
          modules: Array.isArray(oRes.data.modules) ? oRes.data.modules : [],
          categoriesByModule: oRes.data.categoriesByModule || {},
        });
      }

      if (isEdit) {
        const res = await resibotService.getReminder(id);
        if (!cancelled && res?.success && res.data) {
          const r = res.data;
          setForm({
            module: r.module || "BILL",
            category: r.category || "",
            title: r.title || "",
            providerName: r.providerName || "",
            accountIdentifier: r.accountIdentifier || "",
            amount: r.amount ?? "",
            dueDate: r.dueDate || "",
            lastActionDate: r.lastActionDate || "",
            repeatFrequency: r.repeatFrequency || "NONE",
            repeatIntervalDays: r.repeatIntervalDays ?? "",
            alertOffsetsDays: r.alertOffsetsDays || "",
            paymentMethod: r.paymentMethod || "",
            memberId: r.memberId?.id || "",
            notes: r.notes || "",
          });
        }
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const meta = getResibotModule(form.module);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Merge user's previously-used custom values into the dropdowns.
  const customModules = (options.modules || []).filter((m) => !RESIBOT_MODULES.some((x) => x.key === m));
  const builtinCats = meta?.categories || [];
  const customCats = (options.categoriesByModule?.[form.module] || []).filter((c) => !builtinCats.includes(c));

  const saveNewMember = async () => {
    if (!newMember.name.trim()) return;
    setMemberSaving(true);
    const res = await resibotService.addMember({
      name: newMember.name.trim(),
      mobileNumber: newMember.mobileNumber ? newMember.mobileNumber.trim() : null,
    });
    setMemberSaving(false);
    if (res?.success && res.data?.id) {
      const list = await resibotService.listMembers();
      if (list?.success && Array.isArray(list.data)) setMembers(list.data);
      setForm((f) => ({ ...f, memberId: res.data.id }));
      setShowAddMember(false);
      setNewMember({ name: "", mobileNumber: "" });
    }
  };

  const selectedMember = members.find((m) => String(m.id) === String(form.memberId));

  const handleSave = async () => {
    setError("");
    if (!form.module) { setError("Please select a module."); return; }
    if (!form.dueDate) { setError("Please select a due / renewal date."); return; }

    setSaving(true);
    const payload = {
      module: form.module,
      category: form.category || null,
      title: form.title || null,
      providerName: form.providerName || null,
      accountIdentifier: form.accountIdentifier || null,
      amount: form.amount === "" ? null : Number(form.amount),
      dueDate: form.dueDate,
      lastActionDate: form.lastActionDate || null,
      repeatFrequency: form.repeatFrequency,
      repeatIntervalDays: form.repeatFrequency === "CUSTOM_DAYS" && form.repeatIntervalDays !== ""
        ? Number(form.repeatIntervalDays) : null,
      alertOffsetsDays: form.alertOffsetsDays || null,
      paymentMethod: form.paymentMethod || null,
      redirectSlug: meta?.redirectSlug || null,
      notes: form.notes || null,
      memberId: form.memberId ? { id: Number(form.memberId) } : null,
    };
    if (isEdit) payload.id = Number(id);

    const res = isEdit
      ? await resibotService.updateReminder(payload)
      : await resibotService.createReminder(payload);
    setSaving(false);

    if (res?.success) {
      navigate(`/customer/app/resibot/reminders/${form.module}`);
    } else {
      setError(friendlyError(res?.message));
    }
  };

  if (loading) return <Spinner />;

  const dueLabelText = form.module === "WARRANTY" || form.module === "INSURANCE"
    ? "Expiry date"
    : form.module === "SERVICE" ? "Next service date"
    : form.module === "FAMILY" ? "Event date" : "Due / Renewal date";

  return (
    <div className="rb-page">
      <ResibotHeader
        title={isEdit ? "Edit reminder" : "New reminder"}
        subtitle={meta?.label}
        onBack={() => navigate(-1)}
      />

      {error && <div className="rb-error">{error}</div>}

      {/* Details */}
      <Card style={{ marginBottom: 14 }}>
        <div className="rb-field">
          <div className="rb-field-head">
            <span className="rb-label">Module</span>
            {!isEdit && (
              <button type="button" className="rb-add-btn" onClick={() => setCustomModule((v) => !v)}>
                {customModule ? <><FaListUl size={9} /> List</> : <><FaPlus size={9} /> Custom</>}
              </button>
            )}
          </div>
          {customModule && !isEdit ? (
            <TextInput
              value={form.module}
              onChange={(e) => setForm((f) => ({ ...f, module: e.target.value.toUpperCase() }))}
              placeholder="e.g. PET, VEHICLE, RENT"
            />
          ) : (
            <Select value={form.module} onChange={set("module")} disabled={isEdit}>
              {RESIBOT_MODULES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              {customModules.map((m) => <option key={m} value={m}>{m}</option>)}
              {form.module && !RESIBOT_MODULES.some((m) => m.key === form.module) && !customModules.includes(form.module) && (
                <option value={form.module}>{form.module}</option>
              )}
            </Select>
          )}
        </div>

        <div className="rb-field">
          <div className="rb-field-head">
            <span className="rb-label">Category</span>
            <button type="button" className="rb-add-btn" onClick={() => setCustomCategory((v) => !v)}>
              {customCategory ? <><FaListUl size={9} /> List</> : <><FaPlus size={9} /> Custom</>}
            </button>
          </div>
          {customCategory ? (
            <TextInput value={form.category} onChange={set("category")} placeholder="Type your own category" />
          ) : (
            <Select value={form.category} onChange={set("category")}>
              <option value="">Select category</option>
              {builtinCats.map((c) => <option key={c} value={c}>{c}</option>)}
              {customCats.map((c) => <option key={c} value={c}>{c}</option>)}
              {form.category && !builtinCats.includes(form.category) && !customCats.includes(form.category) && (
                <option value={form.category}>{form.category}</option>
              )}
            </Select>
          )}
        </div>

        <Field label="Title / Label">
          <TextInput value={form.title} onChange={set("title")} placeholder="e.g. Home electricity bill" />
        </Field>

        <Field label="Provider / Brand / Company">
          <TextInput value={form.providerName} onChange={set("providerName")} placeholder="e.g. MSEB, Netflix, HDFC Ergo" />
        </Field>

        <Field label="Customer / Policy / Account number">
          <TextInput value={form.accountIdentifier} onChange={set("accountIdentifier")} placeholder="Identifier" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Amount (optional)">
            <TextInput type="number" inputMode="decimal" value={form.amount} onChange={set("amount")} placeholder="₹" />
          </Field>
          <Field label={dueLabelText}>
            <TextInput type="date" value={form.dueDate} onChange={set("dueDate")} />
          </Field>
        </div>

        {(form.module === "RECHARGE" || form.module === "SERVICE" || form.module === "WARRANTY") && (
          <Field label={form.module === "WARRANTY" ? "Purchase date" : form.module === "SERVICE" ? "Last service date" : "Last recharge date"}>
            <TextInput type="date" value={form.lastActionDate} onChange={set("lastActionDate")} />
          </Field>
        )}
      </Card>

      {/* Schedule & alerts */}
      <div className="rb-section-title">Schedule & alerts</div>
      <Card style={{ marginBottom: 14 }}>
        <Field label="Repeat">
          <Select value={form.repeatFrequency} onChange={set("repeatFrequency")}>
            {RESIBOT_REPEAT_OPTIONS.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
          </Select>
        </Field>

        {form.repeatFrequency === "CUSTOM_DAYS" && (
          <Field label="Repeat every (days)">
            <TextInput type="number" inputMode="numeric" value={form.repeatIntervalDays} onChange={set("repeatIntervalDays")} placeholder="e.g. 45" />
          </Field>
        )}

        <Field label="Alert offsets (days before, comma separated)">
          <TextInput value={form.alertOffsetsDays} onChange={set("alertOffsetsDays")} placeholder="Leave blank for defaults e.g. 7,3,1,0" />
        </Field>

        {form.module === "SUBSCRIPTION" && (
          <Field label="Payment method">
            <TextInput value={form.paymentMethod} onChange={set("paymentMethod")} placeholder="e.g. HDFC Credit Card" />
          </Field>
        )}
      </Card>

      {/* More */}
      <Card>
        <div className="rb-field">
          <div className="rb-field-head">
            <span className="rb-label">For family member (optional)</span>
            <button type="button" className="rb-add-btn" onClick={() => setShowAddMember((v) => !v)}>
              {showAddMember ? <><FaListUl size={9} /> Close</> : <><FaPlus size={9} /> Add member</>}
            </button>
          </div>
          <Select value={form.memberId} onChange={set("memberId")}>
            <option value="">Myself</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.mobileNumber ? ` (${m.mobileNumber})` : ""}</option>
            ))}
          </Select>

          {selectedMember?.mobileNumber && (
            <div style={{ fontSize: 11.5, color: "var(--rb-muted)", marginTop: 7, lineHeight: 1.5 }}>
              Shared with {selectedMember.name} ({selectedMember.mobileNumber}) — if they use VasBazaar, this reminder will also appear in their app.
            </div>
          )}

          {showAddMember && (
            <div style={{ marginTop: 12, padding: 13, borderRadius: 12, border: "1px dashed var(--rb-border-strong)", background: "var(--rb-surface-2)" }}>
              <Field label="Name">
                <TextInput value={newMember.name} onChange={(e) => setNewMember((n) => ({ ...n, name: e.target.value }))} placeholder="Family member name" />
              </Field>
              <Field label="Mobile number (their VasBazaar number)">
                <TextInput type="tel" inputMode="numeric" value={newMember.mobileNumber}
                  onChange={(e) => setNewMember((n) => ({ ...n, mobileNumber: e.target.value }))} placeholder="e.g. 9876543210" />
              </Field>
              <div style={{ fontSize: 11.5, color: "var(--rb-muted)", margin: "-6px 0 12px", lineHeight: 1.5 }}>
                If this number belongs to a VasBazaar user, reminders you assign to this member appear in their app automatically — they don't need to add anything.
              </div>
              <PrimaryButton onClick={saveNewMember} disabled={memberSaving}>
                {memberSaving ? "Adding…" : "Add & select"}
              </PrimaryButton>
            </div>
          )}
        </div>

        <Field label="Notes">
          <TextArea value={form.notes} onChange={set("notes")} placeholder="Optional notes" />
        </Field>
      </Card>

      <div className="rb-sticky-bar">
        <PrimaryButton onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Update reminder" : "Create reminder"}
        </PrimaryButton>
      </div>
    </div>
  );
};

export default ResibotReminderFormScreen;
