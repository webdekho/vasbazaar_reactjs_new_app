import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaArrowLeft,
  FaSearch,
  FaChevronRight,
  FaUserAlt,
  FaWallet,
  FaTv,
  FaCheck,
} from "react-icons/fa";
import { FiCreditCard, FiArrowRight } from "react-icons/fi";
import { serviceService } from "../services/serviceService";
import { rechargeService } from "../services/rechargeService";
import { Capacitor } from "@capacitor/core";
import juspayService, { isPwaStandalone } from "../services/juspayService";
import { advertisementService } from "../services/advertisementService";
import { offerService } from "../services/offerService";
import { userService } from "../services/userService";
import BannerSlider from "../components/BannerSlider";
import { useToast } from "../context/ToastContext";
import { sanitizeBackendMessage } from "../utils/userMessages";

/* ── Bharat Connect Logo ── */
const BharatConnectLogo = () => (
  <img
    src="/images/bbps.svg"
    alt="Bharat Connect"
    className="bf-bharat-logo"
  />
);

/* ── Step Indicator ── */
// eslint-disable-next-line no-unused-vars
const StepIndicator = ({ current, total }) => (
  <div className="bf-step-indicator">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`bf-step-dot${i === current ? " is-active" : ""}${
          i < current ? " is-done" : ""
        }`}
      />
    ))}
  </div>
);

/* ══════════════════════════════════════════════
   Step 1: Biller List — Premium Design
   ══════════════════════════════════════════════ */
const GRADIENTS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #fccb90, #d57eeb)",
  "linear-gradient(135deg, #e0c3fc, #8ec5fc)",
  "linear-gradient(135deg, #f5576c, #ff6a00)",
  "linear-gradient(135deg, #13547a, #80d0c7)",
  "linear-gradient(135deg, #ff9a9e, #fecfef)",
  "linear-gradient(135deg, #a1c4fd, #c2e9fb)",
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #89f7fe, #66a6ff)",
  "linear-gradient(135deg, #fddb92, #d1fdff)",
];
const getGradient = (ch) => GRADIENTS[ch.charCodeAt(0) % GRADIENTS.length];

// Favicon used whenever a biller has no logo or its logo URL is broken.
const FAVICON_SRC = "/favicon.png";
// Shared onError handler: swap a failed biller logo to the favicon. Guards
// against an infinite-loop if the favicon itself somehow fails.
const handleBillerLogoError = (e) => {
  if (e.currentTarget.dataset.fallback === "1") return;
  e.currentTarget.dataset.fallback = "1";
  e.currentTarget.src = FAVICON_SRC;
};

const BillerList = ({ operators, myBillers = [], isLoading: listLoading, onSelect, onBack, serviceName, banners }) => {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [activeLetter, setActiveLetter] = useState(null);
  const listRef = useRef(null);

  /* Combine all billers for search filtering */
  const allBillers = useMemo(() => {
    const all = [...myBillers, ...operators];
    // Remove duplicates by id
    const seen = new Set();
    return all.filter(op => {
      if (seen.has(op.id)) return false;
      seen.add(op.id);
      return true;
    });
  }, [operators, myBillers]);

  /* Filter by search */
  const filteredAll = allBillers.filter((op) =>
    (op.operatorName || op.name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredMyBillers = myBillers.filter((op) =>
    (op.operatorName || op.name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredOperators = operators.filter((op) =>
    (op.operatorName || op.name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* Group billers by state */
  const groupedByState = useMemo(() => {
    const stateMap = {};

    // Helper to get state name
    const getStateName = (op) => op.state?.name || "Other States";

    // Group my billers by state
    const myBillersByState = {};
    filteredMyBillers.forEach((op) => {
      const stateName = getStateName(op);
      if (!myBillersByState[stateName]) myBillersByState[stateName] = [];
      myBillersByState[stateName].push(op);
    });

    // Group other billers by state
    const operatorsByState = {};
    filteredOperators.forEach((op) => {
      const stateName = getStateName(op);
      if (!operatorsByState[stateName]) operatorsByState[stateName] = [];
      operatorsByState[stateName].push(op);
    });

    // Combine all states
    const allStates = new Set([...Object.keys(myBillersByState), ...Object.keys(operatorsByState)]);

    // Sort states alphabetically but put "Other States" at the end
    const sortedStates = [...allStates].sort((a, b) => {
      if (a === "Other States") return 1;
      if (b === "Other States") return -1;
      return a.localeCompare(b);
    });

    sortedStates.forEach((stateName) => {
      stateMap[stateName] = {
        myBillers: (myBillersByState[stateName] || []).sort((a, b) =>
          (a.operatorName || a.name || "").localeCompare(b.operatorName || b.name || "")
        ),
        operators: (operatorsByState[stateName] || []).sort((a, b) =>
          (a.operatorName || a.name || "").localeCompare(b.operatorName || b.name || "")
        ),
      };
    });

    return stateMap;
  }, [filteredMyBillers, filteredOperators]);

  const matchCount = filteredAll.length;

  return (
    <div className="bf-step bf-step-enter">
      {/* ── Header ── */}
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={onBack}>
          <FaArrowLeft />
        </button>
        <h1>{serviceName} Operators</h1>
        <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
      </div>

      {/* Banner */}
      {!search && <BannerSlider banners={banners} showCustomerCard={false} />}

      {/* Search */}
      <div className="bf-search-section">
        <div className={`bf-hero-search${searchFocused ? " is-focused" : ""}`}>
          <FaSearch className="bf-hero-search-icon" />
          <input
            className="bf-hero-search-input"
            placeholder="Search by operator"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search && (
            <button type="button" className="bf-hero-search-clear" onClick={() => setSearch("")}>&times;</button>
          )}
        </div>
        {search && (
          <div className="bf-result-bar">
            Found <span className="bf-result-count">{matchCount}</span> of {operators.length} operators
          </div>
        )}
      </div>

      {/* ── Biller List ── */}
      <div className="bf-biller-area" ref={listRef}>
        {listLoading ? (
          <div className="bf-skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bf-skeleton-row" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="bf-skeleton-avatar" />
                <div className="bf-skeleton-lines">
                  <div className="bf-skeleton-text" />
                  <div className="bf-skeleton-text bf-skeleton-text--short" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAll.length === 0 ? (
          <div className="bf-empty">
            <div className="bf-empty-circle">
              <FaSearch />
            </div>
            <p className="bf-empty-title">No billers found</p>
            <p className="bf-empty-desc">Try a different search keyword</p>
          </div>
        ) : (
          <div className="bf-biller-grouped">
            {Object.entries(groupedByState).map(([stateName, { myBillers: stateMyBillers, operators: stateOperators }]) => (
              <div key={stateName} className="bf-state-group">
                {/* State Header */}
                <div className="bf-state-header">
                  <span className="bf-state-name">{stateName}</span>
                </div>

                {/* My Billers Section (only if not empty) */}
                {stateMyBillers.length > 0 && (
                  <div className="bf-mybiller-section">
                    <div className="bf-mybiller-label">My Billers</div>
                    <div className="bf-glass-card">
                      {stateMyBillers.map((op, i) => {
                        const name = op.operatorName || op.name || "?";
                        const initial = name[0].toUpperCase();
                        const grad = getGradient(initial);
                        return (
                          <button
                            key={op.id}
                            type="button"
                            className="bf-biller-row bf-biller-row--mybiller"
                            onClick={() => onSelect(op)}
                            style={{ animationDelay: `${i * 30}ms` }}
                          >
                            <div className="bf-biller-avatar" style={{ background: grad }}>
                              <img
                                src={op.logo || FAVICON_SRC}
                                alt=""
                                className="bf-biller-avatar-img"
                                onError={handleBillerLogoError}
                              />
                            </div>
                            <div className="bf-biller-info">
                              <span className="bf-biller-name">{name}</span>
                              <span className="bf-biller-tag">Bharat BillPay</span>
                            </div>
                            <span className="bf-mybiller-badge">★</span>
                            <span className="bf-biller-arrow">
                              <FaChevronRight />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Other Billers Section */}
                {stateOperators.length > 0 && (
                  <div className="bf-operators-section">
                    {stateMyBillers.length > 0 && (
                      <div className="bf-operators-label">All Billers</div>
                    )}
                    <div className="bf-glass-card">
                      {stateOperators.map((op, i) => {
                        const name = op.operatorName || op.name || "?";
                        const initial = name[0].toUpperCase();
                        const grad = getGradient(initial);
                        return (
                          <button
                            key={op.id}
                            type="button"
                            className="bf-biller-row"
                            onClick={() => onSelect(op)}
                            style={{ animationDelay: `${i * 30}ms` }}
                          >
                            <div className="bf-biller-avatar" style={{ background: grad }}>
                              <img
                                src={op.logo || FAVICON_SRC}
                                alt=""
                                className="bf-biller-avatar-img"
                                onError={handleBillerLogoError}
                              />
                            </div>
                            <div className="bf-biller-info">
                              <span className="bf-biller-name">{name}</span>
                              <span className="bf-biller-tag">Bharat BillPay</span>
                            </div>
                            <span className="bf-biller-arrow">
                              <FaChevronRight />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Searchable Select Component
   ══════════════════════════════════════════════ */
const SearchableSelect = ({ options, value, onChange, placeholder, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="bf-searchable-select" ref={dropdownRef}>
      <button
        type="button"
        className="bf-input bf-select bf-searchable-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption ? selectedOption.label : placeholder || `Select ${label}`}
      </button>
      {isOpen && (
        <div className="bf-searchable-dropdown">
          <div className="bf-searchable-search">
            <FaSearch className="bf-searchable-search-icon" />
            <input
              type="text"
              className="bf-searchable-search-input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="bf-searchable-options">
            {filtered.length === 0 ? (
              <div className="bf-searchable-empty">No results found</div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  className={`bf-searchable-option${opt.value === value ? " is-selected" : ""}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label}
                  {opt.value === value && <FaCheck className="bf-searchable-check" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   Step 2: Biller Form
   ══════════════════════════════════════════════ */
const BillerForm = ({ biller, onSubmit, onBack, isLoading }) => {
  const [extraParams, setExtraParams] = useState([]);
  const [formValues, setFormValues] = useState({ field1: "", field2: "" });
  const [error, setError] = useState("");
  const [paramsLoading, setParamsLoading] = useState(true);

  useEffect(() => {
    const loadParams = async () => {
      setParamsLoading(true);
      const resp = await serviceService.getExtraParamsByOperatorId(biller.id);
      if (resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
        setExtraParams(resp.data);
      }
      setParamsLoading(false);
    };
    loadParams();
  }, [biller.id]);

  // Extract options for select fields from extraParams
  // API returns: { param1: "0019" (code/value), param2: "VASAI RD. URBAN Subdivision" (display name) }
  // Display: "param1 - param2" (e.g., "0019 - VASAI RD. URBAN Subdivision")
  // Value: param1 only (what gets sent to API)
  const getSelectOptions = useCallback(() => {
    if (!extraParams.length) return [];
    return extraParams.map(p => {
      const val = p.param1 || p.paramName || p.name || p.displayName || "";
      const displayName = p.param2 || "";
      const label = displayName ? `${val} - ${displayName}` : val;
      return { label, value: val };
    }).filter(opt => opt.label && opt.value);
  }, [extraParams]);

  const inputFields = useMemo(() => {
    if (biller.inputFields && Object.keys(biller.inputFields).length > 0) {
      const selectOptions = getSelectOptions();
      return Object.entries(biller.inputFields).map(([key, field]) => ({
        key,
        label: field.label || key,
        type: field.type || "text",
        required: field.required !== false,
        placeholder: field.placeholder || `Enter ${field.label || key}`,
        options: field.type === "select" ? selectOptions : [],
      }));
    }
    if (extraParams.length > 0) {
      return extraParams.slice(0, 2).map((p, i) => ({
        key: `field${i + 1}`,
        label: p.fieldName || p.displayName || `Field ${i + 1}`,
        type: "text",
        required: true,
        placeholder: p.placeholder || p.fieldName || `Enter field ${i + 1}`,
        options: [],
      }));
    }
    return [
      {
        key: "field1",
        label: "User Name/Phone Number",
        type: "text",
        required: true,
        placeholder: "Enter User Name/Phone Number",
        options: [],
      },
    ];
  }, [biller.inputFields, extraParams, getSelectOptions]);

  const handleChange = (key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleSubmit = () => {
    const missing = inputFields.find(
      (f) => f.required && !formValues[f.key]?.trim()
    );
    if (missing) {
      setError(`Please enter ${missing.label}`);
      return;
    }
    onSubmit(formValues);
  };

  return (
    <div className="bf-step bf-step-enter">
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={onBack}>
          <FaArrowLeft />
        </button>
        <h1>{biller.operatorName || biller.name}</h1>
        <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
      </div>

      {paramsLoading ? (
        <div className="bf-card">
          <div className="bf-skeleton-block" />
          <div className="bf-skeleton-block bf-skeleton-block--short" />
        </div>
      ) : (
        <>
          <div className="bf-card bf-form-card">
            {inputFields.map((field, idx) => (
              <div className="bf-field" key={field.key}>
                <label className="bf-label">{field.label}</label>
                <div className="bf-input-row">
                  {field.type === "select" ? (
                    <SearchableSelect
                      options={field.options}
                      value={formValues[field.key] || ""}
                      onChange={(val) => handleChange(field.key, val)}
                      placeholder={`Select ${field.label}`}
                      label={field.label}
                    />
                  ) : (
                    <input
                      className="bf-input"
                      type={field.type === "number" ? "tel" : "text"}
                      placeholder={field.placeholder}
                      value={formValues[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      inputMode={field.type === "number" ? "numeric" : "text"}
                    />
                  )}
                  {idx === 0 && field.type !== "select" && (
                    <div className="bf-input-icon">
                      <FaUserAlt />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {error && <div className="bf-error">{error}</div>}
          </div>

          <div className="bf-card bf-info-card">
            <div className="bf-info-row">
              <BharatConnectLogo />
              <p className="bf-info-text">
                By proceeding further, you allow vasbazaar to fetch your current
                and future bills and remind you.
              </p>
            </div>
          </div>

          {biller.isDTH && (
            <div className="bf-notice-bar">
              Keep Set top box on while recharging.
            </div>
          )}

          <button
            className={`bf-primary-btn${isLoading ? " is-loading" : ""}`}
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="bf-btn-loader" />
            ) : (
              "Confirm"
            )}
          </button>
        </>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   Step 3: Bill View
   ══════════════════════════════════════════════ */
const BillView = ({ biller, billData, amount, setAmount, onPay, onBack, isExact }) => {
  const [showSTBConfirm, setShowSTBConfirm] = useState(false);
  const isDTH = !!biller.isDTH;

  const labelMap = {
    customername: "Customer Name",
    dueDate: "Due Date",
    billAmount: "Bill Amount",
    billnumber: "Bill Number",
    billdate: "Bill Date",
    billperiod: "Bill Period",
  };
  const hiddenKeys = [
    "statusMessage",
    "acceptPayment",
    "acceptPartPay",
    "paymentAmountExactness",
    "maxBillAmount",
    "AddInfo",
  ];

  const displayEntries = Object.entries(billData || {}).filter(
    ([key, value]) =>
      value != null &&
      String(value).trim() !== "" &&
      !hiddenKeys.includes(key)
  );

  const handlePayClick = () => {
    if (isDTH) {
      setShowSTBConfirm(true);
    } else {
      onPay();
    }
  };

  return (
    <div className="bf-step bf-step-enter">
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={onBack}>
          <FaArrowLeft />
        </button>
        <h1>{biller.operatorName || biller.name}</h1>
        <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
      </div>

      {/* Biller Info */}
      <div className="bf-card bf-biller-info-card">
        <div className="bf-biller-info-row">
          <img
            src={biller.logo || FAVICON_SRC}
            alt=""
            className="bf-biller-info-logo"
            onError={handleBillerLogoError}
          />
          <div>
            <div className="bf-biller-info-name">
              {biller.operatorName || biller.name}
            </div>
            <div className="bf-biller-info-sub">Bharat Billpay</div>
          </div>
        </div>
      </div>

      {/* Amount to Pay */}
      <div className="bf-amount-display">
        <span className="bf-amount-label">Amount to pay</span>
        <span className="bf-amount-value">
          ₹{parseFloat(amount || "0").toFixed(2)}
        </span>
      </div>

      {/* Bill Details Grid */}
      <div className="bf-card bf-details-card">
        <div className="bf-details-grid">
          {displayEntries.map(([key, value]) => (
            <div className="bf-detail-item" key={key}>
              <span className="bf-detail-label">
                {labelMap[key] || key.replace(/_/g, " ")}
              </span>
              <strong className="bf-detail-value">
                {key === "billAmount" ? `${value}` : String(value ?? "NA")}
              </strong>
            </div>
          ))}
        </div>
      </div>

      {/* Amount Input (if not exact) */}
      {!isExact && (
        <div className="bf-card bf-amount-card">
          <label className="bf-label">Amount</label>
          <input
            className="bf-input"
            type="tel"
            inputMode="decimal"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value.replace(/[^0-9.]/g, ""))
            }
          />
        </div>
      )}

      {/* Min/Max Amount Limits */}
      {(biller.minAmount != null || biller.maxAmount != null) && (
        <div className="bf-amount-limits">
          {biller.minAmount != null && (
            <span className="bf-limit-item">
              <span className="bf-limit-label">Min:</span> ₹{biller.minAmount}
            </span>
          )}
          {biller.maxAmount != null && (
            <span className="bf-limit-item">
              <span className="bf-limit-label">Max:</span> ₹{biller.maxAmount}
            </span>
          )}
        </div>
      )}

      <div className="bf-divider" />
      <button className="bf-primary-btn" type="button" onClick={handlePayClick}>
        {isDTH ? "Recharge your DTH" : "Pay Bill"}
      </button>

      {/* STB Confirmation Modal for DTH */}
      {showSTBConfirm && (
        <div className="bf-modal-overlay" onClick={() => setShowSTBConfirm(false)}>
          <div className="bf-stb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bf-stb-modal-icon">📡</div>
            <h3 className="bf-stb-modal-title">Set Top Box Confirmation</h3>
            <p className="bf-stb-modal-text">
              Please confirm that your Set Top Box is switched <strong>ON</strong> before proceeding with the recharge.
            </p>
            <div className="bf-stb-modal-actions">
              <button
                type="button"
                className="bf-stb-modal-btn bf-stb-modal-btn--cancel"
                onClick={() => setShowSTBConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bf-stb-modal-btn bf-stb-modal-btn--confirm"
                onClick={() => { setShowSTBConfirm(false); onPay(); }}
              >
                Yes, It's ON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   DTH Plans View
   ══════════════════════════════════════════════ */
const DTHPlansView = ({ biller, mobile, operators, onSelectPlan, onBack, onChangeOperator }) => {
  const [comboPlans, setComboPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All Plans");
  const [search, setSearch] = useState("");

  const opName = biller.operatorName || biller.name || "Operator";
  const opLogo = biller.logo || "";
  const billerOpCode = biller.operatorCode || biller.opCode || biller.operator_code || "";

  useEffect(() => {
    const fetchDTH = async () => {
      if (!billerOpCode) {
        console.warn("[DTHPlans] No opCode found in biller:", JSON.stringify(biller, null, 2));
        setLoading(false);
        return;
      }
      setLoading(true);
      console.log("[DTHPlans] Fetching plans with opCode:", billerOpCode);
      const res = await rechargeService.fetchDTHPlans({ opCode: billerOpCode });
      console.log("[DTHPlans] API response:", JSON.stringify(res, null, 2).slice(0, 500));

      if (res.success) {
        // Try all possible paths where Combo data could be
        const combo =
          res.data?.RDATA?.Combo ||
          res.data?.Combo ||
          res.raw?.RDATA?.Combo ||
          res.raw?.data?.RDATA?.Combo ||
          (Array.isArray(res.data) ? res.data : []);
        console.log("[DTHPlans] Combo plans found:", Array.isArray(combo) ? combo.length : 0);
        setComboPlans(Array.isArray(combo) ? combo : []);
      } else {
        console.warn("[DTHPlans] API failed:", res.message);
      }
      setLoading(false);
    };
    fetchDTH();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billerOpCode]);

  /* Extract categories from Language field */
  const categories = useMemo(() => {
    const langs = [...new Set(comboPlans.map((item) => item.Language).filter(Boolean))];
    return ["All Plans", ...langs];
  }, [comboPlans]);

  /* Flatten combo plans into renderable items */
  const allPlans = useMemo(() => {
    return comboPlans.flatMap((combo, ci) => {
      if (!combo.Details || !Array.isArray(combo.Details)) return [];
      return combo.Details.map((detail, di) => ({
        id: `${combo.Language}-${ci}-${di}`,
        category: combo.Language,
        planName: detail.PlanName || "",
        channels: detail.Channels || "",
        paidChannels: detail.PaidChannels || "",
        hdChannels: detail.HdChannels || "",
        lastUpdate: detail.last_update || "",
        pricing: detail.PricingList || [],
        searchText: `${detail.PlanName} ${combo.Language} ${(detail.PricingList || []).map((p) => p.Amount).join(" ")}`.toLowerCase(),
      }));
    });
  }, [comboPlans]);

  /* Filter by tab + search */
  const filtered = useMemo(() => {
    let list = activeTab === "All Plans" ? allPlans : allPlans.filter((p) => p.category === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const searchAmt = parseInt(q.replace(/\D/g, ""), 10);
      list = list.filter((p) => {
        if (!isNaN(searchAmt) && p.pricing.some((pr) => parseInt(String(pr.Amount).replace(/\D/g, ""), 10) === searchAmt)) return true;
        return p.searchText.includes(q);
      });
    }
    return list;
  }, [allPlans, activeTab, search]);

  const handlePriceSelect = (plan, priceObj) => {
    onSelectPlan({
      rs: String(priceObj.Amount).replace(/[^0-9]/g, ""),
      validity: priceObj.Month || "N/A",
      category: plan.planName,
      desc: `${plan.channels} Channels, ${plan.paidChannels} Paid, ${plan.hdChannels} HD`,
    });
  };

  return (
    <div className="bf-step bf-step-enter">
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={onBack}><FaArrowLeft /></button>
        <h1>DTH Plans</h1>
        <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
      </div>

      {/* Operator info card */}
      <div className="bf-dth-operator-card">
        <div className="bf-dth-operator-left">
          {opLogo ? <img src={opLogo} alt="" className="bf-dth-operator-logo" /> : <div className="bf-dth-operator-avatar">{opName[0]}</div>}
          <div>
            <div className="bf-dth-operator-name">Customer &middot; {mobile}</div>
            <div className="bf-dth-operator-sub">{opName}</div>
          </div>
        </div>
        <button type="button" className="bf-dth-change-btn" onClick={onChangeOperator}>Change</button>
      </div>

      {/* Search */}
      <div className="bf-search-section">
        <div className="bf-hero-search">
          <FaSearch className="bf-hero-search-icon" />
          <input className="bf-hero-search-input" placeholder="Search Plan or Enter Amount" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button type="button" className="bf-hero-search-clear" onClick={() => setSearch("")}>&times;</button>}
        </div>
      </div>

      {/* Category tabs */}
      <div className="bf-dth-tabs">
        {categories.map((tab) => (
          <button key={tab} type="button" className={`bf-dth-tab${activeTab === tab ? " is-active" : ""}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {/* Plans */}
      <div className="bf-dth-plans-area">
        {loading ? (
          <div className="bf-skeleton-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bf-skeleton-row" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="bf-skeleton-avatar" />
                <div className="bf-skeleton-lines"><div className="bf-skeleton-text" /><div className="bf-skeleton-text bf-skeleton-text--short" /></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Custom amount card — shown when searched amount not found in plans */}
            {(() => {
              const digits = search.trim().replace(/\D/g, "");
              if (digits && Number(digits) > 0) {
                const exactMatch = allPlans.some((p) =>
                  p.pricing.some((pr) => String(pr.Amount).replace(/[^0-9]/g, "") === digits)
                );
                if (!exactMatch) {
                  return (
                    <div className="bf-dth-plan-group bf-dth-custom-card" onClick={() => onSelectPlan({ rs: digits, validity: "Custom", category: "Custom Recharge", desc: `Custom DTH recharge of ₹${digits}` })}>
                      <div className="bf-dth-plan-group-header">
                        <h3 className="bf-dth-plan-group-title">Custom Recharge</h3>
                        <span className="bf-dth-plan-group-badge bf-dth-custom-badge">CUSTOM</span>
                      </div>
                      <div className="bf-dth-custom-amount">₹{digits}</div>
                      <p className="bf-dth-custom-desc">Recharge with your custom amount</p>
                      <div className="bf-dth-recharge-list">
                        <button type="button" className="bf-dth-recharge-card bf-dth-custom-btn">
                          <div>
                            <div className="bf-dth-recharge-price">₹{digits}</div>
                            <div className="bf-dth-recharge-validity">Tap to proceed</div>
                          </div>
                          <FiArrowRight className="bf-dth-recharge-arrow" />
                        </button>
                      </div>
                    </div>
                  );
                }
              }
              return null;
            })()}

            {filtered.length === 0 ? (
              <div className="bf-empty">
                <div className="bf-empty-circle"><FaTv /></div>
                <p className="bf-empty-title">No plans found</p>
                <p className="bf-empty-desc">Try a different search or category</p>
              </div>
            ) : (
              filtered.map((plan) => (
            <div key={plan.id} className="bf-dth-plan-group">
              <div className="bf-dth-plan-group-header">
                <h3 className="bf-dth-plan-group-title">{plan.planName}</h3>
                <span className="bf-dth-plan-group-badge">DTH</span>
              </div>
              <div className="bf-dth-channel-strip">
                <div className="bf-dth-channel-item"><span className="bf-dth-channel-label">CHANNELS</span><strong>{plan.channels}</strong></div>
                <div className="bf-dth-channel-item"><span className="bf-dth-channel-label">PAID</span><strong>{plan.paidChannels}</strong></div>
                <div className="bf-dth-channel-item"><span className="bf-dth-channel-label">HD</span><strong>{plan.hdChannels}</strong></div>
              </div>
              {plan.lastUpdate && <div className="bf-dth-last-update">Last Updated: {plan.lastUpdate}</div>}
              <div className="bf-dth-recharge-label">RECHARGE OPTIONS</div>
              <div className="bf-dth-recharge-list">
                {plan.pricing.map((priceObj, i) => (
                  <button key={i} type="button" className="bf-dth-recharge-card" onClick={() => handlePriceSelect(plan, priceObj)}>
                    <div>
                      <div className="bf-dth-recharge-price">{priceObj.Amount}</div>
                      <div className="bf-dth-recharge-validity">{priceObj.Month}</div>
                    </div>
                    <FiArrowRight className="bf-dth-recharge-arrow" />
                  </button>
                ))}
              </div>
            </div>
              ))
            )}
          </>
        )}
        <div className="bf-dth-disclaimer">Disclaimer: Review your plan with the operator before recharging.</div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Step 4: Offers
   ══════════════════════════════════════════════ */
const OffersStep = ({
  biller,
  amount,
  mobile,
  customerName,
  onProceed,
  onBack,
}) => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [couponSearch, setCouponSearch] = useState("");
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    offerService.getOffers(1).then((res) => {
      setLoading(false);
      if (res.success && Array.isArray(res.data)) setOffers(res.data);
    });
  }, []);

  const numericAmount = parseFloat(amount) || 0;

  const enhancedOffers = useMemo(() => {
    return offers.map((offer) => {
      let discountValue = 0;
      if (numericAmount > 0) {
        if (offer.type === "FLAT") discountValue = offer.amount;
        else if (offer.type === "PERCENTAGE")
          discountValue = (offer.amount / 100) * numericAmount;
      }
      const formatted = `₹${discountValue.toFixed(1)}`;
      const desc = offer.description
        ?.replace("{#discount#}", formatted)
        .replace("{#cashback#}", formatted);
      return { ...offer, discountValue, formattedDescription: desc };
    });
  }, [offers, numericAmount]);

  const handleApply = (offer) => {
    if (offer.categoryId?.name === "Other") {
      setCouponModalOpen(true);
      offerService.getCoupons(0).then((res) => {
        if (res.success && Array.isArray(res.data)) setCoupons(res.data);
      });
      return;
    }
    setSelectedOffer(offer.id);
    setConfetti(true);
    setTimeout(() => setConfetti(false), 1500);
  };

  const handleSelectCoupon = (coupon) => {
    setSelectedCoupon(coupon.id);
    setSelectedOffer(coupon.id);
    setConfetti(true);
    setTimeout(() => {
      setConfetti(false);
      setCouponModalOpen(false);
    }, 800);
  };

  const filteredCoupons = coupons.filter(
    (c) =>
      (c.couponName || "").toLowerCase().includes(couponSearch.toLowerCase()) ||
      (c.couponCode || "").toLowerCase().includes(couponSearch.toLowerCase())
  );

  const offerIcon = (offer) => {
    const cat = offer.categoryId?.name?.toLowerCase();
    if (cat === "cashback") return "💰";
    if (cat === "discount") return "🏷️";
    return "🎟️";
  };

  return (
    <div className="bf-step bf-step-enter">
      <div className="cm-flow-title-row">
        <button className="cm-back-icon" type="button" onClick={onBack}>
          <FaArrowLeft />
        </button>
        <h1>Mobile Recharge</h1>
        <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
      </div>

      {confetti && <div className="bf-confetti-burst" />}

      {/* User Info */}
      <div className="bf-card bf-user-card">
        <div className="bf-user-avatar">
          <img
            src={biller.logo || FAVICON_SRC}
            alt=""
            className="bf-user-avatar-img"
            onError={handleBillerLogoError}
          />
        </div>
        <div className="bf-user-info">
          <div className="bf-user-name">
            {customerName || "No Name"} &middot; {mobile}
          </div>
          <div className="bf-user-biller">
            {biller.operatorName || biller.name}
          </div>
        </div>
      </div>

      {/* Amount */}
      <div className="bf-card bf-offer-amount-card">
        <span className="bf-offer-amount">₹{numericAmount}</span>
      </div>

      {/* Offers */}
      <h2 className="bf-section-title bf-offers-title">Offers for You</h2>
      <hr className="bf-hr" />

      {loading ? (
        <div className="bf-card">
          <div className="bf-skeleton-block" />
          <div className="bf-skeleton-block" />
        </div>
      ) : enhancedOffers.length === 0 ? (
        <div className="bf-card">
          <p className="bf-info-text">No offers available right now.</p>
        </div>
      ) : (
        <div className="bf-offers-list">
          {enhancedOffers.map((offer, i) => {
            const isOther = offer.categoryId?.name === "Other";
            const isApplied = selectedOffer === offer.id;
            return (
              <div
                key={offer.id}
                className={`bf-offer-card${isApplied ? " is-applied" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="bf-offer-icon">{offerIcon(offer)}</div>
                <div className="bf-offer-content">
                  <div className="bf-offer-name">{offer.couponName}</div>
                  <div className="bf-offer-desc">
                    {offer.formattedDescription ||
                      `Upto ₹${offer.discountValue?.toFixed(1)}`}
                  </div>
                </div>
                <button
                  className={`bf-offer-btn${isApplied ? " is-applied" : ""}`}
                  type="button"
                  onClick={() => handleApply(offer)}
                >
                  {isApplied ? "Applied" : isOther ? "Select" : "Apply"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Proceed */}
      <button
        className="bf-primary-btn bf-proceed-btn"
        type="button"
        onClick={() =>
          onProceed({ couponId: selectedOffer, couponId2: selectedCoupon })
        }
      >
        Proceed to Pay
      </button>

      {/* Coupon Modal */}
      {couponModalOpen && (
        <div className="bf-modal-overlay" onClick={() => setCouponModalOpen(false)}>
          <div className="bf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bf-modal-header">
              <div className="bf-modal-search-wrap">
                <FaSearch className="bf-search-icon" />
                <input
                  className="bf-modal-search"
                  placeholder="Search Coupon"
                  value={couponSearch}
                  onChange={(e) => setCouponSearch(e.target.value)}
                />
              </div>
              <button
                className="bf-modal-close"
                type="button"
                onClick={() => setCouponModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="bf-modal-body">
              {filteredCoupons.length === 0 ? (
                <p className="bf-info-text" style={{ textAlign: "center", padding: 32 }}>
                  No coupons found
                </p>
              ) : (
                filteredCoupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className={`bf-offer-card${
                      selectedCoupon === coupon.id ? " is-applied" : ""
                    }`}
                  >
                    <div className="bf-offer-icon">
                      {coupon.logo ? (
                        <img
                          src={coupon.logo}
                          alt=""
                          style={{
                            width: 32,
                            height: 32,
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        "🎟️"
                      )}
                    </div>
                    <div className="bf-offer-content">
                      <div className="bf-offer-name">{coupon.couponName}</div>
                      <div className="bf-offer-desc">{coupon.description}</div>
                    </div>
                    <button
                      className={`bf-offer-btn${
                        selectedCoupon === coupon.id ? " is-applied" : ""
                      }`}
                      type="button"
                      onClick={() => handleSelectCoupon(coupon)}
                    >
                      {selectedCoupon === coupon.id ? "Applied" : "Apply"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   Step 5: Payment Method Selection
   ══════════════════════════════════════════════ */
const PaymentMethodStep = ({
  biller,
  amount,
  mobile,
  customerName,
  walletBalance,
  onPay,
  onBack,
  isLoading,
}) => (
  <div className="bf-step bf-step-enter">
    <div className="cm-flow-title-row">
      <button className="cm-back-icon" type="button" onClick={onBack}>
        <FaArrowLeft />
      </button>
      <h1>Payment</h1>
      <img src="https://webdekho.in/images/bbps.svg" alt="Bharat Connect" className="cm-bc-title-logo cm-bc-title-logo--lg" />
    </div>

    {/* User Info */}
    <div className="bf-card bf-user-card">
      <div className="bf-user-avatar">
        <img
          src={biller.logo || FAVICON_SRC}
          alt=""
          className="bf-user-avatar-img"
          onError={handleBillerLogoError}
        />
      </div>
      <div className="bf-user-info">
        <div className="bf-user-name">
          {customerName || "No Name"} - {mobile}
        </div>
        <div className="bf-user-biller">
          {biller.operatorName || biller.name}
        </div>
      </div>
    </div>

    {/* Amount */}
    <div className="bf-card bf-offer-amount-card">
      <span className="bf-offer-amount">₹{parseFloat(amount).toFixed(0)}</span>
    </div>

    {/* Payment Methods */}
    <h2 className="bf-section-title">Select Payment Method</h2>

    <div className="bf-payment-methods">
      {/* UPI */}
      <div className="bf-payment-card bf-payment-recommended">
        <span className="bf-recommended-badge">Recommended</span>
        <div className="bf-payment-row">
          <div className="bf-payment-icon-wrap">
            <FiCreditCard className="bf-payment-icon" />
          </div>
          <div className="bf-payment-info">
            <div className="bf-payment-name">UPI</div>
            <div className="bf-payment-desc">Pay using UPI</div>
          </div>
          <button
            className="bf-pay-btn"
            type="button"
            disabled={isLoading}
            onClick={() => onPay("upi")}
          >
            {isLoading ? <span className="bf-btn-loader" /> : "Pay"}
          </button>
        </div>
      </div>

      {/* Wallet */}
      <div className="bf-payment-card">
        <div className="bf-payment-row">
          <div className="bf-payment-icon-wrap">
            <FaWallet className="bf-payment-icon" />
          </div>
          <div className="bf-payment-info">
            <div className="bf-payment-name">Wallet Balance</div>
            <div className="bf-payment-desc">
              Available: Rs.{walletBalance.toFixed(2)}
            </div>
          </div>
          <button
            className="bf-pay-btn"
            type="button"
            disabled={isLoading || walletBalance < parseFloat(amount)}
            onClick={() => onPay("wallet")}
          >
            {isLoading ? <span className="bf-btn-loader" /> : "Pay"}
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* ── Helper to extract operator array and mybillers from various response shapes ── */
const extractOperatorsWithMyBillers = (data) => {
  // New API format: { mybillers: [...], data: [...] }
  if (data?.mybillers || data?.data) {
    return {
      myBillers: Array.isArray(data.mybillers) ? data.mybillers : [],
      operators: Array.isArray(data.data) ? data.data : [],
    };
  }
  // Legacy formats
  if (Array.isArray(data)) return { myBillers: [], operators: data };
  if (data?.content && Array.isArray(data.content)) return { myBillers: [], operators: data.content };
  return { myBillers: [], operators: [] };
};

/* ══════════════════════════════════════════════
   Main BillerFlow Orchestrator
   ══════════════════════════════════════════════ */
const BillerFlowScreen = ({ serviceData, operators: passedOperators, navigate }) => {
  const nav = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill;
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [banners, setBanners] = useState([]);
  const [billers, setBillers] = useState(passedOperators || []);
  const [myBillers, setMyBillers] = useState([]);
  const [billersLoading, setBillersLoading] = useState(false);
  const [selectedBiller, setSelectedBiller] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [billData, setBillData] = useState(null);
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("No Name");
  const [mobile, setMobile] = useState("");
  const [isExact, setIsExact] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [couponData, setCouponData] = useState({});
  const autoPrefillRunRef = useRef(false);
  const [autoSubmitPending, setAutoSubmitPending] = useState(null);

  /* Fetch billers directly using the same API as old project */
  useEffect(() => {
    advertisementService.getHomeAdvertisements().then((res) => {
      if (res.success && Array.isArray(res.data)) setBanners(res.data);
    });
    userService.getUserProfile().then((res) => {
      if (res.success) setWalletBalance(Number(res.data?.balance || 0));
    });

    // Always fetch billers fresh to ensure full data
    const fetchBillers = async () => {
      setBillersLoading(true);
      const resp = await serviceService.getOperatorsByService(serviceData.id);
      setBillersLoading(false);
      if (resp.success) {
        const { myBillers: fetchedMyBillers, operators } = extractOperatorsWithMyBillers(resp.data);
        setMyBillers(fetchedMyBillers);
        if (operators.length > 0) setBillers(operators);
      }
    };
    fetchBillers();
  }, [serviceData.id]);

  const goBack = useCallback(() => {
    if (step === 0) navigate("/customer/app/services");
    else setStep((s) => s - 1);
  }, [step, navigate]);

  /* Step 1 → 2: Select biller */
  const isDTH = serviceData.slug === "dth";
  const handleSelectBiller = (biller) => {
    setSelectedBiller({ ...biller, isDTH });
    setStep(1);
  };

  /* Auto-select biller from Upcoming Dues prefill, skipping the biller list. */
  useEffect(() => {
    if (autoPrefillRunRef.current) return;
    if (!prefill?.operatorId) return;
    if (billersLoading) return;

    const target = String(prefill.operatorId);
    const combined = [...myBillers, ...billers];
    let match = combined.find((b) => String(b.id) === target);
    if (!match && prefill.operatorCode) {
      match = combined.find((b) =>
        (b.operatorCode || b.opCode) === prefill.operatorCode
      );
    }
    // Fall back to a synthetic biller from prefill so we can still fetch the bill.
    if (!match) {
      match = {
        id: prefill.operatorId,
        operatorName: prefill.operatorName,
        operatorCode: prefill.operatorCode,
      };
    }

    autoPrefillRunRef.current = true;
    setSelectedBiller({ ...match, isDTH });
    if (prefill.mobile) {
      setAutoSubmitPending({ field1: prefill.mobile, field2: "" });
    } else {
      setStep(1);
    }
  }, [prefill, billers, myBillers, billersLoading, isDTH]);

  /* Trigger the bill fetch once the biller is committed to state. */
  useEffect(() => {
    if (!autoSubmitPending || !selectedBiller) return;
    const values = autoSubmitPending;
    setAutoSubmitPending(null);
    handleFormSubmit(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitPending, selectedBiller]);

  /* Step 2 → 3: Submit form, fetch bill (or show DTH plans) */
  const handleFormSubmit = async (values) => {
    setFormValues(values);
    setMobile(values.field1);

    // DTH: go directly to DTH plans view (step 2 = DTH plans)
    if (isDTH) {
      setLoading(false);
      setStep(2);
      return;
    }

    setLoading(true);
    const fetchReq = selectedBiller.fetchRequirement;
    let bill = {
      dueDate: "NA",
      billAmount: 0,
      customername: "No Name",
      billnumber: "NA",
      billdate: "NA",
    };

    if (fetchReq && fetchReq.toLowerCase() !== "not_supported") {
      // If field2 has city selection, swap: field1=CITY (uppercase), field2="", mn=service number
      const hasCity = values.field2 && values.field2.trim();
      const resp = await rechargeService.viewBill({
        operatorId: Number(selectedBiller.id),
        field1: hasCity ? values.field2.toUpperCase() : values.field1,
        field2: hasCity ? "" : (values.field2 || null),
        mn: values.field1,
        op: selectedBiller.id,
      });
      if (resp.success && resp.data) {
        const d = Array.isArray(resp.data?.data)
          ? resp.data.data[0]
          : resp.data;
        if (d) {
          bill = {
            dueDate: d.dueDate || "NA",
            billAmount: d.billAmount || 0,
            customername: d.customername || "No Name",
            billnumber: d.billnumber || "NA",
            billdate: d.billdate || "NA",
            billperiod: d.billperiod || "",
          };
        }
      }
    }

    setBillData(bill);
    // Fallback to prefill amount (from Upcoming Dues) when live bill fetch returns 0.
    setAmount(String(bill.billAmount || prefill?.amount || "0"));
    setCustomerName(bill.customername || "No Name");
    setIsExact(
      selectedBiller.amountExactness === "Exact" && bill.billAmount > 0
    );
    setLoading(false);
    setStep(2);
  };

  /* DTH: select a plan → go to offers page */
  const handleDTHPlanSelect = (plan) => {
    const opName = selectedBiller?.operatorName || selectedBiller?.name || serviceData.name;
    navigate("/customer/app/offers", {
      state: {
        type: "bill", operatorId: selectedBiller?.id, amount: plan.rs,
        label: serviceData.name, mobile, field1: mobile, field2: formValues?.field2 || mobile,
        viewBillResponse: billData || {}, operatorName: opName,
        logo: selectedBiller?.logo, serviceId: serviceData?.id,
      },
    });
  };

  /* Step 3: Pay bill → go to offers page */
  const handlePayBill = () => {
    if (!amount || Number(amount) <= 0) return;
    const opName = selectedBiller?.operatorName || selectedBiller?.name || serviceData.name;
    navigate("/customer/app/offers", {
      state: {
        type: "bill", operatorId: selectedBiller?.id, amount: Number(amount),
        label: serviceData.name, mobile, field1: formValues?.field1 || mobile, field2: formValues?.field2 || null,
        viewBillResponse: billData || {}, operatorName: opName,
        logo: selectedBiller?.logo, serviceId: serviceData?.id,
      },
    });
  };

  /* Step 4 → 5: Proceed from offers → payment method */
  const handleProceedFromOffers = (coupons) => {
    setCouponData(coupons);
    setStep(4);
  };

  /* Step 5: Execute payment */
  const handlePay = async (payType) => {
    setLoading(true);

    // Pre-open window synchronously for PWA standalone (Safari blocks async window.open as popup)
    let pwaWindow = null;
    if (payType === "upi" && !Capacitor.isNativePlatform() && isPwaStandalone()) {
      pwaWindow = window.open("about:blank", "_blank");
    }

    const payload = {
      amount: Number(amount),
      operatorId: Number(selectedBiller.id),
      validity: 30,
      payType,
      mobile: mobile,
      name: customerName,
      field1: formValues.field1,
      field2: formValues.field2 || null,
      viewBillResponse: billData || {},
    };

    // For UPI, use Juspay redirect flow
    const rechargeCall = payType === "upi"
      ? juspayService.rechargeWithJuspay(payload)
      : rechargeService.recharge(payload);

    const response = await rechargeCall;
    if (!response.success) {
      if (pwaWindow) pwaWindow.close();
      setLoading(false);
      showToast(sanitizeBackendMessage(response.message, "Payment could not be processed."), "error");
      return;
    }

    // Check if Juspay returned a payment URL (UPI redirect flow)
    if (payType === "upi") {
      const paymentUrl = juspayService.extractPaymentUrl(response);
      if (paymentUrl) {
        const orderId = juspayService.extractOrderId(response);
        juspayService.savePaymentContext({
          orderId,
          amount,
          type: "bill",
          label: serviceData.name,
          mobile,
          operatorName: selectedBiller.operatorName || selectedBiller.name,
          operatorId: selectedBiller.id,
          logo: selectedBiller.logo,
          couponCode: couponData?.code || null,
          couponName: couponData?.name || null,
          discountValue: couponData?.discountValue || 0,
          cashbackValue: couponData?.cashbackValue || 0,
          offerType: couponData?.offerType || null,
        });

        // PWA standalone: use pre-opened window (Safari blocks async popups)
        if (pwaWindow && !pwaWindow.closed) {
          pwaWindow.location.href = paymentUrl;
        } else {
          window.location.href = paymentUrl;
        }
        return;
      }
    }

    // Direct flow (wallet or UPI without redirect)
    const txnId =
      response.data?.txnId ||
      response.data?.txnid ||
      response.data?.transactionId ||
      response.raw?.data?.txnId ||
      `VB${Date.now()}`;

    const statusResponse = await rechargeService.checkRechargeStatus({
      txnId,
      field1: payload.field1,
      field2: payload.field2,
      validity: payload.validity,
      recharge: true,
      viewBillResponse: payload.viewBillResponse,
    });

    setLoading(false);

    nav("/customer/app/success", {
      state: {
        type: "bill",
        amount,
        label: serviceData.name,
        txnId,
        statusPayload: statusResponse.data || response.data,
        paymentType: payType,
        customerName,
        mobile,
        billerName: selectedBiller.operatorName || selectedBiller.name,
        billerLogo: selectedBiller.logo,
        couponData,
      },
    });
  };

  const dthSteps = [
    <BillerList
      key="list"
      operators={billers}
      myBillers={myBillers}
      isLoading={billersLoading}
      onSelect={handleSelectBiller}
      onBack={goBack}
      serviceName={serviceData.name}
      banners={banners}
    />,
    selectedBiller && (
      <BillerForm
        key="form"
        biller={selectedBiller}
        onSubmit={handleFormSubmit}
        onBack={goBack}
        isLoading={loading}
      />
    ),
    selectedBiller && (
      <DTHPlansView
        key="dth-plans"
        biller={selectedBiller}
        mobile={mobile}
        operators={billers}
        onSelectPlan={handleDTHPlanSelect}
        onBack={goBack}
        onChangeOperator={() => setStep(0)}
      />
    ),
    selectedBiller && (
      <OffersStep
        key="offers"
        biller={selectedBiller}
        amount={amount}
        mobile={mobile}
        customerName={customerName}
        onProceed={handleProceedFromOffers}
        onBack={goBack}
      />
    ),
    selectedBiller && (
      <PaymentMethodStep
        key="payment"
        biller={selectedBiller}
        amount={amount}
        mobile={mobile}
        customerName={customerName}
        walletBalance={walletBalance}
        onPay={handlePay}
        onBack={goBack}
        isLoading={loading}
      />
    ),
  ];

  const billerSteps = [
    <BillerList
      key="list"
      operators={billers}
      myBillers={myBillers}
      isLoading={billersLoading}
      onSelect={handleSelectBiller}
      onBack={goBack}
      serviceName={serviceData.name}
      banners={banners}
    />,
    selectedBiller && (
      <BillerForm
        key="form"
        biller={selectedBiller}
        onSubmit={handleFormSubmit}
        onBack={goBack}
        isLoading={loading}
      />
    ),
    selectedBiller && (
      <BillView
        key="bill"
        biller={selectedBiller}
        billData={billData}
        amount={amount}
        setAmount={setAmount}
        onPay={handlePayBill}
        onBack={goBack}
        isExact={isExact}
      />
    ),
    selectedBiller && (
      <OffersStep
        key="offers"
        biller={selectedBiller}
        amount={amount}
        mobile={mobile}
        customerName={customerName}
        onProceed={handleProceedFromOffers}
        onBack={goBack}
      />
    ),
    selectedBiller && (
      <PaymentMethodStep
        key="payment"
        biller={selectedBiller}
        amount={amount}
        mobile={mobile}
        customerName={customerName}
        walletBalance={walletBalance}
        onPay={handlePay}
        onBack={goBack}
        isLoading={loading}
      />
    ),
  ];

  const stepComponents = isDTH ? dthSteps : billerSteps;

  return (
    <div className="bf-container">
      {stepComponents[step]}
    </div>
  );
};

export default BillerFlowScreen;
