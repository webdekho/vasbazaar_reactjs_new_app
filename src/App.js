import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import CustomerModernRoutes from "./customer/CustomerModernRoutes";

function App() {
  return (
    <BrowserRouter basename="/vasbazaar">
      <Routes>
        <Route path="/customer/*" element={<CustomerModernRoutes />} />
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
