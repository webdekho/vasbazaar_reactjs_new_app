import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaChevronRight, FaGift } from "react-icons/fa";
import { customerStorage } from "../services/storageService";
import { authService } from "../services/authService";
import { useTheme } from "../context/ThemeContext";
import { sanitizeBackendMessage } from "../utils/userMessages";

const DEFAULT_CNF_REFERRAL = "2222222222";

const ReferralScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const mobile = searchParams.get("mobile") || "";
  const [referralCode, setReferralCode] = useState("");
  const [focused, setFocused] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  // Guard: if there's no temp token (no sendOtp just happened), bounce to login.
  useEffect(() => {
    if (!customerStorage.getTempToken()) {
      navigate("/customer/login", { replace: true });
    }
  }, [navigate]);

  const proceedWithReferral = async (code) => {
    const finalCode = code || DEFAULT_CNF_REFERRAL;
    customerStorage.setReferralCode(finalCode);

    // Call referalConfig API to create the user account
    const tempToken = customerStorage.getTempToken();
    if (!tempToken) {
      setStatus({ type: "error", message: "Session expired. Please login again." });
      return;
    }

    setLoading(true);
    setStatus({ type: "info", message: "Setting up your account..." });
    const response = await authService.referalConfig({ token: tempToken, referalCode: finalCode });
    setLoading(false);

    if (!response.success) {
      setStatus({ type: "error", message: sanitizeBackendMessage(response.message, "Failed to configure referral. Please try again.") });
      return;
    }

    // Get session data from referalConfig response
    const apiData = (typeof response.data === "object" && response.data !== null) ? response.data : (response.raw?.data || {});
    const sessionToken = apiData.token || apiData.permanentToken || tempToken;

    // Navigate to OTP screen with mode=name to show name entry directly
    navigate(`/customer/verify-otp?mobile=${mobile}&mode=name`, {
      state: {
        sessionToken,
        userData: {
          name: apiData.name || "",
          mobile: apiData.mobile || apiData.mobileNumber || mobile,
          city: apiData.city || "",
          state: apiData.state || "",
          userType: apiData.userType || "",
          refferalCode: apiData.refferalCode || finalCode,
          verified_status: apiData.verified_status,
          profile: apiData.profile || "",
          isExistingUser: false,
        },
      },
    });
  };

  const submit = (event) => {
    event.preventDefault();
    proceedWithReferral(referralCode.trim());
  };

  const skip = () => {
    proceedWithReferral("");
  };

  return (
    <div className="cm-auth-screen">
      <div className="cm-auth-bg">
        <div className="cm-auth-orb cm-auth-orb--1" />
        <div className="cm-auth-orb cm-auth-orb--2" />
        <div className="cm-auth-orb cm-auth-orb--3" />
        <div className="cm-auth-mesh" />
      </div>

      <div className="cm-auth-container">
        <div className="cm-auth-glass-card">
          <div className="cm-auth-particles">
            <span /><span /><span /><span /><span />
          </div>

          <div className="cm-auth-header">
            <button className="cm-auth-back" type="button" onClick={() => navigate("/customer/login")}>
              <FaArrowLeft /> Back
            </button>
          </div>

          <div className="cm-auth-header">
            <div className="cm-auth-logo">
              <img src={theme === "light" ? "https://webdekho.in/images/vasbazaar1.png" : "https://webdekho.in/images/vasbazaar.png"} alt="VasBazaar" className="cm-auth-logo-img" />
            </div>
          </div>

          <div className="cm-auth-hero-text">
            <h1>Got a referral?</h1>
            <p>Enter a referral code or referrer's mobile number to earn rewards. You can skip this step.</p>
          </div>

          <form className="cm-auth-form" onSubmit={submit}>
            <div className={`cm-auth-field${focused === "referral" ? " is-focused" : ""}`}>
              <label htmlFor="referral">
                <FaGift className="cm-auth-field-icon" />
                Referral Code / Referrer Mobile Number
              </label>
              <input
                id="referral"
                className="cm-auth-input cm-auth-input--full"
                placeholder="Optional referral code or mobile number"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                onFocus={() => setFocused("referral")}
                onBlur={() => setFocused("")}
                autoFocus
                disabled={loading}
              />
            </div>

            {status && (
              <div className={`cm-auth-alert cm-auth-alert--${status.type}`}>
                <span className="cm-auth-alert-dot" />
                {status.message}
              </div>
            )}

            <button className="cm-auth-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="cm-auth-btn-loading"><span className="cm-auth-spinner" />Setting up...</span>
              ) : (
                <>Continue <FaChevronRight className="cm-auth-btn-arrow" /></>
              )}
            </button>

            <button className="cm-auth-skip-btn" type="button" onClick={skip} disabled={loading}>
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReferralScreen;
