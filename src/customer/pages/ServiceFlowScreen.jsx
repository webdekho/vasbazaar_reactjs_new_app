import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaArrowLeft, FaSearch, FaChevronRight, FaTimes, FaCheck } from "react-icons/fa";
import { FiArrowRight } from "react-icons/fi";
import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";
import { serviceService } from "../services/serviceService";
import { rechargeService } from "../services/rechargeService";
import { advertisementService } from "../services/advertisementService";
import DataState from "../components/DataState";
import { normalizeService } from "../components/serviceUtils";
import BillerFlowScreen from "./BillerFlowScreen";

const FALLBACK_LOGO = "/assets/images/Brand_favicon.png";
const handleLogoError = (e) => { e.target.onerror = null; e.target.src = FALLBACK_LOGO; };

/* ── helpers ── */
const normalizeMobile = (raw) => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
};
const isValidMobile = (num) => /^[6-9]\d{9}$/.test(num);

const extractDataFromDesc = (desc) => {
  if (!desc) return null;
  const m = desc.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|gb|mb))/i);
  return m ? m[1] : null;
};

/* ══════════════════════════════════════════════
   Plan Card Component
   ══════════════════════════════════════════════ */
const PlanCard = ({ plan, onSelect }) => (
  <div className="cm-plan-card-v2" onClick={() => onSelect(plan)}>
    <div className="cm-plan-header">
      <div>
        <div className="cm-plan-price">₹{plan.rs}</div>
        <div className="cm-plan-validity">Validity: {plan.validity || "N/A"}</div>
      </div>
      <span className="cm-plan-badge">{plan.category}</span>
    </div>
    {(plan.data || plan.talktime) && (
      <div className="cm-plan-details">
        {plan.data && <div className="cm-plan-detail-item"><span className="cm-plan-detail-label">DATA</span><strong>{plan.data}</strong></div>}
        {plan.talktime && <div className="cm-plan-detail-item"><span className="cm-plan-detail-label">TALKTIME</span><strong>{plan.talktime}</strong></div>}
        <div className="cm-plan-detail-item"><span className="cm-plan-detail-label">VALIDITY</span><strong>{plan.validity || "N/A"}</strong></div>
      </div>
    )}
    {plan.desc && <p className="cm-plan-desc">{plan.desc}</p>}
    <div className="cm-plan-action">Tap to recharge <FiArrowRight /></div>
  </div>
);

/* ══════════════════════════════════════════════
   Operator Change Bottom Sheet
   ══════════════════════════════════════════════ */
const OperatorChangeSheet = ({ open, operators, currentOpCode, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const sheetRef = useRef(null);

  useEffect(() => { if (open) setSearch(""); }, [open]);

  if (!open) return null;

  const filtered = operators.filter((op) =>
    `${op.operatorName || ""} ${op.name || ""} ${op.opCode || ""} ${op.operatorCode || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="cm-sheet-overlay is-open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cm-sheet is-open" ref={sheetRef}>
        <div className="cm-sheet-header">
          <h2>Select Operator</h2>
          <button type="button" className="cm-sheet-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="cm-sheet-search">
          <FaSearch className="cm-contact-search-icon" />
          <input className="cm-contact-search-input" placeholder="Search operator..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="cm-sheet-list">
          {filtered.length === 0 ? (
            <div className="cm-contact-empty"><p className="cm-contact-empty-title">No operators found</p></div>
          ) : (
            filtered.map((op) => {
              const isActive = op.opCode === currentOpCode || op.operatorCode === currentOpCode;
              return (
                <button key={op.id} type="button" className={`cm-sheet-item${isActive ? " is-active" : ""}`} onClick={() => onSelect(op)}>
                  {op.logo ? (
                    <img src={op.logo} alt="" className="cm-operator-logo" onError={handleLogoError} />
                  ) : (
                    <div className="cm-contact-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                      {(op.operatorName || op.name || "O")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="cm-contact-info">
                    <div className="cm-contact-name">{op.operatorName || op.name}</div>
                  </div>
                  {isActive && <FaCheck className="cm-sheet-check" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Recharge Plans View
   ══════════════════════════════════════════════ */
const RechargePlansView = ({ contactName, mobile, operatorData: initialOperatorData, operators, serviceData, navigate, onBack }) => {
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All Plans");
  const [search, setSearch] = useState("");
  const [operatorData, setOperatorData] = useState(initialOperatorData);
  const [showOperatorSheet, setShowOperatorSheet] = useState(false);

  const matchedOperator = useMemo(() => {
    const code = operatorData?.opCode || operatorData?.operatorCode || "";
    return operators.find((o) => o.opCode === code || o.operatorCode === code);
  }, [operatorData, operators]);

  const opName = operatorData?.operatorName || operatorData?.operator || matchedOperator?.operatorName || matchedOperator?.name || "Operator";
  const circleName = operatorData?.circleName || operatorData?.circle || operatorData?.circleCode || "";
  const opLogo = operatorData?.logo || operatorData?.operatorLogo || matchedOperator?.logo || "";
  const opCode = operatorData?.opCode || operatorData?.operatorCode || "";
  const circleCode = operatorData?.circleCode || operatorData?.circle_code || "";

  useEffect(() => {
    if (!opCode || !circleCode) return;
    setLoading(true);
    setActiveTab("All Plans");
    rechargeService.fetchPlansByCode({ opCode, circleCode }).then((res) => {
      setLoading(false);
      if (res.success) setPlans(res.data?.RDATA || res.data?.rdata || res.data || {});
      else setPlans({});
    });
  }, [opCode, circleCode]);

  const categories = useMemo(() => ["All Plans", ...Object.keys(plans).filter((k) => Array.isArray(plans[k]) && plans[k].length > 0)], [plans]);

  const allPlans = useMemo(() => {
    const result = [];
    Object.entries(plans).forEach(([cat, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach((p, i) => {
        const dataInfo = extractDataFromDesc(p.desc) || p.data || p.DATA || null;
        result.push({ id: `${cat}-${i}`, category: cat, rs: p.rs || p.price || p.amount, validity: p.validity || "N/A", desc: p.desc || "", data: dataInfo, talktime: p.talktime || null, searchText: `${p.rs} ${p.validity} ${p.desc} ${cat}`.toLowerCase() });
      });
    });
    return result;
  }, [plans]);

  const filtered = useMemo(() => {
    let list = activeTab === "All Plans" ? allPlans : allPlans.filter((p) => p.category === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const digits = q.replace(/\D/g, "");
      if (digits && digits === q) {
        // Numeric search: exact price matches first, then starts-with, then contains
        const exact = list.filter((p) => String(p.rs) === digits);
        const startsWith = list.filter((p) => String(p.rs).startsWith(digits) && String(p.rs) !== digits);
        const rest = list.filter((p) => !String(p.rs).startsWith(digits) && p.searchText.includes(q));
        list = [...exact, ...startsWith, ...rest];
      } else {
        list = list.filter((p) => p.searchText.includes(q));
      }
    }
    return list;
  }, [allPlans, activeTab, search]);

  const handleSelectPlan = (plan) => {
    navigate("/customer/app/offers", {
      state: { type: "recharge", operatorId: matchedOperator?.id || "", amount: plan.rs, label: serviceData.name, validity: plan.validity, planDescription: plan.desc, mobile, contactName, opCode, circleCode, serviceId: serviceData.id, operatorName: opName, logo: opLogo },
    });
  };

  const handleOperatorChange = async (op) => {
    setShowOperatorSheet(false);
    // Re-detect circle for the mobile with the new operator
    const res = await rechargeService.fetchOperatorCircle(mobile);
    if (res.success) {
      setOperatorData({
        ...res.data,
        opCode: op.opCode || op.operatorCode || res.data?.opCode,
        operatorName: op.operatorName || op.name,
        logo: op.logo || res.data?.logo,
      });
    } else {
      // Fallback: use operator data directly
      setOperatorData({
        opCode: op.opCode || op.operatorCode,
        operatorName: op.operatorName || op.name,
        logo: op.logo,
        circleName: circleName,
        circleCode: circleCode,
      });
    }
  };

  return (
    <div className="cm-plans-page">
      {/* Header */}
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={onBack}><FaArrowLeft /></button>
        <h1>Mobile Recharge Plans</h1>
        <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
      </div>

      {/* Operator info card */}
      <div className="cm-operator-card">
        <div className="cm-operator-info">
          {opLogo ? <img src={opLogo} alt="" className="cm-operator-logo" onError={handleLogoError} /> : <div className="cm-contact-avatar cm-contact-avatar--my">{(opName[0] || "O").toUpperCase()}</div>}
          <div>
            <div className="cm-contact-name">{contactName && !/^\+?\d[\d\s-]{6,}$/.test(contactName.trim()) ? `${contactName} · ${mobile}` : `+91 ${mobile.replace(/(\d{5})(\d{5})/, "$1 $2")}`}</div>
            <div className="cm-contact-number">{opName} - {circleName}</div>
          </div>
        </div>
        <button type="button" className="cm-change-btn" onClick={() => setShowOperatorSheet(true)}>Change</button>
      </div>

      {/* Operator Change Sheet */}
      <OperatorChangeSheet open={showOperatorSheet} operators={operators} currentOpCode={opCode} onSelect={handleOperatorChange} onClose={() => setShowOperatorSheet(false)} />

      {/* Search plans */}
      <div className="cm-contact-search">
        <FaSearch className="cm-contact-search-icon" />
        <input className="cm-contact-search-input" placeholder="Search Plan or Enter Amount" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Category tabs */}
      <div className="cm-plan-tabs">
        {categories.map((tab) => (
          <button key={tab} type="button" className={`cm-plan-tab${activeTab === tab ? " is-active" : ""}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {/* Plans list */}
      {loading ? (
        <div className="cm-plans-skeleton">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="cm-plan-card-v2 cm-plan-skeleton">
              <div className="cm-skeleton-pulse" style={{ height: 24, width: "30%" }} />
              <div className="cm-skeleton-pulse" style={{ height: 14, width: "50%", marginTop: 6 }} />
              <div className="cm-skeleton-pulse" style={{ height: 40, width: "100%", marginTop: 12 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="cm-plans-list">
          {/* Custom amount card — shown when user types a number not in the plans */}
          {(() => {
            const digits = search.trim().replace(/\D/g, "");
            if (digits && Number(digits) > 0) {
              const exactMatch = allPlans.some((p) => String(p.rs) === digits);
              if (!exactMatch) {
                return (
                  <div className="cm-plan-card-v2 cm-plan-card--custom" onClick={() => handleSelectPlan({ rs: digits, validity: "N/A", desc: `Custom recharge of ₹${digits}`, category: "Custom" })}>
                    <div className="cm-plan-header">
                      <div>
                        <div className="cm-plan-price">₹{digits}</div>
                        <div className="cm-plan-validity">Custom Amount</div>
                      </div>
                      <span className="cm-plan-badge" style={{ background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", border: "none" }}>CUSTOM</span>
                    </div>
                    <p className="cm-plan-desc">Recharge with ₹{digits} — enter any amount to top up your mobile.</p>
                    <div className="cm-plan-action">Tap to recharge <FiArrowRight /></div>
                  </div>
                );
              }
            }
            return null;
          })()}

          {filtered.length === 0 && !search.trim() ? (
            <div className="cm-contact-empty"><p className="cm-contact-empty-title">No plans found</p><p className="cm-contact-empty-desc">Try a different search or category</p></div>
          ) : (
            filtered.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={handleSelectPlan} />)
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="cm-plan-disclaimer">Disclaimer: Review your plan with the operator before recharging.</div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Mobile Number Bottom Sheet (Prepaid: View Plans / Postpaid: Fetch Bill)
   ══════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
const MobileNumberSheet = ({ open, operator, isPostpaid, navigate, serviceData, onSubmit, onClose }) => {
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // step: "mobile" → "bill" (bill fetched) or "amount" (bill fetch failed, enter manually)
  const [step, setStep] = useState("mobile");
  const [billResponse, setBillResponse] = useState(null);

  useEffect(() => { if (open) { setMobile(""); setAmount(""); setError(""); setLoading(false); setStep("mobile"); setBillResponse(null); } }, [open]);

  if (!open || !operator) return null;

  const opName = operator.operatorName || operator.name || "Operator";

  const handleFetchBill = async () => {
    const num = normalizeMobile(mobile);
    if (!isValidMobile(num)) { setError("Enter a valid 10-digit mobile number."); return; }
    setError("");
    setLoading(true);

    if (isPostpaid) {
      const payload = { operatorId: Number(operator.id), field1: num, field2: num, mn: num, op: operator.id };
      const res = await rechargeService.viewBill(payload);
      setLoading(false);
      if (res.success && res.data) {
        // Bill fetched successfully
        const billData = Array.isArray(res.data?.data) ? res.data.data[0] : res.data;
        setBillResponse(billData);
        const billAmt = billData?.billAmount || billData?.amount || billData?.netAmount || billData?.billnetamount || "";
        setAmount(String(billAmt || ""));
        setStep("bill");
      } else {
        // Bill fetch failed — let user enter amount manually
        setBillResponse(null);
        setStep("amount");
      }
    } else {
      const res = await onSubmit(num, operator);
      if (res?.error) { setError(res.error); setLoading(false); }
    }
  };

  const handlePay = () => {
    const num = normalizeMobile(mobile);
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) { setError("Enter a valid amount."); return; }
    navigate("/customer/app/offers", {
      state: {
        type: "bill",
        operatorId: operator.id,
        amount: payAmount,
        label: serviceData?.name || opName,
        mobile: num,
        field1: num,
        field2: num,
        viewBillResponse: billResponse || {},
        operatorName: opName,
        logo: operator.logo,
        serviceId: serviceData?.id,
      },
    });
  };

  const title = step === "bill" ? "Bill Details" : step === "amount" ? "Enter Amount" : "Enter Mobile Number";

  return (
    <div className="cm-sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cm-sheet">
        <div className="cm-sheet-header">
          <h2>{title}</h2>
          <button type="button" className="cm-sheet-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div style={{ padding: "16px 20px 24px" }}>
          {/* Operator info */}
          <div className="cm-operator-card" style={{ marginBottom: 16 }}>
            <div className="cm-operator-info">
              {operator.logo ? (
                <img src={operator.logo} alt="" className="cm-operator-logo" onError={handleLogoError} />
              ) : (
                <div className="cm-operator-list-avatar">{opName[0].toUpperCase()}</div>
              )}
              <div>
                <div className="cm-contact-name">{opName}</div>
                {step !== "mobile" && <div className="cm-contact-number">+91 {mobile}</div>}
              </div>
            </div>
          </div>

          {step === "mobile" && (
            <>
              <div className="cm-mobile-input-row">
                <span className="cm-mobile-prefix">+91</span>
                <input
                  className="cm-mobile-input"
                  placeholder="Enter 10-digit number"
                  inputMode="numeric"
                  maxLength={10}
                  value={mobile}
                  autoFocus
                  onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "")); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchBill()}
                />
              </div>
              {error && <p className="cm-mobile-error">{error}</p>}
              <button type="button" className="cm-mobile-submit-btn" disabled={mobile.length < 10 || loading} onClick={handleFetchBill}>
                {loading ? <span className="cm-contact-loading" /> : isPostpaid ? "Fetch Bill" : "View Plans"}
              </button>
            </>
          )}

          {step === "bill" && billResponse && (
            <>
              <div className="cm-bill-details">
                {Object.entries(billResponse).filter(([k]) => !["status", "Status", "STATUS", "responseCode", "response_code"].includes(k)).slice(0, 8).map(([key, value]) => (
                  <div className="cm-bill-row" key={key}>
                    <span className="cm-bill-label">{key}</span>
                    <strong className="cm-bill-value">{String(value ?? "--")}</strong>
                  </div>
                ))}
              </div>
              <div className="cm-mobile-input-row" style={{ marginTop: 12 }}>
                <span className="cm-mobile-prefix">₹</span>
                <input className="cm-mobile-input" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setError(""); }} />
              </div>
              {error && <p className="cm-mobile-error">{error}</p>}
              <button type="button" className="cm-mobile-submit-btn" disabled={!amount || Number(amount) <= 0} onClick={handlePay}>
                Pay ₹{amount || 0}
              </button>
            </>
          )}

          {step === "amount" && (
            <>
              <p className="cm-bill-fallback-msg">Bill could not be fetched. Please enter the amount manually.</p>
              <div className="cm-mobile-input-row">
                <span className="cm-mobile-prefix">₹</span>
                <input className="cm-mobile-input" inputMode="decimal" placeholder="Enter amount" value={amount} autoFocus onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handlePay()} />
              </div>
              {error && <p className="cm-mobile-error">{error}</p>}
              <button type="button" className="cm-mobile-submit-btn" disabled={!amount || Number(amount) <= 0} onClick={handlePay}>
                Pay ₹{amount || 0}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Contact List Screen (Prepaid & Postpaid)
   ══════════════════════════════════════════════ */
const PrepaidFlow = ({ serviceData, operators, navigate }) => {
  const location = useLocation();
  const prefill = location.state?.prefill;
  const [, setBanners] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingNumber, setLoadingNumber] = useState(null);
  const [planView, setPlanView] = useState(() => {
    // If navigating from My Dues with prefill data, skip to plans view directly
    if (prefill?.mobile && prefill?.operatorData) {
      return { contactName: prefill.contactName || "", mobile: prefill.mobile, operatorData: prefill.operatorData };
    }
    return null;
  });
  const [contactsLoading, setContactsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const contactsLoadedRef = useRef(false);

  const userData = useMemo(() => {
    try {
      const stored = localStorage.getItem("customerUserData");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }, []);

  useEffect(() => { advertisementService.getServiceAdvertisements().then((res) => { if (res.success && Array.isArray(res.data)) setBanners(res.data); }); }, []);

  // Auto-load contacts on mount for native apps and PWA
  useEffect(() => {
    if (contactsLoadedRef.current) return;

    const autoLoadContacts = async () => {
      // For native apps (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        contactsLoadedRef.current = true;
        setContactsLoading(true);
        try {
          const checkStatus = await Contacts.checkPermissions();
          let permGranted = checkStatus.contacts === "granted" || checkStatus.contacts === "limited";

          if (!permGranted) {
            const reqStatus = await Contacts.requestPermissions();
            permGranted = reqStatus.contacts === "granted" || reqStatus.contacts === "limited";
          }

          if (permGranted) {
            const result = await Contacts.getContacts({
              projection: { name: true, phones: true }
            });

            if (result?.contacts?.length) {
              const imported = result.contacts
                .filter(c => c.phones?.length > 0)
                .map((c, i) => ({
                  id: `native-${c.contactId || i}`,
                  name: c.name?.display || c.name?.given || c.name?.family || "Contact",
                  number: normalizeMobile(c.phones[0]?.number || ""),
                  phones: c.phones?.map(p => p.number).filter(Boolean) || []
                }))
                .filter(c => c.number && c.number.length >= 10);

              if (imported.length) {
                setContacts(imported);
              }
            }
          }
        } catch (e) {
          console.log("Auto-load contacts error:", e);
        }
        setContactsLoading(false);
        return;
      }

      // For PWA / Web with Contact Picker API support
      if ("contacts" in navigator && "select" in navigator.contacts) {
        // Don't auto-trigger on web as it requires user gesture
        // Just mark as loaded so we don't try again
        contactsLoadedRef.current = true;
      }
    };

    autoLoadContacts();
  }, []);

  /* ── Contact import helpers ── */
  const parseContactFile = (text, fileName) => {
    const parsed = [];
    if (fileName.toLowerCase().endsWith(".vcf")) {
      text.split("BEGIN:VCARD").forEach((block, i) => {
        if (i === 0 && !block.includes("END:VCARD")) return;
        let name = "";
        const phones = [];
        block.split("\n").forEach((line) => {
          const l = line.trim();
          if (l.startsWith("FN:")) name = l.substring(3);
          else if (l.includes("TEL")) { const m = l.match(/:(.+)$/); if (m) phones.push(m[1].trim()); }
        });
        if (name && phones.length) parsed.push({ id: `vcf-${i}`, name, number: phones[0], phones });
      });
    } else if (fileName.toLowerCase().endsWith(".csv")) {
      text.split("\n").forEach((line, i) => {
        if (i === 0) return;
        const [name, phone] = line.split(",").map((s) => s.trim().replace(/"/g, ""));
        if (name && phone) parsed.push({ id: `csv-${i}`, name, number: phone, phones: [phone] });
      });
    }
    return parsed;
  };

  const handleImportContacts = async () => {
    // Use Capacitor plugin on native Android/iOS - fetch all contacts
    if (Capacitor.isNativePlatform()) {
      try {
        // Check current permission status
        const checkStatus = await Contacts.checkPermissions();
        let permGranted = checkStatus.contacts === "granted" || checkStatus.contacts === "limited";

        // Request permission if not granted
        if (!permGranted) {
          const reqStatus = await Contacts.requestPermissions();
          permGranted = reqStatus.contacts === "granted" || reqStatus.contacts === "limited";
        }

        if (!permGranted) {
          alert("Please allow contacts permission to import contacts from your device.");
          return;
        }

        // Fetch all contacts from device
        const result = await Contacts.getContacts({
          projection: { name: true, phones: true }
        });

        console.log("Contacts result:", result?.contacts?.length || 0, "contacts found");

        if (result?.contacts?.length) {
          const imported = result.contacts
            .filter(c => c.phones?.length > 0)
            .map((c, i) => ({
              id: `native-${c.contactId || i}`,
              name: c.name?.display || c.name?.given || c.name?.family || "Contact",
              number: normalizeMobile(c.phones[0]?.number || ""),
              phones: c.phones?.map(p => p.number).filter(Boolean) || []
            }))
            .filter(c => c.number && c.number.length >= 10);

          if (imported.length) {
            setContacts(imported);
          } else {
            alert("No contacts with valid phone numbers found.");
          }
        } else {
          alert("No contacts found on this device.");
        }
        return;
      } catch (e) {
        console.error("Native contacts error:", e);
        alert("Error reading contacts: " + (e.message || "Unknown error"));
        return;
      }
    }

    // Web Contact Picker API fallback (Chrome Android)
    if ("contacts" in navigator && "select" in navigator.contacts) {
      try {
        const selected = await navigator.contacts.select(["name", "tel"], { multiple: true });
        const imported = selected.filter((c) => c.tel?.length).map((c, i) => ({
          id: `web-${i}`, name: c.name?.[0] || "Unknown", number: normalizeMobile(c.tel[0]), phones: c.tel,
        }));
        if (imported.length) { setContacts(imported); return; }
      } catch { /* fall through */ }
    }

    // Final fallback: file import (only for web browsers)
    fileInputRef.current?.click();
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const parsed = parseContactFile(text, file.name);
      if (parsed.length) setContacts(parsed);
    });
    e.target.value = "";
  };

  /* ── Handle contact selection → detect operator → show plans ── */
  const handleSelectContact = async (contact) => {
    const num = normalizeMobile(contact.number || "");
    if (!isValidMobile(num)) return;
    setLoadingNumber(num);
    try {
      const res = await rechargeService.fetchOperatorCircle(num);
      if (res.success) {
        setPlanView({ contactName: contact.name || "", mobile: num, operatorData: res.data });
      }
    } finally {
      setLoadingNumber(null);
    }
  };

  /* ── Search / filter ── */
  const allContacts = useMemo(() => {
    const list = [];
    if (userData?.mobile) {
      list.push({ id: "my-number", name: "My Number", number: normalizeMobile(userData.mobile), isMyNumber: true });
    }
    contacts.forEach((c) => list.push(c));
    return list;
  }, [userData, contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allContacts;
    const digits = q.replace(/\D/g, "");

    // If user typed a valid 10-digit mobile number, just show it as a direct recharge option
    if (digits.length >= 10) {
      const normalized = normalizeMobile(digits);
      if (isValidMobile(normalized)) {
        return [{ id: "direct-number", name: normalized.replace(/(\d{5})(\d{5})/, "+91 $1 $2"), number: normalized, isNew: true }];
      }
    }

    const result = allContacts.filter((c) => {
      if (c.name?.toLowerCase().includes(q)) return true;
      if (digits && normalizeMobile(c.number || "").includes(digits)) return true;
      return false;
    });

    // If partial number typed (4+ digits) and no match, show option to proceed
    if (!result.length && digits.length >= 4) {
      result.push({ id: "direct-number", name: `+91 ${digits}`, number: digits, isNew: true });
    }
    return result;
  }, [allContacts, search]);

  /* ── Plans view ── */
  if (planView) {
    return <RechargePlansView contactName={planView.contactName} mobile={planView.mobile} operatorData={planView.operatorData} operators={operators} serviceData={serviceData} navigate={navigate} onBack={() => setPlanView(null)} />;
  }

  return (
    <div className="cm-prepaid-flow">
      {/* Header */}
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={() => navigate("/customer/app/services")}><FaArrowLeft /></button>
        <h1>Contact List</h1>
      </div>

      {/* Search bar */}
      <div className="cm-contact-search cm-contact-search--bar">
        <FaSearch className="cm-contact-search-icon" />
        <input className="cm-contact-search-input" placeholder="Search by name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" className="pp-contact-btn" style={{ width: 40, height: 40, borderRadius: 12 }} onClick={handleImportContacts} title="Import contacts">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".vcf,.csv" style={{ display: "none" }} onChange={handleFileImport} />

      {/* My Number card */}
      {userData?.mobile && !search.trim() && (
        <button type="button" className="cm-my-number-card" onClick={() => handleSelectContact({ name: "My Number", number: userData.mobile })}>
          <div className="cm-my-number-left">
            <div className="cm-contact-avatar cm-contact-avatar--my-num">M</div>
            <div className="cm-contact-info">
              <div className="cm-contact-name" style={{ fontSize: 16, fontWeight: 700 }}>My Number</div>
              <div className="cm-contact-number">+91 {normalizeMobile(userData.mobile).replace(/(\d{5})(\d{5})/, "$1 $2")}</div>
            </div>
          </div>
          {loadingNumber === normalizeMobile(userData.mobile) ? (
            <span className="cm-contact-loading" />
          ) : (
            <FaChevronRight className="cm-contact-arrow" />
          )}
        </button>
      )}

      {/* Contact list */}
      {search.trim() ? (
        <div className="cm-cl-list">
          {filtered.map((c) => {
            const num = normalizeMobile(c.number || "");
            const valid = isValidMobile(num);
            const initial = (c.name || "?")[0].toUpperCase();
            return (
              <button key={c.id} type="button" className={`cm-cl-item${!valid && !c.isNew ? " cm-cl-item--disabled" : ""}`} onClick={() => valid && handleSelectContact(c)} disabled={!valid && !c.isNew}>
                <div className="cm-contact-avatar" style={c.isNew ? { background: "linear-gradient(135deg, #00C853, #40E0D0)" } : undefined}>{c.isNew ? "+" : initial}</div>
                <div className="cm-contact-info">
                  <div className="cm-contact-name">{c.name}</div>
                  <div className="cm-contact-number">{num ? `+91 ${num.replace(/(\d{5})(\d{5})/, "$1 $2")}` : "No number"}</div>
                </div>
                {loadingNumber === num ? <span className="cm-contact-loading" /> : <FaChevronRight className="cm-contact-arrow" />}
              </button>
            );
          })}
        </div>
      ) : contacts.length > 0 ? (
        <>
          <div className="cm-cl-section-header">Contact List</div>
          <div className="cm-cl-list">
            {contacts.map((c) => {
              const num = normalizeMobile(c.number || "");
              const valid = isValidMobile(num);
              const initial = (c.name || "?")[0].toUpperCase();
              return (
                <button key={c.id} type="button" className={`cm-cl-item${!valid ? " cm-cl-item--disabled" : ""}`} onClick={() => valid && handleSelectContact(c)} disabled={!valid}>
                  <div className="cm-contact-avatar">{initial}</div>
                  <div className="cm-contact-info">
                    <div className="cm-contact-name">{c.name}</div>
                    <div className="cm-contact-number">{num ? `+91 ${num.replace(/(\d{5})(\d{5})/, "$1 $2")}` : "No number"}</div>
                  </div>
                  {loadingNumber === num ? <span className="cm-contact-loading" /> : <FaChevronRight className="cm-contact-arrow" />}
                </button>
              );
            })}
          </div>
        </>
      ) : contactsLoading ? (
        <div className="cm-cl-empty">
          <div className="cm-cl-loading-spinner" />
          <p className="cm-cl-empty-title">Loading contacts...</p>
          <p className="cm-cl-empty-desc">Please wait while we fetch your contacts</p>
        </div>
      ) : (
        <div className="cm-cl-empty">
          <div className="cm-cl-empty-icon-wrap" onClick={handleImportContacts} role="button" tabIndex={0}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <div className="cm-cl-empty-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </div>
          </div>
          <p className="cm-cl-empty-title">No contacts available</p>
          <p className="cm-cl-empty-desc">Import contacts from a file or<br />manually search for numbers</p>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   Postpaid Flow — Step-by-step bill payment
   Step 1: Enter mobile → Step 2: Select operator → Step 3: View bill → Pay
   ══════════════════════════════════════════════ */
const PostpaidFlow = ({ serviceData, operators, navigate }) => {
  const [step, setStep] = useState("mobile"); // mobile → operator → bill
  const [mobile, setMobile] = useState("");
  const [selectedOp, setSelectedOp] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billData, setBillData] = useState(null);
  const [amount, setAmount] = useState("");
  const fileInputRef = useRef(null);

  const userData = useMemo(() => {
    try { const s = localStorage.getItem("customerUserData"); return s ? JSON.parse(s) : null; } catch { return null; }
  }, []);

  const handlePickContact = async () => {
    if ("contacts" in navigator && "select" in navigator.contacts) {
      try {
        const selected = await navigator.contacts.select(["name", "tel"], { multiple: false });
        if (selected?.[0]?.tel?.[0]) {
          const num = normalizeMobile(selected[0].tel[0]);
          if (num) setMobile(num);
        }
        return;
      } catch { /* fall through */ }
    }
    // Fallback: file import for VCF
    fileInputRef.current?.click();
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const phones = [];
      text.split("BEGIN:VCARD").forEach((block) => {
        block.split("\n").forEach((line) => {
          if (line.includes("TEL")) { const m = line.match(/:(.+)$/); if (m) phones.push(normalizeMobile(m[1].trim())); }
        });
      });
      if (phones[0]) setMobile(phones[0]);
    });
    e.target.value = "";
  };

  const handleMobileSubmit = () => {
    const num = normalizeMobile(mobile);
    if (!isValidMobile(num)) { setError("Enter a valid 10-digit mobile number."); return; }
    setError("");
    setMobile(num);
    setStep("operator");
  };

  const handleSelectOperator = async (op) => {
    setSelectedOp(op);
    setLoading(true);
    setError("");
    const payload = { operatorId: Number(op.id), field1: mobile, field2: mobile, mn: mobile, op: op.id };
    const res = await rechargeService.viewBill(payload);
    setLoading(false);
    if (res.success && res.data) {
      const bill = Array.isArray(res.data?.data) ? res.data.data[0] : res.data;
      setBillData(bill);
      const billAmt = bill?.billAmount || bill?.amount || bill?.netAmount || bill?.billnetamount || "";
      setAmount(String(billAmt || ""));
      setStep("bill");
    } else {
      // Bill fetch failed — go to manual amount entry
      setBillData(null);
      setAmount("");
      setStep("bill");
    }
  };

  const handlePayBill = () => {
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) { setError("Enter a valid amount."); return; }
    const opName = selectedOp?.operatorName || selectedOp?.name || "Operator";
    navigate("/customer/app/offers", {
      state: {
        type: "bill", operatorId: selectedOp?.id, amount: payAmount,
        label: serviceData?.name || opName, mobile, field1: mobile, field2: mobile,
        viewBillResponse: billData || {}, operatorName: opName,
        logo: selectedOp?.logo, serviceId: serviceData?.id,
      },
    });
  };

  const filteredOps = operators.filter((op) =>
    `${op.operatorName || ""} ${op.name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const opName = selectedOp?.operatorName || selectedOp?.name || "";

  // Extract bill details for display
  const billFields = billData
    ? Object.entries(billData)
        .filter(([k]) => !["status", "Status", "STATUS", "responseCode", "response_code", "message"].includes(k))
        .slice(0, 8)
    : [];

  return (
    <div className="pp-flow">
      {/* Header */}
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={() => {
          if (step === "bill") setStep("operator");
          else if (step === "operator") setStep("mobile");
          else navigate("/customer/app/services");
        }}><FaArrowLeft /></button>
        <h1>{step === "mobile" ? "Postpaid Bill Payment" : step === "operator" ? "Select Operator" : "Bill Details"}</h1>
        <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
      </div>

      {/* Step indicator */}
      <div className="pp-steps">
        <div className={`pp-step-dot${step === "mobile" ? " is-active" : " is-done"}`}>1</div>
        <div className="pp-step-line" />
        <div className={`pp-step-dot${step === "operator" ? " is-active" : step === "bill" ? " is-done" : ""}`}>2</div>
        <div className="pp-step-line" />
        <div className={`pp-step-dot${step === "bill" ? " is-active" : ""}`}>3</div>
      </div>

      {/* ── Step 1: Enter Mobile ── */}
      {step === "mobile" && (
        <div className="pp-step-content pp-animate">
          <div className="pp-card">
            <h2 className="pp-card-title">Enter Mobile Number</h2>
            <p className="pp-card-sub">Enter the postpaid mobile number for bill payment</p>

            {/* Quick: My Number */}
            {userData?.mobile && (
              <button type="button" className="pp-my-number" onClick={() => { setMobile(normalizeMobile(userData.mobile)); }}>
                <div className="cm-contact-avatar cm-contact-avatar--my" style={{ width: 36, height: 36, fontSize: 14 }}>M</div>
                <div className="cm-contact-info">
                  <div className="cm-contact-name">My Number</div>
                  <div className="cm-contact-number">+91 {normalizeMobile(userData.mobile)}</div>
                </div>
                <FaChevronRight style={{ color: "var(--cm-disabled, #6B6B6B)", fontSize: 12 }} />
              </button>
            )}

            <div className="pp-input-with-contact" style={{ marginTop: 16 }}>
              <div className="cm-mobile-input-row" style={{ flex: 1 }}>
                <span className="cm-mobile-prefix">+91</span>
                <input className="cm-mobile-input" placeholder="Enter 10-digit number" inputMode="numeric" maxLength={10} value={mobile} autoFocus onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "")); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handleMobileSubmit()} />
              </div>
              <button type="button" className="pp-contact-btn" onClick={handlePickContact} title="Pick from contacts">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".vcf,.csv" style={{ display: "none" }} onChange={handleFileImport} />
            {error && <p className="cm-mobile-error">{error}</p>}
            <button type="button" className="cm-mobile-submit-btn" disabled={mobile.length < 10} onClick={handleMobileSubmit}>
              Next — Select Operator <FiArrowRight />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Select Operator ── */}
      {step === "operator" && (
        <div className="pp-step-content pp-animate">
          {/* Mobile info */}
          <div className="pp-mobile-bar">
            <span>+91 {mobile}</span>
            <button type="button" className="pp-edit-btn" onClick={() => setStep("mobile")}>Edit</button>
          </div>

          {/* Search */}
          <div className="cm-contact-search" style={{ margin: "0 0 12px" }}>
            <FaSearch className="cm-contact-search-icon" />
            <input className="cm-contact-search-input" placeholder="Search operator..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>

          {/* Operator list */}
          <div className="pp-op-list">
            {filteredOps.length === 0 ? (
              <div className="cm-contact-empty"><p className="cm-contact-empty-title">No operators found</p></div>
            ) : filteredOps.map((op, i) => {
              const name = op.operatorName || op.name || "?";
              return (
                <button key={op.id} type="button" className="pp-op-item" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => handleSelectOperator(op)}>
                  {op.logo ? (
                    <img src={op.logo} alt="" className="cm-operator-logo" onError={handleLogoError} />
                  ) : (
                    <div className="cm-operator-list-avatar">{name[0].toUpperCase()}</div>
                  )}
                  <div className="cm-contact-info">
                    <div className="cm-contact-name">{name}</div>
                    <div className="cm-contact-number">Bharat BillPay</div>
                  </div>
                  {loading && selectedOp?.id === op.id ? <span className="cm-contact-loading" /> : <FaChevronRight style={{ color: "var(--cm-disabled, #6B6B6B)", fontSize: 12 }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Bill Details ── */}
      {step === "bill" && (
        <div className="pp-step-content pp-animate">
          {/* Operator info */}
          <div className="pp-op-bar">
            {selectedOp?.logo ? <img src={selectedOp.logo} alt="" className="cm-operator-logo" onError={handleLogoError} /> : <div className="cm-operator-list-avatar">{(opName[0] || "O").toUpperCase()}</div>}
            <div>
              <div className="cm-contact-name">{opName}</div>
              <div className="cm-contact-number">+91 {mobile}</div>
            </div>
          </div>

          {loading ? (
            <div className="pp-loading"><span className="cm-contact-loading" /><p>Fetching bill details...</p></div>
          ) : billData ? (
            <>
              {/* Bill amount hero */}
              <div className="pp-bill-hero">
                <div className="pp-bill-hero-label">Bill Amount</div>
                <div className="pp-bill-hero-amount">₹{amount || "0"}</div>
              </div>

              {/* Bill details grid */}
              <div className="pp-bill-details">
                {billFields.map(([key, value]) => (
                  <div className="pp-bill-row" key={key}>
                    <span className="pp-bill-label">{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</span>
                    <strong className="pp-bill-value">{String(value ?? "--")}</strong>
                  </div>
                ))}
              </div>

              {/* Editable amount */}
              <div className="pp-amount-edit">
                <span className="pp-amount-edit-label">Pay Amount</span>
                <div className="cm-mobile-input-row">
                  <span className="cm-mobile-prefix">₹</span>
                  <input className="cm-mobile-input" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setError(""); }} />
                </div>
              </div>

              {error && <p className="cm-mobile-error">{error}</p>}
              <button type="button" className="cm-mobile-submit-btn" disabled={!amount || Number(amount) <= 0} onClick={handlePayBill}>
                Pay Bill ₹{amount || 0} <FiArrowRight />
              </button>
            </>
          ) : (
            <>
              {/* Bill fetch failed — manual entry */}
              <div className="pp-bill-fallback">
                <p>Bill could not be fetched automatically. Please enter the amount manually.</p>
              </div>
              <div className="pp-amount-edit">
                <span className="pp-amount-edit-label">Enter Amount</span>
                <div className="cm-mobile-input-row">
                  <span className="cm-mobile-prefix">₹</span>
                  <input className="cm-mobile-input" inputMode="decimal" placeholder="Enter bill amount" value={amount} autoFocus onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handlePayBill()} />
                </div>
              </div>
              {error && <p className="cm-mobile-error">{error}</p>}
              <button type="button" className="cm-mobile-submit-btn" disabled={!amount || Number(amount) <= 0} onClick={handlePayBill}>
                Pay Bill ₹{amount || 0} <FiArrowRight />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   Biller Flow (existing)
   ══════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
const BillerFlow = ({ serviceData, operators, navigate }) => {
  const [search, setSearch] = useState("");
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [extraParams, setExtraParams] = useState([]);
  const [formState, setFormState] = useState({ mobile: "", amount: "", field1: "", field2: "" });
  const [error, setError] = useState("");
  const [billResponse, setBillResponse] = useState(null);
  const filteredOperators = operators.filter((item) => `${item.operatorName || ""} ${item.name || ""}`.toLowerCase().includes(search.toLowerCase()));
  const selectOperator = async (operatorId) => { setSelectedOperatorId(String(operatorId)); const resp = await serviceService.getExtraParamsByOperatorId(operatorId); if (resp.success) setExtraParams(Array.isArray(resp.data) ? resp.data : []); };
  const fetchBill = async () => { if (!selectedOperatorId) { setError("Choose a biller first."); return; } setError(""); const resp = await rechargeService.viewBill({ operatorId: Number(selectedOperatorId), field1: formState.field1 || formState.mobile, field2: formState.field2 || null }); if (!resp.success) { setError(resp.message); return; } setBillResponse(resp.data); };

  return (
    <div className="cm-stack">
      <div className="cm-card">
        <div className="cm-flow-header"><div className="cm-flow-title-row"><button className="cm-back-icon" type="button" onClick={() => navigate("/customer/app/services")}><FaArrowLeft /></button><h1>{serviceData.name}</h1><img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" /></div><p className="cm-page-subtitle">Select a biller and fill in your details.</p></div>
        <div className="cm-summary-strip"><div className="cm-search-wrap"><FaSearch /><input className="cm-input" placeholder="Search billers" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
      </div>
      {error && <div className="cm-status cm-status-error">{error}</div>}
      <div className="cm-two-col">
        <div className="cm-card">
          <div className="cm-section-head"><h2>Select biller</h2><span className="cm-muted">{filteredOperators.length} options</span></div>
          <div className="cm-list">{filteredOperators.slice(0, 12).map((item) => (<button key={item.id} type="button" className="cm-service-card" onClick={() => selectOperator(item.id)}><div className="cm-list-item"><div><div className="cm-list-title">{item.operatorName || item.name}</div><div className="cm-muted">{item.opCode || item.operatorCode || "No code"}</div></div><span className="cm-chip">{item.id}</span></div></button>))}</div>
        </div>
        <div className="cm-card">
          <div className="cm-section-head"><h2>Bill journey</h2><span className="cm-muted">{selectedOperatorId ? `Operator ${selectedOperatorId}` : "Choose biller"}</span></div>
          <div className="cm-form">
            {extraParams.length === 0 ? (<><div className="cm-field"><label>Primary Field</label><input className="cm-input" placeholder="Consumer number / account" value={formState.field1} onChange={(e) => setFormState((p) => ({ ...p, field1: e.target.value }))} /></div><div className="cm-field"><label>Secondary Field</label><input className="cm-input" placeholder="Billing unit" value={formState.field2} onChange={(e) => setFormState((p) => ({ ...p, field2: e.target.value }))} /></div></>) : (extraParams.slice(0, 2).map((field, index) => { const key = index === 0 ? "field1" : "field2"; return (<div className="cm-field" key={field.id || key}><label>{field.fieldName || field.displayName || `Field ${index + 1}`}</label><input className="cm-input" placeholder={field.placeholder || field.fieldName || `Enter ${key}`} value={formState[key]} onChange={(e) => setFormState((p) => ({ ...p, [key]: e.target.value }))} /></div>); }))}
            <button className="cm-button" type="button" onClick={fetchBill}>Fetch bill details</button>
          </div>
          {billResponse ? (<div className="cm-card" style={{ marginTop: 18, background: "rgba(255,255,255,0.86)" }}><div className="cm-section-head"><h2>Bill snapshot</h2><span className="cm-badge">Live API response</span></div><div className="cm-detail-grid">{Object.entries(billResponse).slice(0, 6).map(([key, value]) => (<div className="cm-detail-box" key={key}><span className="cm-muted">{key}</span><strong>{String(value ?? "--")}</strong></div>))}</div><button className="cm-button" type="button" onClick={() => navigate("/customer/app/offers", { state: { type: "bill", operatorId: selectedOperatorId, amount: billResponse.billAmount || billResponse.amount || formState.amount || 100, label: serviceData.name, field1: formState.field1, field2: formState.field2, viewBillResponse: billResponse } })}>Continue to payment</button></div>) : null}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Main Router
   ══════════════════════════════════════════════ */
const ServiceFlowScreen = () => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const rawService = location.state?.service;
  const service = rawService ? normalizeService(rawService) : null;
  const [serviceData, setServiceData] = useState(service || null);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("discover");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let currentService = serviceData;
      if (!currentService) { const resp = await serviceService.getAllServices(); if (resp.success) { currentService = (resp.data || []).map(normalizeService).find((item) => item.slug === params.serviceSlug); setServiceData(currentService || null); } }
      if (!currentService) { setError("Service not found."); setLoading(false); return; }
      const opResp = await serviceService.getOperatorsByService(currentService.id);
      setLoading(false);
      if (!opResp.success) { setError(opResp.message); return; }
      const opData = opResp.data;
      setOperators(Array.isArray(opData) ? opData : Array.isArray(opData?.data) ? opData.data : Array.isArray(opData?.content) ? opData.content : []);
      const slug = currentService.slug;
      if (slug === "prepaid") setMode("prepaid");
      else if (slug === "postpaid") setMode("postpaid");
      else setMode("biller");
    };
    load();
  }, [params.serviceSlug, serviceData]);

  return (
    <DataState loading={loading} error={error}>
      {serviceData ? (
        mode === "prepaid" ? <PrepaidFlow serviceData={serviceData} operators={operators} navigate={navigate} /> :
        mode === "postpaid" ? <PostpaidFlow serviceData={serviceData} operators={operators} navigate={navigate} /> :
        <BillerFlowScreen serviceData={serviceData} operators={operators} navigate={navigate} />
      ) : null}
    </DataState>
  );
};

export default ServiceFlowScreen;
