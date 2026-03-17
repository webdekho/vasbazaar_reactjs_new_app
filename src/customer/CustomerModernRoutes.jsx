import { Navigate, Route, Routes } from "react-router-dom";
import "./customerModern.css";
import { CustomerModernProvider } from "./context/CustomerModernContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import AuthGuard from "./components/AuthGuard";
import LoginScreen from "./pages/LoginScreen";
import OtpScreen from "./pages/OtpScreen";
import ProtectedShell from "./pages/ProtectedShell";
import ServicesScreen from "./pages/ServicesScreen";
import ServiceFlowScreen from "./pages/ServiceFlowScreen";
import OfferScreen from "./pages/OfferScreen";
import PaymentScreen from "./pages/PaymentScreen";
import SuccessScreen from "./pages/SuccessScreen";
import WalletScreen from "./pages/WalletScreen";
import CouponsScreen from "./pages/CouponsScreen";
import NotificationsScreen from "./pages/NotificationsScreen";
import ProfileScreen from "./pages/ProfileScreen";
import ComplaintScreen from "./pages/ComplaintScreen";
import CommissionScreen from "./pages/CommissionScreen";
import ReferralListScreen from "./pages/ReferralListScreen";
import SearchTransactionScreen from "./pages/SearchTransactionScreen";
import TransactionHistoryScreen from "./pages/TransactionHistoryScreen";
import MyDuesScreen from "./pages/MyDuesScreen";
import CouponListScreen from "./pages/CouponListScreen";
import AutoPayScreen from "./pages/AutoPayScreen";
import HelpScreen from "./pages/HelpScreen";
import ComplaintListScreen from "./pages/ComplaintListScreen";
import TrackComplaintScreen from "./pages/TrackComplaintScreen";

const ThemedApp = ({ children }) => {
  const { theme } = useTheme();
  return <div className={`customer-modern-app${theme === "light" ? " theme-light" : ""}`}>{children}</div>;
};

const CustomerModernRoutes = () => {
  return (
    <ThemeProvider>
      <ThemedApp>
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
            <Route path="offers" element={<OfferScreen />} />
            <Route path="payment" element={<PaymentScreen />} />
            <Route path="success" element={<SuccessScreen />} />
            <Route path="wallet" element={<WalletScreen />} />
            <Route path="coupons" element={<CouponListScreen />} />
            <Route path="notifications" element={<NotificationsScreen />} />
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="file-complaint" element={<ComplaintScreen />} />
            <Route path="complaint" element={<ComplaintScreen />} />
            <Route path="complaints" element={<ComplaintListScreen />} />
            <Route path="track-complaint" element={<TrackComplaintScreen />} />
            <Route path="commission" element={<CommissionScreen />} />
            <Route path="referrals" element={<ReferralListScreen />} />
            <Route path="search-transaction" element={<SearchTransactionScreen />} />
            <Route path="history" element={<TransactionHistoryScreen />} />
            <Route path="my-dues" element={<MyDuesScreen />} />
            <Route path="my-coupons" element={<CouponListScreen />} />
            <Route path="autopay" element={<AutoPayScreen />} />
            <Route path="help" element={<HelpScreen />} />
            <Route path="*" element={<Navigate to="/customer/app/services" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/customer/login" replace />} />
        </Routes>
      </CustomerModernProvider>
      </ThemedApp>
    </ThemeProvider>
  );
};

export default CustomerModernRoutes;
