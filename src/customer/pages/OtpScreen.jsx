import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaChevronRight } from "react-icons/fa";
import { FiRefreshCw, FiShield } from "react-icons/fi";
import { useCustomerModern } from "../context/CustomerModernContext";
import { authService } from "../services/authService";
import { customerStorage } from "../services/storageService";
import { extractSessionToken } from "../components/serviceUtils";

const OtpScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthSession } = useCustomerModern();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(30);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState(customerStorage.getDevOtp());
  const mobile = searchParams.get("mobile");

  useEffect(() => {
    if (timer <= 0) return undefined;
    const id = window.setInterval(() => setTimer((previous) => previous - 1), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) {
      const nextField = document.getElementById(`otp-${index + 1}`);
      if (nextField) nextField.focus();
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const otpValue = otp.join("");
    if (otpValue.length !== 6) {
      setStatus({ type: "error", message: "Enter the 6-digit OTP." });
      return;
    }

    const token = customerStorage.getTempToken();
    if (!token) {
      setStatus({ type: "error", message: "OTP token missing. Please request OTP again." });
      return;
    }

    setLoading(true);
    const response = await authService.verifyOtp({
      otp: otpValue,
      token,
      referralCode: customerStorage.getReferralCode(),
    });
    setLoading(false);

    if (!response.success) {
      setStatus({ type: "error", message: response.message });
      return;
    }

    const sessionToken = extractSessionToken(response.data) || response.raw?.data?.token || token;
    customerStorage.setDevOtp(null);
    setAuthSession({
      sessionToken,
      userData: response.data,
      tempToken: null,
    });
    navigate("/customer/app/home", { replace: true });
  };

  const resendOtp = async () => {
    if (!mobile) return;
    setLoading(true);
    const response = await authService.sendOtp({
      mobileNumber: mobile,
      referralCode: customerStorage.getReferralCode(),
    });
    setLoading(false);
    if (response.success) {
      const tempToken = extractSessionToken(response.data) || response.raw?.data?.token;
      if (tempToken) customerStorage.setTempToken(tempToken);
      const nextDevOtp = response.raw?.devOtp || null;
      customerStorage.setDevOtp(nextDevOtp);
      setDevOtp(nextDevOtp);
      setTimer(30);
      setStatus({ type: "success", message: response.message || "OTP resent." });
    } else {
      setStatus({ type: "error", message: response.message });
    }
  };

  return (
    <div className="cm-auth-screen">
      <div className="cm-auth-bg">
        <div className="cm-auth-orb cm-auth-orb--1" />
        <div className="cm-auth-orb cm-auth-orb--2" />
        <div className="cm-auth-orb cm-auth-orb--3" />
        <div className="cm-auth-grid-overlay" />
      </div>

      <div className="cm-auth-container">
        <div className="cm-auth-glass-card">
          <div className="cm-auth-header">
            <button className="cm-auth-back" type="button" onClick={() => navigate("/customer/login")}>
              <FaArrowLeft /> Back
            </button>
          </div>

          <div className="cm-auth-hero-text">
            <div className="cm-auth-otp-icon">
              <FiShield />
            </div>
            <h1>Verify OTP</h1>
            <p>We sent a 6-digit code to <strong>+91 {mobile || "your number"}</strong></p>
          </div>

          <form className="cm-auth-form" onSubmit={submit}>
            <div className="cm-auth-otp-grid">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  className="cm-auth-otp-input"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(event) => handleOtpChange(index, event.target.value)}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <div className="cm-auth-timer-row">
              {timer > 0 ? (
                <div className="cm-auth-timer">
                  <svg className="cm-auth-timer-ring" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#timerGrad)" strokeWidth="3"
                      strokeDasharray={`${(timer / 30) * 97.4} 97.4`}
                      strokeLinecap="round" transform="rotate(-90 18 18)" />
                    <defs>
                      <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ff7a00" />
                        <stop offset="100%" stopColor="#ffd43b" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="cm-auth-timer-text">{timer}s</span>
                </div>
              ) : (
                <button className="cm-auth-resend-btn" type="button" onClick={resendOtp} disabled={loading}>
                  <FiRefreshCw /> Resend OTP
                </button>
              )}
            </div>

            {devOtp ? <div className="cm-auth-alert cm-auth-alert--success"><span className="cm-auth-alert-dot" />Development OTP: {devOtp}</div> : null}

            {status ? (
              <div className={`cm-auth-alert cm-auth-alert--${status.type}`}>
                <span className="cm-auth-alert-dot" />
                {status.message}
              </div>
            ) : null}

            <button className="cm-auth-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="cm-auth-btn-loading">
                  <span className="cm-auth-spinner" />
                  Verifying...
                </span>
              ) : (
                <>Verify & Enter <FaChevronRight className="cm-auth-btn-arrow" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OtpScreen;
