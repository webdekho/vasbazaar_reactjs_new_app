import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaChevronRight, FaGift } from "react-icons/fa";
import { customerStorage } from "../services/storageService";
import { useTheme } from "../context/ThemeContext";

const DEFAULT_CNF_REFERRAL = "2222222222";

const ReferralScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const mobile = searchParams.get("mobile") || "";
  const [referralCode, setReferralCode] = useState("");
  const [focused, setFocused] = useState("");

  // Guard: if there's no temp token (no sendOtp just happened), bounce to login.
  useEffect(() => {
    if (!customerStorage.getTempToken()) {
      navigate("/customer/login", { replace: true });
    }
  }, [navigate]);

  const proceedToOtp = (code) => {
    customerStorage.setReferralCode(code || DEFAULT_CNF_REFERRAL);
    navigate(`/customer/verify-otp${mobile ? `?mobile=${mobile}` : ""}`);
  };

  const submit = (event) => {
    event.preventDefault();
    proceedToOtp(referralCode.trim());
  };

  const skip = () => {
    proceedToOtp("");
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
              />
            </div>

            <button className="cm-auth-btn" type="submit">
              Continue <FaChevronRight className="cm-auth-btn-arrow" />
            </button>

            <button className="cm-auth-skip-btn" type="button" onClick={skip}>
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReferralScreen;
