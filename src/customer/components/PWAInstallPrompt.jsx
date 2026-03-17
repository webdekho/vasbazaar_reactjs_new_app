import { useEffect, useState, useCallback } from "react";
import { FiDownload, FiX, FiShare, FiPlusSquare, FiSmartphone, FiMoreVertical } from "react-icons/fi";
import { usePWAInstall } from "../hooks/usePWAInstall";

const PWAInstallPrompt = () => {
  const { visible, canInstall, isInstalled, installPWA, dismiss, deviceType } = usePWAInstall();
  const [animateIn, setAnimateIn] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);

  useEffect(() => {
    if (visible && !isInstalled) {
      const t = setTimeout(() => setAnimateIn(true), 50);
      return () => clearTimeout(t);
    }
    setAnimateIn(false);
    setShowManualSteps(false);
  }, [visible, isInstalled]);

  const addToHomeManually = useCallback(() => {
    setShowManualSteps(true);
  }, []);

  if (!visible || isInstalled) return null;

  return (
    <div className={`pwa-overlay${animateIn ? " pwa-overlay--in" : ""}`} onClick={dismiss}>
      <div className={`pwa-sheet${animateIn ? " pwa-sheet--in" : ""}`} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="pwa-close" type="button" onClick={dismiss} aria-label="Close">
          <FiX />
        </button>

        {/* Animated phone icon */}
        <div className="pwa-icon-wrap">
          <div className="pwa-icon-ring" />
          <div className="pwa-icon-ring pwa-icon-ring--2" />
          <FiSmartphone className="pwa-icon-phone" />
          <div className="pwa-icon-badge">
            <FiDownload />
          </div>
        </div>

        {/* Title */}
        <h2 className="pwa-title">Add to Home Screen</h2>
        <p className="pwa-subtitle">Get the full app experience</p>

        {deviceType === "ios" || (showManualSteps && deviceType === "ios") ? (
          /* iOS: show manual steps */
          <div className="pwa-ios-steps">
            <div className="pwa-step">
              <span className="pwa-step-num">1</span>
              <span className="pwa-step-text">
                Tap <FiShare className="pwa-step-icon" /> <strong>Share</strong> button below
              </span>
            </div>
            <div className="pwa-step">
              <span className="pwa-step-num">2</span>
              <span className="pwa-step-text">
                Scroll & tap <FiPlusSquare className="pwa-step-icon" /> <strong>Add to Home Screen</strong>
              </span>
            </div>
            <div className="pwa-step">
              <span className="pwa-step-num">3</span>
              <span className="pwa-step-text">Tap <strong>Add</strong> to confirm</span>
            </div>
          </div>
        ) : showManualSteps ? (
          /* Android/Desktop: manual steps when native prompt unavailable */
          <div className="pwa-ios-steps">
            <div className="pwa-step">
              <span className="pwa-step-num">1</span>
              <span className="pwa-step-text">
                Tap <FiMoreVertical className="pwa-step-icon" /> <strong>Menu</strong> (top-right corner)
              </span>
            </div>
            <div className="pwa-step">
              <span className="pwa-step-num">2</span>
              <span className="pwa-step-text">
                Tap <FiPlusSquare className="pwa-step-icon" /> <strong>Add to Home screen</strong>
              </span>
            </div>
            <div className="pwa-step">
              <span className="pwa-step-num">3</span>
              <span className="pwa-step-text">Tap <strong>Install</strong> to confirm</span>
            </div>
          </div>
        ) : (
          /* Android / Desktop: features list */
          <div className="pwa-features">
            <div className="pwa-feature"><span className="pwa-feature-dot" />Instant access from home screen</div>
            <div className="pwa-feature"><span className="pwa-feature-dot" />Faster loading & smooth experience</div>
            <div className="pwa-feature"><span className="pwa-feature-dot" />Works like a native app</div>
          </div>
        )}

        {/* Action buttons */}
        <div className="pwa-actions">
          {deviceType === "ios" ? (
            <button className="pwa-btn pwa-btn--primary" type="button" onClick={dismiss}>
              Got it
            </button>
          ) : (
            <button className="pwa-btn pwa-btn--primary" type="button" onClick={canInstall ? installPWA : addToHomeManually}>
              <FiDownload /> Install App
            </button>
          )}
          <button className="pwa-btn pwa-btn--ghost" type="button" onClick={dismiss}>
            <FiX /> Not Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
