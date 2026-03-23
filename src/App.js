import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import CustomerModernRoutes from "./customer/CustomerModernRoutes";

const RootRedirect = () => {
  const { search } = useLocation();
  return <Navigate to={`/customer${search}`} replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/customer/*" element={<CustomerModernRoutes />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
