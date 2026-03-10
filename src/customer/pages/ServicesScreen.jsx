import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { serviceService } from "../services/serviceService";
import DataState from "../components/DataState";
import ServiceIcon from "../components/ServiceIcon";
import { normalizeService, toSerializableService } from "../components/serviceUtils";

const ServicesScreen = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const response = await serviceService.getAllServices();
      setLoading(false);
      if (!response.success) { setError(response.message); return; }
      setServices((Array.isArray(response.data) ? response.data : []).map(normalizeService));
    };
    load();
  }, []);

  const filtered = services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <DataState loading={loading} error={error} empty={filtered.length === 0 ? "No services matched your search." : null}>
      <div className="cm-stack">
        <div className="cm-card">
          <div className="cm-page-header">
            <h1>Service hub</h1>
            <p className="cm-page-subtitle">Modern access to prepaid, BBPS, dues, wallet and recurring payment flows.</p>
          </div>
          <div className="cm-search-wrap">
            <FaSearch />
            <input className="cm-input" placeholder="Search by service name" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="cm-service-grid">
          {filtered.map((service) => (
            <button key={service.id} className="cm-service-card" type="button"
              onClick={() => navigate(`/customer/app/services/${service.slug}`, { state: { service: toSerializableService(service) } })}>
              <ServiceIcon icon={service.icon} accentColor={service.accentColor} highlightColor={service.highlightColor} />
              <div className="cm-service-name">{service.name}</div>
            </button>
          ))}
        </div>
      </div>
    </DataState>
  );
};

export default ServicesScreen;
