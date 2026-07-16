import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import CustomerModernRoutes from "./customer/CustomerModernRoutes";
import ErrorBoundary from "./customer/components/ErrorBoundary";

const RootRedirect = () => {
  const { search } = useLocation();
  return <Navigate to={`/customer${search}`} replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/customer/*" element={<CustomerModernRoutes />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
