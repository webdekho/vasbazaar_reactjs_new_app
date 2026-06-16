import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChartBar } from "react-icons/fa";
import "./marketplace.css";

const StoreAnalyticsScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="marketplace-screen">
      <div className="marketplace-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <h1>Store Analytics</h1>
      </div>
      <div className="marketplace-content" style={{ padding: "2rem", textAlign: "center" }}>
        <FaChartBar size={48} style={{ color: "#94a3b8", marginBottom: "1rem" }} />
        <p style={{ color: "#64748b" }}>Analytics coming soon</p>
      </div>
    </div>
  );
};

export default StoreAnalyticsScreen;
