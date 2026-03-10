import { Navigate } from "react-router-dom";
import { useCustomerModern } from "../context/CustomerModernContext";

const AuthGuard = ({ children }) => {
  const { sessionToken } = useCustomerModern();
  if (!sessionToken) {
    return <Navigate to="/customer/login" replace />;
  }
  return children;
};

export default AuthGuard;
