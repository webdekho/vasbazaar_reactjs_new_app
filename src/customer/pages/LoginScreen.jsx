import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaChevronRight, FaGift } from "react-icons/fa";
import { FiPhoneCall, FiCreditCard, FiGift } from "react-icons/fi";
import { authService } from "../services/authService";
import { customerStorage } from "../services/storageService";
import { extractSessionToken } from "../components/serviceUtils";
import { useTheme } from "../context/ThemeContext";

const LoginScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const urlCode = searchParams.get("code");
  const [mobileNumber, setMobileNumber] = useState("");
  const [referralCode, setReferralCode] = useState(
    urlCode || customerStorage.getReferralCode() || ""
  );
  const [status, setStatus] = useState(() => {
    const reason = sessionStorage.getItem("vb_logout_reason");
    if (reason) { sessionStorage.removeItem("vb_logout_reason"); return { type: "error", message: reason }; }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!/^\d{10}$/.test(mobileNumber)) {
      setStatus({ type: "error", message: "Enter a valid 10-digit mobile number." });
      return;
    }
    setLoading(true);
    const response = await authService.sendOtp({ mobileNumber, referralCode });
    setLoading(false);
    if (!response.success) { setStatus({ type: "error", message: response.message }); return; }
    const tempToken = extractSessionToken(response.data) || response.raw?.token || response.raw?.data?.token;
    if (tempToken) customerStorage.setTempToken(tempToken);
    customerStorage.setDevOtp(response.raw?.devOtp || null);
    customerStorage.setReferralCode(referralCode);
    setStatus({ type: "success", message: response.message || "OTP sent successfully." });
    navigate(`/customer/verify-otp?mobile=${mobileNumber}`);
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
            <div className="cm-auth-logo">
              <img src={theme === "light" ? "/images/vasbazaar-light.png" : "/images/vasbazaar-dark.png"} alt="VasBazaar" className="cm-auth-logo-img" />
            </div>
            <div className="cm-auth-badge-row">
              <span className="cm-auth-chip"><FiCreditCard /> Bills</span>
              <span className="cm-auth-chip"><FiPhoneCall /> Recharge</span>
              <span className="cm-auth-chip cm-auth-chip--accent"><FiGift /> Rewards</span>
            </div>
          </div>

          <div className="cm-auth-hero-text">
            <h1>Welcome back</h1>
            <p>Sign in with your mobile number to continue</p>
          </div>

          <form className="cm-auth-form" onSubmit={submit}>
            <div className={`cm-auth-field${focused === "mobile" ? " is-focused" : ""}`}>
              <label htmlFor="mobile">
                <FiPhoneCall className="cm-auth-field-icon" />
                Mobile Number
              </label>
              <div className="cm-auth-input-wrap">
                <span className="cm-auth-prefix">+91</span>
                <input
                  id="mobile"
                  className="cm-auth-input"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
                  onFocus={() => setFocused("mobile")}
                  onBlur={() => setFocused("")}
                  autoFocus
                />
              </div>
            </div>

            {!urlCode && (
              <div className={`cm-auth-field${focused === "referral" ? " is-focused" : ""}`}>
                <label htmlFor="referral">
                  <FaGift className="cm-auth-field-icon" />
                  Referral Code
                </label>
                <input
                  id="referral"
                  className="cm-auth-input cm-auth-input--full"
                  placeholder="Optional referral code"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  onFocus={() => setFocused("referral")}
                  onBlur={() => setFocused("")}
                />
              </div>
            )}

            {status && (
              <div className={`cm-auth-alert cm-auth-alert--${status.type}`}>
                <span className="cm-auth-alert-dot" />
                {status.message}
              </div>
            )}

            <button className="cm-auth-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="cm-auth-btn-loading"><span className="cm-auth-spinner" />Sending OTP...</span>
              ) : (
                <>Get OTP <FaChevronRight className="cm-auth-btn-arrow" /></>
              )}
            </button>
          </form>

          <div className="cm-auth-footer">
            <p>By continuing, you agree to our Terms of Service</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
