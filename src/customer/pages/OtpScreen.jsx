import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaChevronRight } from "react-icons/fa";
import { FiRefreshCw, FiUser } from "react-icons/fi";
import { useCustomerModern } from "../context/CustomerModernContext";
import { authService } from "../services/authService";
import { userService } from "../services/userService";
import { customerStorage } from "../services/storageService";
import { extractSessionToken } from "../components/serviceUtils";
import { triggerPWAInstall } from "../hooks/usePWAInstall";
import { useTheme } from "../context/ThemeContext";
import { sanitizeBackendMessage } from "../utils/userMessages";

const NAME_PLACEHOLDERS = new Set([
  "NA",
  "N/A",
  "NULL",
  "UNDEFINED",
  "NONE",
  "CUSTOMER",
  "CUSTOMER NAME",
  "USER",
  "USER NAME",
]);

const OtpScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const { setAuthSession } = useCustomerModern();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(30);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState(customerStorage.getDevOtp());
  const [shake, setShake] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);
  const [name, setName] = useState("");
  const [nameStatus, setNameStatus] = useState(null);
  const [nameLoading, setNameLoading] = useState(false);
  const [focused, setFocused] = useState("");
  const mobile = searchParams.get("mobile");

  // Auto-focus first OTP input on mount (works on mobile too)
  useEffect(() => {
    const focusId = pendingSession ? "onboarding-name" : "otp-0";
    const t = setTimeout(() => document.getElementById(focusId)?.focus(), 300);
    return () => clearTimeout(t);
  }, [pendingSession]);

  useEffect(() => {
    if (timer <= 0) return undefined;
    const id = window.setInterval(() => setTimer((p) => p - 1), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const handleOtpChange = (index, value) => {
    // Handle paste of full OTP
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      digits.forEach((d, i) => { next[i] = d; });
      setOtp(next);
      if (digits.length === 6) {
        document.getElementById(`otp-5`)?.focus();
        // Auto-submit after full paste
        setTimeout(() => document.getElementById("otp-submit-btn")?.click(), 100);
      } else {
        document.getElementById(`otp-${Math.min(digits.length, 5)}`)?.focus();
      }
      return;
    }
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
    // Auto-submit when last digit is typed
    if (value && index === 5) {
      setTimeout(() => document.getElementById("otp-submit-btn")?.click(), 100);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const finishLogin = (sessionToken, userData) => {
    setAuthSession({ sessionToken, userData, tempToken: null });
    triggerPWAInstall();
    navigate("/customer/app/services", { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    const otpValue = otp.join("");
    if (otpValue.length !== 6) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setStatus({ type: "error", message: "Enter the 6-digit OTP." });
      return;
    }
    const token = customerStorage.getTempToken();
    if (!token) { setStatus({ type: "error", message: "OTP token missing. Please request OTP again." }); return; }
    setLoading(true);
    const response = await authService.verifyOtp({ otp: otpValue, token, referralCode: customerStorage.getReferralCode() });
    setLoading(false);
    if (!response.success) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setStatus({ type: "error", message: sanitizeBackendMessage(response.message, "Verification failed. Please try again.") });
      return;
    }
    const apiData = (typeof response.data === "object" && response.data !== null) ? response.data : (response.raw?.data || {});
    const rawData = response.raw || {};
    const sessionToken = apiData.token || extractSessionToken(response.data) || token;
    customerStorage.setDevOtp(null);
    if (apiData.profile) {
      localStorage.setItem("profile_photo", apiData.profile);
    }
    // Try all possible name fields from both data and raw response
    const extractedName = apiData.name || apiData.firstName || apiData.userName || apiData.user_name || apiData.customerName
      || rawData.name || rawData.data?.name || rawData.data?.firstName || rawData.data?.userName || "";
    const userData = {
      name: extractedName,
      mobile: apiData.mobile || apiData.mobileNumber || rawData.data?.mobile || rawData.data?.mobileNumber || mobile,
      city: apiData.city || "", state: apiData.state || "", userType: apiData.userType || "",
      refferalCode: apiData.refferalCode || "", verified_status: apiData.verified_status,
      profile: apiData.profile || "",
    };
    const normalizedName = (extractedName || "").trim().replace(/\s+/g, " ");
    const normalizedNameKey = normalizedName.toUpperCase();
    const nameDigits = normalizedName.replace(/\D/g, "");
    const mobileDigits = String(userData.mobile || "").replace(/\D/g, "");
    const needsNameOnboarding =
      !normalizedName
      || NAME_PLACEHOLDERS.has(normalizedNameKey)
      || (nameDigits.length >= 10 && mobileDigits && nameDigits === mobileDigits);

    if (needsNameOnboarding) {
      setStatus(null);
      setNameStatus(null);
      setName("");
      setPendingSession({ sessionToken, userData: { ...userData, name: "" } });
      return;
    }

    finishLogin(sessionToken, userData);
  };

  const submitName = async (event) => {
    event.preventDefault();
    if (!pendingSession) return;

    const trimmedName = name.trim().replace(/\s+/g, " ");
    if (trimmedName.length < 2) {
      setNameStatus({ type: "error", message: "Please enter your full name." });
      return;
    }

    setNameLoading(true);
    const response = await userService.completeOnboarding({
      name: trimmedName,
      sessionToken: pendingSession.sessionToken,
    });
    setNameLoading(false);

    if (!response.success) {
      setNameStatus({ type: "error", message: sanitizeBackendMessage(response.message, "Failed to save your name.") });
      return;
    }

    const updatedData = {
      ...pendingSession.userData,
      ...(response.data || {}),
      name: response.data?.name || trimmedName,
      mobile: response.data?.mobile || response.data?.mobileNumber || pendingSession.userData.mobile,
      verified_status: response.data?.verified_status ?? pendingSession.userData.verified_status,
      profile: response.data?.profile || pendingSession.userData.profile || "",
    };

    setPendingSession(null);
    setNameStatus(null);
    finishLogin(pendingSession.sessionToken, updatedData);
  };

  const resendOtp = async () => {
    if (!mobile) return;
    setLoading(true);
    const response = await authService.sendOtp({ mobileNumber: mobile, referralCode: customerStorage.getReferralCode() });
    setLoading(false);
    if (response.success) {
      const tempToken = extractSessionToken(response.data) || response.raw?.data?.token;
      if (tempToken) customerStorage.setTempToken(tempToken);
      const nextDevOtp = response.raw?.devOtp || null;
      customerStorage.setDevOtp(nextDevOtp);
      setDevOtp(nextDevOtp);
      setTimer(30);
      setOtp(["", "", "", "", "", ""]);
      setStatus({ type: "success", message: "OTP resent successfully" });
    } else {
      setStatus({ type: "error", message: sanitizeBackendMessage(response.message, "Failed to resend OTP. Please try again.") });
    }
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
          <div className="cm-auth-particles"><span /><span /><span /><span /><span /></div>

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
            <h1>{pendingSession ? "Please enter your name" : "Verify OTP"}</h1>
            <p>
              {pendingSession
                ? "Please enter your name to finish your first-time signup."
                : <>We sent a 6-digit code to <strong>+91 {mobile || "your number"}</strong></>}
            </p>
          </div>

          {pendingSession ? (
            <form className="cm-auth-form" onSubmit={submitName}>
              <div className={`cm-auth-field${focused === "name" ? " is-focused" : ""}`}>
                <label htmlFor="onboarding-name">
                  <FiUser className="cm-auth-field-icon" />
                  Full Name
                </label>
                <input
                  id="onboarding-name"
                  className="cm-auth-input cm-auth-input--full"
                  placeholder="Please enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused("")}
                  autoComplete="name"
                />
              </div>

              {nameStatus && (
                <div className={`cm-auth-alert cm-auth-alert--${nameStatus.type}`}>
                  <span className="cm-auth-alert-dot" />
                  {nameStatus.message}
                </div>
              )}

              <button className="cm-auth-btn" type="submit" disabled={nameLoading}>
                {nameLoading ? (
                  <span className="cm-auth-btn-loading"><span className="cm-auth-spinner" />Saving...</span>
                ) : (
                  <>Continue <FaChevronRight className="cm-auth-btn-arrow" /></>
                )}
              </button>
            </form>
          ) : (
            <form className="cm-auth-form" onSubmit={submit}>
              <div className={`cm-auth-otp-grid${shake ? " cm-shake" : ""}`}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    className={`cm-auth-otp-input${digit ? " has-value" : ""}`}
                    inputMode="numeric"
                    maxLength={index === 0 ? 6 : 1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    autoFocus={index === 0}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                  />
                ))}
              </div>

              <div className="cm-auth-timer-row">
                {timer > 0 ? (
                  <div className="cm-auth-timer">
                    <svg className="cm-auth-timer-ring" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.5" fill="none" className="cm-auth-timer-track" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#timerGrad)" strokeWidth="3"
                        strokeDasharray={`${(timer / 30) * 97.4} 97.4`}
                        strokeLinecap="round" transform="rotate(-90 18 18)" />
                      <defs>
                        <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#40E0D0" />
                          <stop offset="100%" stopColor="#007BFF" />
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

              {devOtp && <div className="cm-auth-alert cm-auth-alert--success"><span className="cm-auth-alert-dot" />Development OTP: {devOtp}</div>}
              {status && <div className={`cm-auth-alert cm-auth-alert--${status.type}`}><span className="cm-auth-alert-dot" />{status.message}</div>}

              <button id="otp-submit-btn" className="cm-auth-btn" type="submit" disabled={loading}>
                {loading ? (
                  <span className="cm-auth-btn-loading"><span className="cm-auth-spinner" />Verifying...</span>
                ) : (
                  <>Verify & Enter <FaChevronRight className="cm-auth-btn-arrow" /></>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default OtpScreen;
