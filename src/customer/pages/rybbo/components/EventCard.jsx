import { useState } from "react";
import { FaStar, FaMapMarkerAlt, FaRegImage } from "react-icons/fa";

const formatEventDate = (value) => {
  if (!value) return "";
  const [datePart] = String(value).split("T");
  const parts = datePart.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", { month: "long" });
  return `${day}-${monthName}-${year}`;
};

const EventCard = ({ event, onClick, layout = "vertical" }) => {
  const isHorizontal = layout === "horizontal";
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!event.poster && !imgFailed;
  const displayDate = formatEventDate(event.date);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rybbo-event-card${isHorizontal ? " rybbo-event-card--horizontal" : ""}`}
    >
      <div className="rybbo-event-media">
        {hasImage ? (
          <img
            src={event.poster} alt={event.title} onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            aria-label={event.title}
            className="rybbo-event-fallback"
          >
            <FaRegImage />
            <span>
              {event.title}
            </span>
          </div>
        )}
        {event.featured && (
          <span className="rybbo-event-badge">
            FEATURED
          </span>
        )}
      </div>
      <div className="rybbo-event-body">
        <div className="rybbo-event-meta">
          <FaStar /> {event.rating || "New"} <span>{event.type}</span>
        </div>
        <div className="rybbo-event-title">
          {event.title}
        </div>
        <div className="rybbo-event-place">
          <FaMapMarkerAlt /> {event.venue}, {event.city}
        </div>
        <div className="rybbo-event-foot">
          <span>₹{event.minPrice} onwards</span>
          <time>{displayDate}</time>
        </div>
      </div>
    </button>
  );
};

export default EventCard;
