import { Navigate, useLocation } from "react-router-dom";
import { useCustomerModern } from "../context/CustomerModernContext";

const AuthGuard = ({ children }) => {
  const { sessionToken } = useCustomerModern();
  const location = useLocation();

  console.log("AuthGuard - Path:", location.pathname, "SessionToken exists:", !!sessionToken);

  if (!sessionToken) {
    console.log("AuthGuard - No session token, redirecting to login");
    // Remember where the user was headed (e.g. a shared ReBuddy group link) so
    // they land back there after logging in instead of the default home screen.
    try {
      sessionStorage.setItem("vb_post_login_redirect", location.pathname + location.search);
    } catch {}
    return <Navigate to="/customer/login" replace />;
  }
  return children;
};

export default AuthGuard;
