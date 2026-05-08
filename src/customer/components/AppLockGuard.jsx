import { useState, useEffect, useCallback, useRef } from "react";
import { FaFingerprint, FaLock, FaBackspace, FaShieldAlt, FaSignOutAlt } from "react-icons/fa";
import { useCustomerModern } from "../context/CustomerModernContext";
import { authService } from "../services/authService";
import { userService } from "../services/userService";
import { setAppLocked, onSessionExpired } from "../services/apiClient";
import { useTheme } from "../context/ThemeContext";
import { sanitizeBackendMessage } from "../utils/userMessages";

const LOCK_KEYS = {
  pinSet: "vb_pin_set",
  lastActive: "vb_last_active",
  biometricEnabled: "vb_biometric_enabled",
};

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour

// Check if Web Authentication API (biometric) is available
const isBiometricAvailable = async () => {
  if (!window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

// Trigger device biometric/screen lock
const authenticateWithBiometric = async () => {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "VasBazaar", id: window.location.hostname },
        user: {
          id: new Uint8Array(16),
          name: "user@vasbazaar",
          displayName: "VasBazaar User",
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    });
    return !!credential;
  } catch {
    return false;
  }
};

// ─── PIN Pad Component ───
const PinPad = ({ onComplete, error, title, subtitle }) => {
  const [pin, setPin] = useState("");

  const handleDigit = (digit) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => {
          onComplete(newPin);
          setPin("");
        }, 150);
      }
    }
  };

  const handleBackspace = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="al-pin-section">
      <div className="al-pin-title">{title || "Enter PIN"}</div>
      {subtitle && <div className="al-pin-subtitle">{subtitle}</div>}
      <div className="al-pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`al-pin-dot${i < pin.length ? " al-pin-dot--filled" : ""}${error ? " al-pin-dot--error" : ""}`} />
        ))}
      </div>
      {error && <div className="al-pin-error">{error}</div>}
      <div className="al-numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "back"].map((key, i) => (
          <button
            key={i}
            type="button"
            className={`al-numpad-key${key === null ? " al-numpad-key--empty" : ""}${key === "back" ? " al-numpad-key--action" : ""}`}
            onClick={() => {
              if (key === "back") handleBackspace();
              else if (key !== null) handleDigit(String(key));
            }}
            disabled={key === null}
          >
            {key === "back" ? <FaBackspace /> : key !== null ? key : ""}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Lock Screen ───
const LockScreen = ({ onUnlock }) => {
  const [error, setError] = useState("");
  const [biometricAvail, setBiometricAvail] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { theme } = useTheme();
  const { sessionToken, setAuthSession, logout } = useCustomerModern();
  const attempted = useRef(false);

  useEffect(() => {
    isBiometricAvailable().then((avail) => {
      setBiometricAvail(avail);
      if (avail && !attempted.current) {
        attempted.current = true;
        handleBiometric();
      } else {
        setShowPin(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBiometric = async () => {
    setError("");
    const success = await authenticateWithBiometric();
    if (success) {
      // Verify the session token is still valid after biometric unlock
      const profileCheck = await userService.getUserProfile();
      if (profileCheck.success) {
        localStorage.setItem(LOCK_KEYS.lastActive, Date.now().toString());
        onUnlock();
      } else {
        // Session expired — biometric verified identity but token is stale
        // Fall back to PIN which returns a fresh token from the server
        setSessionExpired(true);
        setError("Session expired. Enter PIN to continue.");
        setShowPin(true);
      }
    } else {
      setShowPin(true);
    }
  };

  const handlePinSubmit = async (pin) => {
    setError("");
    const res = await authService.authenticateWithPin({ pin, permanentToken: sessionToken });
    if (res.success) {
      // CRITICAL: Update session token with the new token from PIN login response
      const newToken = res.data?.token || res.raw?.data?.token;
      if (newToken) {
        console.log("PIN Login: Updating session token");
        setAuthSession({
          sessionToken: newToken,
          userData: {
            name: res.data?.name || res.raw?.data?.name,
            mobile: res.data?.mobile || res.raw?.data?.mobile,
          },
        });
      }
      localStorage.setItem(LOCK_KEYS.lastActive, Date.now().toString());
      setPinAttempts(0);
      onUnlock();
    } else {
      const attempts = pinAttempts + 1;
      setPinAttempts(attempts);
      if (attempts >= 3) {
        setError("Multiple failed attempts. Please logout and login again.");
      } else {
        setError(sanitizeBackendMessage(res.message, "Incorrect PIN. Try again."));
      }
    }
  };

  const handleLogout = () => {
    // Clear PIN state
    localStorage.removeItem(LOCK_KEYS.pinSet);
    localStorage.removeItem(LOCK_KEYS.lastActive);
    localStorage.removeItem(LOCK_KEYS.biometricEnabled);
    // Logout and redirect to login
    logout();
  };

  return (
    <div className={`al-overlay${theme === "light" ? " al-overlay--light" : ""}`}>
      <div className="al-card">
        <div className="al-logo-wrap">
          <img
            src={theme === "light" ? "https://webdekho.in/images/vasbazaar1.png" : "https://webdekho.in/images/vasbazaar.png"}
            alt="VasBazaar" className="al-logo"
          />
        </div>
        <FaShieldAlt className="al-shield-icon" />
        <div className="al-lock-title">{sessionExpired ? "Session Expired" : "App Locked"}</div>
        <div className="al-lock-sub">
          {sessionExpired ? "Enter PIN to refresh your session" : "Verify your identity to continue"}
        </div>

        {biometricAvail && !showPin && (
          <div className="al-biometric-section">
            <button type="button" className="al-biometric-btn" onClick={handleBiometric}>
              <FaFingerprint />
              <span>Unlock with Biometric</span>
            </button>
            <button type="button" className="al-switch-btn" onClick={() => setShowPin(true)}>
              <FaLock size={12} /> Use PIN instead
            </button>
          </div>
        )}

        {showPin && (
          <>
            <PinPad onComplete={handlePinSubmit} error={error} />
            {biometricAvail && !sessionExpired && (
              <button type="button" className="al-switch-btn" onClick={() => { setShowPin(false); handleBiometric(); }}>
                <FaFingerprint size={14} /> Use Biometric
              </button>
            )}
          </>
        )}

        {/* Logout button - always visible */}
        <button type="button" className="al-logout-btn" onClick={handleLogout}>
          <FaSignOutAlt size={14} /> Logout & Login Again
        </button>
      </div>
    </div>
  );
};

// ─── Set PIN Screen (first time) ───
const SetPinScreen = ({ onComplete }) => {
  const [step, setStep] = useState("create"); // create | confirm
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const { sessionToken } = useCustomerModern();
  const { theme } = useTheme();

  const handleCreate = (pin) => {
    setFirstPin(pin);
    setStep("confirm");
    setError("");
  };

  const handleConfirm = async (pin) => {
    if (pin !== firstPin) {
      setError("PINs don't match. Try again.");
      setStep("create");
      setFirstPin("");
      return;
    }
    setError("");
    const res = await authService.setUserPin({ pin, sessionToken });
    if (res.success) {
      localStorage.setItem(LOCK_KEYS.pinSet, "true");
      localStorage.setItem(LOCK_KEYS.lastActive, Date.now().toString());
      onComplete();
    } else {
      setError(sanitizeBackendMessage(res.message, "Failed to set PIN. Try again."));
      setStep("create");
      setFirstPin("");
    }
  };

  return (
    <div className={`al-overlay${theme === "light" ? " al-overlay--light" : ""}`}>
      <div className="al-card">
        <div className="al-logo-wrap">
          <img
            src={theme === "light" ? "https://webdekho.in/images/vasbazaar1.png" : "https://webdekho.in/images/vasbazaar.png"}
            alt="VasBazaar" className="al-logo"
          />
        </div>
        <FaLock className="al-shield-icon" />
        <div className="al-lock-title">Set App PIN</div>
        <div className="al-lock-sub">Create a 4-digit PIN to secure your app</div>
        <PinPad
          onComplete={step === "create" ? handleCreate : handleConfirm}
          error={error}
          title={step === "create" ? "Create PIN" : "Confirm PIN"}
          subtitle={step === "create" ? "Choose a 4-digit PIN" : "Re-enter the same PIN"}
        />
      </div>
    </div>
  );
};

// ─── Change PIN Screen (exported for ProfileScreen) ───
export const ChangePinScreen = ({ onClose }) => {
  const [step, setStep] = useState("old"); // old | new | confirm
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");
  const { sessionToken, setAuthSession } = useCustomerModern();
  const { theme } = useTheme();

  const handleOldPin = async (pin) => {
    setError("");
    const res = await authService.authenticateWithPin({ pin, permanentToken: sessionToken });
    if (res.success) {
      // Update session token with the new token from PIN verification
      const newToken = res.data?.token || res.raw?.data?.token;
      if (newToken) {
        setAuthSession({
          sessionToken: newToken,
          userData: {
            name: res.data?.name || res.raw?.data?.name,
            mobile: res.data?.mobile || res.raw?.data?.mobile,
          },
        });
      }
      setStep("new");
    } else {
      setError("Incorrect current PIN");
    }
  };

  const handleNewPin = (pin) => {
    setNewPin(pin);
    setStep("confirm");
    setError("");
  };

  const handleConfirm = async (pin) => {
    if (pin !== newPin) {
      setError("PINs don't match. Try again.");
      setStep("new");
      setNewPin("");
      return;
    }
    const res = await authService.setUserPin({ pin, sessionToken });
    if (res.success) {
      onClose("PIN changed successfully");
    } else {
      setError(sanitizeBackendMessage(res.message, "Failed to update PIN."));
      setStep("new");
      setNewPin("");
    }
  };

  const titles = { old: "Enter Current PIN", new: "Enter New PIN", confirm: "Confirm New PIN" };
  const subs = { old: "Verify your current PIN first", new: "Choose a new 4-digit PIN", confirm: "Re-enter the new PIN" };

  return (
    <div className={`al-overlay${theme === "light" ? " al-overlay--light" : ""}`}>
      <div className="al-card">
        <button type="button" className="qr-modal-close" onClick={() => onClose(null)} style={{ zIndex: 5 }}>✕</button>
        <FaLock className="al-shield-icon" style={{ marginTop: 24 }} />
        <div className="al-lock-title">Change PIN</div>
        <PinPad
          onComplete={step === "old" ? handleOldPin : step === "new" ? handleNewPin : handleConfirm}
          error={error}
          title={titles[step]}
          subtitle={subs[step]}
        />
      </div>
    </div>
  );
};

// ─── Main Guard Component ───
const AppLockGuard = ({ children }) => {
  const { sessionToken, userData } = useCustomerModern();
  const [locked, setLocked] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const inactivityTimer = useRef(null);

  // Check lock state on mount
  useEffect(() => {
    if (!sessionToken) return;

    const pinSet = localStorage.getItem(LOCK_KEYS.pinSet);

    // Existing users already have PIN set on server - skip SetPinScreen
    // Mark PIN as set locally so lock screen works normally
    if (userData?.isExistingUser === true) {
      if (!pinSet) {
        localStorage.setItem(LOCK_KEYS.pinSet, "true");
        localStorage.setItem(LOCK_KEYS.lastActive, Date.now().toString());
      }
      // Don't show SetPinScreen for existing users
      setNeedsPin(false);
      return;
    }

    // New users need to create PIN
    if (!pinSet) {
      setNeedsPin(true);
      return;
    }

    const lastActive = Number(localStorage.getItem(LOCK_KEYS.lastActive) || 0);
    const elapsed = Date.now() - lastActive;
    if (elapsed > INACTIVITY_TIMEOUT) {
      setLocked(true);
    } else {
      localStorage.setItem(LOCK_KEYS.lastActive, Date.now().toString());
    }
  }, [sessionToken, userData]);

  // Track user activity
  const resetTimer = useCallback(() => {
    localStorage.setItem(LOCK_KEYS.lastActive, Date.now().toString());
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setLocked(true);
    }, INACTIVITY_TIMEOUT);
  }, []);

  useEffect(() => {
    if (locked || needsPin) return;

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    // Also lock on visibility change (tab switch, app background)
    const handleVisibility = () => {
      if (document.hidden) {
        localStorage.setItem(LOCK_KEYS.lastActive, Date.now().toString());
      } else {
        const lastActive = Number(localStorage.getItem(LOCK_KEYS.lastActive) || 0);
        if (Date.now() - lastActive > INACTIVITY_TIMEOUT) {
          setLocked(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibility);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [locked, needsPin, resetTimer]);

  // Register callback so the 401 interceptor can lock the app instead of redirecting to login
  useEffect(() => {
    onSessionExpired(() => setLocked(true));
    return () => onSessionExpired(null);
  }, []);

  // Tell the 401 interceptor to skip while lock screen is active
  const unlockGraceTimer = useRef(null);
  useEffect(() => {
    if (locked || needsPin) {
      if (unlockGraceTimer.current) { clearTimeout(unlockGraceTimer.current); unlockGraceTimer.current = null; }
      setAppLocked(true);
    } else {
      unlockGraceTimer.current = setTimeout(() => { setAppLocked(false); }, 3000);
    }
    return () => {
      if (unlockGraceTimer.current) { clearTimeout(unlockGraceTimer.current); unlockGraceTimer.current = null; }
      setAppLocked(false);
    };
  }, [locked, needsPin]);

  if (needsPin) {
    return <SetPinScreen onComplete={() => { setNeedsPin(false); setLocked(false); }} />;
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return children;
};

export default AppLockGuard;
