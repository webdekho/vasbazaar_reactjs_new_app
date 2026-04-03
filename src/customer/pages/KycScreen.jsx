import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaIdCard, FaCheck, FaExclamationTriangle, FaArrowLeft, FaShieldAlt, FaUnlock } from "react-icons/fa";
import { FiChevronRight } from "react-icons/fi";
import { useCustomerModern } from "../context/CustomerModernContext";
import { digiLockerService } from "../services/digiLockerService";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

const KycScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = useCustomerModern();

  const [aadhaar, setAadhaar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check verified_status from userData (handles both number 1 and string "1")
  const isVerified = userData?.verified_status === 1 || userData?.verified_status === "1" || userData?.kyc_verified === true;
  const returnPath = location.state?.returnTo || "/customer/app/profile";

  // Debug log
  useEffect(() => {
    console.log("KYC Screen - userData.verified_status:", userData?.verified_status, "isVerified:", isVerified);
  }, [userData, isVerified]);

  useEffect(() => {
    // If verified_status is already in userData, no need to check API
    if (isVerified || userData?.verified_status !== undefined) {
      setCheckingStatus(false);
      return;
    }
    // Only check API if verified_status is not in userData
    checkKycStatus();
  }, [isVerified, userData?.verified_status]);

  const checkKycStatus = async () => {
    setCheckingStatus(true);
    // API call only if we don't have verified_status locally
    const result = await digiLockerService.getKycStatus();
    console.log("KYC Status API result:", result);
    setCheckingStatus(false);
  };

  const formatAadhaar = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3").replace(/-$/, "");
  };

  const handleAadhaarChange = (e) => {
    setAadhaar(formatAadhaar(e.target.value));
    if (error) setError("");
  };

  const handleDigiLockerVerification = async () => {
    const cleanAadhaar = aadhaar.replace(/-/g, "");
    if (cleanAadhaar.length !== 12) {
      setError("Please enter a valid 12-digit Aadhaar number");
      return;
    }

    setLoading(true);
    setError("");

    // Construct return URL based on platform
    let returnUrl;
    if (Capacitor.isNativePlatform()) {
      // For mobile apps, use Vercel redirect page that will deep link back to app
      returnUrl = "https://web.vasbazaar.com/api/kyc-redirect";
    } else {
      // For web, use web callback URL
      returnUrl = `${window.location.origin}/customer/app/kyc-callback`;
    }
    console.log("DigiLocker return URL:", returnUrl);

    // Store pending state for callback
    const pendingState = {
      aadhaarNumber: cleanAadhaar,
      timestamp: Date.now(),
      platform: Capacitor.getPlatform(),
      returnTo: returnPath,
    };
    sessionStorage.setItem("pendingDigiLocker", JSON.stringify(pendingState));

    const result = await digiLockerService.initializeDigiLocker(cleanAadhaar, returnUrl);

    if (!result.success) {
      setError(result.message || "Failed to initialize DigiLocker");
      setLoading(false);
      return;
    }

    const { kycUrl } = result.data;

    if (!kycUrl) {
      setError("No KYC URL received. Please try again.");
      setLoading(false);
      return;
    }

    // Platform-specific handling
    if (Capacitor.isNativePlatform()) {
      // Mobile: Use Capacitor Browser plugin for in-app browser
      try {
        await Browser.open({ url: kycUrl, presentationStyle: "fullscreen" });
        setLoading(false);
      } catch (e) {
        setError("Failed to open DigiLocker. Please try again.");
        setLoading(false);
      }
    } else {
      // Web: Redirect in same window
      window.location.href = kycUrl;
    }
  };

  const handleSkip = () => {
    navigate(returnPath, { replace: true });
  };

  if (checkingStatus) {
    return (
      <div className="cm-page-animate kyc-page">
        <div className="kyc-loading">
          <span className="cm-contact-loading" />
          <p>Checking KYC status...</p>
        </div>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="cm-page-animate kyc-page">
        <div className="kyc-header">
          <button type="button" className="kyc-back" onClick={() => navigate(returnPath)}>
            <FaArrowLeft />
          </button>
          <h1>KYC Status</h1>
        </div>

        <div className="kyc-verified-card">
          <div className="kyc-verified-icon">
            <FaCheck />
          </div>
          <h2>KYC Verified</h2>
          <p>Your identity has been successfully verified via DigiLocker</p>
          <div className="kyc-verified-benefits">
            <div className="kyc-benefit"><FaUnlock /> Unlimited transactions</div>
            <div className="kyc-benefit"><FaShieldAlt /> Full access to all features</div>
          </div>
        </div>

        <button type="button" className="kyc-btn kyc-btn--home" onClick={() => navigate("/customer/app/services")}>
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="cm-page-animate kyc-page">
      <div className="kyc-header">
        <button type="button" className="kyc-back" onClick={() => navigate(returnPath)}>
          <FaArrowLeft />
        </button>
        <h1>KYC Verification</h1>
      </div>

      <div className="kyc-intro">
        <div className="kyc-intro-icon">
          <FaIdCard />
        </div>
        <p>Enter your Aadhaar number for secure KYC verification via DigiLocker</p>
      </div>

      {/* Aadhaar Input */}
      <div className="kyc-input-group">
        <label>Aadhaar Number</label>
        <div className={`kyc-input-wrap${error ? " kyc-input-wrap--error" : ""}`}>
          <span className="kyc-input-icon">
            <FaIdCard />
          </span>
          <input
            type="text"
            placeholder="XXXX-XXXX-XXXX"
            value={aadhaar}
            onChange={handleAadhaarChange}
            maxLength={14}
            inputMode="numeric"
          />
        </div>
        {error && <p className="kyc-error">{error}</p>}
      </div>

      {/* DigiLocker Button */}
      <button
        type="button"
        className="kyc-btn kyc-btn--primary"
        onClick={handleDigiLockerVerification}
        disabled={loading || aadhaar.replace(/-/g, "").length !== 12}
      >
        {loading ? (
          <>
            <span className="cm-contact-loading" style={{ width: 18, height: 18 }} />
            Initializing...
          </>
        ) : (
          <>
            <FaShieldAlt /> Verify with DigiLocker
          </>
        )}
      </button>

      {/* Warning Card */}
      <div className="kyc-warning-card">
        <div className="kyc-warning-icon">
          <FaExclamationTriangle />
        </div>
        <div className="kyc-warning-content">
          <h3>Limited Access Without KYC</h3>
          <p>
            If you skip, you can only make 1 transaction per month. Complete KYC to enjoy
            unlimited transactions and access all features.
          </p>
        </div>
      </div>

      {/* Skip Button */}
      <button type="button" className="kyc-btn kyc-btn--skip" onClick={handleSkip}>
        Skip for Now <FiChevronRight />
      </button>

      {/* Info Section */}
      <div className="kyc-info">
        <p><FaShieldAlt /> Your Aadhaar information is encrypted and secure</p>
        <p><FaCheck /> We use it only for KYC verification as per RBI guidelines</p>
      </div>
    </div>
  );
};

export default KycScreen;
