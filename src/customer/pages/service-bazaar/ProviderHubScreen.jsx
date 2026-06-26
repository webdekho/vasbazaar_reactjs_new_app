import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaCamera } from "react-icons/fa";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { queueService } from "../../services/queueService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

const STATUS_NOTE = {
  PENDING: "Under review by VasBazaar",
  APPROVED: "Live and discoverable",
  REJECTED: "Needs changes — please update",
  SUSPENDED: "Suspended — contact support",
};

/**
 * Provider self-service hub (the PRD "Become a Service Provider" flow).
 * Tabs: profile onboarding/edit, my services (listings), and incoming job requests.
 * A provider can never self-approve — every save re-enters moderation.
 */
export default function ProviderHubScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [queueEnabled, setQueueEnabled] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);

  const [pForm, setPForm] = useState({
    providerName: "", businessName: "", headline: "", about: "",
    categoryId: "", city: "", pincode: "", serviceAreas: "", mobile: "",
    travelCharge: "", locationName: "", latitude: "", longitude: "", profilePhotoUrl: "",
  });
  const [locating, setLocating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const [offeringModal, setOfferingModal] = useState(false);
  const emptyOfferingForm = { id: null, title: "", categoryId: "", description: "", basePrice: "", durationMinutes: "", serviceableArea: "", serviceRadiusKm: "" };
  const [oForm, setOForm] = useState(emptyOfferingForm);

  const load = useCallback(async () => {
    setLoading(true);
    const [profRes, catRes] = await Promise.all([
      serviceBazaarService.getMyProviderProfile(),
      serviceBazaarService.getCategories(),
    ]);
    if (catRes.success) setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    if (profRes.success && profRes.data) {
      const p = profRes.data;
      setProfile(p);
      setQueueEnabled(!!p.queueEnabled);
      setPForm({
        providerName: p.providerName || "", businessName: p.businessName || "",
        headline: p.headline || "", about: p.about || "",
        categoryId: p.categoryId?.id || "", city: p.city || "",
        pincode: p.pincode || "", serviceAreas: p.serviceAreas || "", mobile: p.mobile || "",
        travelCharge: p.travelCharge != null ? String(p.travelCharge) : "",
        locationName: p.locationName || "",
        latitude: p.latitude != null ? String(p.latitude) : "",
        longitude: p.longitude != null ? String(p.longitude) : "",
        profilePhotoUrl: p.profilePhotoUrl || "",
      });
      const offRes = await serviceBazaarService.getMyOfferings();
      if (offRes.success) setOfferings(Array.isArray(offRes.data) ? offRes.data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadJobs = useCallback(async () => {
    const res = await serviceBazaarService.getMyProviderBookings({ pageSize: 50 });
    if (res.success) setJobs(res.data?.records || []);
  }, []);

  useEffect(() => { if (tab === "jobs" && profile) loadJobs(); }, [tab, profile, loadJobs]);

  const pinLocation = () => {
    if (!navigator.geolocation) { showToast("Location not supported on this device", "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPForm((f) => ({ ...f, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) }));
        setLocating(false);
        showToast("Location pinned — remember to save", "success");
      },
      () => { setLocating(false); showToast("Could not get your location", "error"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Max image size is 5 MB", "error"); return; }
    setUploadingPhoto(true);
    const res = await serviceBazaarService.uploadImage(file, "profile");
    setUploadingPhoto(false);
    if (res.success && res.url) {
      setPForm((f) => ({ ...f, profilePhotoUrl: res.url }));
      showToast("Photo uploaded — remember to save", "success");
    } else showToast(res.message || "Upload failed", "error");
  };

  const toggleQueue = async (next) => {
    setQueueBusy(true);
    setQueueEnabled(next); // optimistic
    const res = await queueService.setQueueEnabled(next);
    setQueueBusy(false);
    if (res.success) {
      setProfile((p) => (p ? { ...p, queueEnabled: next } : p));
      showToast(next ? "Live queue enabled — customers can now see it" : "Live queue disabled", "success");
    } else {
      setQueueEnabled(!next); // revert
      showToast(res.message || "Could not update queue setting", "error");
    }
  };

  const saveProfile = async () => {
    if (!pForm.providerName.trim()) { showToast("Name is required", "error"); return; }
    setBusy(true);
    const payload = {
      ...pForm,
      categoryId: pForm.categoryId ? { id: Number(pForm.categoryId) } : null,
      travelCharge: pForm.travelCharge ? Number(pForm.travelCharge) : 0,
      latitude: pForm.latitude ? Number(pForm.latitude) : null,
      longitude: pForm.longitude ? Number(pForm.longitude) : null,
    };
    const res = await serviceBazaarService.saveMyProviderProfile(payload);
    setBusy(false);
    if (res.success) { showToast(res.message || "Profile saved", "success"); load(); }
    else showToast(res.message || "Could not save profile", "error");
  };

  const saveOffering = async () => {
    if (!oForm.title.trim()) { showToast("Service title is required", "error"); return; }
    setBusy(true);
    const payload = {
      ...(oForm.id ? { id: oForm.id } : {}),
      title: oForm.title,
      categoryId: oForm.categoryId ? { id: Number(oForm.categoryId) } : null,
      description: oForm.description,
      basePrice: oForm.basePrice ? Number(oForm.basePrice) : 0,
      durationMinutes: oForm.durationMinutes ? Number(oForm.durationMinutes) : null,
      serviceableArea: oForm.serviceableArea,
      serviceRadiusKm: oForm.serviceRadiusKm ? Number(oForm.serviceRadiusKm) : null,
      pricingType: "FIXED",
    };
    const res = await serviceBazaarService.saveMyOffering(payload);
    setBusy(false);
    if (res.success) {
      showToast(oForm.id ? "Service updated and resubmitted for approval" : "Service submitted for approval", "success");
      setOfferingModal(false);
      setOForm(emptyOfferingForm);
      const offRes = await serviceBazaarService.getMyOfferings();
      if (offRes.success) setOfferings(Array.isArray(offRes.data) ? offRes.data : []);
    } else showToast(res.message || "Could not save service", "error");
  };

  const [otpModal, setOtpModal] = useState(null); // { job, mode: "start" | "complete" }
  const [otpInput, setOtpInput] = useState("");

  const setJobStatus = async (job, status) => {
    setBusy(true);
    const res = await serviceBazaarService.updateProviderBookingStatus(job.id, status);
    setBusy(false);
    if (res.success) { showToast(res.message || "Updated", "success"); loadJobs(); }
    else showToast(res.message || "Could not update", "error");
  };

  const setFulfillment = async (job, stage) => {
    setBusy(true);
    const res = await serviceBazaarService.updateProviderFulfillment(job.id, stage);
    setBusy(false);
    if (res.success) { showToast(res.message || "Updated", "success"); loadJobs(); }
    else showToast(res.message || "Could not update", "error");
  };

  const submitOtp = async () => {
    const otp = otpInput.trim();
    if (!/^\d{4}$/.test(otp)) { showToast("Enter the 4-digit OTP from the customer", "error"); return; }
    setBusy(true);
    const { job, mode } = otpModal;
    const res = mode === "start"
      ? await serviceBazaarService.providerStartService(job.id, otp)
      : await serviceBazaarService.providerCompleteService(job.id, otp);
    setBusy(false);
    if (res.success) {
      showToast(res.message || "Done", "success");
      setOtpModal(null); setOtpInput("");
      loadJobs();
    } else showToast(res.message || "Incorrect OTP", "error");
  };

  if (loading) return <div className="sb-page"><div className="sb-empty">Loading…</div></div>;

  return (
    <div className="sb-page">
      <div className="sb-topbar">
        <button className="sb-back" onClick={() => navigate("/customer/app/service-bazaar")} aria-label="Back"><FaArrowLeft /></button>
        <div>
          <h1 className="sb-title">My Provider Hub</h1>
          {profile && <p className="sb-sub">{STATUS_NOTE[profile.status] || profile.status}</p>}
        </div>
      </div>

      <div className="sb-tabs">
        <button className={`sb-tab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>Profile</button>
        <button className={`sb-tab ${tab === "services" ? "active" : ""}`} onClick={() => setTab("services")} disabled={!profile}>Services</button>
        <button className={`sb-tab ${tab === "jobs" ? "active" : ""}`} onClick={() => setTab("jobs")} disabled={!profile}>Job Requests</button>
      </div>

      {profile && (
        <div className="sb-queue-toggle">
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sb-queue-toggle-title">Live token queue</p>
            <p className="sb-card-meta" style={{ margin: 0 }}>
              {queueEnabled
                ? "On — customers can see your live queue and pull a token."
                : "Off — the queue is hidden from customers."}
            </p>
          </div>
          <label className="sb-switch" aria-label="Toggle live queue">
            <input type="checkbox" checked={queueEnabled} disabled={queueBusy} onChange={(e) => toggleQueue(e.target.checked)} />
            <span className="sb-switch-slider" />
          </label>
        </div>
      )}

      {profile && profile.status === "APPROVED" && queueEnabled && (
        <button className="sb-btn ghost block" style={{ marginBottom: 10 }} onClick={() => navigate("/customer/app/service-bazaar/queue-manage")}>
          Manage live queue
        </button>
      )}

      {tab === "profile" && (
        <div className="sb-section sb-profile-form">
          {!profile && <p className="sb-card-meta" style={{ marginBottom: 12 }}>Create your provider profile to start earning. It goes live after VasBazaar approval.</p>}
          <div className="sb-photo-upload">
            <div className="sb-photo-preview" onClick={() => photoInputRef.current?.click()}>
              {pForm.profilePhotoUrl ? <img src={pForm.profilePhotoUrl} alt="profile" /> : <FaCamera />}
            </div>
            <div>
              <button type="button" className="sb-btn ghost sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                {uploadingPhoto ? "Uploading…" : pForm.profilePhotoUrl ? "Change photo" : "Add profile photo"}
              </button>
              <p className="sb-photo-hint">A clear photo builds customer trust. Max 5 MB.</p>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
          </div>
          <div className="sb-field"><label>Your name *</label><input value={pForm.providerName} onChange={(e) => setPForm({ ...pForm, providerName: e.target.value })} /></div>
          <div className="sb-field"><label>Business name</label><input value={pForm.businessName} onChange={(e) => setPForm({ ...pForm, businessName: e.target.value })} /></div>
          <div className="sb-field"><label>Headline</label><input value={pForm.headline} onChange={(e) => setPForm({ ...pForm, headline: e.target.value })} placeholder="e.g. Bridal makeup specialist, 8 yrs" /></div>
          <div className="sb-field sb-col-full"><label>About</label><textarea rows={3} value={pForm.about} onChange={(e) => setPForm({ ...pForm, about: e.target.value })} /></div>
          <div className="sb-field"><label>City</label><input value={pForm.city} onChange={(e) => setPForm({ ...pForm, city: e.target.value })} /></div>
          <div className="sb-field"><label>Pincode</label><input value={pForm.pincode} onChange={(e) => setPForm({ ...pForm, pincode: e.target.value })} /></div>
          <div className="sb-field"><label>Service areas</label><input value={pForm.serviceAreas} onChange={(e) => setPForm({ ...pForm, serviceAreas: e.target.value })} placeholder="Areas / pincodes you serve" /></div>
          <div className="sb-field"><label>Travel / visit charge (₹)</label><input type="number" value={pForm.travelCharge} onChange={(e) => setPForm({ ...pForm, travelCharge: e.target.value })} placeholder="0 — added to each doorstep booking" /></div>
          <div className="sb-field sb-col-full">
            <label>Map location (for "near me" search)</label>
            <input
              value={pForm.locationName}
              onChange={(e) => setPForm({ ...pForm, locationName: e.target.value })}
              placeholder="e.g. Newa BKC"
              style={{ marginBottom: 8 }}
            />
            <button type="button" className="sb-btn ghost sm" onClick={pinLocation} disabled={locating}>
              {locating ? "Locating…" : pForm.latitude ? "Update GPS pin" : "Pin my location (GPS)"}
            </button>
            {pForm.latitude && (
              <p className="sb-photo-hint">
                Pinned{pForm.locationName ? ` at ${pForm.locationName}` : ""}: {Number(pForm.latitude).toFixed(4)}, {Number(pForm.longitude).toFixed(4)}
              </p>
            )}
          </div>
          <div className="sb-field"><label>Contact mobile</label><input value={pForm.mobile} onChange={(e) => setPForm({ ...pForm, mobile: e.target.value })} /></div>
          <button className="sb-btn block" disabled={busy} onClick={saveProfile}>{busy ? "Saving…" : profile ? "Update & Resubmit" : "Submit for Approval"}</button>
        </div>
      )}

      {tab === "services" && (
        <div className="sb-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>My Services</h3>
            <button className="sb-btn sm" onClick={() => { setOForm(emptyOfferingForm); setOfferingModal(true); }}><FaPlus style={{ marginRight: 4 }} /> Add</button>
          </div>
          {offerings.length === 0 ? <p className="sb-card-meta">No services yet. Add your first one.</p> : offerings.map((o) => (
            <div className="sb-offering" key={o.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="sb-offering-title">{o.title}</p>
                <p className="sb-offering-desc">₹{Number(o.basePrice || 0).toFixed(0)} • <span className={`sb-status ${o.status}`} style={{ fontSize: 10 }}>{o.status}</span></p>
                {(o.serviceableArea || o.serviceRadiusKm) && (
                  <p className="sb-offering-desc">
                    {o.serviceableArea || "Serviceable area"}
                    {o.serviceRadiusKm ? ` • ${Number(o.serviceRadiusKm).toFixed(0)} km` : ""}
                  </p>
                )}
              </div>
              <button className="sb-btn sm ghost" onClick={() => {
                setOForm({
                  id: o.id,
                  title: o.title || "",
                  categoryId: o.categoryId?.id || "",
                  description: o.description || "",
                  basePrice: o.basePrice != null ? String(o.basePrice) : "",
                  durationMinutes: o.durationMinutes != null ? String(o.durationMinutes) : "",
                  serviceableArea: o.serviceableArea || "",
                  serviceRadiusKm: o.serviceRadiusKm != null ? String(o.serviceRadiusKm) : "",
                });
                setOfferingModal(true);
              }}>Edit</button>
            </div>
          ))}
        </div>
      )}

      {tab === "jobs" && (
        <div className="sb-results">
          {jobs.length === 0 ? <div className="sb-empty">No job requests yet.</div> : jobs.map((j) => {
            const status = j.bookingStatus || "PENDING";
            const paid = String(j.paymentStatus || "").toUpperCase() === "PAID";
            const fl = j.fulfillmentStatus;
            return (
              <div className="sb-booking" key={j.id}>
                <div className="sb-booking-head">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="sb-offering-title">{j.serviceOfferingId?.title || "Service"}</p>
                    <p className="sb-offering-desc">#{j.bookingNo} • ₹{Number(j.totalAmount || 0).toFixed(0)} • {paid ? "Paid" : "Payment pending"}</p>
                    {j.serviceAddress && <p className="sb-offering-desc">{j.serviceAddress}</p>}
                    {j.scheduledAt && <p className="sb-offering-desc">{new Date(j.scheduledAt).toLocaleString()}</p>}
                  </div>
                  <span className={`sb-status ${status}`}>{status.replace("_", " ")}</span>
                </div>
                <div className="sb-row-actions">
                  {status === "PENDING" && (
                    <button className="sb-btn sm" disabled={busy || !paid} onClick={() => setJobStatus(j, "CONFIRMED")}>
                      {paid ? "Accept" : "Awaiting payment"}
                    </button>
                  )}
                  {status === "CONFIRMED" && fl !== "ON_THE_WAY" && fl !== "REACHED" && (
                    <button className="sb-btn sm ghost" disabled={busy} onClick={() => setFulfillment(j, "ON_THE_WAY")}>On the way</button>
                  )}
                  {status === "CONFIRMED" && fl === "ON_THE_WAY" && (
                    <button className="sb-btn sm ghost" disabled={busy} onClick={() => setFulfillment(j, "REACHED")}>Reached</button>
                  )}
                  {status === "CONFIRMED" && (
                    <button className="sb-btn sm" disabled={busy} onClick={() => { setOtpModal({ job: j, mode: "start" }); setOtpInput(""); }}>Start (OTP)</button>
                  )}
                  {status === "IN_PROGRESS" && (
                    <button className="sb-btn sm" disabled={busy} onClick={() => { setOtpModal({ job: j, mode: "complete" }); setOtpInput(""); }}>Complete (OTP)</button>
                  )}
                  {(status === "PENDING" || status === "CONFIRMED") && <button className="sb-btn sm danger" disabled={busy} onClick={() => setJobStatus(j, "CANCELLED")}>Decline</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {otpModal && (
        <div className="sb-modal-backdrop" onClick={() => setOtpModal(null)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{otpModal.mode === "start" ? "Start service" : "Complete service"}</h3>
            <p className="sb-card-meta" style={{ marginBottom: 12 }}>
              Ask the customer to read the {otpModal.mode === "start" ? "Start" : "End"} OTP shown in their app, then enter it below.
            </p>
            <div className="sb-field">
              <label>4-digit OTP</label>
              <input inputMode="numeric" maxLength={4} value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••" style={{ letterSpacing: 6, fontSize: 18, textAlign: "center" }} />
            </div>
            <button className="sb-btn block" disabled={busy} onClick={submitOtp}>{busy ? "Verifying…" : "Verify & continue"}</button>
            <button className="sb-btn ghost block" style={{ marginTop: 8 }} onClick={() => setOtpModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {offeringModal && (
        <div className="sb-modal-backdrop" onClick={() => setOfferingModal(false)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{oForm.id ? "Edit Service" : "Add a Service"}</h3>
            {oForm.id && <p className="sb-card-meta" style={{ marginTop: -6, marginBottom: 12 }}>Editing resubmits this service for approval.</p>}
            <div className="sb-field"><label>Title *</label><input value={oForm.title} onChange={(e) => setOForm({ ...oForm, title: e.target.value })} placeholder="e.g. Bridal makeup at home" /></div>
            <div className="sb-field"><label>Category</label>
              <select value={oForm.categoryId} onChange={(e) => setOForm({ ...oForm, categoryId: e.target.value })}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sb-field"><label>Description</label><textarea rows={2} value={oForm.description} onChange={(e) => setOForm({ ...oForm, description: e.target.value })} /></div>
            <div className="sb-field"><label>Price (₹)</label><input type="number" value={oForm.basePrice} onChange={(e) => setOForm({ ...oForm, basePrice: e.target.value })} /></div>
            <div className="sb-field"><label>Duration (min)</label><input type="number" value={oForm.durationMinutes} onChange={(e) => setOForm({ ...oForm, durationMinutes: e.target.value })} /></div>
            <div className="sb-field"><label>Serviceable area</label><textarea rows={2} value={oForm.serviceableArea} onChange={(e) => setOForm({ ...oForm, serviceableArea: e.target.value })} placeholder="e.g. BKC, Bandra, Kurla" /></div>
            <div className="sb-field"><label>Service radius (km)</label><input type="number" min="0" step="0.5" value={oForm.serviceRadiusKm} onChange={(e) => setOForm({ ...oForm, serviceRadiusKm: e.target.value })} placeholder="e.g. 5" /></div>
            <button className="sb-btn block" disabled={busy} onClick={saveOffering}>{busy ? "Saving…" : oForm.id ? "Update Service" : "Submit for Approval"}</button>
            <button className="sb-btn ghost block" style={{ marginTop: 8 }} onClick={() => setOfferingModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
