import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resibotService } from "../../services/resibotService";
import { RB, ResibotHeader, Spinner, Card, Field, TextInput, PrimaryButton, EmptyState, fmtDate } from "./resibotUi";

const VITAL_META = {
  BP: { label: "Blood Pressure", unit: "mmHg", placeholder: "120/80", text: true },
  WEIGHT: { label: "Weight", unit: "kg", placeholder: "70", text: false },
  WATER_INTAKE: { label: "Water Intake", unit: "ml", placeholder: "250", text: false },
  SUGAR: { label: "Blood Sugar", unit: "mg/dL", placeholder: "110", text: false },
  HEART_RATE: { label: "Heart Rate", unit: "bpm", placeholder: "72", text: false },
  TEMPERATURE: { label: "Temperature", unit: "°F", placeholder: "98.6", text: false },
};

const ResibotVitalScreen = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const meta = VITAL_META[type] || { label: type, unit: "", placeholder: "", text: false };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState([]);

  const load = useCallback(async () => {
    const res = await resibotService.listVitals(type);
    setHistory(res?.success && Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (value === "") return;
    setSaving(true);
    const payload = {
      vitalType: type,
      unit: meta.unit,
      valueText: String(value),
      numericValue: meta.text ? null : Number(value),
    };
    await resibotService.logVital(payload);
    setValue("");
    await load();
    setSaving(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="rb-page">
      <ResibotHeader title={meta.label} subtitle={`Logged in ${meta.unit}`} onBack={() => navigate("/customer/app/resibot/health")} />

      <Card style={{ marginBottom: 18 }}>
        <Field label={`New reading (${meta.unit})`}>
          <TextInput
            type={meta.text ? "text" : "number"}
            inputMode={meta.text ? "text" : "decimal"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={meta.placeholder}
          />
        </Field>
        <PrimaryButton onClick={save} disabled={saving || value === ""}>
          {saving ? "Saving…" : "Log reading"}
        </PrimaryButton>
      </Card>

      <h3 style={{ fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>History</h3>
      {history.length === 0 ? (
        <EmptyState>No readings yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {history.map((h) => (
            <Card key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{h.valueText} <span style={{ fontSize: 12, color: RB.muted, fontWeight: 400 }}>{h.unit}</span></span>
              <span style={{ fontSize: 12.5, color: RB.muted }}>
                {h.recordedAt ? new Date(h.recordedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : fmtDate(h.createdAt)}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResibotVitalScreen;
