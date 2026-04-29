import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaSearch, FaSyncAlt, FaUserCircle, FaInbox, FaReceipt, FaUsers, FaWallet } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import AddCustomerSheet from "./components/AddCustomerSheet";
import RenewSubscriptionSheet from "./components/RenewSubscriptionSheet";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({ totalReceivable: 0, totalPayable: 0, customerCount: 0 });
  const [customers, setCustomers] = useState([]);
  const [owedByMe, setOwedByMe] = useState([]);
  const [sort, setSort] = useState("latest");
  const [search, setSearch] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showRenewSheet, setShowRenewSheet] = useState(false);

  const load = async () => {
    setLoading(true);
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
    if (newCustomer?.id) {
      navigate(`/customer/app/outstanding/${newCustomer.id}`);
    } else {
      load();
    }
  };

  const totalReceivable = Number(summary.totalReceivable || 0);
  const totalPayable = Number(summary.totalPayable || 0);
  const netBalance = totalReceivable - totalPayable;
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
        <button
          className="ol-renew-btn-pill"
          type="button"
          aria-label="Renew subscription"
          title="Renew subscription"
          onClick={() => setShowRenewSheet(true)}
        >
          <FaSyncAlt />
        </button>
        <button
          className="ol-add-btn-pill"
          type="button"
          aria-label="Add customer"
          onClick={() => setShowAddSheet(true)}
        >
          <FaPlus />
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

      <div className="ol-ledger-insights ol-list-insights" aria-label="ReBill summary">
        <div className="ol-insight-tile">
          <span className="ol-insight-icon"><FaUsers /></span>
          <span className="ol-insight-label">Customers</span>
          <strong>{summary.customerCount || 0}</strong>
        </div>
        <div className="ol-insight-tile">
          <span className="ol-insight-icon"><FaReceipt /></span>
          <span className="ol-insight-label">Accounts</span>
          <strong>{customers.length || "No"} active</strong>
        </div>
        <div className="ol-insight-tile">
          <span className="ol-insight-icon"><FaWallet /></span>
          <span className="ol-insight-label">Payable</span>
          <strong>{formatINR(totalPayable)}</strong>
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
                onClick={() => navigate(`/customer/app/outstanding/${c.id}`)}
              >
                <div className="ol-avatar"><FaUserCircle /></div>
                <div className="ol-item-main">
                  <div className="ol-item-name">
                    {c.customerName}
                    {c.isAppUser && <span className="ol-app-badge">App</span>}
                  </div>
                  <div className="ol-item-sub">
                    +91 {c.customerMobile} · {formatRelative(c.lastActivityAt)}
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
                onClick={() => navigate(`/customer/app/outstanding/${o.id}?view=owed`)}
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

      {showAddSheet && (
        <AddCustomerSheet
          onClose={() => setShowAddSheet(false)}
          onAdded={onCustomerAdded}
        />
      )}

      {showRenewSheet && (
        <RenewSubscriptionSheet onClose={() => setShowRenewSheet(false)} />
      )}
    </div>
  );
};

export default OutstandingListScreen;
