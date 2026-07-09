import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaCamera, FaBuilding } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import { useToast } from "../../context/ToastContext";

const BusinessProfileScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [address, setAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upiHandle, setUpiHandle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await outstandingService.getBusinessProfile();
      if (active && res.success && res.data) {
        setOrgName(res.data.orgName || "");
        setAddress(res.data.address || "");
        setGstNumber(res.data.gstNumber || "");
        setAccountNumber(res.data.accountNumber || "");
        setBankName(res.data.bankName || "");
        setIfsc(res.data.ifsc || "");
        setUpiHandle(res.data.upiHandle || "");
        setLogoUrl(res.data.logoUrl || "");
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const onPickLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setSaving(true);
    const res = await outstandingService.saveBusinessProfile({
      orgName: orgName.trim(),
      address: address.trim(),
      gstNumber: gstNumber.trim().toUpperCase(),
      accountNumber: accountNumber.trim(),
      bankName: bankName.trim(),
      ifsc: ifsc.trim().toUpperCase(),
      upiHandle: upiHandle.trim(),
      logoFile,
    });
    setSaving(false);
    if (!res.success) {
      showToast(res.message || "Could not save", "error");
      return;
    }
    if (res.data?.logoUrl) setLogoUrl(res.data.logoUrl);
    setLogoFile(null);
    showToast("Business profile saved", "success");
    navigate(-1);
  };

  const shownLogo = logoPreview || logoUrl;

  return (
    <div className="ol-page ol-invoice-page">
      <div className="ol-ledger-header">
        <button className="ol-back-btn" type="button" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-id">
          <div className="ol-ledger-name"><span className="ol-ledger-name-text">Business profile</span></div>
          <div className="ol-ledger-mobile">Shown on the invoices you create</div>
        </div>
      </div>

      {loading ? (
        <div className="ol-list">{[0, 1].map((i) => <div key={i} className="ol-item ol-skeleton" />)}</div>
      ) : (
        <div className="ol-form">
          <div className="ol-biz-logo-row">
            <div className="ol-biz-logo" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}>
              {shownLogo ? <img src={shownLogo} alt="Logo" /> : <FaBuilding />}
              <span className="ol-biz-logo-cam"><FaCamera /></span>
            </div>
            <div className="ol-biz-logo-copy">
              <b>Organisation logo</b>
              <small>Prints on the top-right of every invoice</small>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
          </div>

          <label className="ol-field">
            <span>Organisation name</span>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} maxLength={150} placeholder="e.g. Patil Traders" />
          </label>

          <label className="ol-field">
            <span>Address</span>
            <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={255} placeholder="Shop / office address" />
          </label>

          <label className="ol-field">
            <span>GST number (optional)</span>
            <input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} maxLength={20} placeholder="e.g. 27ABCDE1234F1Z5" />
          </label>

          <label className="ol-field">
            <span>Receiver bank account number (optional)</span>
            <input type="text" inputMode="numeric" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 60))} maxLength={60} placeholder="Bank account for receiving payment" />
          </label>

          <label className="ol-field">
            <span>Bank name (optional)</span>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value.slice(0, 150))} maxLength={150} placeholder="e.g. HDFC Bank" />
          </label>

          <label className="ol-field">
            <span>IFSC (optional)</span>
            <input type="text" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 20))} maxLength={20} placeholder="e.g. HDFC0001234" style={{ textTransform: "uppercase" }} />
          </label>

          <label className="ol-field">
            <span>UPI handle (optional)</span>
            <input type="text" value={upiHandle} onChange={(e) => setUpiHandle(e.target.value.replace(/\s/g, "").slice(0, 100))} maxLength={100} placeholder="e.g. name@bank" />
          </label>

          <button type="button" className="ol-inv-submit" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save business profile"}
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessProfileScreen;
