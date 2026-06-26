import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStar, FaCheckCircle, FaMapMarkerAlt, FaHeart } from "react-icons/fa";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

/**
 * Saved / favourite providers (PRD: "Saved Providers" in the customer dashboard).
 * Lists the providers the customer has hearted; tapping the heart unsaves inline.
 */
export default function SavedProvidersScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await serviceBazaarService.getMyFavorites({ pageSize: 50 });
    if (res.success) setProviders(res.data?.records || []);
    else showToast(res.message || "Could not load saved providers", "error");
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const unsave = async (e, providerId) => {
    e.stopPropagation();
    if (busyId) return;
    setBusyId(providerId);
    const res = await serviceBazaarService.removeFavorite(providerId);
    if (res.success) {
      setProviders((list) => list.filter((p) => p.id !== providerId));
      showToast("Removed from saved", "success");
    } else {
      showToast(res.message || "Could not remove", "error");
    }
    setBusyId(null);
  };

  return (
    <div className="sb-page">
      <div className="sb-topbar" style={{ marginBottom: 8 }}>
        <button className="sb-back" onClick={() => navigate(-1)} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">Saved Providers</h1>
      </div>

      <div className="sb-results">
        {loading ? (
          <div className="sb-empty">Loading…</div>
        ) : providers.length === 0 ? (
          <div className="sb-empty">No saved providers yet. Tap the heart on a provider to save them here.</div>
        ) : (
          providers.map((p) => (
            <div
              key={p.id}
              className="sb-card"
              onClick={() => navigate(`/customer/app/service-bazaar/provider/${p.id}`)}
            >
              <div className="sb-avatar">
                {p.profilePhotoUrl ? (
                  <img src={p.profilePhotoUrl} alt={p.providerName} style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} />
                ) : (
                  (p.businessName || p.providerName || "?").charAt(0).toUpperCase()
                )}
              </div>
              <div className="sb-card-body">
                <p className="sb-card-name">{p.businessName || p.providerName}</p>
                <p className="sb-card-meta">
                  {p.headline || p.categoryId?.name || "Service provider"}
                  {p.city ? ` • ${p.city}` : ""}
                </p>
                <div className="sb-badges">
                  {Number(p.ratingAvg) > 0 && (
                    <span className="sb-badge rating">
                      <FaStar style={{ marginRight: 3, fontSize: 10 }} />
                      {Number(p.ratingAvg).toFixed(1)} ({p.reviewCount || 0})
                    </span>
                  )}
                  <span className="sb-badge"><FaCheckCircle style={{ marginRight: 3, fontSize: 10 }} /> Verified</span>
                </div>
              </div>
              <button
                className="sb-share"
                style={{ color: "#ef4444", alignSelf: "center" }}
                onClick={(e) => unsave(e, p.id)}
                disabled={busyId === p.id}
                aria-label="Remove from saved"
              >
                <FaHeart />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
