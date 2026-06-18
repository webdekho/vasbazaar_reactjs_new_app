import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHeart, FaTrash, FaRupeeSign } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useToast } from "../../context/ToastContext";
import "./marketplace.css";

const formatDate = (s) => {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

const EMPTY = { itemName: "", quantity: "", budget: "", note: "" };

const MyWishlistScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    marketplaceService.getMyWishlist().then((res) => {
      setLoading(false);
      if (res.success) {
        setItems(Array.isArray(res.data) ? res.data : []);
      } else {
        setError(res.message || "Couldn't load your wishlist. Please try again.");
      }
    });
  };

  useEffect(() => { load(); }, []);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.itemName.trim()) {
      showToast("Enter the item name", "error");
      return;
    }
    setSaving(true);
    const res = await marketplaceService.createWishlist({
      itemName: form.itemName.trim(),
      quantity: form.quantity.trim() || undefined,
      budget: form.budget.trim() || undefined,
      note: form.note.trim() || undefined,
    });
    setSaving(false);
    if (res.success) {
      setForm(EMPTY);
      showToast("Added to wishlist", "success");
      load();
    } else {
      showToast(res.message || "Could not add to wishlist", "error");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this item from your wishlist?")) return;
    const res = await marketplaceService.deleteWishlist(id);
    if (res.success) {
      setItems((prev) => prev.filter((x) => x.id !== id));
    } else {
      showToast(res.message || "Could not remove", "error");
    }
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">My Wishlist</h1>
      </div>

      {/* Add form */}
      <form onSubmit={submit} className="mkt-wishlist-form">
        <div className="mkt-field">
          <label className="mkt-field-label">What are you looking for? <span className="mkt-req">*</span></label>
          <input
            className="mkt-input"
            placeholder="e.g. Blue running shoes, size 9"
            value={form.itemName}
            onChange={(e) => setField("itemName", e.target.value)}
            maxLength={160}
          />
        </div>
        <div className="mkt-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="mkt-field-label">Quantity</label>
            <input
              className="mkt-input"
              placeholder="e.g. 2"
              value={form.quantity}
              onChange={(e) => setField("quantity", e.target.value)}
              maxLength={40}
            />
          </div>
          <div>
            <label className="mkt-field-label">Budget (₹)</label>
            <input
              className="mkt-input"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="optional"
              value={form.budget}
              onChange={(e) => setField("budget", e.target.value)}
            />
          </div>
        </div>
        <div className="mkt-field">
          <label className="mkt-field-label">Note</label>
          <textarea
            className="mkt-input"
            rows={2}
            placeholder="Any details — brand, colour, model…"
            value={form.note}
            onChange={(e) => setField("note", e.target.value)}
          />
        </div>
        <button type="submit" className="mkt-btn mkt-btn--primary" disabled={saving}>
          {saving ? "Adding…" : "Add to wishlist"}
        </button>
      </form>

      {/* List */}
      {loading ? (
        <div className="mkt-empty">Loading…</div>
      ) : error ? (
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaHeart /></div>
          <div>{error}</div>
          <button
            onClick={load}
            style={{ marginTop: 14, background: "var(--cm-primary, #14b8a6)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="mkt-empty">
          <div className="mkt-empty-icon"><FaHeart /></div>
          <div>Your wishlist is empty</div>
          <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 4 }}>
            Add items above to keep track of what you want.
          </div>
        </div>
      ) : (
        <div style={{ padding: "4px 14px 24px" }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                background: "var(--cm-card)",
                border: "1px solid var(--cm-line)",
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cm-ink)" }}>{it.itemName}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {it.quantity && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>
                      Qty: {it.quantity}
                    </span>
                  )}
                  {it.budget != null && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(16,185,129,0.12)", color: "#10b981", display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <FaRupeeSign size={9} />{Number(it.budget).toFixed(0)}
                    </span>
                  )}
                </div>
                {it.note && (
                  <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 6 }}>{it.note}</div>
                )}
                <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 6 }}>{formatDate(it.createdAt)}</div>
              </div>
              <button
                onClick={() => remove(it.id)}
                aria-label="Remove"
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 6, flexShrink: 0 }}
              >
                <FaTrash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyWishlistScreen;
