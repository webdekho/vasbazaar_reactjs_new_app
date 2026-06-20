import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaPencilAlt, FaTrash, FaStore, FaCamera, FaCheckCircle, FaTimesCircle, FaClock, FaBan, FaEdit, FaRegClock, FaChevronRight, FaPowerOff, FaChevronDown, FaChevronUp, FaToggleOn, FaToggleOff, FaTags, FaChartLine, FaStar, FaTruck, FaShoppingBag, FaFileCsv, FaBook } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useToast } from "../../context/ToastContext";
import { parseVariants, variantDimensions } from "./variantUtils";
import BarcodeScannerModal from "../../components/BarcodeScannerModal";
import "./marketplace.css";

const STATUS_META = {
  PENDING: { cls: "mkt-status--pending", icon: FaClock, label: "Pending Approval", text: "Your store is awaiting admin review. You'll be notified once approved." },
  APPROVED: { cls: "mkt-status--approved", icon: FaCheckCircle, label: "Approved", text: "Your store is live on Marketplace." },
  REJECTED: { cls: "mkt-status--rejected", icon: FaTimesCircle, label: "Rejected", text: "Your submission was not approved. Please update your profile and resubmit." },
  FINAL_REJECTED: { cls: "mkt-status--rejected", icon: FaBan, label: "Permanently Rejected", text: "Your store has been permanently rejected. You cannot edit or resubmit this profile." },
  SUSPENDED: { cls: "mkt-status--suspended", icon: FaBan, label: "Suspended", text: "Your store is temporarily suspended." },
};

const CATEGORY_STATUS_BADGE = {
  APPROVED: { label: "Available", bg: "rgba(16,185,129,0.14)", color: "#10b981" },
  PENDING: { label: "Pending approval", bg: "rgba(245,158,11,0.16)", color: "#f59e0b" },
  REJECTED: { label: "Rejected", bg: "rgba(239,68,68,0.14)", color: "#ef4444" },
};

const MyStoreManageScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const bulkFileInput = useRef(null);

  // Minimal CSV parser: first row is the header, supports quoted cells.
  const parseCsv = (text) => {
    const rows = [];
    let row = [], cell = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cell += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some((x) => x.trim() !== "")) rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); if (row.some((x) => x.trim() !== "")) rows.push(row); }
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
      return obj;
    });
  };

  const handleBulkFile = async (e) => {
    const file = e.target.files?.[0];
    if (bulkFileInput.current) bulkFileInput.current.value = "";
    if (!file) return;
    setBulkResult(null);
    setError(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) { setError("CSV is empty or missing a header row"); return; }
      if (rows.length > 1000) { setError("Max 1000 rows per import"); return; }
      setBulkImporting(true);
      const res = await marketplaceService.bulkAddItems(rows);
      setBulkImporting(false);
      if (res.success) {
        setBulkResult(res.data || { message: res.message });
        load();
      } else {
        setError(res.message || "Import failed");
      }
    } catch (ex) {
      setBulkImporting(false);
      setError("Could not read the CSV file");
    }
  };

  // Build and download a sample CSV the seller can fill in and re-upload.
  const downloadSampleCsv = (e) => {
    e?.stopPropagation();
    // All columns supported by the manual "Add Item" form. Required: name, sellingPrice.
    // imageUrls/variants/services/offers are JSON arrays; category/subcategory match by name.
    const headers = [
      "name", "sellingPrice", "mrp", "offerPrice", "sku", "barcode", "hsn", "taxRate",
      "unit", "stockQty", "lowStockThreshold", "minOrderQty", "maxOrderQty", "description", "imageUrl",
      "imageUrls", "category", "subcategory", "variants", "services", "offers",
    ];
    const sample = [
      [
        "Aashirvaad Atta 5kg", "245", "260", "239", "ATTA-5KG", "8901234567890", "1101", "5",
        "kg", "50", "10", "1", "5", "Whole wheat atta 5 kg pack", "https://cdn.example.com/atta.jpg",
        '["https://cdn.example.com/atta-1.jpg","https://cdn.example.com/atta-2.jpg"]',
        "Grocery", "Atta & Flour",
        '[{"label":"5 kg","price":245,"mrp":260,"stock":50,"options":{"Weight":"5 kg"}},{"label":"10 kg","price":480,"mrp":510,"stock":20,"options":{"Weight":"10 kg"}}]',
        '[{"label":"Free Delivery","detail":"On orders above ₹199"},{"label":"7-day Replacement"}]',
        '[{"title":"Bank Offer","description":"₹20 off on select cards","discountType":"flat","discountValue":20,"minPurchase":200}]',
      ],
      [
        "Tata Salt 1kg", "28", "30", "", "SALT-1KG", "", "2501", "0",
        "kg", "120", "", "", "", "Iodised salt 1 kg", "",
        "", "Grocery", "",
        "", "", "",
      ],
    ];
    // Quote any cell with comma/quote/newline; double-up inner quotes.
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...sample].map((row) => row.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vasbazaar_items_sample.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const load = useCallback(async () => {
    setLoading(true);
    // Items + recent orders fetch in parallel; orders endpoint only succeeds
    // for approved stores so a 404/403 is fine — we just fall back to [].
    const [s, i, o] = await Promise.all([
      marketplaceService.getMyStore(),
      marketplaceService.getMyItems().catch(() => ({ success: false, data: [] })),
      marketplaceService.getMyStoreOrders({ pageSize: 100 }).catch(() => ({ success: false, data: { records: [] } })),
    ]);
    setLoading(false);
    if (s.success && s.data && s.data.id) {
      setStore(s.data);
      if (i.success) setItems(Array.isArray(i.data) ? i.data : []);
      if (o.success) setRecentOrders(o.data?.records || []);
    } else {
      // No store yet — redirect to onboarding
      navigate("/customer/app/marketplace/onboard", { replace: true });
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const [fulfillSaving, setFulfillSaving] = useState(false);
  const [fulfillMsg, setFulfillMsg] = useState(null);

  const handleFulfillmentChange = async (next) => {
    // Backend rule: at least one mode must stay enabled.
    if (!next.deliveryEnabled && !next.pickupEnabled) {
      setFulfillMsg({ type: "error", text: "Keep at least one fulfillment mode enabled." });
      return;
    }
    setFulfillMsg(null);
    setFulfillSaving(true);
    const res = await marketplaceService.updateFulfillmentModes(next);
    setFulfillSaving(false);
    if (res.success) {
      setStore((p) => ({ ...p, ...next }));
      setFulfillMsg({ type: "success", text: "Fulfillment updated" });
      setTimeout(() => setFulfillMsg(null), 2500);
    } else {
      setFulfillMsg({ type: "error", text: res.message || "Failed to update" });
    }
  };

  const handleToggleOpen = async () => {
    const next = !(store.isOpen);
    const res = await marketplaceService.toggleMyStoreOpen(next);
    if (res.success) {
      setStore({ ...store, isOpen: next });
      showToast(
        next
          ? "Store is now Open — customers can place orders"
          : "Store is now Closed — customers can't place orders",
        next ? "success" : "info"
      );
    } else {
      const msg = res.message || "Failed to update store status";
      setError(msg);
      showToast(msg, "error");
    }
  };

  // Truncate API time strings (e.g. "09:00:00") to "09:00" for window math.
  const trimTime = (t) => (t ? String(t).slice(0, 5) : "");
  const isWithinWindow = (cur, openStr, closeStr) => {
    if (!openStr || !closeStr) return true;
    const [oh, om] = openStr.split(":").map(Number);
    const [ch, cm] = closeStr.split(":").map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    return close > open ? cur >= open && cur < close : cur >= open || cur < close;
  };
  const isCurrentlyClosedBySchedule = (() => {
    if (!store?.autoSchedule) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    // Per-day weekly schedule wins when set
    if (store.weeklySchedule) {
      try {
        const arr = JSON.parse(store.weeklySchedule);
        const keys = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        const today = keys[(now.getDay() + 6) % 7];
        const entry = Array.isArray(arr) ? arr.find((e) => String(e.day).toUpperCase() === today) : null;
        if (entry) {
          if (entry.closed) return true;
          return !isWithinWindow(cur, trimTime(entry.openTime), trimTime(entry.closeTime));
        }
      } catch (_) { /* fall through */ }
    }
    if (!store.openTime || !store.closeTime) return false;
    return !isWithinWindow(cur, trimTime(store.openTime), trimTime(store.closeTime));
  })();

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    const res = await marketplaceService.deleteMyItem(id);
    if (res.success) setItems((p) => p.filter((it) => it.id !== id));
    else setError(res.message || "Failed to delete");
  };

  const handleToggleAvailability = async (id, current) => {
    const next = !current;
    const res = await marketplaceService.toggleItemAvailability(id, next);
    if (res.success) setItems((p) => p.map((it) => it.id === id ? { ...it, isAvailable: next } : it));
  };

  if (loading || !store) {
    return (
      <div className="mkt">
        <div className="mkt-header"><button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button><h1 className="mkt-header-title">My Store</h1></div>
        <div className="mkt-empty">Loading…</div>
      </div>
    );
  }

  const statusKey = store.status || "PENDING";
  const meta = STATUS_META[statusKey] || STATUS_META.PENDING;
  const StatusIcon = meta.icon;
  const canManageItems = statusKey === "APPROVED";
  const canEditProfile = statusKey !== "FINAL_REJECTED";

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate("/customer/app/marketplace")}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Store</h1>
        {canEditProfile && (
          <button
            className="mkt-header-action"
            title="Edit profile"
            aria-label="Edit profile"
            onClick={() => navigate("/customer/app/marketplace/onboard", { state: { editMode: true, store } })}
          >
            <FaEdit size={14} />
          </button>
        )}
        {canManageItems && (
          <button
            className="mkt-header-action"
            title="Manage timings & holidays"
            aria-label="Manage timings"
            onClick={() => navigate("/customer/app/marketplace/my-store/timings")}
          >
            <FaRegClock size={14} />
          </button>
        )}
        {canManageItems && (
          <button
            className="mkt-header-action"
            title="Delivery slots"
            aria-label="Delivery slots"
            onClick={() => navigate("/customer/app/marketplace/my-store/delivery-slots")}
          >
            <FaTruck size={14} />
          </button>
        )}
        {canManageItems && (
          <button
            className="mkt-header-action"
            title={store.isOpen ? "Close store" : "Open store"}
            aria-label={store.isOpen ? "Close store" : "Open store"}
            onClick={handleToggleOpen}
            style={{
              background: store.isOpen ? "#ef4444" : "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)",
              color: "#fff",
              borderColor: "transparent",
              boxShadow: store.isOpen ? "0 4px 12px rgba(239,68,68,0.3)" : "0 4px 12px rgba(0,123,255,0.3)",
            }}
          >
            <FaPowerOff size={14} />
          </button>
        )}
      </div>

      {statusKey !== "APPROVED" && (
        <div className={`mkt-status-banner ${meta.cls}`}>
          <StatusIcon size={16} style={{ marginTop: 2 }} />
          <div>
            <div>{meta.label}</div>
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, opacity: 0.85 }}>{meta.text}</div>
            {store.rejectionReason && <div style={{ fontSize: 12, marginTop: 4 }}>Reason: {store.rejectionReason}</div>}
          </div>
        </div>
      )}

      <div style={{ padding: "0 14px 14px" }}>
        {canManageItems && isCurrentlyClosedBySchedule && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(239, 68, 68, 0.1)",
              color: "#dc2626",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Store is currently closed (off-hours / holiday).
          </div>
        )}

        {canManageItems && (
          <div
            role="tablist"
            aria-label="My Store sections"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 6,
              padding: 4,
              marginTop: 12,
              borderRadius: 12,
              background: "var(--cm-bg-secondary)",
              border: "1px solid var(--cm-line)",
            }}
          >
            {[
              { key: "orders", label: "Orders", count: recentOrders.length },
              { key: "items", label: "Items", count: items.length },
              { key: "categories", label: "Categories" },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    minWidth: 0,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    background: isActive ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "transparent",
                    color: isActive ? "#fff" : "var(--cm-muted)",
                    boxShadow: isActive ? "0 4px 12px rgba(20,184,166,0.25)" : "none",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  {tab.label}{tab.count != null && <span style={{ opacity: 0.85, fontWeight: 600 }}> ({tab.count})</span>}
                </button>
              );
            })}
          </div>
        )}

        {canManageItems && activeTab === "orders" && (
          <RecentOrdersSection
            orders={recentOrders}
            onSeeAll={() => navigate("/customer/app/marketplace/store-orders")}
          />
        )}

        {canManageItems && activeTab === "orders" && (
          <>
            {/* === Store management shortcuts === */}
            <div className="mkt-form-section-title" style={{ margin: "20px 0 8px" }}>Manage store</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: FaTags, title: "Offers & Promotions", sub: "Flat, percent & BOGO promo codes", to: "/customer/app/marketplace/my-store/offers" },
                { icon: FaChartLine, title: "Analytics", sub: "Revenue, orders & top items", to: "/customer/app/marketplace/my-store/analytics" },
                { icon: FaStar, title: "Reviews", sub: "Read & reply to customer reviews", to: "/customer/app/marketplace/my-store/reviews" },
                { icon: FaBook, title: "Khata / Credit", sub: "Customer credit ledger & reminders", to: "/customer/app/marketplace/my-store/khata" },
              ].map((it) => {
                const Icon = it.icon;
                return (
                  <div
                    key={it.to}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(it.to)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(it.to); } }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: 14,
                      borderRadius: 14, border: "1px solid var(--cm-line)",
                      background: "var(--cm-card)", color: "var(--cm-ink)", cursor: "pointer",
                    }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", flexShrink: 0 }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{it.title}</div>
                      <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{it.sub}</div>
                    </div>
                    <FaChevronRight size={12} color="var(--cm-muted)" />
                  </div>
                );
              })}
            </div>

            {/* === Fulfillment modes === */}
            <div className="mkt-form-section-title" style={{ margin: "20px 0 8px" }}>Fulfillment</div>
            <div style={{ borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderBottom: "1px solid var(--cm-line)" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(20,184,166,0.12)", color: "#14b8a6", flexShrink: 0 }}>
                  <FaTruck size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>Home delivery</div>
                  <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Deliver orders to customers</div>
                </div>
                <button
                  type="button"
                  disabled={fulfillSaving}
                  onClick={() => handleFulfillmentChange({ deliveryEnabled: !store.deliveryEnabled, pickupEnabled: !!store.pickupEnabled })}
                  style={{ background: "none", border: "none", cursor: fulfillSaving ? "not-allowed" : "pointer", color: store.deliveryEnabled ? "#14b8a6" : "var(--cm-muted)", padding: 2 }}
                  title={store.deliveryEnabled ? "Disable delivery" : "Enable delivery"}
                >
                  {store.deliveryEnabled ? <FaToggleOn size={26} /> : <FaToggleOff size={26} />}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(0,123,255,0.12)", color: "#007BFF", flexShrink: 0 }}>
                  <FaShoppingBag size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>Store pickup</div>
                  <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Customers collect from your store</div>
                </div>
                <button
                  type="button"
                  disabled={fulfillSaving}
                  onClick={() => handleFulfillmentChange({ deliveryEnabled: !!store.deliveryEnabled, pickupEnabled: !store.pickupEnabled })}
                  style={{ background: "none", border: "none", cursor: fulfillSaving ? "not-allowed" : "pointer", color: store.pickupEnabled ? "#14b8a6" : "var(--cm-muted)", padding: 2 }}
                  title={store.pickupEnabled ? "Disable pickup" : "Enable pickup"}
                >
                  {store.pickupEnabled ? <FaToggleOn size={26} /> : <FaToggleOff size={26} />}
                </button>
              </div>
            </div>
            {fulfillMsg && (
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: fulfillMsg.type === "success" ? "#059669" : "#dc2626" }}>
                {fulfillMsg.text}
              </div>
            )}
          </>
        )}
      </div>

      {canManageItems && activeTab === "items" && (
        <>
          {/* === Add Item — its own CTA card === */}
          <div style={{ padding: "4px 14px 0" }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditingItem(null); setShowItemForm(true); } }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 14,
                border: "1.5px dashed #007BFF",
                background: "rgba(20, 184, 166, 0.06)",
                color: "var(--cm-ink)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 42, height: 42, borderRadius: 12,
                  display: "grid", placeItems: "center",
                  background: "linear-gradient(135deg, #40E0D0, #007BFF)",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                <FaPlus size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Add new item</div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                  New items go to admin for approval before going live.
                </div>
              </div>
              <FaChevronRight size={12} color="var(--cm-muted)" />
            </div>
          </div>

          {/* === Bulk import (CSV) === */}
          <div style={{ padding: "8px 14px 0" }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => !bulkImporting && bulkFileInput.current?.click()}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !bulkImporting) { e.preventDefault(); bulkFileInput.current?.click(); } }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14,
                border: "1.5px dashed #14b8a6", background: "rgba(20, 184, 166, 0.06)",
                color: "var(--cm-ink)", cursor: bulkImporting ? "wait" : "pointer",
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #14b8a6, #0d9488)", color: "#fff", flexShrink: 0 }}>
                <FaFileCsv size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{bulkImporting ? "Importing…" : "Bulk import items (CSV)"}</div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                  name &amp; sellingPrice required. Also supports mrp, offerPrice, sku, barcode, hsn, taxRate, unit, stockQty, lowStockThreshold, minOrderQty, maxOrderQty, description, imageUrl, imageUrls, category, subcategory, variants, services, offers. Download the sample for the exact format.
                </div>
              </div>
              <FaChevronRight size={12} color="var(--cm-muted)" />
              <input ref={bulkFileInput} type="file" accept=".csv,text/csv" hidden onChange={handleBulkFile} />
            </div>
            <button
              type="button"
              onClick={downloadSampleCsv}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
                background: "none", border: "none", padding: 0,
                color: "#14b8a6", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              <FaFileCsv size={12} /> Download sample CSV
            </button>
            {bulkResult && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: "#10b981" }}>{bulkResult.message || `${bulkResult.created} imported`}</div>
                {Array.isArray(bulkResult.errors) && bulkResult.errors.length > 0 && (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 16, color: "#ef4444" }}>
                    {bulkResult.errors.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}
                    {bulkResult.errors.length > 8 && <li>…and {bulkResult.errors.length - 8} more</li>}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* === Listed Items section === */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 14px 8px" }}>
            <div className="mkt-form-section-title" style={{ margin: 0 }}>
              Listed items <span style={{ color: "var(--cm-muted)", fontWeight: 500 }}>({items.length})</span>
            </div>
          </div>

          {error && <div className="mkt-error-text" style={{ padding: "0 14px" }}>{error}</div>}

          {items.length === 0 ? (
            <div className="mkt-empty">No items listed yet</div>
          ) : (
            <div style={{ padding: "0 14px 24px" }}>
              {items.map((it) => {
                const itemStatus = String(it.status || "PENDING").toUpperCase();
                const statusStyle =
                  itemStatus === "APPROVED" ? { bg: "rgba(16, 185, 129, 0.12)", color: "#059669", label: "APPROVED" } :
                  itemStatus === "REJECTED" ? { bg: "rgba(239, 68, 68, 0.12)", color: "#dc2626", label: "REJECTED" } :
                  { bg: "rgba(245, 158, 11, 0.12)", color: "#d97706", label: "PENDING APPROVAL" };
                return (
                  <div key={it.id} className="mkt-cart-line" style={{ borderRadius: 12, border: "1px solid var(--cm-line)", marginBottom: 8, borderBottom: "1px solid var(--cm-line)" }}>
                    <div className="mkt-cart-line-img">
                      {it.imageUrl ? <img src={it.imageUrl} alt="" /> : <FaStore size={20} />}
                    </div>
                    <div className="mkt-cart-line-info">
                      <p className="mkt-cart-line-name">{it.name}</p>
                      <div className="mkt-cart-line-price">₹{Number(it.sellingPrice).toFixed(0)}{it.unit ? ` / ${it.unit}` : ""}</div>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          letterSpacing: "0.02em",
                        }}>
                          {statusStyle.label}
                        </span>
                        {itemStatus === "APPROVED" && (
                          <label style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--cm-muted)" }}>
                            <input type="checkbox" checked={!!it.isAvailable} onChange={() => handleToggleAvailability(it.id, it.isAvailable)} />
                            Available
                          </label>
                        )}
                      </div>
                      {itemStatus === "REJECTED" && it.rejectionReason && (
                        <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>
                          Reason: {it.rejectionReason}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => { setEditingItem(it); setShowItemForm(true); }} style={{ background: "none", border: "none", color: "#007BFF", cursor: "pointer" }}><FaPencilAlt size={12} /></button>
                      <button onClick={() => handleDeleteItem(it.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><FaTrash size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {canManageItems && activeTab === "categories" && (
        <CategoriesTab />
      )}

      {showItemForm && (
        <ItemFormModal
          initial={editingItem}
          allItems={items}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }}
          onSaved={() => { setShowItemForm(false); setEditingItem(null); load(); }}
        />
      )}
    </div>
  );
};

// ===== Categories & Subcategories Management Tab =====
const CategoriesTab = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Top-level subcategory management (mirrors categories). Subcategories are
  // loaded across every approved category and shown as one flat, managed list.
  const [allSubs, setAllSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [editingSub, setEditingSub] = useState(null);

  const approvedCategories = useMemo(
    () => categories.filter((c) => String(c.status || "APPROVED").toUpperCase() === "APPROVED"),
    [categories]
  );

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketplaceService.getMyItemCategories();
      if (res.success) setCategories(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Fetch subcategories for each approved category and merge into one list,
  // tagging each with its parent category name for display.
  const loadSubcategories = useCallback(async (cats) => {
    const parents = (cats || []).filter((c) => String(c.status || "APPROVED").toUpperCase() === "APPROVED");
    if (parents.length === 0) { setAllSubs([]); return; }
    setSubsLoading(true);
    try {
      const results = await Promise.all(
        parents.map((c) =>
          marketplaceService.getMyItemSubcategories(c.id)
            .then((r) => (r.success && Array.isArray(r.data) ? r.data.map((s) => ({ ...s, categoryId: c.id, categoryName: c.name })) : []))
            .catch(() => [])
        )
      );
      setAllSubs(results.flat());
    } finally { setSubsLoading(false); }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  // Reload the flat subcategory list whenever the category set changes.
  useEffect(() => { loadSubcategories(categories); }, [categories, loadSubcategories]);

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Delete this category? All subcategories under it will also be deleted.")) return;
    const res = await marketplaceService.deleteMyItemCategory(id);
    if (res.success) { setCategories((p) => p.filter((c) => c.id !== id)); if (expandedId === id) setExpandedId(null); }
    else setError(res.message || "Delete failed");
  };

  const handleDeleteSub = async (id) => {
    if (!window.confirm("Delete this subcategory?")) return;
    const res = await marketplaceService.deleteMyItemSubcategory(id);
    if (res.success) setAllSubs((p) => p.filter((s) => s.id !== id));
    else setError(res.message || "Delete failed");
  };

  return (
    <div style={{ padding: "4px 14px 24px" }}>
      {/* Add Category CTA */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setEditingCategory(null); setShowAddCategory(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditingCategory(null); setShowAddCategory(true); } }}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: 14,
          borderRadius: 14, border: "1.5px dashed #007BFF",
          background: "rgba(20, 184, 166, 0.06)", color: "var(--cm-ink)", cursor: "pointer",
        }}
      >
        <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", flexShrink: 0 }}>
          <FaPlus size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Propose a new category</div>
          <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>New names go to admin for approval, then become available to all sellers</div>
        </div>
        <FaChevronRight size={12} color="var(--cm-muted)" />
      </div>


      {error && <div className="mkt-error-text" style={{ padding: "8px 0" }}>{error}</div>}

      {/* Category list */}
      <div style={{ marginTop: 12 }}>
        <div className="mkt-form-section-title" style={{ margin: "0 0 8px" }}>
          Item Categories <span style={{ color: "var(--cm-muted)", fontWeight: 500 }}>({categories.length})</span>
        </div>

        {loading ? (
          <div className="mkt-empty">Loading…</div>
        ) : categories.length === 0 ? (
          <div className="mkt-empty">No categories yet. Add one to organize your items.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((cat) => {
              const isExpanded = expandedId === cat.id;
              const status = String(cat.status || "APPROVED").toUpperCase();
              const isApproved = status === "APPROVED";
              const badge = CATEGORY_STATUS_BADGE[status] || CATEGORY_STATUS_BADGE.APPROVED;
              return (
                <div key={cat.id} style={{ borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)", overflow: "hidden" }}>
                  {/* Category row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                    {cat.iconUrl && <img src={cat.iconUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {cat.name}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>
                        {isApproved ? "Shared catalog" : (cat.rejectionReason ? `Reason: ${cat.rejectionReason}` : "Awaiting admin approval")}
                      </div>
                    </div>
                    {/* Sellers can only manage their own un-approved proposals; approved ones are shared & read-only */}
                    {!isApproved && (
                      <>
                        <button onClick={() => { setEditingCategory(cat); setShowAddCategory(true); }} style={{ background: "none", border: "none", color: "#007BFF", cursor: "pointer", padding: 4 }}><FaPencilAlt size={12} /></button>
                        <button onClick={() => handleDeleteCategory(cat.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 4 }}><FaTrash size={12} /></button>
                      </>
                    )}
                    {isApproved && (
                      <button onClick={() => setExpandedId(isExpanded ? null : cat.id)} style={{ background: "none", border: "none", color: "var(--cm-muted)", cursor: "pointer", padding: 4 }}>
                        {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                  {/* Subcategories panel — only under approved categories */}
                  {isExpanded && isApproved && (
                    <SubcategoriesPanel categoryId={cat.id} categoryName={cat.name} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Subcategories management (same pattern as categories) ===== */}
      <div style={{ marginTop: 20 }}>
        {/* Add Subcategory CTA */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => { if (approvedCategories.length) { setEditingSub(null); setShowAddSub(true); } }}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && approvedCategories.length) { e.preventDefault(); setEditingSub(null); setShowAddSub(true); } }}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: 14,
            borderRadius: 14, border: "1.5px dashed #007BFF",
            background: "rgba(20, 184, 166, 0.06)", color: "var(--cm-ink)",
            cursor: approvedCategories.length ? "pointer" : "not-allowed",
            opacity: approvedCategories.length ? 1 : 0.6,
          }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #40E0D0, #007BFF)", color: "#fff", flexShrink: 0 }}>
            <FaPlus size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Propose a new subcategory</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
              {approvedCategories.length
                ? "Pick a parent category, then name the subcategory. Goes to admin for approval."
                : "Get at least one category approved first, then add subcategories under it."}
            </div>
          </div>
          <FaChevronRight size={12} color="var(--cm-muted)" />
        </div>

        {/* Subcategory list */}
        <div style={{ marginTop: 12 }}>
          <div className="mkt-form-section-title" style={{ margin: "0 0 8px" }}>
            Item Subcategories <span style={{ color: "var(--cm-muted)", fontWeight: 500 }}>({allSubs.length})</span>
          </div>
          {subsLoading ? (
            <div className="mkt-empty">Loading…</div>
          ) : allSubs.length === 0 ? (
            <div className="mkt-empty">No subcategories yet. Add one to organize items further.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allSubs.map((sub) => {
                const status = String(sub.status || "APPROVED").toUpperCase();
                const isApproved = status === "APPROVED";
                const badge = CATEGORY_STATUS_BADGE[status] || CATEGORY_STATUS_BADGE.APPROVED;
                return (
                  <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
                    {sub.iconUrl && <img src={sub.iconUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {sub.name}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>
                        Under <strong>{sub.categoryName}</strong>{isApproved ? "" : (sub.rejectionReason ? ` · ${sub.rejectionReason}` : " · Awaiting admin approval")}
                      </div>
                    </div>
                    {!isApproved && (
                      <>
                        <button onClick={() => { setEditingSub(sub); setShowAddSub(true); }} style={{ background: "none", border: "none", color: "#007BFF", cursor: "pointer", padding: 4 }}><FaPencilAlt size={12} /></button>
                        <button onClick={() => handleDeleteSub(sub.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 4 }}><FaTrash size={12} /></button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Category Modal */}
      {showAddCategory && (
        <CategoryFormModal
          initial={editingCategory}
          onClose={() => { setShowAddCategory(false); setEditingCategory(null); }}
          onSaved={() => { setShowAddCategory(false); setEditingCategory(null); loadCategories(); }}
        />
      )}

      {/* Add/Edit Subcategory Modal (top-level — shows parent category dropdown) */}
      {showAddSub && (
        <SubcategoryFormModal
          categories={approvedCategories}
          initial={editingSub}
          onClose={() => { setShowAddSub(false); setEditingSub(null); }}
          onSaved={() => { setShowAddSub(false); setEditingSub(null); loadSubcategories(categories); }}
        />
      )}

    </div>
  );
};

// ===== Subcategories panel (nested inside an expanded category) =====
const SubcategoriesPanel = ({ categoryId, categoryName }) => {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [error, setError] = useState(null);

  const loadSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketplaceService.getMyItemSubcategories(categoryId);
      if (res.success) setSubs(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [categoryId]);

  useEffect(() => { loadSubs(); }, [loadSubs]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this subcategory?")) return;
    const res = await marketplaceService.deleteMyItemSubcategory(id);
    if (res.success) setSubs((p) => p.filter((s) => s.id !== id));
    else setError(res.message || "Delete failed");
  };

  return (
    <div style={{ borderTop: "1px solid var(--cm-line)", padding: "10px 14px", background: "var(--cm-bg-secondary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cm-muted)" }}>
          Subcategories ({subs.length})
        </div>
        <button
          type="button"
          onClick={() => { setEditingSub(null); setShowAdd(true); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 8, border: "1px solid #007BFF",
            background: "transparent", color: "#007BFF", fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}
        >
          <FaPlus size={9} /> Propose
        </button>
      </div>

      {error && <div className="mkt-error-text" style={{ marginBottom: 6 }}>{error}</div>}

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--cm-muted)", padding: "8px 0" }}>Loading…</div>
      ) : subs.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--cm-muted)", padding: "8px 0" }}>No subcategories yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {subs.map((sub) => {
            const status = String(sub.status || "APPROVED").toUpperCase();
            const isApproved = status === "APPROVED";
            const badge = CATEGORY_STATUS_BADGE[status] || CATEGORY_STATUS_BADGE.APPROVED;
            return (
            <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--cm-line)", background: "var(--cm-card)" }}>
              {sub.iconUrl && <img src={sub.iconUrl} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {sub.name}
                  {!isApproved && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: badge.bg, color: badge.color }}>{badge.label}</span>}
                </div>
                <div style={{ fontSize: 10, color: "var(--cm-muted)" }}>{isApproved ? "Shared" : (sub.rejectionReason || "Awaiting approval")}</div>
              </div>
              {!isApproved && (
                <>
                  <button onClick={() => { setEditingSub(sub); setShowAdd(true); }} style={{ background: "none", border: "none", color: "#007BFF", cursor: "pointer", padding: 2 }}><FaPencilAlt size={10} /></button>
                  <button onClick={() => handleDelete(sub.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 2 }}><FaTrash size={10} /></button>
                </>
              )}
            </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <SubcategoryFormModal
          categoryId={categoryId}
          categoryName={categoryName}
          initial={editingSub}
          onClose={() => { setShowAdd(false); setEditingSub(null); }}
          onSaved={() => { setShowAdd(false); setEditingSub(null); loadSubs(); }}
        />
      )}
    </div>
  );
};

// ===== Category Add/Edit Modal =====
const CategoryFormModal = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: initial?.name || "",
    iconUrl: initial?.iconUrl || "",
    sortOrder: initial?.sortOrder ?? 0,
    isActive: initial?.isActive ?? true,
  });
  // Optional subcategories proposed together with a brand-new category.
  // (Editing an existing category keeps using the standalone "Propose" flow.)
  const [subs, setSubs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const addSubRow = () => setSubs((p) => [...p, ""]);
  const updateSubRow = (i, v) => setSubs((p) => p.map((s, idx) => (idx === i ? v : s)));
  const removeSubRow = (i) => setSubs((p) => p.filter((_, idx) => idx !== i));

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Image must be under 2 MB"); return; }
    setUploading(true);
    const res = await marketplaceService.uploadImage(file, "category_icon");
    setUploading(false);
    if (res.success && res.data?.url) setField("iconUrl", res.data.url);
    else setError(res.message || "Upload failed");
  };

  const submit = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setError(null);
    setSaving(true);
    // Clean, de-duplicated subcategory names (new-category flow only).
    const subNames = !initial
      ? Array.from(new Set(subs.map((s) => s.trim()).filter(Boolean).map((s) => s)))
      : [];
    let res;
    if (!initial && subNames.length > 0) {
      res = await marketplaceService.createMyItemCategoryWithSubs({
        name: form.name.trim(),
        iconUrl: form.iconUrl || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        subcategories: subNames,
      });
    } else {
      const payload = {
        ...(initial ? { id: initial.id } : {}),
        name: form.name.trim(),
        iconUrl: form.iconUrl || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      res = initial
        ? await marketplaceService.updateMyItemCategory(payload)
        : await marketplaceService.createMyItemCategory(payload);
    }
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.message || "Save failed");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--cm-bg)", width: "100%", maxWidth: 480, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="mkt-header" style={{ position: "sticky", top: 0 }}>
          <button className="mkt-header-back" onClick={onClose}>×</button>
          <h1 className="mkt-header-title">{initial ? "Edit Category" : "Add Category"}</h1>
        </div>
        <div className="mkt-form">
          <div className="mkt-field">
            <label className="mkt-field-label">Icon (optional)</label>
            <div className="mkt-image-upload" onClick={() => fileInput.current?.click()}>
              <div className="mkt-image-upload-preview" style={{ width: 48, height: 48 }}>
                {form.iconUrl ? <img src={form.iconUrl} alt="" /> : <FaCamera size={14} />}
              </div>
              <div className="mkt-image-upload-text">{uploading ? "Uploading…" : form.iconUrl ? "Tap to change" : "Tap to upload"}</div>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleImagePick} />
            </div>
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Category name <span className="mkt-req">*</span></label>
            <input className="mkt-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Fruits, Dairy, Snacks" />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Sort order</label>
            <input className="mkt-input" inputMode="numeric" value={form.sortOrder} onChange={(e) => setField("sortOrder", e.target.value.replace(/\D/g, ""))} />
          </div>

          {/* Optional: propose subcategories together with the new category.
              The standalone "Propose a new subcategory" flow stays available too. */}
          {!initial && (
            <div className="mkt-field">
              <label className="mkt-field-label">Subcategories (optional)</label>
              <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 8 }}>
                Add one or more subcategories under this category. They go to admin for approval along with the category.
              </div>
              {subs.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input
                    className="mkt-input"
                    style={{ flex: 1 }}
                    value={s}
                    placeholder={`Subcategory ${i + 1} e.g. Citrus`}
                    onChange={(e) => updateSubRow(i, e.target.value)}
                  />
                  <button type="button" className="mkt-variant-del" onClick={() => removeSubRow(i)} aria-label="Remove subcategory">×</button>
                </div>
              ))}
              <button type="button" onClick={addSubRow} className="mkt-btn mkt-btn--add" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
                + Add subcategory
              </button>
            </div>
          )}

          <div className="mkt-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setField("isActive", e.target.checked)} id="cat-active" />
            <label htmlFor="cat-active" className="mkt-field-label" style={{ margin: 0 }}>Active</label>
          </div>
          {error && <div className="mkt-error-text">{error}</div>}
          <button className="mkt-btn mkt-btn--primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : (subs.some((s) => s.trim()) ? "Add category & subcategories" : "Add category")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== Subcategory Add/Edit Modal =====
// Supports two modes:
// 1. With categoryId prop (called from SubcategoriesPanel inside an expanded category)
// 2. With categories prop (called from CategoriesTab "Add item subcategory" button — shows category dropdown)
const SubcategoryFormModal = ({ categoryId: fixedCategoryId, categoryName: fixedCategoryName, categories, initial, onClose, onSaved }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    fixedCategoryId || initial?.storeItemCategoryId?.id || initial?.categoryId || ""
  );
  const selectedCategoryName = fixedCategoryName || (categories || []).find((c) => c.id === selectedCategoryId)?.name || "";

  const [form, setForm] = useState({
    name: initial?.name || "",
    iconUrl: initial?.iconUrl || "",
    sortOrder: initial?.sortOrder ?? 0,
    isActive: initial?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Image must be under 2 MB"); return; }
    setUploading(true);
    const res = await marketplaceService.uploadImage(file, "subcategory_icon");
    setUploading(false);
    if (res.success && res.data?.url) setField("iconUrl", res.data.url);
    else setError(res.message || "Upload failed");
  };

  const submit = async () => {
    if (!selectedCategoryId) { setError("Please select a parent category"); return; }
    if (!form.name.trim()) { setError("Name is required"); return; }
    setError(null);
    setSaving(true);
    const payload = {
      ...(initial ? { id: initial.id } : {}),
      storeItemCategoryId: { id: selectedCategoryId },
      name: form.name.trim(),
      iconUrl: form.iconUrl || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };
    const res = initial
      ? await marketplaceService.updateMyItemSubcategory(payload)
      : await marketplaceService.createMyItemSubcategory(payload);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.message || "Save failed");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--cm-bg)", width: "100%", maxWidth: 480, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="mkt-header" style={{ position: "sticky", top: 0 }}>
          <button className="mkt-header-back" onClick={onClose}>×</button>
          <h1 className="mkt-header-title">{initial ? "Edit Subcategory" : "Add Subcategory"}</h1>
        </div>
        {fixedCategoryId ? (
          <div style={{ padding: "0 14px", marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Under: <strong>{selectedCategoryName}</strong></div>
          </div>
        ) : null}
        <div className="mkt-form">
          {/* Show category dropdown when opened from top-level (no fixedCategoryId) */}
          {!fixedCategoryId && categories && (
            <div className="mkt-field">
              <label className="mkt-field-label">Parent category <span className="mkt-req">*</span></label>
              <select
                className="mkt-input"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">-- Select category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="mkt-field">
            <label className="mkt-field-label">Icon (optional)</label>
            <div className="mkt-image-upload" onClick={() => fileInput.current?.click()}>
              <div className="mkt-image-upload-preview" style={{ width: 48, height: 48 }}>
                {form.iconUrl ? <img src={form.iconUrl} alt="" /> : <FaCamera size={14} />}
              </div>
              <div className="mkt-image-upload-text">{uploading ? "Uploading…" : form.iconUrl ? "Tap to change" : "Tap to upload"}</div>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleImagePick} />
            </div>
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Subcategory name <span className="mkt-req">*</span></label>
            <input className="mkt-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Citrus, Leafy Greens" />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Sort order</label>
            <input className="mkt-input" inputMode="numeric" value={form.sortOrder} onChange={(e) => setField("sortOrder", e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="mkt-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setField("isActive", e.target.checked)} id="sub-active" />
            <label htmlFor="sub-active" className="mkt-field-label" style={{ margin: 0 }}>Active</label>
          </div>
          {error && <div className="mkt-error-text">{error}</div>}
          <button className="mkt-btn mkt-btn--primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add subcategory"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Sample values shown as placeholders so sellers know an attribute holds a
// concrete value (Colour → Red), not another attribute name.
const EXAMPLE_VALUES = {
  colour: "Red", color: "Red", size: "Large", weight: "1 kg",
  ram: "8 GB", storage: "128 GB", material: "Cotton", flavour: "Mango", flavor: "Mango",
};

// Common option *values* sellers mistakenly type into the *attribute* box.
// e.g. naming the attribute "Black" instead of "Colour".
const VALUE_LIKE_NAMES = {
  black: "Colour", white: "Colour", blue: "Colour", red: "Colour", green: "Colour",
  yellow: "Colour", grey: "Colour", gray: "Colour", pink: "Colour", purple: "Colour",
  orange: "Colour", brown: "Colour", silver: "Colour", gold: "Colour",
  small: "Size", medium: "Size", large: "Size", xl: "Size", xxl: "Size", "x-large": "Size",
  s: "Size", m: "Size", l: "Size",
  "1kg": "Weight", "500g": "Weight", "1 kg": "Weight", "500 g": "Weight", "5kg": "Weight", "5 kg": "Weight",
  cotton: "Material", silk: "Material", wool: "Material", leather: "Material",
};
// Returns the suggested attribute name if the entered text looks like a value.
const valueLikeAttr = (name) => VALUE_LIKE_NAMES[String(name || "").trim().toLowerCase()] || null;

const ItemFormModal = ({ initial, allItems = [], onClose, onSaved }) => {
  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    description: initial?.description || "",
    sellingPrice: initial?.sellingPrice ?? "",
    mrp: initial?.mrp ?? "",
    offerPrice: initial?.offerPrice ?? "",
    sku: initial?.sku || "",
    barcode: initial?.barcode || "",
    hsn: initial?.hsn || "",
    taxRate: initial?.taxRate ?? "",
    unit: initial?.unit || "",
    unitMeasure: initial?.unitMeasure || "",
    stockQty: initial?.stockQty ?? 0,
    lowStockThreshold: initial?.lowStockThreshold ?? "",
    minOrderQty: initial?.minOrderQty ?? "",
    maxOrderQty: initial?.maxOrderQty ?? "",
    imageUrl: initial?.imageUrl || "",
    storeItemCategoryId: initial?.storeItemCategoryId?.id || "",
    storeItemSubcategoryId: initial?.storeItemSubcategoryId?.id || "",
  }));
  // Grouped, purchasable variants. Each row:
  //   { options: { [dimension]: value }, price, mrp, stock, image, label }
  // `options` powers Amazon-style grouped selectors (one chip group per
  // dimension, e.g. Size / Colour). When no dimensions are defined the row uses
  // a free-text `label` (legacy flat variants).
  const initialVariants = parseVariants(initial?.variants);
  const [dimensions, setDimensions] = useState(() => variantDimensions(initialVariants));
  const [variants, setVariants] = useState(() =>
    initialVariants.map((x) => ({
      options: x.options && typeof x.options === "object" ? { ...x.options } : {},
      label: x.label || "",
      price: x.price ?? "",
      mrp: x.mrp ?? "",
      stock: x.stock ?? "",
      image: x.image || "",
    }))
  );
  const [variantImgLoading, setVariantImgLoading] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);

  // Highlight services / assurances: [{ label, detail }]
  const parseJsonArr = (raw) => {
    try { const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch { return []; }
  };
  const [services, setServices] = useState(() =>
    parseJsonArr(initial?.services).map((s) => ({ label: s.label || "", detail: s.detail || "" }))
  );
  const addService = () => setServices((s) => [...s, { label: "", detail: "" }]);
  const updateService = (i, k, val) => setServices((s) => s.map((x, idx) => (idx === i ? { ...x, [k]: val } : x)));
  const removeService = (i) => setServices((s) => s.filter((_, idx) => idx !== i));

  // Offer cards: [{ title, description, discountType, discountValue, minPurchase }]
  const [offers, setOffers] = useState(() =>
    parseJsonArr(initial?.offers).map((o) => ({
      title: o.title || "",
      description: o.description || "",
      discountType: o.discountType || "flat",
      discountValue: o.discountValue ?? "",
      minPurchase: o.minPurchase ?? "",
    }))
  );
  const addOffer = () => setOffers((o) => [...o, { title: "", description: "", discountType: "flat", discountValue: "", minPurchase: "" }]);

  // Linked products: this item can be grouped with other already-listed products.
  // On the customer front, opening one product shows the group as swap-able options.
  const [groupedItemIds, setGroupedItemIds] = useState(() => {
    const raw = (() => { try { const a = JSON.parse(initial?.groupedItemIds || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } })();
    return raw.map(Number).filter((n) => !Number.isNaN(n));
  });
  const [groupPickerQuery, setGroupPickerQuery] = useState("");
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const addGroupedItem = (id) => setGroupedItemIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  const removeGroupedItem = (id) => setGroupedItemIds((ids) => ids.filter((x) => x !== id));
  // Every other product in this store (excluding the one being edited).
  const otherItems = useMemo(
    () => (allItems || []).filter((it) => it.id !== initial?.id),
    [allItems, initial]
  );
  // Currently-grouped products, resolved to full objects for display.
  const groupedItems = useMemo(() => {
    const byId = new Map(otherItems.map((it) => [it.id, it]));
    return groupedItemIds.map((id) => byId.get(id)).filter(Boolean);
  }, [otherItems, groupedItemIds]);
  // Unselected products matching the search — shown inside the add dropdown.
  const groupCandidates = useMemo(() => {
    const q = groupPickerQuery.trim().toLowerCase();
    return otherItems
      .filter((it) => !groupedItemIds.includes(it.id))
      .filter((it) => !q || String(it.name || "").toLowerCase().includes(q));
  }, [otherItems, groupedItemIds, groupPickerQuery]);
  const updateOffer = (i, k, val) => setOffers((o) => o.map((x, idx) => (idx === i ? { ...x, [k]: val } : x)));
  const removeOffer = (i) => setOffers((o) => o.filter((_, idx) => idx !== i));

  const addDimension = () => setDimensions((d) => [...d, ""]);
  const updateDimension = (i, val) => setDimensions((d) => d.map((x, idx) => (idx === i ? val : x)));
  const removeDimension = (i) =>
    setDimensions((d) => {
      const name = d[i];
      setVariants((vs) => vs.map((v) => {
        const o = { ...v.options }; delete o[name]; return { ...v, options: o };
      }));
      return d.filter((_, idx) => idx !== i);
    });

  const addVariant = () => setVariants((v) => [...v, { options: {}, label: "", price: "", mrp: "", stock: "", image: "" }]);
  const updateVariant = (i, k, val) => setVariants((v) => v.map((x, idx) => (idx === i ? { ...x, [k]: val } : x)));
  const updateVariantOption = (i, dim, val) =>
    setVariants((v) => v.map((x, idx) => (idx === i ? { ...x, options: { ...x.options, [dim]: val } } : x)));
  const removeVariant = (i) => setVariants((v) => v.filter((_, idx) => idx !== i));

  const handleVariantImage = async (i, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5 MB"); return; }
    setVariantImgLoading(i);
    const res = await marketplaceService.uploadImage(file, "item");
    setVariantImgLoading(null);
    if (res.success && res.data?.url) updateVariant(i, "image", res.data.url);
    else setError(res.message || "Upload failed");
  };

  // Auto-label a variant from its option values, e.g. "1 kg / Red".
  const variantLabel = useCallback((v) => {
    const named = dimensions.filter(Boolean);
    if (named.length) return named.map((d) => v.options?.[d]).filter((x) => x != null && x !== "").join(" / ");
    return String(v.label || "").trim();
  }, [dimensions]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  // Category / subcategory cascading dropdowns
  const [itemCategories, setItemCategories] = useState([]);
  const [itemSubcategories, setItemSubcategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [showInlineAddCat, setShowInlineAddCat] = useState(false);
  const [showInlineAddSub, setShowInlineAddSub] = useState(false);

  // Only APPROVED (shared) categories can be assigned to items.
  const onlyApproved = (arr) => (Array.isArray(arr) ? arr.filter((x) => String(x.status || "APPROVED").toUpperCase() === "APPROVED") : []);

  const loadItemCategories = useCallback(() => {
    setLoadingCats(true);
    marketplaceService.getMyItemCategories()
      .then((res) => { if (res.success) setItemCategories(onlyApproved(res.data)); })
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, []);

  useEffect(() => { loadItemCategories(); }, [loadItemCategories]);

  const loadItemSubcategories = useCallback(() => {
    if (!form.storeItemCategoryId) { setItemSubcategories([]); return; }
    setLoadingSubs(true);
    marketplaceService.getMyItemSubcategories(form.storeItemCategoryId)
      .then((res) => { if (res.success) setItemSubcategories(onlyApproved(res.data)); })
      .catch(() => setItemSubcategories([]))
      .finally(() => setLoadingSubs(false));
  }, [form.storeItemCategoryId]);

  useEffect(() => { loadItemSubcategories(); }, [loadItemSubcategories]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5 MB"); return; }
    setUploading(true);
    const res = await marketplaceService.uploadImage(file, "item");
    setUploading(false);
    if (res.success && res.data?.url) setField("imageUrl", res.data.url);
    else setError(res.message || "Upload failed");
  };

  const submit = async () => {
    if (!form.name.trim()) { setError("Item name required"); return; }
    if (!form.sellingPrice || Number(form.sellingPrice) <= 0) { setError("Valid selling price required"); return; }
    setError(null);
    setSaving(true);
    if (form.offerPrice && Number(form.offerPrice) > Number(form.sellingPrice)) {
      setError("Offer price cannot exceed selling price"); return;
    }
    // Clean variants: keep only rows with a resolvable label and a valid price.
    const namedDims = dimensions.filter(Boolean);
    const cleanVariants = variants
      .map((v) => ({ ...v, _label: variantLabel(v) }))
      .filter((v) => v._label && v.price !== "" && Number(v.price) > 0)
      .map((v) => ({
        label: v._label,
        price: Number(v.price),
        ...(v.mrp !== "" && v.mrp != null ? { mrp: Number(v.mrp) } : {}),
        ...(v.stock !== "" && v.stock != null ? { stock: Number(v.stock) } : {}),
        ...(v.image ? { image: v.image } : {}),
        ...(namedDims.length
          ? { options: namedDims.reduce((acc, d) => { if (v.options?.[d]) acc[d] = v.options[d]; return acc; }, {}) }
          : {}),
      }));
    // Two variants must not share the same label, or the buyer/back-end can't tell them apart.
    const labels = cleanVariants.map((v) => v.label.toLowerCase());
    if (new Set(labels).size !== labels.length) {
      setError("Two variants have the same options/label. Make each variant unique."); setSaving(false); return;
    }
    const minQ = form.minOrderQty !== "" ? Number(form.minOrderQty) : null;
    const maxQ = form.maxOrderQty !== "" ? Number(form.maxOrderQty) : null;
    if (minQ != null && maxQ != null && maxQ < minQ) {
      setError("Max order quantity cannot be less than min order quantity."); setSaving(false); return;
    }
    const payload = {
      ...(initial ? { id: initial.id } : {}),
      name: form.name.trim(),
      description: form.description.trim() || null,
      sellingPrice: Number(form.sellingPrice),
      mrp: form.mrp ? Number(form.mrp) : null,
      offerPrice: form.offerPrice ? Number(form.offerPrice) : null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      hsn: form.hsn.trim() || null,
      taxRate: form.taxRate !== "" ? Number(form.taxRate) : null,
      unit: form.unit || null,
      unitMeasure: form.unitMeasure.trim() || null,
      stockQty: form.stockQty ? Number(form.stockQty) : 0,
      lowStockThreshold: form.lowStockThreshold !== "" ? Number(form.lowStockThreshold) : null,
      minOrderQty: form.minOrderQty !== "" ? Number(form.minOrderQty) : null,
      maxOrderQty: form.maxOrderQty !== "" ? Number(form.maxOrderQty) : null,
      variants: cleanVariants.length ? JSON.stringify(cleanVariants) : null,
      services: (() => {
        const clean = services
          .map((s) => ({ label: String(s.label || "").trim(), detail: String(s.detail || "").trim() }))
          .filter((s) => s.label)
          .map((s) => (s.detail ? s : { label: s.label }));
        return clean.length ? JSON.stringify(clean) : null;
      })(),
      offers: (() => {
        const clean = offers
          .map((o) => {
            const out = { title: String(o.title || "").trim() };
            const desc = String(o.description || "").trim();
            if (desc) out.description = desc;
            const val = o.discountValue === "" || o.discountValue == null ? null : Number(o.discountValue);
            if (val != null && !Number.isNaN(val) && val > 0) {
              out.discountType = o.discountType === "percent" ? "percent" : "flat";
              out.discountValue = val;
              const min = o.minPurchase === "" || o.minPurchase == null ? null : Number(o.minPurchase);
              if (min != null && !Number.isNaN(min) && min > 0) out.minPurchase = min;
            }
            return out;
          })
          .filter((o) => o.title);
        return clean.length ? JSON.stringify(clean) : null;
      })(),
      groupedItemIds: groupedItemIds.length ? JSON.stringify(groupedItemIds) : null,
      imageUrl: form.imageUrl || null,
      isAvailable: true,
      storeItemCategoryId: form.storeItemCategoryId ? { id: form.storeItemCategoryId } : null,
      storeItemSubcategoryId: form.storeItemSubcategoryId ? { id: form.storeItemSubcategoryId } : null,
    };
    const res = initial
      ? await marketplaceService.updateMyItem(payload)
      : await marketplaceService.addMyItem(payload);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.message || "Save failed");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      {scanOpen && (
        <BarcodeScannerModal
          onDetected={(code) => { setField("barcode", code); setScanOpen(false); }}
          onClose={() => setScanOpen(false)}
        />
      )}
      <div style={{ background: "var(--cm-bg)", width: "100%", maxWidth: 480, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="mkt-header" style={{ position: "sticky", top: 0 }}>
          <button className="mkt-header-back" onClick={onClose}>×</button>
          <h1 className="mkt-header-title">{initial ? "Edit Item" : "Add Item"}</h1>
        </div>
        <div className="mkt-form">
          <div className="mkt-field">
            <label className="mkt-field-label">Item image</label>
            <div className="mkt-image-upload" onClick={() => fileInput.current?.click()}>
              <div className="mkt-image-upload-preview">
                {form.imageUrl ? <img src={form.imageUrl} alt="" /> : <FaCamera size={18} />}
              </div>
              <div className="mkt-image-upload-text">{uploading ? "Uploading…" : form.imageUrl ? "Tap to change" : "Tap to upload"}</div>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleImagePick} />
            </div>
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Name <span className="mkt-req">*</span></label>
            <input className="mkt-input" value={form.name} onChange={(e) => setField("name", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Description</label>
            <textarea className="mkt-textarea" value={form.description} onChange={(e) => setField("description", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Selling price (₹) <span className="mkt-req">*</span></label>
            <input className="mkt-input" inputMode="decimal" value={form.sellingPrice} onChange={(e) => setField("sellingPrice", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">MRP (₹)</label>
            <input className="mkt-input" inputMode="decimal" value={form.mrp} onChange={(e) => setField("mrp", e.target.value)} />
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Offer price (₹)</label>
            <input className="mkt-input" inputMode="decimal" placeholder="Optional promo price below selling price" value={form.offerPrice} onChange={(e) => setField("offerPrice", e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">SKU (Internal Tracking code)</label>
              <input className="mkt-input" value={form.sku} onChange={(e) => setField("sku", e.target.value)} />
            </div>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Barcode</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="mkt-input" style={{ flex: 1 }} value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} />
                <button
                  type="button"
                  onClick={() => setScanOpen(true)}
                  className="mkt-btn mkt-btn--secondary"
                  style={{ width: "auto", padding: "0 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                  aria-label="Scan barcode with camera"
                >
                  <FaCamera size={13} /> Scan
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">HSN / SAC</label>
              <input className="mkt-input" value={form.hsn} onChange={(e) => setField("hsn", e.target.value)} />
            </div>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">GST %</label>
              <input className="mkt-input" inputMode="decimal" placeholder="e.g. 5, 12, 18" value={form.taxRate} onChange={(e) => setField("taxRate", e.target.value)} />
            </div>
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Unit</label>
            <select className="mkt-input" value={form.unit} onChange={(e) => setField("unit", e.target.value)}>
              <option value="">-- Select unit --</option>
              <option value="piece">Piece</option>
              <option value="kg">Kg</option>
              <option value="g">Gram (g)</option>
              <option value="litre">Litre</option>
              <option value="ml">ML</option>
              <option value="pack">Pack</option>
              <option value="dozen">Dozen</option>
              <option value="box">Box</option>
              <option value="bundle">Bundle</option>
              <option value="plate">Plate</option>
              <option value="bottle">Bottle</option>
              <option value="bag">Bag</option>
              <option value="meter">Meter</option>
              <option value="foot">Foot</option>
              <option value="set">Set</option>
              <option value="pair">Pair</option>
            </select>
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Unit measure</label>
            <input
              className="mkt-input"
              type="text"
              placeholder="e.g. 2, 500, 1.5"
              value={form.unitMeasure}
              onChange={(e) => setField("unitMeasure", e.target.value)}
            />
            <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
              Quantity per unit (e.g. 2 with unit "Kg" = 2 Kg per item).
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Stock quantity</label>
              <input className="mkt-input" inputMode="numeric" value={form.stockQty} onChange={(e) => setField("stockQty", e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Low-stock alert at</label>
              <input className="mkt-input" inputMode="numeric" placeholder="e.g. 5" value={form.lowStockThreshold} onChange={(e) => setField("lowStockThreshold", e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Min order quantity</label>
              <input className="mkt-input" inputMode="numeric" placeholder="e.g. 1" value={form.minOrderQty} onChange={(e) => setField("minOrderQty", e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="mkt-field" style={{ flex: 1 }}>
              <label className="mkt-field-label">Max order quantity</label>
              <input className="mkt-input" inputMode="numeric" placeholder="No limit" value={form.maxOrderQty} onChange={(e) => setField("maxOrderQty", e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: -4 }}>
            Limits how many units a customer can buy per order. Leave blank for no limit.
          </div>

          {/* Grouped variants (Amazon-style). Optional option dimensions (Size,
              Colour…) + per-variant price / MRP / stock / image. */}
          <div className="mkt-field">
            <label className="mkt-field-label">Variants &amp; options (optional)</label>
            <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 10 }}>
              Sell one product in multiple options that each have their own price — like a shirt in different colours or rice in different weights. Leave this empty if the product has just one option.
            </div>

            {/* Step 1 — Option types (attributes) */}
            <div className="mkt-variant-dims">
              <div className="mkt-field-label" style={{ marginBottom: 4 }}>Step 1 · Attribute name</div>
              <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 8 }}>
                What changes between options? Enter the <b>type</b> here, not the value — e.g. <b>Colour</b> or <b>Size</b> (not “Black” or “1 kg”).
              </div>
              {dimensions.map((d, i) => {
                const suggest = valueLikeAttr(d);
                return (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div className="mkt-variant-dim-row">
                      <input
                        className="mkt-input"
                        style={suggest ? { borderColor: "#f59e0b" } : undefined}
                        placeholder="e.g. Colour, Size, Weight"
                        value={d}
                        onChange={(e) => updateDimension(i, e.target.value)}
                      />
                      <button type="button" className="mkt-variant-del" onClick={() => removeDimension(i)} aria-label="Remove attribute">×</button>
                    </div>
                    {suggest && (
                      <div style={{ fontSize: 11, color: "#b45309", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>“{d.trim()}” looks like a value. Did you mean the attribute <b>{suggest}</b>, with “{d.trim()}” as a variant?</span>
                        <button
                          type="button"
                          onClick={() => updateDimension(i, suggest)}
                          style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          Use “{suggest}”
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={addDimension} className="mkt-btn mkt-btn--add" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}>
                + Add another attribute
              </button>
            </div>

            {/* Step 2 — Variants */}
            {dimensions.filter(Boolean).length > 0 && (
              <div className="mkt-field-label" style={{ margin: "12px 0 6px" }}>
                Step 2 · Add each option (the actual values + price)
              </div>
            )}

            {/* Variant rows */}
            {variants.map((v, i) => (
              <div key={i} className="mkt-variant-card">
                <div className="mkt-variant-card-head">
                  <span className="mkt-variant-card-title">{variantLabel(v) || `Variant ${i + 1}`}</span>
                  <button type="button" className="mkt-variant-del" onClick={() => removeVariant(i)} aria-label="Remove variant">×</button>
                </div>
                {dimensions.filter(Boolean).length > 0 ? (
                  <div className="mkt-variant-opts">
                    {dimensions.filter(Boolean).map((dim) => (
                      <div key={dim} style={{ flex: 1, minWidth: 120 }}>
                        <label className="mkt-field-label" style={{ display: "block", marginBottom: 3 }}>{dim}</label>
                        <input
                          className="mkt-input"
                          placeholder={`e.g. ${EXAMPLE_VALUES[dim.trim().toLowerCase()] || "value"}`}
                          value={v.options?.[dim] || ""}
                          onChange={(e) => updateVariantOption(i, dim, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <input className="mkt-input" placeholder="Label e.g. 500g" value={v.label} onChange={(e) => updateVariant(i, "label", e.target.value)} />
                )}
                <div className="mkt-variant-nums">
                  <input className="mkt-input" inputMode="decimal" placeholder="Price *" value={v.price} onChange={(e) => updateVariant(i, "price", e.target.value)} />
                  <input className="mkt-input" inputMode="decimal" placeholder="₹ MRP" value={v.mrp} onChange={(e) => updateVariant(i, "mrp", e.target.value)} />
                  <input className="mkt-input" inputMode="numeric" placeholder="Stock" value={v.stock} onChange={(e) => updateVariant(i, "stock", e.target.value.replace(/\D/g, ""))} />
                </div>
                <label className="mkt-variant-img">
                  <span>{variantImgLoading === i ? "Uploading…" : v.image ? "Change image" : "Add variant image (optional)"}</span>
                  {v.image ? <img src={v.image} alt="" /> : null}
                  <input type="file" accept="image/*" hidden onChange={(e) => handleVariantImage(i, e)} />
                </label>
              </div>
            ))}
            <button type="button" onClick={addVariant} className="mkt-btn mkt-btn--add" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
              + Add variant
            </button>
          </div>

          {/* Group with other already-listed products. Customer opens one product
              and can swap between every product in the group. */}
          <div className="mkt-field">
            <label className="mkt-field-label">Group with other products (optional)</label>
            <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 8 }}>
              Pick other products already listed in your store. On the customer side, opening any one of them shows the whole group as swap-able options below the product.
            </div>
            {otherItems.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--cm-muted)", padding: "10px 12px", border: "1px dashed var(--cm-line)", borderRadius: 10 }}>
                {initial
                  ? "This is your only product so far. Add more products, then come back here to group them."
                  : "You don’t have any other products yet. Save this one, add a few more, then edit any product to group them together."}
              </div>
            ) : (
              <>
                {/* Selected products as removable rows. */}
                {groupedItems.map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--cm-line)", borderRadius: 10, marginBottom: 6 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--cm-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {it.imageUrl ? <img src={it.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{it.name}</span>
                    <span style={{ fontSize: 12, color: "var(--cm-muted)" }}>₹{Number(it.sellingPrice || 0).toFixed(0)}</span>
                    <button type="button" className="mkt-variant-del" onClick={() => removeGroupedItem(it.id)} aria-label="Remove from group">×</button>
                  </div>
                ))}

                {/* + Add product → searchable dropdown of unselected products. */}
                {!groupDropdownOpen ? (
                  <button
                    type="button"
                    onClick={() => { setGroupPickerQuery(""); setGroupDropdownOpen(true); }}
                    className="mkt-btn mkt-btn--add"
                    style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
                  >
                    + Add product
                  </button>
                ) : (
                  <div style={{ border: "1px solid var(--cm-line)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid var(--cm-line)" }}>
                      <input
                        className="mkt-input"
                        autoFocus
                        style={{ flex: 1 }}
                        placeholder="Search product to add…"
                        value={groupPickerQuery}
                        onChange={(e) => setGroupPickerQuery(e.target.value)}
                      />
                      <button type="button" className="mkt-variant-del" onClick={() => setGroupDropdownOpen(false)} aria-label="Close">×</button>
                    </div>
                    <div style={{ maxHeight: 240, overflowY: "auto" }}>
                      {groupCandidates.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--cm-muted)", padding: "10px 12px" }}>
                          {groupPickerQuery.trim() ? "No matching products." : "All your products are already grouped."}
                        </div>
                      ) : (
                        groupCandidates.map((it) => (
                          <button
                            type="button"
                            key={it.id}
                            onClick={() => { addGroupedItem(it.id); setGroupPickerQuery(""); }}
                            style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: "1px solid var(--cm-line)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                          >
                            <span style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--cm-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {it.imageUrl ? <img src={it.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                            </span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{it.name}</span>
                            <span style={{ fontSize: 12, color: "var(--cm-muted)" }}>₹{Number(it.sellingPrice || 0).toFixed(0)}</span>
                            <FaPlus size={11} color="var(--cm-accent, #007BFF)" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Highlight services / assurances (e.g. 1 Year Warranty, Free Delivery). */}
          <div className="mkt-field">
            <label className="mkt-field-label">Services &amp; highlights (optional)</label>
            <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 8 }}>
              Assurances shown on the product, like “1 Year Warranty”, “Free Delivery” or “7-day Replacement”.
            </div>
            {services.map((s, i) => (
              <div key={i} className="mkt-variant-card">
                <div className="mkt-variant-card-head">
                  <span className="mkt-variant-card-title">{s.label.trim() || `Service ${i + 1}`}</span>
                  <button type="button" className="mkt-variant-del" onClick={() => removeService(i)} aria-label="Remove service">×</button>
                </div>
                <input className="mkt-input" style={{ marginBottom: 6 }} placeholder="Title e.g. 1 Year Warranty" value={s.label} onChange={(e) => updateService(i, "label", e.target.value)} />
                <input className="mkt-input" placeholder="Detail (optional) e.g. Brand warranty" value={s.detail} onChange={(e) => updateService(i, "detail", e.target.value)} />
              </div>
            ))}
            <button type="button" onClick={addService} className="mkt-btn mkt-btn--add" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
              + Add service
            </button>
          </div>

          {/* Offer cards (e.g. Bank Offer, No Cost EMI, Cashback). */}
          <div className="mkt-field">
            <label className="mkt-field-label">Offers (optional)</label>
            <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 8 }}>
              Promotional cards shown on the product, like “Bank Offer” or “No Cost EMI”. Add a discount rule (flat ₹ or percent %, with optional minimum purchase) so the saving is applied.
            </div>
            {offers.map((o, i) => (
              <div key={i} className="mkt-variant-card">
                <div className="mkt-variant-card-head">
                  <span className="mkt-variant-card-title">{o.title.trim() || `Offer ${i + 1}`}</span>
                  <button type="button" className="mkt-variant-del" onClick={() => removeOffer(i)} aria-label="Remove offer">×</button>
                </div>
                <input className="mkt-input" style={{ marginBottom: 6 }} placeholder="Offer title e.g. Bank Offer" value={o.title} onChange={(e) => updateOffer(i, "title", e.target.value)} />
                <textarea className="mkt-input" rows={2} style={{ marginBottom: 6 }} placeholder="Description e.g. Upto ₹50 off on select cards" value={o.description} onChange={(e) => updateOffer(i, "description", e.target.value)} />
                <label className="mkt-field-label" style={{ fontSize: 11 }}>Discount rule</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select className="mkt-input" style={{ flex: "0 0 110px" }} value={o.discountType} onChange={(e) => updateOffer(i, "discountType", e.target.value)}>
                    <option value="flat">Flat ₹</option>
                    <option value="percent">Percent %</option>
                  </select>
                  <input className="mkt-input" style={{ flex: 1 }} inputMode="decimal" placeholder={o.discountType === "percent" ? "e.g. 10 (%)" : "e.g. 50 (₹)"} value={o.discountValue} onChange={(e) => updateOffer(i, "discountValue", e.target.value)} />
                  <input className="mkt-input" style={{ flex: 1 }} inputMode="decimal" placeholder="Min ₹ (opt)" value={o.minPurchase} onChange={(e) => updateOffer(i, "minPurchase", e.target.value)} />
                </div>
              </div>
            ))}
            <button type="button" onClick={addOffer} className="mkt-btn mkt-btn--add" style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}>
              + Add offer
            </button>
          </div>

          {/* Category / Subcategory dropdowns with inline add */}
          <div className="mkt-field">
            <label className="mkt-field-label">Item Category</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                className="mkt-input"
                style={{ flex: 1 }}
                value={form.storeItemCategoryId}
                onChange={(e) => {
                  setField("storeItemCategoryId", e.target.value ? Number(e.target.value) : "");
                  setField("storeItemSubcategoryId", "");
                }}
              >
                <option value="">{loadingCats ? "Loading…" : "-- None --"}</option>
                {itemCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowInlineAddCat(true)}
                style={{
                  flexShrink: 0, width: 38, height: 38, borderRadius: 10,
                  border: "none", background: "linear-gradient(135deg, #40E0D0, #007BFF)",
                  color: "#fff", display: "grid", placeItems: "center", cursor: "pointer",
                }}
                title="Add category"
              >
                <FaPlus size={14} />
              </button>
            </div>
          </div>
          <div className="mkt-field">
            <label className="mkt-field-label">Item Subcategory</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                className="mkt-input"
                style={{ flex: 1 }}
                value={form.storeItemSubcategoryId}
                onChange={(e) => setField("storeItemSubcategoryId", e.target.value ? Number(e.target.value) : "")}
                disabled={!form.storeItemCategoryId}
              >
                <option value="">{!form.storeItemCategoryId ? "-- Select category first --" : loadingSubs ? "Loading…" : "-- None --"}</option>
                {itemSubcategories.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!form.storeItemCategoryId) { setError("Select a category first"); return; }
                  setShowInlineAddSub(true);
                }}
                style={{
                  flexShrink: 0, width: 38, height: 38, borderRadius: 10,
                  border: "none", background: form.storeItemCategoryId ? "linear-gradient(135deg, #14b8a6, #0d9488)" : "var(--cm-line)",
                  color: "#fff", display: "grid", placeItems: "center",
                  cursor: form.storeItemCategoryId ? "pointer" : "not-allowed",
                }}
                title="Add subcategory"
              >
                <FaPlus size={14} />
              </button>
            </div>
          </div>

          {/* Inline add category modal */}
          {showInlineAddCat && (
            <CategoryFormModal
              onClose={() => setShowInlineAddCat(false)}
              onSaved={() => { setShowInlineAddCat(false); loadItemCategories(); }}
            />
          )}

          {/* Inline add subcategory modal */}
          {showInlineAddSub && form.storeItemCategoryId && (
            <SubcategoryFormModal
              categoryId={form.storeItemCategoryId}
              categoryName={itemCategories.find((c) => c.id === form.storeItemCategoryId)?.name || ""}
              onClose={() => setShowInlineAddSub(false)}
              onSaved={() => { setShowInlineAddSub(false); loadItemSubcategories(); }}
            />
          )}
          {error && <div className="mkt-error-text">{error}</div>}
          <button className="mkt-btn mkt-btn--primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ORDER_STATUS_TONE = {
  PLACED: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" },
  ACCEPTED: { bg: "rgba(20, 184, 166, 0.12)", color: "#14b8a6" },
  PREPARING: { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" },
  OUT_FOR_DELIVERY: { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" },
  DELIVERED: { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444" },
  CANCELLED: { bg: "rgba(148, 163, 184, 0.18)", color: "#64748b" },
};

const formatOrderTime = (s) => {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

const ORDER_STATUS_FILTERS = [
  { key: "PLACED", label: "Pending" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "PREPARING", label: "Preparing" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ALL", label: "All" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const RecentOrdersSection = ({ orders, onSeeAll }) => {
  const navigate = useNavigate();
  // Default to PLACED (= pending, awaiting seller action) — that's the most
  // actionable bucket on landing. Seller can flip to All / other states.
  const [statusFilter, setStatusFilter] = useState("PLACED");
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());

  const filtered = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity;
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.orderStatus !== statusFilter) return false;
      const ts = o.placedAt || o.date || o.createdDate;
      if (!ts) return true;
      const t = new Date(ts).getTime();
      return t >= from && t <= to;
    });
  }, [orders, statusFilter, fromDate, toDate]);

  // Cap displayed rows even if filter has more — keeps the inline preview light.
  const visible = filtered.slice(0, 5);
  const totalForLabel = filtered.length;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>
          Orders {totalForLabel > 0 && <span style={{ fontWeight: 500, color: "var(--cm-muted)" }}>({visible.length} of {totalForLabel})</span>}
        </div>
      </div>

      {/* Status filter chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 6,
          marginBottom: 8,
          scrollbarWidth: "none",
        }}
      >
        {ORDER_STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.key;
          // Per-status count helps the seller see what's where at a glance.
          const count = f.key === "ALL"
            ? orders.length
            : orders.filter((o) => o.orderStatus === f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${isActive ? "transparent" : "var(--cm-line)"}`,
                background: isActive ? "linear-gradient(135deg, #40E0D0, #007BFF)" : "var(--cm-card)",
                color: isActive ? "#fff" : "var(--cm-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {f.label} <span style={{ opacity: 0.85 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Date range */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 4 }}>From</div>
          <input
            type="date"
            className="mkt-input"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 4 }}>To</div>
          <input
            type="date"
            className="mkt-input"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            padding: "18px 14px",
            borderRadius: 12,
            border: "1px dashed var(--cm-line)",
            background: "var(--cm-card)",
            color: "var(--cm-muted)",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {orders.length === 0
            ? "No orders yet. New orders will appear here."
            : `No ${statusFilter === "ALL" ? "orders" : (ORDER_STATUS_FILTERS.find((f) => f.key === statusFilter)?.label || "matching")} orders in this date range.`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map((o) => {
            const tone = ORDER_STATUS_TONE[o.orderStatus] || ORDER_STATUS_TONE.ACCEPTED;
            return (
              <div
                key={o.id}
                onClick={() => navigate("/customer/app/marketplace/store-orders")}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--cm-line)",
                  background: "var(--cm-card)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--cm-muted)" }}>{o.orderNo || `#${o.id}`}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.userId?.name || "Customer"}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      background: tone.bg, color: tone.color, letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {String(o.orderStatus || "").replace(/_/g, " ")}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--cm-muted)" }}>
                  <span>{formatOrderTime(o.placedAt || o.createdDate)}</span>
                  <span style={{ fontWeight: 700, color: "var(--cm-ink)" }}>
                    ₹{Number(o.totalAmount || 0).toFixed(0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visible.length > 0 && (
        <button
          type="button"
          onClick={onSeeAll}
          className="mkt-btn mkt-btn--secondary"
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          View more orders <FaChevronRight size={11} />
        </button>
      )}
    </div>
  );
};

export default MyStoreManageScreen;
