import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaSearch, FaSyncAlt, FaUserCircle, FaInbox, FaBell, FaCommentDots, FaDownload, FaSpinner, FaFileInvoice, FaUserPlus } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import { useToast } from "../../context/ToastContext";
import { buildCsv, downloadCsv } from "../../utils/exportCsv";
import AddCustomerSheet from "./components/AddCustomerSheet";
import RenewSubscriptionSheet from "./components/RenewSubscriptionSheet";
import CustomerPickerSheet from "./components/CustomerPickerSheet";

const SORT_OPTIONS = [
  { value: "latest", label: "Latest activity" },
  { value: "oldest", label: "Oldest activity" },
  { value: "amount_high", label: "Amount (High to Low)" },
  { value: "amount_low", label: "Amount (Low to High)" },
  { value: "name", label: "Name (A-Z)" },
];

const formatINR = (n) => {
  const v = Number(n || 0);
  return `₹${Math.round(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatRelative = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const OutstandingListScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({ totalReceivable: 0, totalPayable: 0, customerCount: 0 });
  const [customers, setCustomers] = useState([]);
  const [owedByMe, setOwedByMe] = useState([]);
  const [sort, setSort] = useState("latest");
  const [search, setSearch] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showRenewSheet, setShowRenewSheet] = useState(false);
  const [subscriptionLocked, setSubscriptionLocked] = useState(false);
  const [invoicePickMode, setInvoicePickMode] = useState(false);
  // When the add-customer sheet was opened as part of the create-invoice flow,
  // jump straight into the new customer's invoice form after they're saved.
  const [invoiceAfterAdd, setInvoiceAfterAdd] = useState(false);

  // A customer row tap opens that customer's ledger.
  const handleCustomerTap = (customerId) => {
    if (subscriptionLocked) return;
    navigate(`/customer/app/outstanding/${customerId}`);
  };

  // From the invoice picker popup: jump straight into the chosen customer's
  // new-invoice form.
  const handleInvoiceCustomerPick = (customerId) => {
    setInvoicePickMode(false);
    navigate(`/customer/app/outstanding/${customerId}/invoice/new`);
  };

  // Create-invoice entry point: with no customers yet, add one first (then land
  // on their invoice form); otherwise let the user pick an existing customer.
  const startCreateInvoice = () => {
    if (subscriptionLocked) return;
    if (customers.length === 0) {
      setInvoiceAfterAdd(true);
      setShowAddSheet(true);
      return;
    }
    setInvoicePickMode(true);
  };

  const checkSubscriptionAccess = async () => {
    const res = await outstandingService.getSubscription();
    if (!res?.success || !res.data || res.data.isActive) {
      setSubscriptionLocked(false);
      return true;
    }

    if (res.data.autoRenewEnabled && (res.data.autoRenewMode || "wallet") === "wallet") {
      const renewRes = await outstandingService.renewSubscription();
      if (renewRes?.success) {
        setSubscriptionLocked(false);
        return true;
      }
    }

    setSubscriptionLocked(true);
    setShowRenewSheet(true);
    return false;
  };

  const load = async () => {
    setLoading(true);
    const canUseService = await checkSubscriptionAccess();
    if (!canUseService) {
      setLoading(false);
      setError("ReBill subscription expired. Please renew to continue using this service.");
      setSummary({ totalReceivable: 0, totalPayable: 0, customerCount: 0 });
      setCustomers([]);
      setOwedByMe([]);
      return;
    }

    const [sumRes, listRes, owedRes] = await Promise.all([
      outstandingService.getSummary(),
      outstandingService.listCustomers(0, 100, sort),
      outstandingService.getOwedByMe(),
    ]);
    setLoading(false);
    if (!sumRes.success) {
      setError(sumRes.message || "Failed to load");
      return;
    }
    setSummary(sumRes.data || { totalReceivable: 0, totalPayable: 0, customerCount: 0 });
    setCustomers(listRes.data?.records || []);
    setOwedByMe(Array.isArray(owedRes.data) ? owedRes.data : []);
    setError("");
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [sort]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.customerName || "").toLowerCase().includes(q) ||
        (c.customerMobile || "").includes(q),
    );
  }, [customers, search]);

  const onCustomerAdded = (newCustomer) => {
    setShowAddSheet(false);
    const goInvoice = invoiceAfterAdd;
    setInvoiceAfterAdd(false);
    if (newCustomer?.id) {
      navigate(`/customer/app/outstanding/${newCustomer.id}${goInvoice ? "/invoice/new" : ""}`);
    } else {
      load();
    }
  };

  const exportAllCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Pull the full customer set (not just the page on screen).
      const res = await outstandingService.listCustomers(0, 5000, "name");
      const records = res?.data?.records || customers;
      if (!records.length) {
        showToast("No customers to export", "info");
        return;
      }
      const headers = [
        "Customer Name", "Mobile", "Category", "Status", "Balance (INR)",
        "Credit Limit", "Credit Used %", "Due Date", "Promise To Pay",
        "Ageing (days)", "App User", "Last Activity",
      ];
      const rows = records.map((c) => {
        const bal = Number(c.balance || 0);
        const status = bal > 0 ? "Outstanding" : bal < 0 ? "Advance" : "Settled";
        return [
          c.customerName || "",
          c.customerMobile || "",
          c.category || "REGULAR",
          status,
          Math.round(bal),
          c.creditLimit != null ? Math.round(Number(c.creditLimit)) : "",
          c.creditUsagePct != null ? c.creditUsagePct : "",
          c.dueDate ? String(c.dueDate).slice(0, 10) : "",
          c.promiseToPayDate ? String(c.promiseToPayDate).slice(0, 10) : "",
          bal > 0 ? (c.ageingDays || 0) : "",
          c.isAppUser ? "Yes" : "No",
          c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleString("en-IN") : "",
        ];
      });
      const csv = buildCsv(headers, rows);
      const today = new Date().toISOString().slice(0, 10);
      await downloadCsv(`rebill-customers-${today}.csv`, csv);
      showToast(`${rows.length} customer${rows.length === 1 ? "" : "s"} exported`, "success");
    } catch (e) {
      if (e?.name !== "AbortError") showToast("Could not export CSV. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const totalReceivable = Number(summary.totalReceivable || 0);
  const totalPayable = Number(summary.totalPayable || 0);
  const netBalance = totalReceivable - totalPayable;
  // +ve net = "You Will Receive" → green; -ve = "You Owe" → red.
  const heroTone = netBalance > 0 ? "ol-hero-positive" : netBalance < 0 ? "ol-hero-negative" : "ol-hero-settled";

  return (
    <div className="ol-page ol-list-page">
      <div className="ol-ledger-header">
        <button className="ol-back-btn" type="button" onClick={() => navigate("/customer/app")} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-id">
          <div className="ol-ledger-name">ReBill</div>
          <div className="ol-ledger-mobile">{summary.customerCount || 0} customer{summary.customerCount === 1 ? "" : "s"}</div>
        </div>
      </div>

      {/* Action chips — own horizontally-scrollable row below the title, above the hero card */}
      <div className="ol-hdr-actions ol-hdr-actions-row">
        <button
          className="ol-chip ol-chip-newcust"
          type="button"
          aria-label="Add customer"
          title="Add customer"
          disabled={subscriptionLocked}
          onClick={() => !subscriptionLocked && setShowAddSheet(true)}
        >
          <FaUserPlus /><span>Add Customer</span>
        </button>
        <button
          className="ol-chip ol-chip-create"
          type="button"
          aria-label="Create invoice"
          title="Create invoice"
          disabled={subscriptionLocked}
          onClick={startCreateInvoice}
        >
          <FaFileInvoice /><span>Create Invoice</span>
        </button>
        <button
          className="ol-chip ol-chip-export"
          type="button"
          aria-label="Download all customers (CSV)"
          title="Download consolidated CSV"
          disabled={exporting || subscriptionLocked}
          onClick={exportAllCsv}
        >
          {exporting ? <FaSpinner className="ol-spin" /> : <FaDownload />}<span>Export</span>
        </button>
        <button
          className="ol-chip ol-chip-invoices"
          type="button"
          aria-label="All invoices"
          title="All invoices"
          disabled={subscriptionLocked}
          onClick={() => !subscriptionLocked && navigate("/customer/app/outstanding/invoices")}
        >
          <FaFileInvoice /><span>Invoices</span>
        </button>
        <button
          className="ol-chip ol-chip-sms"
          type="button"
          aria-label="Auto SMS settings"
          title="Auto SMS settings"
          disabled={subscriptionLocked}
          onClick={() => !subscriptionLocked && navigate("/customer/app/outstanding/sms-settings")}
        >
          <FaBell /><span>Auto SMS</span>
        </button>
        <button
          className="ol-chip ol-chip-remind"
          type="button"
          aria-label="Send reminders"
          title="Send reminders"
          disabled={subscriptionLocked}
          onClick={() => !subscriptionLocked && navigate("/customer/app/outstanding/reminders")}
        >
          <FaCommentDots /><span>Reminders</span>
        </button>
        <button
          className="ol-chip ol-chip-renew"
          type="button"
          aria-label="Renew subscription"
          title="Renew subscription"
          onClick={() => setShowRenewSheet(true)}
        >
          <FaSyncAlt /><span>Renew</span>
        </button>
      </div>

      <div className={`ol-hero ol-list-hero ${heroTone}`}>
        <div className="ol-hero-topline">
          <div className="ol-hero-label">{netBalance >= 0 ? "You Will Receive" : "You Owe"}</div>
          <div className="ol-hero-count">{summary.customerCount || 0} customer{summary.customerCount === 1 ? "" : "s"}</div>
        </div>
        <div className="ol-hero-amount">{formatINR(Math.abs(netBalance))}</div>
        <div className="ol-hero-hint">
          {netBalance > 0 ? "Total amount pending from customers" : netBalance < 0 ? "Total amount pending from you" : "All accounts are settled"}
        </div>
        <div
          className="ol-hero-split"
          onClick={() => totalPayable > 0 && document.getElementById("ol-owed")?.scrollIntoView({ behavior: "smooth" })}
          role={totalPayable > 0 ? "button" : undefined}
        >
          <div className="ol-split-cell">
            <span>Will Receive</span>
            <b>{formatINR(totalReceivable)}</b>
          </div>
          <div className="ol-split-divider" />
          <div className="ol-split-cell">
            <span>You Owe</span>
            <b>{formatINR(totalPayable)}</b>
          </div>
        </div>
      </div>

      <div className="ol-controls">
        <div className="ol-search">
          <FaSearch />
          <input
            type="search"
            inputMode="search"
            placeholder="Search by name or mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="ol-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="cm-empty">{error}</div>}

      {!loading && filtered.length > 0 && (
        <div className="ol-section-head-row ol-list-section-head">
          <h3 className="ol-section-head">Customer ledger</h3>
          <span className="ol-section-count">{filtered.length}</span>
        </div>
      )}

      {loading ? (
        <div className="ol-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ol-item ol-skeleton" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : filtered.length === 0 && owedByMe.length === 0 ? (
        <div className="cm-empty ol-empty">
          <FaInbox style={{ fontSize: 36, opacity: 0.5 }} />
          <h3>No customers yet</h3>
          <p>Tap the + button to add your first customer and track outstanding amounts.</p>
          <button className="cm-button" type="button" onClick={() => setShowAddSheet(true)}>
            <FaPlus /> Add Customer
          </button>
        </div>
      ) : (
        <div className="ol-list">
          {filtered.map((c) => {
            const bal = Number(c.balance || 0);
            const cls = bal > 0 ? "ol-item ol-positive" : bal < 0 ? "ol-item ol-negative" : "ol-item ol-settled";
            return (
              <button
                key={c.id}
                type="button"
                className={cls}
                disabled={subscriptionLocked}
                onClick={() => handleCustomerTap(c.id)}
              >
                <div className="ol-avatar"><FaUserCircle /></div>
                <div className="ol-item-main">
                  <div className="ol-item-name">
                    {c.customerName}
                    {c.isAppUser && <span className="ol-app-badge">App</span>}
                    {(c.category === "VIP" || c.category === "RISKY") && (
                      <span className={`ol-cat-pill ol-cat-${c.category.toLowerCase()}`}>
                        {c.category === "VIP" ? "VIP" : "Risky"}
                      </span>
                    )}
                  </div>
                  <div className="ol-item-sub">
                    +91 {c.customerMobile} · {formatRelative(c.lastActivityAt)}
                    {bal > 0 && Number(c.ageingDays) > 0 && (
                      <span className={`ol-age-pill ${Number(c.ageingDays) <= 30 ? "is-fresh" : Number(c.ageingDays) <= 60 ? "is-warn" : "is-old"}`}>
                        {c.ageingDays}d
                      </span>
                    )}
                  </div>
                </div>
                <div className="ol-item-amount">
                  {bal === 0 ? (
                    <span className="ol-settled-tag">Settled</span>
                  ) : (
                    <>
                      <strong>{formatINR(Math.abs(bal))}</strong>
                      <span className={`ol-tag ${bal > 0 ? "is-outstanding" : "is-advance"}`}>{bal > 0 ? "Outstanding" : "Advance"}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {owedByMe.length > 0 && (
        <div id="ol-owed" className="ol-owed-section">
          <h3>You owe these users</h3>
          <div className="ol-list">
            {owedByMe.map((o) => (
              <button
                key={o.id}
                type="button"
                className="ol-item ol-owed-item"
                disabled={subscriptionLocked}
                onClick={() => !subscriptionLocked && navigate(`/customer/app/outstanding/${o.id}?view=owed`)}
              >
                <div className="ol-avatar"><FaUserCircle /></div>
                <div className="ol-item-main">
                  <div className="ol-item-name">{o.creditorName || `+91 ${o.creditorMobile}`}</div>
                  <div className="ol-item-sub">+91 {o.creditorMobile} · {formatRelative(o.lastActivityAt)}</div>
                </div>
                <div className="ol-item-amount">
                  <strong>{formatINR(o.amount)}</strong>
                  <span className="ol-tag">You owe</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {invoicePickMode && (
        <CustomerPickerSheet
          customers={customers}
          onClose={() => setInvoicePickMode(false)}
          onSelect={handleInvoiceCustomerPick}
          onAddNew={() => {
            setInvoicePickMode(false);
            setInvoiceAfterAdd(true);
            setShowAddSheet(true);
          }}
        />
      )}

      {showAddSheet && (
        <AddCustomerSheet
          onClose={() => { setShowAddSheet(false); setInvoiceAfterAdd(false); }}
          onAdded={onCustomerAdded}
        />
      )}

      {showRenewSheet && (
        <RenewSubscriptionSheet
          requireRenewal={subscriptionLocked}
          onClose={() => {
            if (!subscriptionLocked) setShowRenewSheet(false);
          }}
          onRenewed={() => {
            setSubscriptionLocked(false);
            setShowRenewSheet(false);
            load();
          }}
        />
      )}
    </div>
  );
};

export default OutstandingListScreen;
