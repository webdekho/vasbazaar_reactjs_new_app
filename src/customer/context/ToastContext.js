import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null); // { message, type, visible }
  const timerRef = useRef(null);

  const hideToast = useCallback(() => {
    setToast((prev) => (prev ? { ...prev, visible: false } : null));
    // Remove from DOM after exit animation
    setTimeout(() => setToast(null), 300);
  }, []);

  const showToast = useCallback((message, type = "info") => {
    // Clear any pending timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Show immediately (replaces current toast)
    setToast({ message, type, visible: true });

    // Auto-dismiss after 3.5s
    timerRef.current = setTimeout(() => {
      hideToast();
    }, 3500);
  }, [hideToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && <ToastRenderer toast={toast} onClose={hideToast} />}
    </ToastContext.Provider>
  );
};

// Inline renderer to avoid circular imports
const ToastRenderer = ({ toast, onClose }) => {
  const iconMap = {
    success: "\u2713",
    error: "\u2717",
    info: "\u2139",
  };

  return (
    <div
      className={`cm-toast cm-toast--${toast.type}${toast.visible ? " cm-toast--visible" : " cm-toast--exit"}`}
      role="alert"
      aria-live="polite"
    >
      <span className="cm-toast-icon">{iconMap[toast.type] || iconMap.info}</span>
      <span className="cm-toast-msg">{toast.message}</span>
      <button className="cm-toast-close" type="button" onClick={onClose} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
};
