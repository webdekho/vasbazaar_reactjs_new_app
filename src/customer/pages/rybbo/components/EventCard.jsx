import { useState } from "react";
import { FaStar, FaMapMarkerAlt, FaRegImage } from "react-icons/fa";

const EventCard = ({ event, onClick, layout = "vertical" }) => {
  const isHorizontal = layout === "horizontal";
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!event.poster && !imgFailed;
  const imgHeight = isHorizontal ? 140 : 220;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", flexDirection: isHorizontal ? "row" : "column", gap: 12,
        background: "var(--cm-card, #FFFFFF)", border: "1px solid var(--cm-line, #E5E7EB)",
        borderRadius: 14, padding: isHorizontal ? 10 : 0, textAlign: "left", cursor: "pointer",
        width: "100%", overflow: "hidden", color: "inherit",
      }}
    >
      <div style={{ position: "relative", width: isHorizontal ? 110 : "100%", flexShrink: 0 }}>
        {hasImage ? (
          <img
            src={event.poster} alt={event.title} onError={() => setImgFailed(true)}
            style={{ width: "100%", height: imgHeight, objectFit: "cover", borderRadius: isHorizontal ? 10 : "14px 14px 0 0", display: "block" }}
          />
        ) : (
          <div
            aria-label={event.title}
            style={{
              width: "100%", height: imgHeight, borderRadius: isHorizontal ? 10 : "14px 14px 0 0",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              background: "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)", color: "#FFFFFF",
              padding: 10, textAlign: "center",
            }}
          >
            <FaRegImage size={isHorizontal ? 22 : 32} style={{ opacity: 0.9 }} />
            <span style={{ fontSize: isHorizontal ? 11 : 13, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {event.title}
            </span>
          </div>
        )}
        {event.featured && (
          <span style={{ position: "absolute", top: 8, left: 8, background: "#7C3AED", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, letterSpacing: 0.4 }}>
            FEATURED
          </span>
        )}
      </div>
      <div style={{ padding: isHorizontal ? "0 10px 0 0" : "10px 12px 14px", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#F4A261", fontWeight: 600, marginBottom: 4 }}>
          <FaStar size={11} /> {event.rating || "—"} <span style={{ color: "var(--cm-muted, #6B7280)" }}>· {event.type}</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {event.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--cm-muted, #6B7280)", marginBottom: 8 }}>
          <FaMapMarkerAlt size={10} /> {event.venue}, {event.city}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#007BFF", whiteSpace: "nowrap" }}>₹{event.minPrice} onwards</span>
          <span style={{ fontSize: 11, color: "var(--cm-muted, #6B7280)", whiteSpace: "nowrap" }}>{event.date}</span>
        </div>
      </div>
    </button>
  );
};

export default EventCard;
