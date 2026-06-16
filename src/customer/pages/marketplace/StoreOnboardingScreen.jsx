import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaMapMarkerAlt, FaCamera, FaImage, FaFileAlt } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { useGeolocation } from "../../hooks/useGeolocation";
import "./marketplace.css";

const STEPS = [
  "Business basics",
  "Location",
  "Delivery setup",
  "Branding",
  "Review",
];

const initialForm = {
  businessName: "",
  ownerName: "",
  mobile: "",
  email: "",
  gstNumber: "",
  categoryId: null,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  latitude: null,
  longitude: null,
  servingRadiusKm: 5,
  deliveryTimeMinutes: 30,
  deliveryCharges: 0,
  minOrderValue: 0,
  autoSchedule: false,
  openTime: "",
  closeTime: "",
  weeklyOffDays: [], // subset of ["MON","TUE","WED","THU","FRI","SAT","SUN"]
  logoUrl: "",
  bannerUrl: "",
  gstCertificateUrl: "",
  udyamCertificateUrl: "",
  fssaiCertificateUrl: "",
};

const StoreOnboardingScreen = ({ editMode: forceEditMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const editMode = forceEditMode || location.state?.editMode === true;
  const initialData = location.state?.store;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => initialData ? { ...initialForm, ...flattenStore(initialData) } : initialForm);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingGst, setUploadingGst] = useState(false);
  const [uploadingUdyam, setUploadingUdyam] = useState(false);
  const [uploadingFssai, setUploadingFssai] = useState(false);
  const [chargesData, setChargesData] = useState(null);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState(null);
  const logoInput = useRef(null);
  const bannerInput = useRef(null);
  const gstInput = useRef(null);
  const udyamInput = useRef(null);
  const fssaiInput = useRef(null);

  const selectedCategory = categories.find((c) => Number(c.id) === Number(form.categoryId));
  const isRestaurant = /restaurant|food|hotel|cafe|eatery|dhaba/i.test(selectedCategory?.name || "");

  // Use Capacitor geolocation hook for proper Android/iOS permission handling
  const {
    requestLocation,
    loading: geoLoading,
  } = useGeolocation({ autoRequest: false });

  useEffect(() => {
    marketplaceService.getCategories().then((res) => {
      if (res.success) setCategories(Array.isArray(res.data) ? res.data : []);
    });
  }, []);

  // Fetch charges only at registration (not edit). Re-runs when category or applied coupon changes.
  useEffect(() => {
    if (editMode) return;
    setChargesLoading(true);
    marketplaceService.getOnboardingCharges({
      categoryId: form.categoryId || undefined,
      couponCode: appliedCoupon || undefined,
    }).then((res) => {
      setChargesLoading(false);
      if (res.success) setChargesData(res.data);
    });
  }, [editMode, form.categoryId, appliedCoupon]);

  const applyCoupon = () => {
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponError("Enter a coupon code"); return; }
    marketplaceService.validateOnboardingCoupon({
      code,
      categoryId: form.categoryId || null,
    }).then((res) => {
      if (!res.success) { setCouponError(res.message || "Invalid coupon"); return; }
      const couponInfo = res.data?.coupon || {};
      if (couponInfo.valid) {
        setAppliedCoupon(code);
        setChargesData(res.data);
      } else {
        setCouponError(couponInfo.message || "Coupon not applicable");
      }
    });
  };

  const removeCoupon = () => {
    setAppliedCoupon("");
    setCouponInput("");
    setCouponError(null);
  };

  function flattenStore(s) {
    return {
      businessName: s.businessName || "",
      ownerName: s.ownerName || "",
      mobile: s.mobile || "",
      email: s.email || "",
      gstNumber: s.gstNumber || "",
      categoryId: s.categoryId?.id || s.categoryId || null,
      addressLine1: s.addressLine1 || "",
      addressLine2: s.addressLine2 || "",
      city: s.city || "",
      state: s.state || "",
      pincode: s.pincode || "",
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
      servingRadiusKm: Number(s.servingRadiusKm || 5),
      deliveryTimeMinutes: Number(s.deliveryTimeMinutes || 30),
      deliveryCharges: Number(s.deliveryCharges || 0),
      minOrderValue: Number(s.minOrderValue || 0),
      autoSchedule: s.autoSchedule === true,
      openTime: s.openTime ? String(s.openTime).slice(0, 5) : "",
      closeTime: s.closeTime ? String(s.closeTime).slice(0, 5) : "",
      weeklyOffDays: parseOffDays(s.weeklySchedule),
      logoUrl: s.logoUrl || "",
      bannerUrl: s.bannerUrl || "",
      gstCertificateUrl: s.gstCertificateUrl || "",
      udyamCertificateUrl: s.udyamCertificateUrl || "",
      fssaiCertificateUrl: s.fssaiCertificateUrl || "",
    };
  }

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const captureLocation = async () => {
    setError(null);
    try {
      const coords = await requestLocation();
      if (coords && coords.lat && coords.lng) {
        setField("latitude", coords.lat);
        setField("longitude", coords.lng);
      } else {
        setError("Allow location permission to continue");
      }
    } catch (err) {
      setError(err?.message || "Could not get location. Please enable location permission.");
    }
  };

  const handleImagePick = async (e, purpose, setUploading, setterField) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5 MB"); return; }
    setError(null);
    setUploading(true);
    const res = await marketplaceService.uploadImage(file, purpose);
    setUploading(false);
    if (res.success && res.data?.url) {
      setField(setterField, res.data.url);
    } else {
      setError(res.message || "Upload failed");
    }
  };

  const handleDocumentPick = async (e, purpose, setUploading, setterField) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("File must be under 10 MB"); return; }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) { setError("Only JPG, PNG or PDF allowed"); return; }
    setError(null);
    setUploading(true);
    const res = await marketplaceService.uploadImage(file, purpose);
    setUploading(false);
    if (res.success && res.data?.url) {
      setField(setterField, res.data.url);
    } else {
      setError(res.message || "Upload failed");
    }
  };

  const isPdf = (url) => /\.pdf($|\?)/i.test(url || "");
  const fileLabel = (url) => {
    if (!url) return "";
    if (isPdf(url)) return "PDF uploaded";
    return "Uploaded";
  };

  const validateStep = () => {
    setError(null);
    if (step === 0) {
      if (!form.businessName.trim()) return "Business name is required";
      if (!form.mobile || !/^\d{10}$/.test(form.mobile)) return "Valid 10-digit mobile required";
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Invalid email";
    }
    if (step === 1) {
      if (!form.addressLine1.trim()) return "Address is required";
      if (!form.city.trim()) return "City is required";
      if (!form.state.trim()) return "State is required";
      if (!form.pincode || !/^\d{6}$/.test(form.pincode)) return "Valid 6-digit pincode required";
      if (form.latitude == null || form.longitude == null) return "Capture your store location";
    }
    if (step === 2) {
      if (!form.servingRadiusKm || form.servingRadiusKm <= 0) return "Serving radius required";
      if (!form.deliveryTimeMinutes || form.deliveryTimeMinutes <= 0) return "Delivery time required";
      if (form.deliveryCharges < 0) return "Delivery charges cannot be negative";
      if (form.minOrderValue < 0) return "Min order value cannot be negative";
      if (form.autoSchedule) {
        if (!form.openTime || !form.closeTime) {
          return "Set both open and close time, or turn off auto schedule";
        }
        if (form.openTime === form.closeTime) {
          return "Open and close time cannot be the same";
        }
      }
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const payload = { ...form };
    if (form.categoryId) payload.categoryId = { id: Number(form.categoryId) };
    else delete payload.categoryId;

    // Timing fields: backend deserializes openTime/closeTime to LocalTime,
    // so empty strings would 500. Send "HH:mm:ss" or omit entirely.
    const toIsoTime = (t) => (t && t.length === 5 ? `${t}:00` : t || null);
    if (form.autoSchedule) {
      payload.openTime = toIsoTime(form.openTime);
      payload.closeTime = toIsoTime(form.closeTime);
      // Build weekly schedule only when seller picked at least one off-day.
      // Otherwise the single open/close window applies every day.
      if (form.weeklyOffDays.length > 0) {
        payload.weeklySchedule = buildWeeklyScheduleJson(form.weeklyOffDays, form.openTime, form.closeTime);
      } else {
        payload.weeklySchedule = null;
      }
    } else {
      delete payload.openTime;
      delete payload.closeTime;
      payload.weeklySchedule = null;
    }
    // Strip the UI-only helper field so backend reflection doesn't trip on it.
    delete payload.weeklyOffDays;
    // Seller publishing a profile expects the store to be available.
    // The "currently open" kill-switch is a separate manual toggle (My Store screen);
    // clear any stale false value here so auto-schedule actually takes effect.
    payload.isOpen = true;

    if (editMode) {
      const res = await marketplaceService.updateMyStore(payload);
      if (!res.success) {
        setSubmitting(false);
        setError(res.message || "Submission failed");
        return;
      }
      // Profile update path uses reflection that skips null fields, so removing
      // all weekly holidays or turning auto-schedule off via updateMyStore alone
      // wouldn't actually clear the stale values. The dedicated timings endpoint
      // sets these explicitly (including to null), guaranteeing the seller's
      // current selection is what gets persisted.
      const timingsRes = await marketplaceService.updateMyStoreTimings({
        openTime: form.autoSchedule ? toIsoTime(form.openTime) : null,
        closeTime: form.autoSchedule ? toIsoTime(form.closeTime) : null,
        autoSchedule: form.autoSchedule,
        weeklySchedule: form.autoSchedule && form.weeklyOffDays.length > 0
          ? buildWeeklyScheduleJson(form.weeklyOffDays, form.openTime, form.closeTime)
          : null,
      });
      setSubmitting(false);
      if (!timingsRes.success) {
        setError(timingsRes.message || "Profile saved but timings update failed");
        return;
      }
      navigate("/customer/app/marketplace/my-store", { replace: true });
      return;
    }

    payload.onboardingCouponCode = appliedCoupon || null;

    const payable = Number(chargesData?.payable || 0);
    let paymentRef = null;

    if (payable > 0) {
      // TODO: integrate real PG flow — for now ask user to confirm a transaction reference
      // (admin will reconcile via /onboarding/charges + payment_ref).
      paymentRef = window.prompt(
        `Onboarding requires payment of ₹${payable.toFixed(2)}.\nEnter your payment reference / UTR after completing payment:`
      );
      if (!paymentRef || !paymentRef.trim()) {
        setSubmitting(false);
        setError("Payment reference is required to complete registration.");
        return;
      }
      paymentRef = paymentRef.trim();
    }

    const res = await marketplaceService.onboardStore(payload, paymentRef);
    setSubmitting(false);
    if (res.success) {
      navigate("/customer/app/marketplace/my-store", { replace: true });
    } else {
      setError(res.message || "Submission failed");
    }
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">{editMode ? "Edit Store" : "Sell on Marketplace"}</h1>
      </div>

      <div className="mkt-wizard-progress">
        {STEPS.map((_, i) => (
          <div key={i} className={`mkt-wizard-step${i < step ? " is-done" : i === step ? " is-active" : ""}`} />
        ))}
      </div>

      <div className="mkt-form">
        <div className="mkt-form-section-title">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>

        {step === 0 && (
          <>
            <div className="mkt-field">
              <label className="mkt-field-label">Business name *</label>
              <input className="mkt-input" value={form.businessName} onChange={(e) => setField("businessName", e.target.value)} placeholder="e.g. Sharma General Store" />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Owner name</label>
              <input className="mkt-input" value={form.ownerName} onChange={(e) => setField("ownerName", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Business mobile *</label>
              <input className="mkt-input" inputMode="numeric" value={form.mobile} onChange={(e) => setField("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Email</label>
              <input className="mkt-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">GST number (optional)</label>
              <input className="mkt-input" value={form.gstNumber} onChange={(e) => setField("gstNumber", e.target.value.toUpperCase())} placeholder="Leave blank if not registered" />
            </div>
            {categories.length > 0 && (
              <div className="mkt-field">
                <label className="mkt-field-label">Category</label>
                <select className="mkt-select" value={form.categoryId || ""} onChange={(e) => setField("categoryId", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className="mkt-field">
              <label className="mkt-field-label">Address line 1 *</label>
              <input className="mkt-input" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Address line 2</label>
              <input className="mkt-input" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">City *</label>
              <input className="mkt-input" value={form.city} onChange={(e) => setField("city", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">State *</label>
              <input className="mkt-input" value={form.state} onChange={(e) => setField("state", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Pincode *</label>
              <input className="mkt-input" inputMode="numeric" value={form.pincode} onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
            <button type="button" className="mkt-btn mkt-btn--secondary" onClick={captureLocation} disabled={geoLoading}>
              <FaMapMarkerAlt size={12} style={{ marginRight: 6 }} />
              {geoLoading
                ? "Getting location..."
                : form.latitude != null
                  ? `Location captured (${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)})`
                  : "Capture store location *"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mkt-field">
              <div className="mkt-slider-row">
                <span className="mkt-field-label">Serving radius</span>
                <strong>{Number(form.servingRadiusKm).toFixed(1)} km</strong>
              </div>
              <input
                type="range"
                className="mkt-slider"
                min="1" max="25" step="0.5"
                value={form.servingRadiusKm}
                onChange={(e) => setField("servingRadiusKm", Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, #40E0D0 0%, #007BFF ${((Number(form.servingRadiusKm) - 1) / 24) * 100}%, var(--cm-line) ${((Number(form.servingRadiusKm) - 1) / 24) * 100}%, var(--cm-line) 100%)`,
                }}
              />
              <div className="mkt-slider-scale">
                <span>1 km</span>
                <span>25 km</span>
              </div>
              <div className="mkt-radius-manual">
                <label className="mkt-field-label" htmlFor="servingRadiusManual">Or set radius manually (km)</label>
                <input
                  id="servingRadiusManual"
                  className="mkt-input"
                  type="number"
                  inputMode="decimal"
                  min="1" max="25" step="0.5"
                  value={form.servingRadiusKm}
                  onChange={(e) => setField("servingRadiusKm", e.target.value)}
                  onBlur={(e) => {
                    let v = Number(e.target.value);
                    if (!Number.isFinite(v) || v < 1) v = 1;
                    if (v > 25) v = 25;
                    setField("servingRadiusKm", v);
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
                Only customers within this radius from your store will see your listing.
              </div>
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Delivery time (minutes) *</label>
              <input className="mkt-input" inputMode="numeric" value={form.deliveryTimeMinutes} onChange={(e) => setField("deliveryTimeMinutes", e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Delivery charges (₹)</label>
              <input className="mkt-input" inputMode="decimal" value={form.deliveryCharges} onChange={(e) => setField("deliveryCharges", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Min order value (₹)</label>
              <input className="mkt-input" inputMode="decimal" value={form.minOrderValue} onChange={(e) => setField("minOrderValue", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>

            <div className="mkt-field">
              <label className="mkt-field-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Auto open/close by timing</span>
                <label className="mkt-switch">
                  <input
                    type="checkbox"
                    checked={form.autoSchedule}
                    onChange={(e) => setField("autoSchedule", e.target.checked)}
                  />
                  <span className="mkt-switch-slider" />
                </label>
              </label>
              <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
                {form.autoSchedule
                  ? "Your store will appear as Open only between the times below. Outside this window, customers will see it as Closed."
                  : "Store stays available all day. Customers can place orders any time."}
              </div>
            </div>

            {form.autoSchedule && (
              <>
                <div className="mkt-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="mkt-field-label">Open time *</label>
                    <input
                      type="time"
                      className="mkt-input"
                      value={form.openTime}
                      onChange={(e) => setField("openTime", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mkt-field-label">Close time *</label>
                    <input
                      type="time"
                      className="mkt-input"
                      value={form.closeTime}
                      onChange={(e) => setField("closeTime", e.target.value)}
                    />
                  </div>
                </div>
                <TimingHint openTime={form.openTime} closeTime={form.closeTime} />

                <div className="mkt-field">
                  <label className="mkt-field-label" style={{ marginBottom: 6 }}>Weekly holidays</label>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 8 }}>
                    Tap any day to mark it as a holiday. On those days the store will appear as Closed all day.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {DAY_OPTIONS.map((d) => {
                      const off = form.weeklyOffDays.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setForm((p) => {
                            const current = Array.isArray(p.weeklyOffDays) ? p.weeklyOffDays : [];
                            const next = current.includes(d.key)
                              ? current.filter((x) => x !== d.key)
                              : [...current, d.key];
                            return { ...p, weeklyOffDays: next };
                          })}
                          className="mkt-day-chip"
                          data-off={off ? "true" : "false"}
                          aria-pressed={off}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  {form.weeklyOffDays.length === 7 && (
                    <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
                      ⚠ All 7 days are marked as holiday — your store will never appear open.
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="mkt-field">
              <label className="mkt-field-label">Store logo</label>
              <div className="mkt-image-upload" onClick={() => logoInput.current?.click()}>
                <div className="mkt-image-upload-preview">
                  {form.logoUrl ? <img src={form.logoUrl} alt="" /> : <FaCamera size={20} />}
                </div>
                <div className="mkt-image-upload-text">
                  {uploadingLogo ? "Uploading…" : form.logoUrl ? "Tap to change" : "Tap to upload logo"}
                </div>
                <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => handleImagePick(e, "logo", setUploadingLogo, "logoUrl")} />
              </div>
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Store banner (optional)</label>
              <div className="mkt-image-upload" onClick={() => bannerInput.current?.click()}>
                <div className="mkt-image-upload-preview">
                  {form.bannerUrl ? <img src={form.bannerUrl} alt="" /> : <FaImage size={20} />}
                </div>
                <div className="mkt-image-upload-text">
                  {uploadingBanner ? "Uploading…" : form.bannerUrl ? "Tap to change" : "Tap to upload banner"}
                </div>
                <input ref={bannerInput} type="file" accept="image/*" hidden onChange={(e) => handleImagePick(e, "banner", setUploadingBanner, "bannerUrl")} />
              </div>
            </div>

            <div className="mkt-form-section-title" style={{ marginTop: 16 }}>Documents (optional)</div>

            <div className="mkt-field">
              <label className="mkt-field-label">GST certificate (optional)</label>
              <div className="mkt-image-upload" onClick={() => gstInput.current?.click()}>
                <div className="mkt-image-upload-preview">
                  {form.gstCertificateUrl && !isPdf(form.gstCertificateUrl)
                    ? <img src={form.gstCertificateUrl} alt="" />
                    : <FaFileAlt size={20} />}
                </div>
                <div className="mkt-image-upload-text">
                  {uploadingGst ? "Uploading…" : form.gstCertificateUrl ? `${fileLabel(form.gstCertificateUrl)} · Tap to change` : "Tap to upload GST certificate (JPG/PNG/PDF)"}
                </div>
                <input ref={gstInput} type="file" accept="image/jpeg,image/png,application/pdf" hidden onChange={(e) => handleDocumentPick(e, "gst_certificate", setUploadingGst, "gstCertificateUrl")} />
              </div>
            </div>

            <div className="mkt-field">
              <label className="mkt-field-label">Udyam Aadhaar / Shop Act (optional)</label>
              <div className="mkt-image-upload" onClick={() => udyamInput.current?.click()}>
                <div className="mkt-image-upload-preview">
                  {form.udyamCertificateUrl && !isPdf(form.udyamCertificateUrl)
                    ? <img src={form.udyamCertificateUrl} alt="" />
                    : <FaFileAlt size={20} />}
                </div>
                <div className="mkt-image-upload-text">
                  {uploadingUdyam ? "Uploading…" : form.udyamCertificateUrl ? `${fileLabel(form.udyamCertificateUrl)} · Tap to change` : "Tap to upload Udyam / Shop Act (JPG/PNG/PDF)"}
                </div>
                <input ref={udyamInput} type="file" accept="image/jpeg,image/png,application/pdf" hidden onChange={(e) => handleDocumentPick(e, "udyam_certificate", setUploadingUdyam, "udyamCertificateUrl")} />
              </div>
            </div>

            {isRestaurant && (
              <div className="mkt-field">
                <label className="mkt-field-label">FSSAI certificate (optional)</label>
                <div className="mkt-image-upload" onClick={() => fssaiInput.current?.click()}>
                  <div className="mkt-image-upload-preview">
                    {form.fssaiCertificateUrl && !isPdf(form.fssaiCertificateUrl)
                      ? <img src={form.fssaiCertificateUrl} alt="" />
                      : <FaFileAlt size={20} />}
                  </div>
                  <div className="mkt-image-upload-text">
                    {uploadingFssai ? "Uploading…" : form.fssaiCertificateUrl ? `${fileLabel(form.fssaiCertificateUrl)} · Tap to change` : "Tap to upload FSSAI certificate (JPG/PNG/PDF)"}
                  </div>
                  <input ref={fssaiInput} type="file" accept="image/jpeg,image/png,application/pdf" hidden onChange={(e) => handleDocumentPick(e, "fssai_certificate", setUploadingFssai, "fssaiCertificateUrl")} />
                </div>
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <div style={{ background: "var(--cm-card)", borderRadius: 14, padding: 14 }}>
            <div className="mkt-form-section-title" style={{ marginTop: 0 }}>Review &amp; submit</div>
            <ReviewRow label="Business" value={form.businessName} />
            <ReviewRow label="Mobile" value={form.mobile} />
            {form.email && <ReviewRow label="Email" value={form.email} />}
            {form.gstNumber && <ReviewRow label="GST" value={form.gstNumber} />}
            <ReviewRow label="Address" value={`${form.addressLine1}${form.addressLine2 ? ", " + form.addressLine2 : ""}, ${form.city}, ${form.state} - ${form.pincode}`} />
            <ReviewRow label="Serving radius" value={`${form.servingRadiusKm} km`} />
            <ReviewRow label="Delivery time" value={`${form.deliveryTimeMinutes} min`} />
            <ReviewRow label="Delivery charges" value={`₹${Number(form.deliveryCharges).toFixed(0)}`} />
            <ReviewRow label="Min order" value={`₹${Number(form.minOrderValue).toFixed(0)}`} />
            {form.gstCertificateUrl && <ReviewRow label="GST certificate" value="Uploaded" />}
            {form.udyamCertificateUrl && <ReviewRow label="Udyam / Shop Act" value="Uploaded" />}
            {isRestaurant && form.fssaiCertificateUrl && <ReviewRow label="FSSAI certificate" value="Uploaded" />}

            {!editMode && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--cm-line)" }}>
                <div className="mkt-form-section-title" style={{ marginTop: 0 }}>Onboarding charges</div>
                {chargesLoading && <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Loading charges…</div>}
                {chargesData && (
                  <>
                    <ReviewRow label="Security deposit" value={`₹${Number(chargesData.securityDeposit || 0).toFixed(2)}`} />
                    <ReviewRow label="Activation charges" value={`₹${Number(chargesData.activationCharges || 0).toFixed(2)}`} />
                    <ReviewRow label="Subtotal" value={`₹${Number(chargesData.subtotal || 0).toFixed(2)}`} />
                    {Number(chargesData.discount || 0) > 0 && (
                      <ReviewRow label={`Coupon (${appliedCoupon})`} value={`− ₹${Number(chargesData.discount).toFixed(2)}`} />
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 15, fontWeight: 700 }}>
                      <span>Total payable</span>
                      <span>₹{Number(chargesData.payable || 0).toFixed(2)}</span>
                    </div>
                    {Number(chargesData.monthlyCharges || 0) > 0 && (
                      <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
                        Recurring monthly platform fee: ₹{Number(chargesData.monthlyCharges).toFixed(2)} (billed separately).
                      </div>
                    )}
                  </>
                )}

                {!appliedCoupon ? (
                  <div className="mkt-field" style={{ marginTop: 12 }}>
                    <label className="mkt-field-label">Have a marketplace coupon?</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                      <input
                        className="mkt-input"
                        style={{ flex: 1, minWidth: 0 }}
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Enter coupon code"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck="false"
                      />
                      <button
                        type="button"
                        className="mkt-btn mkt-btn--secondary"
                        style={{ width: "auto", flexShrink: 0, padding: "12px 20px" }}
                        onClick={applyCoupon}
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && <div className="mkt-error-text" style={{ marginTop: 6 }}>{couponError}</div>}
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, padding: 8, background: "var(--cm-card)", borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>Coupon <strong>{appliedCoupon}</strong> applied</span>
                    <button type="button" onClick={removeCoupon} style={{ background: "none", border: "none", color: "var(--cm-muted)", fontSize: 12, cursor: "pointer" }}>Remove</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 12 }}>
              Submission will be reviewed by our admin team. You'll be notified once approved.
            </div>
          </div>
        )}

        {error && <div className="mkt-error-text">{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {step > 0 && (
            <button className="mkt-btn mkt-btn--secondary" onClick={back}>Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="mkt-btn mkt-btn--primary" onClick={next}>Continue</button>
          ) : (
            <button className="mkt-btn mkt-btn--primary" onClick={submit} disabled={submitting}>
              {submitting
                ? "Submitting…"
                : editMode
                  ? "Save & re-submit"
                  : Number(chargesData?.payable || 0) > 0
                    ? `Pay ₹${Number(chargesData.payable).toFixed(2)} & submit`
                    : "Submit for approval"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const DAY_OPTIONS = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THU", label: "Thu" },
  { key: "FRI", label: "Fri" },
  { key: "SAT", label: "Sat" },
  { key: "SUN", label: "Sun" },
];

const parseOffDays = (weeklyScheduleJson) => {
  if (!weeklyScheduleJson) return [];
  try {
    const arr = typeof weeklyScheduleJson === "string"
      ? JSON.parse(weeklyScheduleJson)
      : weeklyScheduleJson;
    if (!Array.isArray(arr)) return [];
    return arr.filter((d) => d && d.closed === true).map((d) => String(d.day || "").toUpperCase());
  } catch { return []; }
};

const buildWeeklyScheduleJson = (offDays, openTime, closeTime) => {
  const toIso = (t) => (t && t.length === 5 ? `${t}:00` : t || null);
  const entries = DAY_OPTIONS.map(({ key }) => offDays.includes(key)
    ? { day: key, closed: true }
    : { day: key, closed: false, openTime: toIso(openTime), closeTime: toIso(closeTime) }
  );
  return JSON.stringify(entries);
};

// Mirrors the backend semantics in StoreEntity.withinWindow(): when close <= open
// the window is treated as overnight (e.g., 18:00 – 02:00). Sellers usually intend
// a same-day window, so surface a warning before they save a near-24h schedule.
const TimingHint = ({ openTime, closeTime }) => {
  if (!openTime || !closeTime) return null;
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (closeMin > openMin) {
    const hrs = Math.floor((closeMin - openMin) / 60);
    const mins = (closeMin - openMin) % 60;
    return (
      <div style={{ fontSize: 12, color: "#10b981", marginTop: -6, marginBottom: 8 }}>
        ✓ Open daily for {hrs}h {mins ? `${mins}m` : ""} ({fmt12(openTime)} – {fmt12(closeTime)})
      </div>
    );
  }
  if (closeMin === openMin) {
    return (
      <div style={{ fontSize: 12, color: "#ef4444", marginTop: -6, marginBottom: 8 }}>
        ⚠ Open and close time are the same — store will never appear open
      </div>
    );
  }
  // closeMin < openMin → overnight window
  const overnightMin = (24 * 60 - openMin) + closeMin;
  const hrs = Math.floor(overnightMin / 60);
  const mins = overnightMin % 60;
  return (
    <div style={{ fontSize: 12, color: "#f59e0b", marginTop: -6, marginBottom: 8, lineHeight: 1.5 }}>
      ⚠ Close time is earlier than open time. This is treated as an <strong>overnight window</strong>:
      open from {fmt12(openTime)} today through {fmt12(closeTime)} the next day
      ({hrs}h {mins ? `${mins}m` : ""}). If you meant same-day hours, set close time after open time.
    </div>
  );
};

const fmt12 = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

const ReviewRow = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--cm-line)" }}>
    <span style={{ color: "var(--cm-muted)" }}>{label}</span>
    <span style={{ fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{value || "—"}</span>
  </div>
);

export default StoreOnboardingScreen;
