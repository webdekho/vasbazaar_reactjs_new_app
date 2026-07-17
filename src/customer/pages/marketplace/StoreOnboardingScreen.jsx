import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaMapMarkerAlt, FaCamera, FaImage, FaFileAlt } from "react-icons/fa";
import { marketplaceService } from "../../services/marketplaceService";
import { setActiveStoreId } from "../../services/apiClient";
import { useGeolocation } from "../../hooks/useGeolocation";
import SignaturePad from "../../components/SignaturePad";
import "./marketplace.css";

// The Agreement step is registration-only: an edit is not a re-signing, and
// forcing an OTP on every profile tweak would be gratuitous.
const STEPS = [
  "Business basics",
  "Location",
  "Delivery setup",
  "Branding",
  "Agreement",
  "Review",
];
const EDIT_STEPS = STEPS.filter((s) => s !== "Agreement");

/**
 * Mirrors the server's ladder rules so the seller hears about a bad ladder on
 * the step that owns it, not as a toast after they hit Submit two steps later.
 * The server still re-checks -- this is only about where the message lands.
 */
const validateSlabs = (form, sellerDelivers) => {
  if (!sellerDelivers) return null;

  const check = (rows, label, unit, minKey, maxKey) => {
    if (!rows.length) return null;
    const parsed = rows.map((r) => ({
      min: Number(r[minKey]),
      max: r[maxKey] === "" || r[maxKey] == null ? null : Number(r[maxKey]),
      charge: Number(r.charge),
    }));
    for (const r of parsed) {
      if (Number.isNaN(r.min) || r.min < 0) return `${label}: 'from' ${unit} is not valid`;
      if (r.max != null && (Number.isNaN(r.max) || r.max < r.min)) {
        return `${label}: 'to' must be greater than 'from'`;
      }
      if (Number.isNaN(r.charge) || r.charge < 0) return `${label}: charge cannot be negative`;
    }
    const sorted = [...parsed].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].max == null && i !== sorted.length - 1) {
        return `${label}: only the last row can be left open-ended`;
      }
      if (i > 0 && sorted[i - 1].max != null && sorted[i].min <= sorted[i - 1].max) {
        return `${label}: rows must not overlap`;
      }
    }
    return null;
  };

  const amountError = check(form.amountSlabs, "Order value slabs", "amount", "minAmount", "maxAmount");
  if (amountError) return amountError;
  const distanceError = check(form.distanceSlabs, "Distance slabs", "km", "minKm", "maxKm");
  if (distanceError) return distanceError;

  // Past selfDeliveryMaxKm a HYBRID store's legs are VasBazaar's and priced from
  // admin's slabs, so a seller row out there would never be read.
  if (form.deliveryMode === "HYBRID" && form.selfDeliveryMaxKm) {
    const cap = Number(form.selfDeliveryMaxKm);
    if (form.distanceSlabs.some((r) => Number(r.minKm) >= cap)) {
      return `Distance slabs cannot start beyond ${cap} km — VasBazaar's charges apply past that`;
    }
  }
  return null;
};

/**
 * Drops rows the seller started but left blank, and coerces the rest to numbers.
 * An empty "to" stays null on purpose -- that is the open-ended top rung.
 */
const cleanSlabs = (rows, fromKey, toKey) =>
  rows
    .filter((r) => String(r[fromKey]).trim() !== "" || String(r.charge).trim() !== "")
    .map((r) => ({
      [fromKey]: Number(r[fromKey]) || 0,
      [toKey]: String(r[toKey]).trim() === "" ? null : Number(r[toKey]),
      charge: Number(r.charge) || 0,
    }));

/** One ladder of slabs. Both ladders edit identically, only the unit differs. */
const SlabEditor = ({ title, rows, unit, fromKey, toKey, onAdd, onRemove, onChange }) => (
  <div className="mkt-slab-group">
    <div className="mkt-slab-head">
      <span className="mkt-slab-title">{title}</span>
      <button type="button" className="mkt-slab-add" onClick={onAdd}>
        + Add slab
      </button>
    </div>

    {rows.length === 0 ? (
      <div className="mkt-slab-empty">No {title.toLowerCase()} charge — free.</div>
    ) : (
      <div className="mkt-slab-rows">
        {rows.map((row, i) => (
          <div className="mkt-slab-row" key={i}>
            <input
              className="mkt-input mkt-slab-input"
              inputMode="decimal"
              placeholder={`From ${unit}`}
              value={row[fromKey]}
              onChange={(e) => onChange(i, fromKey, e.target.value)}
            />
            <span className="mkt-slab-dash">–</span>
            <input
              className="mkt-input mkt-slab-input"
              inputMode="decimal"
              placeholder="Any"
              value={row[toKey]}
              onChange={(e) => onChange(i, toKey, e.target.value)}
            />
            <span className="mkt-slab-eq">=</span>
            <input
              className="mkt-input mkt-slab-input"
              inputMode="decimal"
              placeholder="₹"
              value={row.charge}
              onChange={(e) => onChange(i, "charge", e.target.value)}
            />
            <button
              type="button"
              className="mkt-slab-del"
              onClick={() => onRemove(i)}
              aria-label={`Remove slab ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        <div className="mkt-slab-hint">
          Leave the last "to" empty to cover everything above it.
        </div>
      </div>
    )}
  </div>
);

/** Prices a concrete basket against the ladders as they stand right now. */
const SlabExample = ({ form }) => {
  const pick = (rows, value, fromKey, toKey) => {
    if (!rows.length) return 0;
    const parsed = rows
      .map((r) => ({
        min: Number(r[fromKey]) || 0,
        max: r[toKey] === "" || r[toKey] == null ? null : Number(r[toKey]),
        charge: Number(r.charge) || 0,
      }))
      .sort((a, b) => a.min - b.min);
    let below = null;
    for (const r of parsed) {
      if (r.min <= value && (r.max == null || r.max >= value)) return r.charge;
      if (r.min <= value) below = r;
    }
    return below ? below.charge : parsed[0].charge;
  };

  const SAMPLE_VALUE = 700;
  const SAMPLE_KM = 12;
  const beyondSelf =
    form.deliveryMode === "HYBRID" && Number(form.selfDeliveryMaxKm) < SAMPLE_KM;

  if (!form.amountSlabs.length && !form.distanceSlabs.length) return null;

  const amount = pick(form.amountSlabs, SAMPLE_VALUE, "minAmount", "maxAmount");
  const distance = pick(form.distanceSlabs, SAMPLE_KM, "minKm", "maxKm");

  return (
    <div className="mkt-slab-example">
      <strong>Example:</strong> a ₹{SAMPLE_VALUE} order {SAMPLE_KM} km away
      {beyondSelf ? (
        <> is past your {Number(form.selfDeliveryMaxKm)} km limit, so VasBazaar's charges apply.</>
      ) : (
        <>
          {" "}pays ₹{amount} + ₹{distance} = <strong>₹{amount + distance}</strong> delivery.
        </>
      )}
    </div>
  );
};

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
  minOrderValue: 0,
  deliveryMode: "SELF", // SELF | VASBAZAAR | HYBRID
  selfDeliveryMaxKm: 3,
  // Delivery pricing for legs the seller carries. Fee = amount slab + distance
  // slab. Empty ladders mean free delivery. Legs VasBazaar carries are priced
  // from admin's logistics slabs instead, and are not editable here.
  amountSlabs: [], // [{ minAmount, maxAmount, charge }]
  distanceSlabs: [], // [{ minKm, maxKm, charge }]
  deliveryOtpRequired: true, // require a doorstep OTP on self-delivered orders
  autoSchedule: false,
  openTime: "",
  closeTime: "",
  weeklyOffDays: [], // subset of ["MON","TUE","WED","THU","FRI","SAT","SUN"]
  logoUrl: "",
  bannerUrl: "",
  gstCertificateUrl: "",
  udyamCertificateUrl: "",
  fssaiCertificateUrl: "",
  // Uploads answering this category's admin-defined document rules:
  // { [docKey]: fileUrl }. The legacy gst/udyam/fssai fields above stay for
  // stores that predate the rules.
  categoryDocs: {},
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

  // Only a seller who carries some leg themselves has anything to price. On
  // VASBAZAAR every leg is the courier's, billed from admin's logistics slabs.
  const sellerDelivers = form.deliveryMode === "SELF" || form.deliveryMode === "HYBRID";

  const addSlab = (key) =>
    setForm((f) => ({
      ...f,
      [key]: [
        ...f[key],
        key === "amountSlabs"
          ? { minAmount: "", maxAmount: "", charge: "" }
          : { minKm: "", maxKm: "", charge: "" },
      ],
    }));

  const removeSlab = (key, index) =>
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }));

  const setSlabField = (key, index, field, value) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));

  // ----- Category-wise documents -----
  const [categoryDocDefs, setCategoryDocDefs] = useState([]);
  const [uploadingDocKey, setUploadingDocKey] = useState(null);

  useEffect(() => {
    if (!form.categoryId) { setCategoryDocDefs([]); return; }
    let cancelled = false;
    marketplaceService.getCategoryDocuments(form.categoryId).then((res) => {
      if (cancelled) return;
      setCategoryDocDefs(res.success && Array.isArray(res.data) ? res.data : []);
    });
    return () => { cancelled = true; };
  }, [form.categoryId]);

  // ----- Partner agreement (registration only) -----
  const [agreement, setAgreement] = useState(null); // { version, text }
  const [agreementRead, setAgreementRead] = useState(false);
  const [signatureBlob, setSignatureBlob] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [mobileHint, setMobileHint] = useState("");
  // Set once the OTP is verified. Single-use and short-lived; onboard needs it.
  const [signToken, setSignToken] = useState(null);

  useEffect(() => {
    if (editMode) return;
    marketplaceService.getAgreementText().then((res) => {
      if (res.success && res.data) setAgreement(res.data);
    });
  }, [editMode]);

  const sendAgreementOtp = async () => {
    setOtpBusy(true);
    setError(null);
    const res = await marketplaceService.sendAgreementOtp();
    setOtpBusy(false);
    if (!res.success) { setError(res.message || "Could not send OTP"); return; }
    setOtpSent(true);
    setMobileHint(res.data?.mobileHint || "");
  };

  const verifyAgreementOtp = async () => {
    if (otpInput.trim().length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setOtpBusy(true);
    setError(null);
    const res = await marketplaceService.verifyAgreementOtp(otpInput.trim());
    setOtpBusy(false);
    if (!res.success || !res.data?.agreementSignToken) {
      setError(res.message || "OTP verification failed");
      return;
    }
    setSignToken(res.data.agreementSignToken);
  };

  // Slabs live in their own tables, so an edit has to load them separately --
  // the store object the caller handed us in navigation state has no ladders.
  useEffect(() => {
    if (!editMode) return;
    marketplaceService.getMyDeliverySlabs().then((res) => {
      if (!res.success || !res.data) return;
      setForm((f) => ({
        ...f,
        amountSlabs: (res.data.amountSlabs || []).map((s) => ({
          minAmount: s.minAmount ?? "",
          maxAmount: s.maxAmount ?? "",
          charge: s.charge ?? "",
        })),
        distanceSlabs: (res.data.distanceSlabs || []).map((s) => ({
          minKm: s.minKm ?? "",
          maxKm: s.maxKm ?? "",
          charge: s.charge ?? "",
        })),
      }));
    });
  }, [editMode]);

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
      minOrderValue: Number(s.minOrderValue || 0),
      deliveryMode: s.deliveryMode || "SELF",
      selfDeliveryMaxKm: Number(s.selfDeliveryMaxKm || 3),
      deliveryOtpRequired: s.deliveryOtpRequired !== false,
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

  /** Upload against an admin-defined category document rule. */
  const handleCategoryDocPick = async (e, docKey) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5 MB"); return; }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) { setError("Only JPG, PNG or PDF allowed"); return; }
    setError(null);
    setUploadingDocKey(docKey);
    // The generic "document" purpose: the doc key is admin-defined, so the upload
    // controller's whitelist cannot enumerate it.
    const res = await marketplaceService.uploadImage(file, "document");
    setUploadingDocKey(null);
    if (res.success && res.data?.url) {
      setForm((f) => ({ ...f, categoryDocs: { ...f.categoryDocs, [docKey]: res.data.url } }));
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
      if (form.minOrderValue < 0) return "Min order value cannot be negative";
      if (form.deliveryMode === "HYBRID") {
        if (!form.selfDeliveryMaxKm || Number(form.selfDeliveryMaxKm) <= 0) {
          return "Set the distance up to which you deliver yourself";
        }
        if (Number(form.selfDeliveryMaxKm) > Number(form.servingRadiusKm)) {
          return "Self-delivery distance cannot exceed your serving radius";
        }
      }
      const slabError = validateSlabs(form, sellerDelivers);
      if (slabError) return slabError;
      if (form.autoSchedule) {
        if (!form.openTime || !form.closeTime) {
          return "Set both open and close time, or turn off auto schedule";
        }
        if (form.openTime === form.closeTime) {
          return "Open and close time cannot be the same";
        }
      }
    }
    if (step === 3) {
      // Every ACTIVE required document for this category must be uploaded. The
      // server re-checks; catching it here keeps the seller on the step that
      // owns the fix rather than bouncing them back from Submit.
      const missing = categoryDocDefs
        .filter((d) => d.required && !form.categoryDocs[d.docKey])
        .map((d) => d.label);
      if (missing.length) return `${missing[0]} is required for this store category`;
    }
    if (step === 4 && !editMode) {
      if (!agreementRead) return "Please read and accept the partner agreement";
      if (!signatureBlob) return "Please draw your signature";
      if (!signToken) return "Verify the OTP to sign the agreement";
    }
    return null;
  };

  // Step 4 is the Agreement, which an edit skips in both directions: the seller
  // signed once at registration and editing a profile is not a re-signing.
  const AGREEMENT_STEP = 4;

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => {
      const target = s + 1;
      if (editMode && target === AGREEMENT_STEP) return target + 1;
      return Math.min(STEPS.length - 1, target);
    });
  };

  const back = () =>
    setStep((s) => {
      const target = s - 1;
      if (editMode && target === AGREEMENT_STEP) return Math.max(0, target - 1);
      return Math.max(0, target);
    });

  // The progress bar counts only the steps this mode actually walks through, so
  // an edit doesn't read "Step 6 of 6" having visited five.
  const visibleSteps = editMode ? EDIT_STEPS : STEPS;
  const visibleIndex = visibleSteps.indexOf(STEPS[step]);

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
    // Slabs live in their own tables behind their own endpoint; StoreEntity has
    // no such fields, so leaving them on the payload would trip its reflection.
    const slabPayload = {
      amountSlabs: sellerDelivers ? cleanSlabs(form.amountSlabs, "minAmount", "maxAmount") : [],
      distanceSlabs: sellerDelivers ? cleanSlabs(form.distanceSlabs, "minKm", "maxKm") : [],
    };
    delete payload.amountSlabs;
    delete payload.distanceSlabs;
    // categoryDocs is a UI-shaped map; the server wants a list.
    delete payload.categoryDocs;
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
      if (!timingsRes.success) {
        setSubmitting(false);
        setError(timingsRes.message || "Profile saved but timings update failed");
        return;
      }
      const slabRes = await marketplaceService.saveMyDeliverySlabs(slabPayload);
      setSubmitting(false);
      if (!slabRes.success) {
        setError(slabRes.message || "Profile saved but delivery charges update failed");
        return;
      }
      navigate("/customer/app/marketplace/my-store", { replace: true });
      return;
    }

    payload.onboardingCouponCode = appliedCoupon || null;

    // Documents the category asked for.
    payload.documents = Object.entries(form.categoryDocs)
      .filter(([, url]) => !!url)
      .map(([docKey, fileUrl]) => ({ docKey, fileUrl }));

    // The signature is uploaded now rather than at draw time, so a seller who
    // redraws doesn't leave a trail of abandoned images on disk.
    const signatureFile = new File([signatureBlob], "signature.png", { type: "image/png" });
    const sigRes = await marketplaceService.uploadImage(signatureFile, "signature");
    if (!sigRes.success || !sigRes.data?.url) {
      setSubmitting(false);
      setError(sigRes.message || "Could not upload your signature");
      return;
    }
    payload.agreementSignatureUrl = sigRes.data.url;
    payload.agreementSignToken = signToken;

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
    if (!res.success) {
      setSubmitting(false);
      setError(res.message || "Submission failed");
      return;
    }

    // Point the active-store header at the store we just made. A seller opening
    // their SECOND store still has the first one active, and the slab endpoint
    // resolves through that header — without this, the new store's delivery
    // charges would be written onto the old store. Newest = highest id.
    const listRes = await marketplaceService.getMyStores().catch(() => null);
    const newest = (listRes?.data || []).reduce(
      (max, st) => (max == null || Number(st.id) > Number(max.id) ? st : max),
      null
    );
    if (newest) setActiveStoreId(newest.id);

    // The slab endpoint resolves the store from the token, so it can only run
    // once the store exists. A failure here is not worth failing registration
    // over -- the store is created and paid for, and the seller can set charges
    // from My Store. Falling back to free delivery until then.
    if (slabPayload.amountSlabs.length || slabPayload.distanceSlabs.length) {
      const slabRes = await marketplaceService.saveMyDeliverySlabs(slabPayload);
      if (!slabRes.success) {
        setSubmitting(false);
        setError(
          "Store registered, but your delivery charges did not save. Set them from My Store — delivery is free until you do."
        );
        return;
      }
    }
    setSubmitting(false);
    navigate("/customer/app/marketplace/my-store", { replace: true });
  };

  return (
    <div className="mkt">
      <div className="mkt-header">
        <button className="mkt-header-back" onClick={() => navigate(-1)}><FaArrowLeft /></button>
        <h1 className="mkt-header-title">{editMode ? "Edit Store" : "Sell on Marketplace"}</h1>
      </div>

      <div className="mkt-wizard-progress">
        {visibleSteps.map((_, i) => (
          <div
            key={i}
            className={`mkt-wizard-step${i < visibleIndex ? " is-done" : i === visibleIndex ? " is-active" : ""}`}
          />
        ))}
      </div>

      <div className="mkt-form">
        <div className="mkt-form-section-title">
          Step {visibleIndex + 1} of {visibleSteps.length} · {STEPS[step]}
        </div>

        {step === 0 && (
          <>
            <div className="mkt-field">
              <label className="mkt-field-label">Business name <span className="mkt-req">*</span></label>
              <input className="mkt-input" value={form.businessName} onChange={(e) => setField("businessName", e.target.value)} placeholder="e.g. Sharma General Store" />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Owner name</label>
              <input className="mkt-input" value={form.ownerName} onChange={(e) => setField("ownerName", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Business mobile <span className="mkt-req">*</span></label>
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
              <label className="mkt-field-label">Address line 1 <span className="mkt-req">*</span></label>
              <input className="mkt-input" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Address line 2</label>
              <input className="mkt-input" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">City <span className="mkt-req">*</span></label>
              <input className="mkt-input" value={form.city} onChange={(e) => setField("city", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">State <span className="mkt-req">*</span></label>
              <input className="mkt-input" value={form.state} onChange={(e) => setField("state", e.target.value)} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Pincode <span className="mkt-req">*</span></label>
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
                min={RADIUS_MIN_KM} max={RADIUS_MAX_KM} step="0.5"
                value={Math.min(Number(form.servingRadiusKm) || RADIUS_MIN_KM, RADIUS_MAX_KM)}
                onChange={(e) => setField("servingRadiusKm", Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, #40E0D0 0%, #007BFF ${radiusSliderPct(form.servingRadiusKm)}%, var(--cm-line) ${radiusSliderPct(form.servingRadiusKm)}%, var(--cm-line) 100%)`,
                }}
              />
              <div className="mkt-slider-scale">
                <span>{RADIUS_MIN_KM} km</span>
                <span>{RADIUS_MAX_KM} km</span>
              </div>
              <button
                type="button"
                className="mkt-radius-allindia"
                aria-pressed={Number(form.servingRadiusKm) === ALL_INDIA_KM}
                onClick={() => setField("servingRadiusKm", ALL_INDIA_KM)}
              >
                All India ({ALL_INDIA_KM} km)
              </button>
              <div className="mkt-radius-manual">
                <label className="mkt-field-label" htmlFor="servingRadiusManual">Or set radius manually (km)</label>
                <input
                  id="servingRadiusManual"
                  className="mkt-input"
                  type="number"
                  inputMode="decimal"
                  min={RADIUS_MIN_KM} max={ALL_INDIA_KM} step="0.5"
                  value={form.servingRadiusKm}
                  onChange={(e) => setField("servingRadiusKm", e.target.value)}
                  onBlur={(e) => {
                    let v = Number(e.target.value);
                    if (!Number.isFinite(v) || v < RADIUS_MIN_KM) v = RADIUS_MIN_KM;
                    if (v > ALL_INDIA_KM) v = ALL_INDIA_KM;
                    setField("servingRadiusKm", v);
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
                Only customers within this radius from your store will see your listing.
              </div>
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Delivery time (minutes) <span className="mkt-req">*</span></label>
              <input className="mkt-input" inputMode="numeric" value={form.deliveryTimeMinutes} onChange={(e) => setField("deliveryTimeMinutes", e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="mkt-field">
              <label className="mkt-field-label">Min order value (₹)</label>
              <input className="mkt-input" inputMode="decimal" value={form.minOrderValue} onChange={(e) => setField("minOrderValue", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>

            <div className="mkt-field">
              <label className="mkt-field-label" style={{ marginBottom: 6 }}>Who delivers your orders?</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DELIVERY_MODE_OPTIONS.map((opt) => {
                  const active = form.deliveryMode === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setField("deliveryMode", opt.key)}
                      aria-pressed={active}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: `1.5px solid ${active ? "#007BFF" : "var(--cm-line)"}`,
                        background: active ? "rgba(0,123,255,0.06)" : "var(--cm-card)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cm-ink)" }}>{opt.title}</div>
                      <div style={{ fontSize: 12, color: "var(--cm-muted)", marginTop: 2 }}>{opt.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.deliveryMode === "HYBRID" && (
              <div className="mkt-field">
                <label className="mkt-field-label">Deliver yourself up to (km)</label>
                <input
                  className="mkt-input"
                  type="number"
                  inputMode="decimal"
                  min="0.5"
                  step="0.5"
                  value={form.selfDeliveryMaxKm}
                  onChange={(e) => setField("selfDeliveryMaxKm", e.target.value === "" ? "" : Number(e.target.value))}
                  onBlur={(e) => {
                    let v = Number(e.target.value);
                    if (!Number.isFinite(v) || v < 0.5) v = 0.5;
                    if (v > Number(form.servingRadiusKm)) v = Number(form.servingRadiusKm);
                    setField("selfDeliveryMaxKm", v);
                  }}
                />
                <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
                  Orders within this distance you deliver yourself. Farther orders (up to your {Number(form.servingRadiusKm)} km serving radius) are delivered by VasBazaar.
                </div>
              </div>
            )}

            {sellerDelivers && (
              <div className="mkt-field">
                <label className="mkt-field-label" style={{ marginBottom: 6 }}>
                  Your delivery charges
                </label>
                <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 10 }}>
                  A customer pays the order-value charge <strong>plus</strong> the distance charge.
                  Leave both empty to deliver free.
                  {form.deliveryMode === "HYBRID" &&
                    ` These apply only within ${Number(form.selfDeliveryMaxKm) || 0} km — past that VasBazaar's charges apply.`}
                </div>

                <SlabEditor
                  title="By order value"
                  rows={form.amountSlabs}
                  unit="₹"
                  fromKey="minAmount"
                  toKey="maxAmount"
                  onAdd={() => addSlab("amountSlabs")}
                  onRemove={(i) => removeSlab("amountSlabs", i)}
                  onChange={(i, field, value) => setSlabField("amountSlabs", i, field, value)}
                />

                <SlabEditor
                  title="By distance"
                  rows={form.distanceSlabs}
                  unit="km"
                  fromKey="minKm"
                  toKey="maxKm"
                  onAdd={() => addSlab("distanceSlabs")}
                  onRemove={(i) => removeSlab("distanceSlabs", i)}
                  onChange={(i, field, value) => setSlabField("distanceSlabs", i, field, value)}
                />

                <SlabExample form={form} />
              </div>
            )}

            {form.deliveryMode === "VASBAZAAR" && (
              <div
                className="mkt-field"
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--cm-line)",
                  background: "var(--cm-card)",
                  fontSize: 12,
                  color: "var(--cm-muted)",
                }}
              >
                VasBazaar's logistics partner carries every order, so delivery charges are set by
                VasBazaar and shown to the customer at checkout. You have nothing to configure here.
              </div>
            )}

            {form.deliveryMode !== "VASBAZAAR" && (
              <div className="mkt-field">
                <label className="mkt-field-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Require delivery OTP</span>
                  <label className="mkt-switch">
                    <input
                      type="checkbox"
                      checked={form.deliveryOtpRequired}
                      onChange={(e) => setField("deliveryOtpRequired", e.target.checked)}
                    />
                    <span className="mkt-switch-slider" />
                  </label>
                </label>
                <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
                  {form.deliveryOtpRequired
                    ? "On your own (self) deliveries, the customer reads out a 6-digit OTP that you verify before the order is marked delivered."
                    : "No OTP on your self deliveries — you can mark orders delivered directly."}
                  {form.deliveryMode === "HYBRID" && " VasBazaar-delivered orders follow the logistics partner's own process."}
                </div>
              </div>
            )}

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
                    <label className="mkt-field-label">Open time <span className="mkt-req">*</span></label>
                    <input
                      type="time"
                      className="mkt-input"
                      value={form.openTime}
                      onChange={(e) => setField("openTime", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mkt-field-label">Close time <span className="mkt-req">*</span></label>
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

            {categoryDocDefs.length > 0 && (
              <>
                <div className="mkt-form-section-title" style={{ marginTop: 16 }}>
                  Documents for {selectedCategory?.name || "this category"}
                </div>
                {categoryDocDefs.map((def) => {
                  const url = form.categoryDocs[def.docKey];
                  const busy = uploadingDocKey === def.docKey;
                  return (
                    <div className="mkt-field" key={def.docKey}>
                      <label className="mkt-field-label">
                        {def.label}
                        {def.required && <span className="mkt-req"> *</span>}
                      </label>
                      <label className="mkt-image-upload" style={{ cursor: busy ? "wait" : "pointer" }}>
                        <div className="mkt-image-upload-preview">
                          {url && !isPdf(url) ? <img src={url} alt="" /> : <FaFileAlt size={20} />}
                        </div>
                        <div className="mkt-image-upload-text">
                          {busy
                            ? "Uploading…"
                            : url
                              ? `${fileLabel(url)} · Tap to change`
                              : `Tap to upload (JPG/PNG/PDF)`}
                        </div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          hidden
                          disabled={busy}
                          onChange={(e) => handleCategoryDocPick(e, def.docKey)}
                        />
                      </label>
                      {def.helpText && (
                        <div style={{ fontSize: 11, color: "var(--cm-muted)", marginTop: 4 }}>
                          {def.helpText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            <div className="mkt-form-section-title" style={{ marginTop: 16 }}>Other documents (optional)</div>

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

        {step === 4 && !editMode && (
          <>
            <div className="mkt-form-section-title" style={{ marginTop: 0 }}>
              VasBazaar Partner Agreement
            </div>

            <div className="mkt-agreement-box">
              {agreement ? (
                <pre className="mkt-agreement-text">{agreement.text}</pre>
              ) : (
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Loading agreement…</div>
              )}
            </div>
            {agreement?.version && (
              <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 12 }}>
                Version {agreement.version}
              </div>
            )}

            <label className="mkt-agreement-accept">
              <input
                type="checkbox"
                checked={agreementRead}
                onChange={(e) => setAgreementRead(e.target.checked)}
                disabled={!agreement}
              />
              <span>I have read and accept the VasBazaar Partner Agreement.</span>
            </label>

            <div className="mkt-field" style={{ marginTop: 14 }}>
              <label className="mkt-field-label">Your signature <span className="mkt-req">*</span></label>
              <SignaturePad
                onChange={setSignatureBlob}
                disabled={!agreementRead || !!signToken}
              />
            </div>

            {/* OTP proves the signer holds the registered SIM — that is what makes
                the drawn signature stand up as an electronic contract. */}
            <div className="mkt-field">
              <label className="mkt-field-label">Verify it's you <span className="mkt-req">*</span></label>
              {signToken ? (
                <div className="mkt-agreement-verified">
                  ✓ Verified. You can submit your store on the next step.
                </div>
              ) : !otpSent ? (
                <button
                  type="button"
                  className="mkt-btn mkt-btn--secondary"
                  disabled={!agreementRead || !signatureBlob || otpBusy}
                  onClick={sendAgreementOtp}
                >
                  {otpBusy ? "Sending…" : "Send OTP to my registered mobile"}
                </button>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: "var(--cm-muted)", marginBottom: 6 }}>
                    OTP sent to {mobileHint || "your registered mobile"}.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="mkt-input"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                    />
                    <button
                      type="button"
                      className="mkt-btn mkt-btn--secondary"
                      disabled={otpBusy || otpInput.length !== 6}
                      onClick={verifyAgreementOtp}
                    >
                      {otpBusy ? "…" : "Verify"}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="mkt-agreement-resend"
                    disabled={otpBusy}
                    onClick={sendAgreementOtp}
                  >
                    Resend OTP
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {step === 5 && (
          <div style={{ background: "var(--cm-card)", borderRadius: 14, padding: 14 }}>
            <div className="mkt-form-section-title" style={{ marginTop: 0 }}>Review &amp; submit</div>
            <ReviewRow label="Business" value={form.businessName} />
            <ReviewRow label="Mobile" value={form.mobile} />
            {form.email && <ReviewRow label="Email" value={form.email} />}
            {form.gstNumber && <ReviewRow label="GST" value={form.gstNumber} />}
            <ReviewRow label="Address" value={`${form.addressLine1}${form.addressLine2 ? ", " + form.addressLine2 : ""}, ${form.city}, ${form.state} - ${form.pincode}`} />
            <ReviewRow label="Serving radius" value={`${form.servingRadiusKm} km`} />
            <ReviewRow label="Delivery time" value={`${form.deliveryTimeMinutes} min`} />
            <ReviewRow label="Delivery by" value={deliveryModeLabel(form.deliveryMode, form.selfDeliveryMaxKm)} />
            {sellerDelivers && (
              <ReviewRow
                label="Delivery charges"
                value={
                  form.amountSlabs.length || form.distanceSlabs.length
                    ? `${form.amountSlabs.length} value + ${form.distanceSlabs.length} distance slab(s)`
                    : "Free"
                }
              />
            )}
            {form.deliveryMode !== "VASBAZAAR" && (
              <ReviewRow label="Delivery OTP" value={form.deliveryOtpRequired ? "Required (self delivery)" : "Not required"} />
            )}
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

const RADIUS_MIN_KM = 1;
const RADIUS_MAX_KM = 500;
// Longest road distance across India; the "All India" preset sits above the
// slider range on purpose, so the slider pins to its max while it is selected.
const ALL_INDIA_KM = 3214;

const radiusSliderPct = (km) => {
  const v = Math.min(Math.max(Number(km) || RADIUS_MIN_KM, RADIUS_MIN_KM), RADIUS_MAX_KM);
  return ((v - RADIUS_MIN_KM) / (RADIUS_MAX_KM - RADIUS_MIN_KM)) * 100;
};

const DELIVERY_MODE_OPTIONS = [
  { key: "SELF", title: "I deliver myself", subtitle: "Your own staff delivers every order." },
  { key: "VASBAZAAR", title: "VasBazaar Logistic Partner", subtitle: "VasBazaar's logistics partner handles every order." },
  { key: "HYBRID", title: "Split by distance", subtitle: "You deliver nearby orders; VasBazaar covers the farther ones." },
];

const deliveryModeLabel = (mode, selfKm) => {
  if (mode === "VASBAZAAR") return "VasBazaar Logistic Partner";
  if (mode === "HYBRID") return `Self up to ${selfKm} km, then VasBazaar`;
  return "Self delivery";
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
