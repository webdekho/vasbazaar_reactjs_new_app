import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { userService } from "../services/userService";
import { customerStorage } from "../services/storageService";

const CustomerModernContext = createContext(null);

const AUTH_PAGES = ["/customer/login", "/customer/verify-otp"];

export const CustomerModernProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionToken, setSessionToken] = useState(customerStorage.getSessionToken());
  const [userData, setUserData] = useState(customerStorage.getUserData());

  useEffect(() => {
    if (!sessionToken) {
      setUserData(null);
      return;
    }

    // Skip authenticated API calls on login/OTP pages to avoid 401s with stale tokens
    if (AUTH_PAGES.includes(location.pathname)) return;

    const hydrate = async () => {
      const profile = await userService.getUserProfile();
      if (profile.success) {
        const existing = customerStorage.getUserData();
        const profileData = profile.data || {};
        const rawData = profile.raw?.data || profile.raw || {};
        // Preserve mobile and name from existing userData if profile doesn't have them
        const mobile = profileData.mobile || profileData.mobileNumber || profileData.phone
          || rawData.mobile || rawData.mobileNumber
          || existing?.mobile || existing?.mobileNumber || "";
        const name = profileData.name || profileData.firstName || profileData.userName
          || profileData.user_name || profileData.customerName
          || rawData.name || rawData.firstName || rawData.userName
          || existing?.name || existing?.firstName || "";
        const merged = { ...profileData, mobile, name };
        setUserData(merged);
        customerStorage.setAuthSession({ sessionToken, userData: merged });
      }
    };

    hydrate();
  }, [sessionToken, location.pathname]);

  const value = useMemo(
    () => ({
      sessionToken,
      userData,
      setAuthSession: (payload) => {
        customerStorage.setAuthSession(payload);
        if (payload.sessionToken) setSessionToken(payload.sessionToken);
        if (payload.userData) setUserData(payload.userData);
      },
      logout: () => {
        customerStorage.clear();
        setSessionToken(null);
        setUserData(null);
        navigate("/customer/login", { replace: true });
      },
    }),
    [navigate, sessionToken, userData]
  );

  return <CustomerModernContext.Provider value={value}>{children}</CustomerModernContext.Provider>;
};

export const useCustomerModern = () => {
  const context = useContext(CustomerModernContext);
  if (!context) throw new Error("Customer modern context unavailable");
  return context;
};

export default CustomerModernContext;
