import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./customerModern.css";
import { CustomerModernProvider } from "./context/CustomerModernContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import AuthGuard from "./components/AuthGuard";
import AppLockGuard from "./components/AppLockGuard";
import { ChatbotProvider } from "./context/ChatbotContext";
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
import AutoPayCallbackScreen from "./pages/AutoPayCallbackScreen";
import HelpScreen from "./pages/HelpScreen";
import TravelScreen from "./pages/TravelScreen";
import FlightResultsScreen from "./pages/FlightResultsScreen";
import FlightBookingScreen from "./pages/FlightBookingScreen";
import MyBookingsScreen from "./pages/MyBookingsScreen";
import ComplaintListScreen from "./pages/ComplaintListScreen";
import TrackComplaintScreen from "./pages/TrackComplaintScreen";
import JuspayCallbackScreen from "./pages/JuspayCallbackScreen";
import FailureScreen from "./pages/FailureScreen";
import KycScreen from "./pages/KycScreen";
import KycCallbackScreen from "./pages/KycCallbackScreen";

const ThemedApp = ({ children }) => {
  const { theme } = useTheme();
  return <div className={`customer-modern-app${theme === "light" ? " theme-light" : ""}`}>{children}</div>;
};

const LoginRedirect = () => {
  const { search } = useLocation();
  return <Navigate to={`/customer/login${search}`} replace />;
};

const CustomerModernRoutes = () => {
  return (
    <ThemeProvider>
      <ThemedApp>
      <CustomerModernProvider>
        <Routes>
          <Route path="/" element={<LoginRedirect />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/verify-otp" element={<OtpScreen />} />
          <Route
            path="/app"
            element={
              <AuthGuard>
                <AppLockGuard>
                  <ChatbotProvider>
                    <ProtectedShell />
                  </ChatbotProvider>
                </AppLockGuard>
              </AuthGuard>
            }
          >
            <Route index element={<ServicesScreen />} />
            <Route path="services" element={<ServicesScreen />} />
            <Route path="services/:serviceSlug" element={<ServiceFlowScreen />} />
            <Route path="offers" element={<OfferScreen />} />
            <Route path="payment" element={<PaymentScreen />} />
            <Route path="payment-callback" element={<JuspayCallbackScreen />} />
            <Route path="success" element={<SuccessScreen />} />
            <Route path="failure" element={<FailureScreen />} />
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
            <Route path="autopay-callback" element={<AutoPayCallbackScreen />} />
            <Route path="help" element={<HelpScreen />} />
            <Route path="travel" element={<TravelScreen />} />
            <Route path="flight-results" element={<FlightResultsScreen />} />
            <Route path="flight-booking" element={<FlightBookingScreen />} />
            <Route path="my-bookings" element={<MyBookingsScreen />} />
            <Route path="kyc" element={<KycScreen />} />
            <Route path="kyc-callback" element={<KycCallbackScreen />} />
            <Route path="*" element={<Navigate to="/customer/app/services" replace />} />
          </Route>
          <Route path="*" element={<LoginRedirect />} />
        </Routes>
      </CustomerModernProvider>
      </ThemedApp>
    </ThemeProvider>
  );
};

export default CustomerModernRoutes;
