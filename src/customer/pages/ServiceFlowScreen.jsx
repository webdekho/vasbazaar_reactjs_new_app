import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaArrowLeft, FaSearch } from "react-icons/fa";
import { serviceService } from "../services/serviceService";
import { rechargeService } from "../services/rechargeService";
import DataState from "../components/DataState";
import { getServiceVisual, normalizeService } from "../components/serviceUtils";

const ServiceFlowScreen = () => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const rawService = location.state?.service;
  const service = rawService ? { ...rawService, ...getServiceVisual(rawService.name) } : null;
  const [serviceData, setServiceData] = useState(service || null);
  const [operators, setOperators] = useState([]);
  const [extraParams, setExtraParams] = useState([]);
  const [plans, setPlans] = useState({});
  const [billResponse, setBillResponse] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [formState, setFormState] = useState({ mobile: "", amount: "", field1: "", field2: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("discover");
  const [activeTab, setActiveTab] = useState("All Plans");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let currentService = serviceData;
      if (!currentService) {
        const resp = await serviceService.getAllServices();
        if (resp.success) {
          currentService = (resp.data || []).map(normalizeService).find((item) => item.slug === params.serviceSlug);
          setServiceData(currentService || null);
        }
      }
      if (!currentService) { setError("Service not found."); setLoading(false); return; }
      const opResp = await serviceService.getOperatorsByService(currentService.id);
      setLoading(false);
      if (!opResp.success) { setError(opResp.message); return; }
      setOperators(Array.isArray(opResp.data) ? opResp.data : []);
      setMode(["prepaid", "postpaid", "dth"].includes(currentService.slug) ? "recharge" : "biller");
    };
    load();
  }, [params.serviceSlug, serviceData]);

  const filteredOperators = operators.filter((item) =>
    `${item.operatorName || ""} ${item.name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const selectOperator = async (operatorId) => {
    setSelectedOperatorId(String(operatorId));
    const resp = await serviceService.getExtraParamsByOperatorId(operatorId);
    if (resp.success) setExtraParams(Array.isArray(resp.data) ? resp.data : []);
  };

  const fetchPlans = async () => {
    if (!/^\d{10}$/.test(formState.mobile)) { setError("Enter a valid mobile number."); return; }
    setError("");
    const opCircle = await rechargeService.fetchOperatorCircle(formState.mobile);
    if (!opCircle.success) { setError(opCircle.message); return; }
    const circleCode = opCircle.data?.circleCode || opCircle.data?.circle_code;
    const opCode = opCircle.data?.opCode || opCircle.data?.operatorCode;
    if (!circleCode || !opCode) { setError("Operator or circle could not be detected for this number."); return; }
    const match = operators.find((i) => i.opCode === opCode || i.operatorCode === opCode);
    if (match) setSelectedOperatorId(String(match.id));
    const plansResp = await rechargeService.fetchPlansByCode({ opCode, circleCode });
    if (!plansResp.success) { setError(plansResp.message); return; }
    setPlans(plansResp.data?.RDATA || plansResp.data || {});
    setActiveTab("All Plans");
  };

  const fetchBill = async () => {
    if (!selectedOperatorId) { setError("Choose a biller first."); return; }
    const resp = await rechargeService.viewBill({ operatorId: Number(selectedOperatorId), field1: formState.field1 || formState.mobile, field2: formState.field2 || null });
    if (!resp.success) { setError(resp.message); return; }
    setBillResponse(resp.data);
  };

  const categories = ["All Plans", ...Object.keys(plans).filter((k) => Array.isArray(plans[k]) && plans[k].length > 0)];
  const currentPlans = activeTab === "All Plans" ? Object.values(plans).flatMap((g) => (Array.isArray(g) ? g : [])) : plans[activeTab] || [];

  return (
    <DataState loading={loading} error={error}>
      {serviceData ? (
        <div className="cm-stack">
          <div className="cm-card">
            <div className="cm-section-head">
              <div><h1>{serviceData.name}</h1><p className="cm-page-subtitle">Same workflow, rebuilt with a stronger mobile-first hierarchy.</p></div>
              <button className="cm-button-ghost" type="button" onClick={() => navigate("/customer/app/services")}><FaArrowLeft /> Back</button>
            </div>
            <div className="cm-summary-strip">
              <div className="cm-chip-row"><span className="cm-chip">Service ID {serviceData.id}</span><span className="cm-chip">{mode === "recharge" ? "Recharge flow" : "Biller flow"}</span></div>
              <div className="cm-search-wrap"><FaSearch /><input className="cm-input" placeholder="Search billers or operators" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            </div>
          </div>

          <div className="cm-two-col">
            <div className="cm-card">
              <div className="cm-section-head"><h2>{mode === "recharge" ? "Enter recharge details" : "Select biller"}</h2><span className="cm-muted">{filteredOperators.length} options</span></div>
              <div className="cm-list">
                {filteredOperators.slice(0, 12).map((item) => (
                  <button key={item.id} type="button" className="cm-service-card" onClick={() => selectOperator(item.id)}>
                    <div className="cm-list-item">
                      <div><div className="cm-list-title">{item.operatorName || item.name}</div><div className="cm-muted">{item.opCode || item.operatorCode || "No operator code"}</div></div>
                      <span className="cm-chip">{item.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="cm-card">
              <div className="cm-section-head"><h2>{mode === "recharge" ? "Recharge journey" : "Bill journey"}</h2><span className="cm-muted">{selectedOperatorId ? `Operator ${selectedOperatorId}` : "Choose biller"}</span></div>
              {mode === "recharge" ? (
                <div className="cm-form">
                  <div className="cm-field"><label>Mobile Number</label><input className="cm-input" inputMode="numeric" maxLength={10} value={formState.mobile} onChange={(e) => setFormState((p) => ({ ...p, mobile: e.target.value.replace(/\D/g, "") }))} /></div>
                  <button className="cm-button" type="button" onClick={fetchPlans}>Fetch plans</button>
                </div>
              ) : (
                <div className="cm-form">
                  {extraParams.length === 0 ? (
                    <>
                      <div className="cm-field"><label>Primary Field</label><input className="cm-input" placeholder="Consumer number / account / field1" value={formState.field1} onChange={(e) => setFormState((p) => ({ ...p, field1: e.target.value }))} /></div>
                      <div className="cm-field"><label>Secondary Field</label><input className="cm-input" placeholder="Billing unit / field2" value={formState.field2} onChange={(e) => setFormState((p) => ({ ...p, field2: e.target.value }))} /></div>
                    </>
                  ) : (
                    extraParams.slice(0, 2).map((field, index) => {
                      const key = index === 0 ? "field1" : "field2";
                      return (<div className="cm-field" key={field.id || key}><label>{field.fieldName || field.displayName || `Field ${index + 1}`}</label><input className="cm-input" placeholder={field.placeholder || field.fieldName || `Enter ${key}`} value={formState[key]} onChange={(e) => setFormState((p) => ({ ...p, [key]: e.target.value }))} /></div>);
                    })
                  )}
                  <button className="cm-button" type="button" onClick={fetchBill}>Fetch bill details</button>
                </div>
              )}
              {billResponse ? (
                <div className="cm-card" style={{ marginTop: 18, background: "rgba(255,255,255,0.86)" }}>
                  <div className="cm-section-head"><h2>Bill snapshot</h2><span className="cm-badge">Live API response</span></div>
                  <div className="cm-detail-grid">
                    {Object.entries(billResponse).slice(0, 6).map(([key, value]) => (<div className="cm-detail-box" key={key}><span className="cm-muted">{key}</span><strong>{String(value ?? "--")}</strong></div>))}
                  </div>
                  <button className="cm-button" type="button" onClick={() => navigate("/customer/app/payment", { state: { type: "bill", operatorId: selectedOperatorId, amount: billResponse.billAmount || billResponse.amount || formState.amount || 100, label: serviceData.name, field1: formState.field1, field2: formState.field2, viewBillResponse: billResponse } })}>Continue to payment</button>
                </div>
              ) : null}
            </div>
          </div>

          {mode === "recharge" && currentPlans.length > 0 ? (
            <div className="cm-card">
              <div className="cm-section-head"><h2>Plans</h2><span className="cm-muted">{currentPlans.length} plan options</span></div>
              <div className="cm-tabs">{categories.map((tab) => (<button key={tab} className={`cm-tab ${activeTab === tab ? "is-active" : ""}`} type="button" onClick={() => setActiveTab(tab)}>{tab}</button>))}</div>
              <div className="cm-stack" style={{ marginTop: 18 }}>
                {currentPlans.slice(0, 18).map((plan, index) => (
                  <div className="cm-plan-card" key={`${plan.rs || plan.price || index}-${index}`}>
                    <div className="cm-plan-top"><div><div className="cm-amount">₹{plan.rs || plan.price || plan.amount || "--"}</div><div className="cm-muted">{plan.desc || plan.validity || "Recharge plan"}</div></div><span className="cm-tag">{activeTab === "All Plans" ? "Plan" : activeTab}</span></div>
                    <div className="cm-detail-grid"><div className="cm-detail-box"><span className="cm-muted">Validity</span><strong>{plan.validity || "N/A"}</strong></div><div className="cm-detail-box"><span className="cm-muted">Data</span><strong>{plan.data || plan["DATA"] || "As per operator"}</strong></div></div>
                    <button className="cm-button" type="button" onClick={() => navigate("/customer/app/payment", { state: { type: "recharge", operatorId: selectedOperatorId, amount: plan.rs || plan.price || plan.amount, label: serviceData.name, validity: plan.validity || "30 Days", planDescription: plan.desc || "", mobile: formState.mobile } })}>Proceed to pay</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </DataState>
  );
};

export default ServiceFlowScreen;
