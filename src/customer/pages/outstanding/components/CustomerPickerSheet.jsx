import { useMemo, useState } from "react";
import { FaTimes, FaSearch, FaUserCircle, FaPlus, FaInbox } from "react-icons/fa";

const formatINR = (n) => {
  const v = Number(n || 0);
  return `₹${Math.round(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

// Popup that lets the user pick an existing customer to create an invoice for,
// or jump into the add-customer flow when the person isn't on the ledger yet.
const CustomerPickerSheet = ({ customers = [], onClose, onSelect, onAddNew }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.customerName || "").toLowerCase().includes(q) ||
        (c.customerMobile || "").includes(q),
    );
  }, [customers, search]);

  return (
    <>
      <div className="cm-sheet-overlay is-open" onClick={onClose} />
      <div className="cm-sheet is-open ol-sheet ol-picker-sheet">
        <div className="cm-sheet-header">
          <h2>Select a customer</h2>
          <button className="cm-sheet-close" type="button" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="ol-controls ol-picker-controls">
          <div className="ol-search">
            <FaSearch />
            <input
              type="search"
              inputMode="search"
              placeholder="Search by name or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {onAddNew && (
          <button className="ol-picker-addnew" type="button" onClick={onAddNew}>
            <FaPlus />
            <span>Add new customer</span>
          </button>
        )}

        <div className="ol-picker-list">
          {filtered.length === 0 ? (
            <div className="cm-empty ol-empty">
              <FaInbox style={{ fontSize: 32, opacity: 0.5 }} />
              <p>No matching customer found.</p>
            </div>
          ) : (
            filtered.map((c) => {
              const bal = Number(c.balance || 0);
              const cls = bal > 0 ? "ol-item ol-positive" : bal < 0 ? "ol-item ol-negative" : "ol-item ol-settled";
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cls}
                  onClick={() => onSelect?.(c.id)}
                >
                  <div className="ol-avatar"><FaUserCircle /></div>
                  <div className="ol-item-main">
                    <div className="ol-item-name">
                      {c.customerName}
                      {c.isAppUser && <span className="ol-app-badge">App</span>}
                    </div>
                    <div className="ol-item-sub">+91 {c.customerMobile}</div>
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
            })
          )}
        </div>
      </div>
    </>
  );
};

export default CustomerPickerSheet;
