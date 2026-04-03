import { BrowserRouter, Route, Routes, Navigate, useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import CustomerModernRoutes from "./customer/CustomerModernRoutes";

// Always use "/" as basename since app is deployed at root
const basename = "/";

// Redirect component that preserves query params
const RedirectWithParams = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const redirectUrl = code ? `/customer/login?code=${code}` : "/customer";
  return <Navigate to={redirectUrl} replace />;
};

function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/customer/*" element={<CustomerModernRoutes />} />
        <Route path="*" element={<RedirectWithParams />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
