import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import CustomerModernRoutes from "./customer/CustomerModernRoutes";

// Use no basename for native apps, "/vasbazaar" for web
const basename = Capacitor.isNativePlatform() ? "/" : "/vasbazaar";

function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/customer/*" element={<CustomerModernRoutes />} />
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
