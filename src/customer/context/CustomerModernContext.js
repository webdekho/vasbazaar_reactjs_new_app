import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userService } from "../services/userService";
import { customerStorage } from "../services/storageService";

const CustomerModernContext = createContext(null);

export const CustomerModernProvider = ({ children }) => {
  const navigate = useNavigate();
  const [sessionToken, setSessionToken] = useState(customerStorage.getSessionToken());
  const [userData, setUserData] = useState(customerStorage.getUserData());

  useEffect(() => {
    if (!sessionToken) {
      setUserData(null);
      return;
    }

    const hydrate = async () => {
      const profile = await userService.getUserProfile();
      if (profile.success) {
        setUserData(profile.data);
        customerStorage.setAuthSession({ sessionToken, userData: profile.data });
      }
    };

    hydrate();
  }, [sessionToken]);

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
