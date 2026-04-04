import { Navigate, useLocation } from "react-router-dom";
import { useCustomerModern } from "../context/CustomerModernContext";

const AuthGuard = ({ children }) => {
  const { sessionToken } = useCustomerModern();
  const location = useLocation();

  console.log("AuthGuard - Path:", location.pathname, "SessionToken exists:", !!sessionToken);

  if (!sessionToken) {
    console.log("AuthGuard - No session token, redirecting to login");
    return <Navigate to="/customer/login" replace />;
  }
  return children;
};

export default AuthGuard;
