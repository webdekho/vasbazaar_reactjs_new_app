import { Navigate, Route, Routes } from "react-router-dom";
import "./customerModern.css";
import { CustomerModernProvider } from "./context/CustomerModernContext";
import AuthGuard from "./components/AuthGuard";
import LoginScreen from "./pages/LoginScreen";
import OtpScreen from "./pages/OtpScreen";
import ProtectedShell from "./pages/ProtectedShell";
import ServicesScreen from "./pages/ServicesScreen";
import ServiceFlowScreen from "./pages/ServiceFlowScreen";
import PaymentScreen from "./pages/PaymentScreen";
import SuccessScreen from "./pages/SuccessScreen";
import WalletScreen from "./pages/WalletScreen";
import CouponsScreen from "./pages/CouponsScreen";
import NotificationsScreen from "./pages/NotificationsScreen";
import ProfileScreen from "./pages/ProfileScreen";

const CustomerModernRoutes = () => {
  return (
    <div className="customer-modern-app">
      <CustomerModernProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/customer/login" replace />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/verify-otp" element={<OtpScreen />} />
          <Route
            path="/app"
            element={
              <AuthGuard>
                <ProtectedShell />
              </AuthGuard>
            }
          >
            <Route index element={<ServicesScreen />} />
            <Route path="services" element={<ServicesScreen />} />
            <Route path="services/:serviceSlug" element={<ServiceFlowScreen />} />
            <Route path="payment" element={<PaymentScreen />} />
            <Route path="success" element={<SuccessScreen />} />
            <Route path="wallet" element={<WalletScreen />} />
            <Route path="coupons" element={<CouponsScreen />} />
            <Route path="notifications" element={<NotificationsScreen />} />
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/customer/app/services" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/customer/login" replace />} />
        </Routes>
      </CustomerModernProvider>
    </div>
  );
};

export default CustomerModernRoutes;
