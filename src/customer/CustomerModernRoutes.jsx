import { lazy as reactLazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./customerModern.css";
import { CustomerModernProvider } from "./context/CustomerModernContext";
import { MarketplaceCartProvider } from "./context/MarketplaceCartContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import AuthGuard from "./components/AuthGuard";
import ImpersonationBanner from "./components/ImpersonationBanner";
import AppLockGuard from "./components/AppLockGuard";
import OtaUpdateGate from "./components/OtaUpdateGate";
import { ChatbotProvider } from "./context/ChatbotContext";
import { customerStorage } from "./services/storageService";
import { ToastProvider } from "./context/ToastContext";

// Eager imports: auth screens + main landing page (always needed on startup)
import LoginScreen from "./pages/LoginScreen";
import ReferralScreen from "./pages/ReferralScreen";
import OtpScreen from "./pages/OtpScreen";
import ProtectedShell from "./pages/ProtectedShell";
import ServicesScreen from "./pages/ServicesScreen";

/**
 * Wraps `lazy()` so a ChunkLoadError (typically caused by a stale `bundle.js`
 * referencing chunk hashes that no longer exist on the dev server after a
 * rebuild) is recovered automatically: retry once, then force a full reload
 * exactly once per session.
 */
const RELOAD_FLAG = "__cm_chunk_reload";
const lazy = (factory) =>
  reactLazy(() =>
    factory().catch((err) => {
      const isChunkErr = err && (err.name === "ChunkLoadError" || /Loading chunk \S+ failed/.test(err.message || ""));
      if (!isChunkErr) throw err;
      return new Promise((resolve, reject) => {
        setTimeout(() => factory().then(resolve, (err2) => {
          if (typeof window === "undefined") return reject(err2);
          if (sessionStorage.getItem(RELOAD_FLAG)) return reject(err2);
          sessionStorage.setItem(RELOAD_FLAG, "1");
          window.location.reload();
        }), 500);
      });
    })
  );

if (typeof window !== "undefined") {
  window.addEventListener("load", () => sessionStorage.removeItem(RELOAD_FLAG));
}

/**
 * PERF FIX: Lazy-load all non-critical route pages.
 * Previously, all 28 pages were eagerly imported — the entire app code loaded upfront.
 * Now only 4 essential screens load immediately; the rest load on-demand.
 * This reduces initial bundle size by ~50-60%, making first paint much faster.
 */
const ServiceFlowScreen = lazy(() => import("./pages/ServiceFlowScreen"));
const OfferScreen = lazy(() => import("./pages/OfferScreen"));
const PaymentScreen = lazy(() => import("./pages/PaymentScreen"));
const SuccessScreen = lazy(() => import("./pages/SuccessScreen"));
const ReceiptScreen = lazy(() => import("./pages/ReceiptScreen"));
const PaymentResultPreview = lazy(() => import("./pages/PaymentResultPreview"));
const WalletScreen = lazy(() => import("./pages/WalletScreen"));
const NotificationsScreen = lazy(() => import("./pages/NotificationsScreen"));
const ProfileScreen = lazy(() => import("./pages/ProfileScreen"));
const ComplaintScreen = lazy(() => import("./pages/ComplaintScreen"));
const CommissionScreen = lazy(() => import("./pages/CommissionScreen"));
const ReferralListScreen = lazy(() => import("./pages/ReferralListScreen"));
const SearchTransactionScreen = lazy(() => import("./pages/SearchTransactionScreen"));
const TransactionHistoryScreen = lazy(() => import("./pages/TransactionHistoryScreen"));
const MyDuesScreen = lazy(() => import("./pages/MyDuesScreen"));
const CouponListScreen = lazy(() => import("./pages/CouponListScreen"));
const AutoPayScreen = lazy(() => import("./pages/AutoPayScreen"));
const AutoPayCallbackScreen = lazy(() => import("./pages/AutoPayCallbackScreen"));
const HelpScreen = lazy(() => import("./pages/HelpScreen"));
const TravelScreen = lazy(() => import("./pages/TravelScreen"));
const FlightResultsScreen = lazy(() => import("./pages/FlightResultsScreen"));
const FlightBookingScreen = lazy(() => import("./pages/FlightBookingScreen"));
const MyBookingsScreen = lazy(() => import("./pages/MyBookingsScreen"));
const ComplaintListScreen = lazy(() => import("./pages/ComplaintListScreen"));
const TrackComplaintScreen = lazy(() => import("./pages/TrackComplaintScreen"));
const JuspayCallbackScreen = lazy(() => import("./pages/JuspayCallbackScreen"));
const FailureScreen = lazy(() => import("./pages/FailureScreen"));
const KycScreen = lazy(() => import("./pages/KycScreen"));
const KycCallbackScreen = lazy(() => import("./pages/KycCallbackScreen"));
const QrStickerScreen = lazy(() => import("./pages/QrStickerScreen"));
const BBPSComplaintListScreen = lazy(() => import("./pages/BBPSComplaintListScreen"));
const OutstandingListScreen = lazy(() => import("./pages/outstanding/OutstandingListScreen"));
const CustomerLedgerScreen = lazy(() => import("./pages/outstanding/CustomerLedgerScreen"));
const ReminderQueueScreen = lazy(() => import("./pages/outstanding/ReminderQueueScreen"));
const SmsReminderListScreen = lazy(() => import("./pages/outstanding/SmsReminderListScreen"));
const InvoiceListScreen = lazy(() => import("./pages/outstanding/InvoiceListScreen"));
const CreateInvoiceScreen = lazy(() => import("./pages/outstanding/CreateInvoiceScreen"));
const InvoiceViewScreen = lazy(() => import("./pages/outstanding/InvoiceViewScreen"));
const BusinessProfileScreen = lazy(() => import("./pages/outstanding/BusinessProfileScreen"));
const RybboHomeScreen = lazy(() => import("./pages/rybbo/RybboHomeScreen"));
const RybboEventDetailScreen = lazy(() => import("./pages/rybbo/EventDetailScreen"));
const RybboSeatSelectionScreen = lazy(() => import("./pages/rybbo/SeatSelectionScreen"));
const RybboBookingSummaryScreen = lazy(() => import("./pages/rybbo/BookingSummaryScreen"));
const RybboBookingSuccessScreen = lazy(() => import("./pages/rybbo/BookingSuccessScreen"));
const RybboBookingResultScreen = lazy(() => import("./pages/rybbo/BookingResultScreen"));
const RybboMyBookingsScreen = lazy(() => import("./pages/rybbo/MyBookingsScreen"));
const RybboListYourShowScreen = lazy(() => import("./pages/rybbo/ListYourShowScreen"));
const RybboTicketDetailsScreen = lazy(() => import("./pages/rybbo/TicketDetailsScreen"));
const RybboQrScannerScreen = lazy(() => import("./pages/rybbo/QrScannerScreen"));
const RybboOrganizerEventsScreen = lazy(() => import("./pages/rybbo/OrganizerEventsScreen"));
const RybboEventScannersScreen = lazy(() => import("./pages/rybbo/EventScannersScreen"));
// RYBBO Social (private events & guest RSVP)
const RybboSocialHomeScreen = lazy(() => import("./pages/rybbo/social/SocialHomeScreen"));
const RybboSocialCreateScreen = lazy(() => import("./pages/rybbo/social/CreateEventScreen"));
const RybboSocialDashboardScreen = lazy(() => import("./pages/rybbo/social/EventDashboardScreen"));
const RybboGuestRsvpScreen = lazy(() => import("./pages/rybbo/social/GuestRsvpScreen"));
const RybboSocialScannerScreen = lazy(() => import("./pages/rybbo/social/SocialScannerScreen"));
// Resibot 360 (VasBazaar Life)
const ResibotDashboardScreen = lazy(() => import("./pages/resibot/ResibotDashboardScreen"));
const ResibotReminderListScreen = lazy(() => import("./pages/resibot/ResibotReminderListScreen"));
const ResibotReminderFormScreen = lazy(() => import("./pages/resibot/ResibotReminderFormScreen"));
const ResibotReminderDetailScreen = lazy(() => import("./pages/resibot/ResibotReminderDetailScreen"));
const ResibotHealthScreen = lazy(() => import("./pages/resibot/ResibotHealthScreen"));
const ResibotVitalScreen = lazy(() => import("./pages/resibot/ResibotVitalScreen"));
const ResibotMembersScreen = lazy(() => import("./pages/resibot/ResibotMembersScreen"));
const ResibotOrdersScreen = lazy(() => import("./pages/resibot/ResibotOrdersScreen"));
const ResibotExpenseScreen = lazy(() => import("./pages/resibot/ResibotExpenseScreen"));
const RebuddyHomeScreen = lazy(() => import("./pages/rebuddy/RebuddyHomeScreen"));
const RebuddyNewGroupScreen = lazy(() => import("./pages/rebuddy/NewGroupScreen"));
const RebuddyGroupDetailScreen = lazy(() => import("./pages/rebuddy/GroupDetailScreen"));
const RebuddyReportScreen = lazy(() => import("./pages/rebuddy/RebuddyReportScreen"));
const RentABookScreen = lazy(() => import("./pages/rentabook/RentABookScreen"));
const TermsScreen = lazy(() => import("./pages/TermsScreen"));

// Service Bazaar (hyperlocal services marketplace)
const ServiceBazaarHomeScreen = lazy(() => import("./pages/service-bazaar/ServiceBazaarHomeScreen"));
const ServiceBazaarProviderProfileScreen = lazy(() => import("./pages/service-bazaar/ProviderProfileScreen"));
const MyServiceBookingsScreen = lazy(() => import("./pages/service-bazaar/MyServiceBookingsScreen"));
const ServiceBookingDetailScreen = lazy(() => import("./pages/service-bazaar/ServiceBookingDetailScreen"));
const ServicePaymentCallbackScreen = lazy(() => import("./pages/service-bazaar/ServicePaymentCallbackScreen"));
const ServiceBazaarProviderHubScreen = lazy(() => import("./pages/service-bazaar/ProviderHubScreen"));

// Marketplace
const MarketplaceHomeScreen = lazy(() => import("./pages/marketplace/MarketplaceHomeScreen"));
const StoreDetailScreen = lazy(() => import("./pages/marketplace/StoreDetailScreen"));
const MarketplaceCartScreen = lazy(() => import("./pages/marketplace/CartScreen"));
const StoreOnboardingScreen = lazy(() => import("./pages/marketplace/StoreOnboardingScreen"));
const MyStoreManageScreen = lazy(() => import("./pages/marketplace/MyStoreManageScreen"));
const StoreTimingsScreen = lazy(() => import("./pages/marketplace/StoreTimingsScreen"));
const MyMarketplaceOrdersScreen = lazy(() => import("./pages/marketplace/MyOrdersScreen"));
const MarketplaceOrderDetailScreen = lazy(() => import("./pages/marketplace/OrderDetailScreen"));
const StoreOrdersScreen = lazy(() => import("./pages/marketplace/StoreOrdersScreen"));
const StoreOffersScreen = lazy(() => import("./pages/marketplace/StoreOffersScreen"));
const StoreAnalyticsScreen = lazy(() => import("./pages/marketplace/StoreAnalyticsScreen"));
const StoreReviewsScreen = lazy(() => import("./pages/marketplace/StoreReviewsScreen"));
const StoreKhataScreen = lazy(() => import("./pages/marketplace/StoreKhataScreen"));
const MyKhataScreen = lazy(() => import("./pages/marketplace/MyKhataScreen"));
const MySubscriptionsScreen = lazy(() => import("./pages/marketplace/MySubscriptionsScreen"));
const StoreDeliverySlotsScreen = lazy(() => import("./pages/marketplace/StoreDeliverySlotsScreen"));
const MarketplacePaymentCallbackScreen = lazy(() => import("./pages/marketplace/MarketplacePaymentCallbackScreen"));

/** Lightweight loading fallback for lazy-loaded routes */
const RouteFallback = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
    <div className="md-spinner" />
  </div>
);

const ThemedApp = ({ children }) => {
  const { theme } = useTheme();
  return <div className={`customer-modern-app${theme === "light" ? " theme-light" : ""}`}>{children}</div>;
};

const SmartRedirect = () => {
  const { search } = useLocation();
  // If user is logged in, redirect to app (AuthGuard + AppLockGuard will handle the rest)
  const sessionToken = customerStorage.getSessionToken();
  if (sessionToken) {
    return <Navigate to="/customer/app" replace />;
  }
  return <Navigate to={`/customer/login${search}`} replace />;
};

const CustomerModernRoutes = () => {
  return (
    <ThemeProvider>
      <ThemedApp>
      <ToastProvider>
      <CustomerModernProvider>
      <MarketplaceCartProvider>
        <OtaUpdateGate />
        <ImpersonationBanner />
        <Routes>
          <Route path="/" element={<SmartRedirect />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/referral" element={<ReferralScreen />} />
          <Route path="/verify-otp" element={<OtpScreen />} />
          <Route path="/terms" element={<Suspense fallback={<RouteFallback />}><TermsScreen /></Suspense>} />
          {/* Public, login-free shared ReBuddy group link. Rendered OUTSIDE the
              AuthGuard/ProtectedShell so the recipient sees only this one group
              (read-only, masked mobiles) and cannot reach any other page. */}
          <Route
            path="/rebuddy/group/:id"
            element={
              <Suspense fallback={<RouteFallback />}>
                <div className="customer-modern-protected" style={{ display: "block" }}>
                  <main className="cm-content" style={{ maxWidth: 720, margin: "0 auto", padding: "0 12px", minHeight: "100vh" }}>
                    <RebuddyGroupDetailScreen publicView />
                  </main>
                </div>
              </Suspense>
            }
          />
          {/* Public, login-free RYBBO Social invite + RSVP page. Rendered OUTSIDE
              the AuthGuard so an invited guest (who may not have a VasBazaar
              account) can view the invite and respond. */}
          <Route
            path="/rybbo/i/:token"
            element={
              <Suspense fallback={<RouteFallback />}>
                <div className="customer-modern-protected" style={{ display: "block" }}>
                  <RybboGuestRsvpScreen />
                </div>
              </Suspense>
            }
          />
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
            {/* PERF FIX: All routes below are wrapped in Suspense for lazy loading */}
            <Route path="services/:serviceSlug" element={<Suspense fallback={<RouteFallback />}><ServiceFlowScreen /></Suspense>} />
            <Route path="offers" element={<Suspense fallback={<RouteFallback />}><OfferScreen /></Suspense>} />
            <Route path="payment" element={<Suspense fallback={<RouteFallback />}><PaymentScreen /></Suspense>} />
            <Route path="qr" element={<Suspense fallback={<RouteFallback />}><QrStickerScreen /></Suspense>} />
            <Route path="payment-callback" element={<Suspense fallback={<RouteFallback />}><JuspayCallbackScreen /></Suspense>} />
            <Route path="success" element={<Suspense fallback={<RouteFallback />}><SuccessScreen /></Suspense>} />
            <Route path="receipt" element={<Suspense fallback={<RouteFallback />}><ReceiptScreen /></Suspense>} />
            <Route path="failure" element={<Suspense fallback={<RouteFallback />}><FailureScreen /></Suspense>} />
            <Route path="preview/:kind" element={<Suspense fallback={<RouteFallback />}><PaymentResultPreview /></Suspense>} />
            <Route path="wallet" element={<Suspense fallback={<RouteFallback />}><WalletScreen /></Suspense>} />
            <Route path="coupons" element={<Suspense fallback={<RouteFallback />}><CouponListScreen /></Suspense>} />
            <Route path="notifications" element={<Suspense fallback={<RouteFallback />}><NotificationsScreen /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<RouteFallback />}><ProfileScreen /></Suspense>} />
            <Route path="file-complaint" element={<Suspense fallback={<RouteFallback />}><ComplaintScreen /></Suspense>} />
            <Route path="complaint" element={<Suspense fallback={<RouteFallback />}><ComplaintScreen /></Suspense>} />
            <Route path="complaints" element={<Suspense fallback={<RouteFallback />}><ComplaintListScreen /></Suspense>} />
            <Route path="track-complaint" element={<Suspense fallback={<RouteFallback />}><TrackComplaintScreen /></Suspense>} />
            <Route path="commission" element={<Suspense fallback={<RouteFallback />}><CommissionScreen /></Suspense>} />
            <Route path="referrals" element={<Suspense fallback={<RouteFallback />}><ReferralListScreen /></Suspense>} />
            <Route path="search-transaction" element={<Suspense fallback={<RouteFallback />}><SearchTransactionScreen /></Suspense>} />
            <Route path="history" element={<Suspense fallback={<RouteFallback />}><TransactionHistoryScreen /></Suspense>} />
            <Route path="my-dues" element={<Suspense fallback={<RouteFallback />}><MyDuesScreen /></Suspense>} />
            <Route path="my-coupons" element={<Suspense fallback={<RouteFallback />}><CouponListScreen /></Suspense>} />
            <Route path="autopay" element={<Suspense fallback={<RouteFallback />}><AutoPayScreen /></Suspense>} />
            <Route path="autopay-callback" element={<Suspense fallback={<RouteFallback />}><AutoPayCallbackScreen /></Suspense>} />
            <Route path="help" element={<Suspense fallback={<RouteFallback />}><HelpScreen /></Suspense>} />
            <Route path="travel" element={<Suspense fallback={<RouteFallback />}><TravelScreen /></Suspense>} />
            <Route path="flight-results" element={<Suspense fallback={<RouteFallback />}><FlightResultsScreen /></Suspense>} />
            <Route path="flight-booking" element={<Suspense fallback={<RouteFallback />}><FlightBookingScreen /></Suspense>} />
            <Route path="my-bookings" element={<Suspense fallback={<RouteFallback />}><MyBookingsScreen /></Suspense>} />
            <Route path="kyc" element={<Suspense fallback={<RouteFallback />}><KycScreen /></Suspense>} />
            <Route path="kyc-callback" element={<Suspense fallback={<RouteFallback />}><KycCallbackScreen /></Suspense>} />
            <Route path="bbps-complaints" element={<Suspense fallback={<RouteFallback />}><BBPSComplaintListScreen /></Suspense>} />
            <Route path="outstanding" element={<Suspense fallback={<RouteFallback />}><OutstandingListScreen /></Suspense>} />
            <Route path="outstanding/reminders" element={<Suspense fallback={<RouteFallback />}><ReminderQueueScreen /></Suspense>} />
            <Route path="outstanding/sms-settings" element={<Suspense fallback={<RouteFallback />}><SmsReminderListScreen /></Suspense>} />
            <Route path="outstanding/business-profile" element={<Suspense fallback={<RouteFallback />}><BusinessProfileScreen /></Suspense>} />
            <Route path="outstanding/invoices" element={<Suspense fallback={<RouteFallback />}><InvoiceListScreen /></Suspense>} />
            <Route path="outstanding/:customerId" element={<Suspense fallback={<RouteFallback />}><CustomerLedgerScreen /></Suspense>} />
            <Route path="outstanding/:customerId/invoices" element={<Suspense fallback={<RouteFallback />}><InvoiceListScreen /></Suspense>} />
            <Route path="outstanding/:customerId/invoice/new" element={<Suspense fallback={<RouteFallback />}><CreateInvoiceScreen /></Suspense>} />
            <Route path="outstanding/:customerId/invoice/:invoiceId/edit" element={<Suspense fallback={<RouteFallback />}><CreateInvoiceScreen /></Suspense>} />
            <Route path="outstanding/:customerId/invoice/:invoiceId" element={<Suspense fallback={<RouteFallback />}><InvoiceViewScreen /></Suspense>} />
            <Route path="rybbo" element={<Suspense fallback={<RouteFallback />}><RybboHomeScreen /></Suspense>} />
            <Route path="rybbo/event/:slug" element={<Suspense fallback={<RouteFallback />}><RybboEventDetailScreen /></Suspense>} />
            <Route path="rybbo/event/:slug/seats" element={<Suspense fallback={<RouteFallback />}><RybboSeatSelectionScreen /></Suspense>} />
            <Route path="rybbo/event/:slug/summary" element={<Suspense fallback={<RouteFallback />}><RybboBookingSummaryScreen /></Suspense>} />
            <Route path="rybbo/booking-success/:bookingId" element={<Suspense fallback={<RouteFallback />}><RybboBookingSuccessScreen /></Suspense>} />
            <Route path="rybbo/booking-result" element={<Suspense fallback={<RouteFallback />}><RybboBookingResultScreen /></Suspense>} />
            <Route path="rybbo/my-bookings" element={<Suspense fallback={<RouteFallback />}><RybboMyBookingsScreen /></Suspense>} />
            <Route path="rybbo/list-your-show" element={<Suspense fallback={<RouteFallback />}><RybboListYourShowScreen /></Suspense>} />
            <Route path="rybbo/ticket/:bookingId" element={<Suspense fallback={<RouteFallback />}><RybboTicketDetailsScreen /></Suspense>} />
            <Route path="rybbo/scan" element={<Suspense fallback={<RouteFallback />}><RybboQrScannerScreen /></Suspense>} />
            <Route path="rybbo/organizer/events" element={<Suspense fallback={<RouteFallback />}><RybboOrganizerEventsScreen /></Suspense>} />
            <Route path="rybbo/organizer/events/:id/scanners" element={<Suspense fallback={<RouteFallback />}><RybboEventScannersScreen /></Suspense>} />
            {/* RYBBO Social (private events & guest RSVP) */}
            <Route path="rybbo/social" element={<Suspense fallback={<RouteFallback />}><RybboSocialHomeScreen /></Suspense>} />
            <Route path="rybbo/social/create" element={<Suspense fallback={<RouteFallback />}><RybboSocialCreateScreen /></Suspense>} />
            <Route path="rybbo/social/event/:id" element={<Suspense fallback={<RouteFallback />}><RybboSocialDashboardScreen /></Suspense>} />
            <Route path="rybbo/social/event/:id/edit" element={<Suspense fallback={<RouteFallback />}><RybboSocialCreateScreen /></Suspense>} />
            <Route path="rybbo/social/event/:id/scan" element={<Suspense fallback={<RouteFallback />}><RybboSocialScannerScreen /></Suspense>} />
            {/* Resibot 360 (VasBazaar Life) */}
            <Route path="resibot" element={<Suspense fallback={<RouteFallback />}><ResibotDashboardScreen /></Suspense>} />
            <Route path="resibot/reminder/new" element={<Suspense fallback={<RouteFallback />}><ResibotReminderFormScreen /></Suspense>} />
            <Route path="resibot/reminder/:id/edit" element={<Suspense fallback={<RouteFallback />}><ResibotReminderFormScreen /></Suspense>} />
            <Route path="resibot/reminder/:id" element={<Suspense fallback={<RouteFallback />}><ResibotReminderDetailScreen /></Suspense>} />
            <Route path="resibot/reminders" element={<Suspense fallback={<RouteFallback />}><ResibotReminderListScreen /></Suspense>} />
            <Route path="resibot/reminders/:module" element={<Suspense fallback={<RouteFallback />}><ResibotReminderListScreen /></Suspense>} />
            <Route path="resibot/health" element={<Suspense fallback={<RouteFallback />}><ResibotHealthScreen /></Suspense>} />
            <Route path="resibot/health/vital/:type" element={<Suspense fallback={<RouteFallback />}><ResibotVitalScreen /></Suspense>} />
            <Route path="resibot/members" element={<Suspense fallback={<RouteFallback />}><ResibotMembersScreen /></Suspense>} />
            <Route path="resibot/orders" element={<Suspense fallback={<RouteFallback />}><ResibotOrdersScreen /></Suspense>} />
            <Route path="resibot/expenses" element={<Suspense fallback={<RouteFallback />}><ResibotExpenseScreen /></Suspense>} />
            <Route path="rebuddy" element={<Suspense fallback={<RouteFallback />}><RebuddyHomeScreen /></Suspense>} />
            <Route path="rebuddy/new" element={<Suspense fallback={<RouteFallback />}><RebuddyNewGroupScreen /></Suspense>} />
            <Route path="rebuddy/report" element={<Suspense fallback={<RouteFallback />}><RebuddyReportScreen /></Suspense>} />
            <Route path="rebuddy/group/:id" element={<Suspense fallback={<RouteFallback />}><RebuddyGroupDetailScreen /></Suspense>} />
            <Route path="rentabook" element={<Suspense fallback={<RouteFallback />}><RentABookScreen /></Suspense>} />
            {/* Service Bazaar (hyperlocal services marketplace) */}
            <Route path="service-bazaar" element={<Suspense fallback={<RouteFallback />}><ServiceBazaarHomeScreen /></Suspense>} />
            <Route path="service-bazaar/provider" element={<Suspense fallback={<RouteFallback />}><ServiceBazaarProviderHubScreen /></Suspense>} />
            <Route path="service-bazaar/provider/:providerId" element={<Suspense fallback={<RouteFallback />}><ServiceBazaarProviderProfileScreen /></Suspense>} />
            <Route path="service-bazaar/my-bookings" element={<Suspense fallback={<RouteFallback />}><MyServiceBookingsScreen /></Suspense>} />
            <Route path="service-bazaar/bookings/:bookingId" element={<Suspense fallback={<RouteFallback />}><ServiceBookingDetailScreen /></Suspense>} />
            <Route path="service-bazaar/payment-callback" element={<Suspense fallback={<RouteFallback />}><ServicePaymentCallbackScreen /></Suspense>} />
            {/* Marketplace */}
            <Route path="marketplace" element={<Suspense fallback={<RouteFallback />}><MarketplaceHomeScreen /></Suspense>} />
            <Route path="marketplace/store/:storeId" element={<Suspense fallback={<RouteFallback />}><StoreDetailScreen /></Suspense>} />
            <Route path="marketplace/cart" element={<Suspense fallback={<RouteFallback />}><MarketplaceCartScreen /></Suspense>} />
            <Route path="marketplace/onboard" element={<Suspense fallback={<RouteFallback />}><StoreOnboardingScreen /></Suspense>} />
            <Route path="marketplace/my-store" element={<Suspense fallback={<RouteFallback />}><MyStoreManageScreen /></Suspense>} />
            <Route path="marketplace/my-store/timings" element={<Suspense fallback={<RouteFallback />}><StoreTimingsScreen /></Suspense>} />
            <Route path="marketplace/my-store/delivery-slots" element={<Suspense fallback={<RouteFallback />}><StoreDeliverySlotsScreen /></Suspense>} />
            <Route path="marketplace/my-orders" element={<Suspense fallback={<RouteFallback />}><MyMarketplaceOrdersScreen /></Suspense>} />
            <Route path="marketplace/orders/:orderId" element={<Suspense fallback={<RouteFallback />}><MarketplaceOrderDetailScreen /></Suspense>} />
            <Route path="marketplace/store-orders" element={<Suspense fallback={<RouteFallback />}><StoreOrdersScreen /></Suspense>} />
            <Route path="marketplace/my-store/offers" element={<Suspense fallback={<RouteFallback />}><StoreOffersScreen /></Suspense>} />
            <Route path="marketplace/my-store/analytics" element={<Suspense fallback={<RouteFallback />}><StoreAnalyticsScreen /></Suspense>} />
            <Route path="marketplace/my-store/reviews" element={<Suspense fallback={<RouteFallback />}><StoreReviewsScreen /></Suspense>} />
            <Route path="marketplace/my-store/khata" element={<Suspense fallback={<RouteFallback />}><StoreKhataScreen /></Suspense>} />
            <Route path="marketplace/my-khata" element={<Suspense fallback={<RouteFallback />}><MyKhataScreen /></Suspense>} />
            <Route path="marketplace/subscriptions" element={<Suspense fallback={<RouteFallback />}><MySubscriptionsScreen /></Suspense>} />
            <Route path="marketplace/payment-callback" element={<Suspense fallback={<RouteFallback />}><MarketplacePaymentCallbackScreen /></Suspense>} />
            <Route path="*" element={<Navigate to="/customer/app/services" replace />} />
          </Route>
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </MarketplaceCartProvider>
      </CustomerModernProvider>
      </ToastProvider>
      </ThemedApp>
    </ThemeProvider>
  );
};

export default CustomerModernRoutes;
