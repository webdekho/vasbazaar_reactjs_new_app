import { customerStorage } from "../services/storageService";

// Local-storage flag marking the current tab as an admin "Login As" session.
// While set, the app-lock (PIN) screen is bypassed because the admin does not
// know the customer's PIN. Cleared on logout along with the rest of the session.
export const IMPERSONATION_FLAG = "customerImpersonation";
export const IMPERSONATION_RETURN_KEY = "customerImpersonationReturn";
export const IMPERSONATION_NAME_KEY = "customerImpersonationName";

/**
 * Admin's "Login As" button opens the customer app with
 * `?impersonation=BASE64(JSON)` where the JSON carries an impersonation
 * session token minted by the backend (POST /api/admin/user/loginAs/{userId}).
 *
 * This must run synchronously at startup — before React reads the auth token
 * from storage — so the impersonated session is already in place when the
 * context initialises. Returns true when a session was bootstrapped.
 */
export const bootstrapImpersonation = () => {
  try {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("impersonation");
    if (!raw) return false;

    const payload = JSON.parse(atob(decodeURIComponent(raw)));
    if (!payload || !payload.token) return false;

    // Replace any existing session with the impersonated customer's session.
    localStorage.removeItem(customerStorage.keys.userData);
    customerStorage.setAuthSession({
      sessionToken: payload.token,
      userData: {
        name: payload.name,
        mobile: payload.mobile,
        userType: payload.userType,
        isExistingUser: true, // skip the "create PIN" screen for this session
        impersonated: true,
      },
    });

    // Bypass the app-lock and avoid an immediate inactivity lock.
    localStorage.setItem(IMPERSONATION_FLAG, "1");
    localStorage.setItem("vb_pin_set", "true");
    localStorage.setItem("vb_last_active", String(Date.now()));

    // Remember where to send the admin back to, and who is being impersonated.
    if (payload.returnUrl) localStorage.setItem(IMPERSONATION_RETURN_KEY, String(payload.returnUrl));
    if (payload.name) localStorage.setItem(IMPERSONATION_NAME_KEY, String(payload.name));

    // Strip the token from the URL so it is not bookmarked, shared or logged.
    params.delete("impersonation");
    const query = params.toString();
    const clean =
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
    window.history.replaceState({}, document.title, clean);

    return true;
  } catch (e) {
    console.error("Impersonation bootstrap failed:", e);
    return false;
  }
};

export const isImpersonationSession = () => {
  try {
    return localStorage.getItem(IMPERSONATION_FLAG) === "1";
  } catch {
    return false;
  }
};

export const getImpersonatedName = () => {
  try {
    return localStorage.getItem(IMPERSONATION_NAME_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * End the admin "Login As" session and send the admin back to the panel they
 * came from. Clears the impersonated customer's session from this tab.
 */
export const exitImpersonation = () => {
  let returnUrl = "";
  try {
    returnUrl = localStorage.getItem(IMPERSONATION_RETURN_KEY) || "";
  } catch {}

  try {
    customerStorage.clear(); // also drops the impersonation flags
  } catch {}
  try {
    localStorage.removeItem(IMPERSONATION_RETURN_KEY);
    localStorage.removeItem(IMPERSONATION_NAME_KEY);
  } catch {}

  if (returnUrl) {
    window.location.href = returnUrl;
  } else {
    // No origin to return to (e.g. opened directly) — just log out locally.
    window.location.href = "/customer/login";
  }
};
