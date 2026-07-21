import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStar, FaRegStar, FaReply } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { formatDisplayDate } from "../../../utils/dateFormat";
import "./marketplace.css";

const Stars = ({ rating, size = 13 }) => {
  const r = Math.round(Number(rating) || 0);
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        n <= r ? <FaStar key={n} size={size} color="#f59e0b" /> : <FaRegStar key={n} size={size} color="#cbd5e1" />
      ))}
    </span>
  );
};

const StoreReviewsScreen = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceService.getMyStoreReviews();
    setLoading(false);
    if (res.success) setReviews(Array.isArray(res.data) ? res.data : []);
    else setError(res.message || "Failed to load reviews");
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="mkt">
        <div className="mkt-header">
          <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
          <h1 className="mkt-header-title">Reviews</h1>
        </div>
        <div className="mkt-empty">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">Reviews</h1>
      </div>

      <div style={{ padding: "12px 14px 24px" }}>
        {error && <div className="mkt-error-text" style={{ marginBottom: 12 }}>{error}</div>}
        {reviews.length === 0 ? (
          <div className="mkt-empty">No reviews yet. They'll appear here once customers rate your store.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} onReplied={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ReviewCard = ({ review, onReplied }) => {
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const photos = Array.isArray(review.photos) ? review.photos : [];

  const submit = async () => {
    if (!reply.trim()) { setError("Write a reply first"); return; }
    setError(null);
    setSaving(true);
    const res = await marketplaceService.replyToReview(review.id, reply.trim());
    setSaving(false);
    if (res.success) onReplied();
    else setError(res.message || "Failed to send reply");
  };

  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--cm-line)", background: "var(--cm-card)", padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cm-ink)" }}>{review.customerName || "Customer"}</div>
          <div style={{ marginTop: 4 }}><Stars rating={review.rating} /></div>
        </div>
        <div style={{ fontSize: 11, color: "var(--cm-muted)", whiteSpace: "nowrap" }}>{formatDisplayDate(review.createdAt, "")}</div>
      </div>

      {review.comment && (
        <div style={{ fontSize: 13, color: "var(--cm-ink)", marginTop: 8, lineHeight: 1.45 }}>{review.comment}</div>
      )}

      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {photos.map((p, i) => (
            <img key={i} src={p} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid var(--cm-line)" }} />
          ))}
        </div>
      )}

      {review.merchantReply ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--cm-bg-secondary)", border: "1px solid var(--cm-line)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#007BFF", display: "flex", alignItems: "center", gap: 6 }}>
            <FaReply size={10} /> Your reply
            {review.merchantReplyAt && <span style={{ color: "var(--cm-muted)", fontWeight: 500 }}>· {formatDisplayDate(review.merchantReplyAt, "")}</span>}
          </div>
          <div style={{ fontSize: 13, color: "var(--cm-ink)", marginTop: 6, lineHeight: 1.45 }}>{review.merchantReply}</div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <textarea
            className="mkt-textarea"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply to this customer…"
            style={{ minHeight: 64 }}
          />
          {error && <div className="mkt-error-text">{error}</div>}
          <button className="mkt-btn mkt-btn--primary" onClick={submit} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Sending…" : "Reply"}
          </button>
        </div>
      )}
    </div>
  );
};

export default StoreReviewsScreen;
