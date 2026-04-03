import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import CustomerModernRoutes from "./customer/CustomerModernRoutes";

// Always use "/" as basename since app is deployed at root
const basename = "/";

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
