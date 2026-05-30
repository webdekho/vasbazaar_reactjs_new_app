import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTint, FaWeight, FaHeartbeat, FaTachometerAlt, FaThermometerHalf } from "react-icons/fa";
import { resibotService } from "../../services/resibotService";
import {
  RB, ResibotHeader, Spinner, Card, Field, TextInput, Select, PrimaryButton,
} from "./resibotUi";

const VITALS = [
  { type: "BP", label: "Blood Pressure", icon: FaTachometerAlt },
  { type: "WEIGHT", label: "Weight", icon: FaWeight },
  { type: "WATER_INTAKE", label: "Water", icon: FaTint },
  { type: "SUGAR", label: "Sugar", icon: FaHeartbeat },
  { type: "HEART_RATE", label: "Heart Rate", icon: FaHeartbeat },
  { type: "TEMPERATURE", label: "Temperature", icon: FaThermometerHalf },
];

const emptyProfile = { heightCm: "", weightKg: "", dob: "", gender: "", activityLevel: "", targetWeightKg: "", dailyWaterTargetMl: "" };

const ResibotHealthScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberId, setMemberId] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async (mid) => {
    const [pRes, sRes] = await Promise.all([
      resibotService.getHealthProfile(mid || undefined),
      resibotService.getHealthSummary(mid || undefined),
    ]);
    if (pRes?.success && pRes.data) {
      const p = pRes.data;
      setProfile({
        heightCm: p.heightCm ?? "", weightKg: p.weightKg ?? "", dob: p.dob || "",
        gender: p.gender || "", activityLevel: p.activityLevel || "",
        targetWeightKg: p.targetWeightKg ?? "", dailyWaterTargetMl: p.dailyWaterTargetMl ?? "",
      });
    } else {
      setProfile(emptyProfile);
    }
    setSummary(sRes?.success ? sRes.data : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const m = await resibotService.listMembers();
      if (m?.success && Array.isArray(m.data)) setMembers(m.data);
      await load("");
    })();
  }, [load]);

  const onMemberChange = async (e) => {
    const mid = e.target.value;
    setMemberId(mid);
    setLoading(true);
    await load(mid);
  };

  const set = (k) => (e) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  const saveProfile = async () => {
    setSaving(true);
    const payload = {
      heightCm: profile.heightCm === "" ? null : Number(profile.heightCm),
      weightKg: profile.weightKg === "" ? null : Number(profile.weightKg),
      dob: profile.dob || null,
      gender: profile.gender || null,
      activityLevel: profile.activityLevel || null,
      targetWeightKg: profile.targetWeightKg === "" ? null : Number(profile.targetWeightKg),
      dailyWaterTargetMl: profile.dailyWaterTargetMl === "" ? null : Number(profile.dailyWaterTargetMl),
      memberId: memberId ? { id: Number(memberId) } : null,
    };
    await resibotService.saveHealthProfile(payload);
    await load(memberId);
    setSaving(false);
  };

  const quickWater = async () => {
    await resibotService.logVital({
      vitalType: "WATER_INTAKE", numericValue: 250, unit: "ml",
      valueText: "250", memberId: memberId ? { id: Number(memberId) } : null,
    });
    await load(memberId);
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ padding: "12px 4px 32px", width: "100%" }}>
      <ResibotHeader title="Health" subtitle="Vitals, BMI & water tracking" onBack={() => navigate("/customer/app/resibot")} />

      <Field label="Profile for">
        <Select value={memberId} onChange={onMemberChange}>
          <option value="">Myself</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Field>

      {/* Summary */}
      <Card style={{ marginBottom: 16, display: "flex", gap: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{summary?.bmi ?? "—"}</div>
          <div style={{ fontSize: 11.5, color: RB.muted }}>BMI</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {summary?.waterConsumedMl ?? 0}{summary?.waterTargetMl ? `/${summary.waterTargetMl}` : ""}
          </div>
          <div style={{ fontSize: 11.5, color: RB.muted }}>Water (ml) today</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{summary?.latestBp ?? "—"}</div>
          <div style={{ fontSize: 11.5, color: RB.muted }}>Last BP</div>
        </div>
      </Card>

      {Array.isArray(summary?.suggestions) && summary.suggestions.length > 0 && (
        <Card style={{ marginBottom: 16, background: RB.brandSoft }}>
          {summary.suggestions.map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: RB.brandDark, marginBottom: i < summary.suggestions.length - 1 ? 6 : 0 }}>• {s}</div>
          ))}
        </Card>
      )}

      <button type="button" onClick={quickWater}
        style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${RB.brand}`, background: "transparent", color: RB.brand, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <FaTint size={13} /> + Add 250 ml water
      </button>

      {/* Log vitals */}
      <h3 style={{ fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Log a vital</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 22 }}>
        {VITALS.map((v) => (
          <Card key={v.type} onClick={() => navigate(`/customer/app/resibot/health/vital/${v.type}`)}
            style={{ textAlign: "center", padding: "14px 8px" }}>
            <v.icon size={18} style={{ color: RB.brand, marginBottom: 6 }} />
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{v.label}</div>
          </Card>
        ))}
      </div>

      {/* Profile form */}
      <h3 style={{ fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Health profile</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Height (cm)"><TextInput type="number" value={profile.heightCm} onChange={set("heightCm")} /></Field>
        <Field label="Weight (kg)"><TextInput type="number" value={profile.weightKg} onChange={set("weightKg")} /></Field>
      </div>
      <Field label="Date of birth"><TextInput type="date" value={profile.dob} onChange={set("dob")} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Gender">
          <Select value={profile.gender} onChange={set("gender")}>
            <option value="">Select</option><option value="Male">Male</option>
            <option value="Female">Female</option><option value="Other">Other</option>
          </Select>
        </Field>
        <Field label="Activity level">
          <Select value={profile.activityLevel} onChange={set("activityLevel")}>
            <option value="">Select</option><option value="SEDENTARY">Sedentary</option>
            <option value="LIGHT">Light</option><option value="MODERATE">Moderate</option><option value="ACTIVE">Active</option>
          </Select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Target weight (kg)"><TextInput type="number" value={profile.targetWeightKg} onChange={set("targetWeightKg")} /></Field>
        <Field label="Daily water (ml)"><TextInput type="number" value={profile.dailyWaterTargetMl} onChange={set("dailyWaterTargetMl")} /></Field>
      </div>

      <PrimaryButton onClick={saveProfile} disabled={saving} style={{ marginTop: 4 }}>
        {saving ? "Saving…" : "Save profile"}
      </PrimaryButton>
    </div>
  );
};

export default ResibotHealthScreen;
