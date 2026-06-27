import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch, FaStar, FaCheckCircle, FaStore, FaCalendarCheck, FaMapMarkerAlt, FaHeart, FaShieldAlt, FaSyncAlt, FaComments } from "react-icons/fa";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { TierChip, TrustBadges } from "./TrustBadges";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

const SkeletonCards = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <div className="sb-skel-card" key={i}>
        <div className="sb-skel sb-skel-avatar" />
        <div style={{ flex: 1 }}>
          <div className="sb-skel sb-skel-line" style={{ width: "55%" }} />
          <div className="sb-skel sb-skel-line" style={{ width: "75%" }} />
          <div className="sb-skel sb-skel-line" style={{ width: "35%", marginBottom: 0 }} />
        </div>
      </div>
    ))}
  </>
);

/**
 * Service Bazaar discovery home: category chips + nearby/keyword provider search.
 * Entry point for the hyperlocal services marketplace.
 */
export default function ServiceBazaarHomeScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [pincode, setPincode] = useState(localStorage.getItem("sbPincode") || "");
  const [editingLoc, setEditingLoc] = useState(false);
  const [coords, setCoords] = useState(null); // { lat, lng } when "near me" is active
  const [radiusKm, setRadiusKm] = useState(10);
  const [locating, setLocating] = useState(false);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);

  const RADII = [3, 5, 10, 20, 0]; // 0 = any distance (within each provider's own reach)

  const useMyLocation = () => {
    if (!navigator.geolocation) { showToast("Location not supported on this device", "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        showToast("Showing providers near you", "success");
      },
      () => { setLocating(false); showToast("Could not get your location", "error"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    let cancelled = false;
    serviceBazaarService.getCategories().then((res) => {
      if (!cancelled && res.success) setCategories(Array.isArray(res.data) ? res.data : []);
    });
    return () => { cancelled = true; };
  }, []);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    const geo = coords ? { lat: coords.lat, lng: coords.lng, radiusKm: radiusKm || undefined } : {};
    const res = await serviceBazaarService.searchProviders({
      categoryId: activeCategory || undefined,
      search: search.trim() || undefined,
      // Pincode is ignored once a precise "near me" location is active.
      pincode: coords ? undefined : pincode.trim() || undefined,
      ...geo,
      pageSize: 20,
    });
    if (res.success) {
      setProviders(res.data?.records || []);
    } else {
      showToast(res.message || "Could not load services", "error");
    }
    setLoading(false);
  }, [activeCategory, search, pincode, coords, radiusKm, showToast]);

  const saveLocation = () => {
    localStorage.setItem("sbPincode", pincode.trim());
    setEditingLoc(false);
  };

  useEffect(() => {
    const t = setTimeout(loadProviders, 300);
    return () => clearTimeout(t);
  }, [loadProviders]);

  return (
    <div className="sb-page">
      <div className="sb-sticky">
        <div className="sb-topbar" style={{ marginBottom: 8 }}>
          <button className="sb-back" onClick={() => navigate("/customer/app")} aria-label="Back">
            <FaArrowLeft />
          </button>
          <h1 className="sb-title">Service Bazaar</h1>
          <button className="sb-provider-cta" onClick={() => navigate("/customer/app/service-bazaar/provider")}>
            <FaStore /> <span>Become a Provider</span>
          </button>
        </div>
        <div className="sb-hero">
          <span className="sb-hero-eyebrow"><FaCheckCircle /> Verified local pros</span>
          <h1>Recharge se <span className="sb-hero-accent">Rozgaar</span> tak</h1>
          <p>Book trusted, verified local services near you</p>
          {editingLoc ? (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input
                className="sb-loc"
                style={{ color: "#fff", flex: 1 }}
                placeholder="Enter pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                inputMode="numeric"
              />
              <button className="sb-loc" onClick={saveLocation}>Done</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button className="sb-loc" onClick={() => setEditingLoc(true)}>
                <FaMapMarkerAlt /> {coords ? "Near me" : pincode ? `Near ${pincode}` : "Set your location"}
              </button>
              <button className="sb-loc" onClick={useMyLocation} disabled={locating}>
                {locating ? "Locating…" : coords ? "Update GPS" : "Use my location"}
              </button>
              {coords && (
                <button className="sb-loc" onClick={() => setCoords(null)}>Clear</button>
              )}
            </div>
          )}
          {coords && (
            <div className="sb-chips" style={{ marginTop: 8 }}>
              {RADII.map((r) => (
                <button
                  key={r}
                  className={`sb-chip ${radiusKm === r ? "active" : ""}`}
                  onClick={() => setRadiusKm(r)}
                >
                  {r === 0 ? "Any" : `${r} km`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sb-quick" role="navigation" aria-label="Service Bazaar shortcuts">
        <button className="sb-quick-item" style={{ "--qc1": "#6366f1", "--qc2": "#8b5cf6" }} onClick={() => navigate("/customer/app/service-bazaar/my-bookings")}>
          <span className="sb-quick-ic"><FaCalendarCheck /></span>
          <span className="sb-quick-lbl">My Bookings</span>
        </button>
        <button className="sb-quick-item" style={{ "--qc1": "#f43f5e", "--qc2": "#fb7185" }} onClick={() => navigate("/customer/app/service-bazaar/saved")}>
          <span className="sb-quick-ic"><FaHeart /></span>
          <span className="sb-quick-lbl">Saved</span>
        </button>
        <button className="sb-quick-item" style={{ "--qc1": "#0ea5e9", "--qc2": "#22d3ee" }} onClick={() => navigate("/customer/app/service-bazaar/appliances")}>
          <span className="sb-quick-ic"><FaShieldAlt /></span>
          <span className="sb-quick-lbl">Appliances &amp; AMC</span>
        </button>
        <button className="sb-quick-item" style={{ "--qc1": "#10b981", "--qc2": "#34d399" }} onClick={() => navigate("/customer/app/service-bazaar/subscriptions")}>
          <span className="sb-quick-ic"><FaSyncAlt /></span>
          <span className="sb-quick-lbl">Subscriptions</span>
        </button>
        <button className="sb-quick-item" style={{ "--qc1": "#f59e0b", "--qc2": "#fbbf24" }} onClick={() => navigate("/customer/app/service-bazaar/messages")}>
          <span className="sb-quick-ic"><FaComments /></span>
          <span className="sb-quick-lbl">Messages</span>
        </button>
      </div>

      <div className="sb-searchrow">
        <div className="sb-search">
          <span className="sb-search-ic"><FaSearch /></span>
          <input
            placeholder="Search beautician, electrician, tutor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="sb-chips">
        <button
          className={`sb-chip ${activeCategory === null ? "active" : ""}`}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`sb-chip ${activeCategory === c.id ? "active" : ""}`}
            onClick={() => setActiveCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="sb-results">
      {loading ? (
        <SkeletonCards />
      ) : providers.length === 0 ? (
        <div className="sb-empty">No providers found yet. Try another category or be the first to list!</div>
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
              <p className="sb-card-name">
                {p.businessName || p.providerName}
                <TierChip level={p.verificationLevel} size="sm" />
              </p>
              <p className="sb-card-meta">
                {p.headline || p.categoryId?.name || "Service provider"}
                {p.city ? ` • ${p.city}` : ""}
              </p>
              <div className="sb-badges">
                {p.distanceKm != null && (
                  <span className="sb-badge">
                    <FaMapMarkerAlt style={{ marginRight: 3, fontSize: 10 }} /> {p.distanceKm} km
                  </span>
                )}
                {Number(p.ratingAvg) > 0 && (
                  <span className="sb-badge rating">
                    <FaStar style={{ marginRight: 3, fontSize: 10 }} />
                    {Number(p.ratingAvg).toFixed(1)} ({p.reviewCount || 0})
                  </span>
                )}
              </div>
              <TrustBadges badges={p.trustBadges} max={3} />
            </div>
          </div>
        ))
      )}
      </div>
    </div>
  );
}
