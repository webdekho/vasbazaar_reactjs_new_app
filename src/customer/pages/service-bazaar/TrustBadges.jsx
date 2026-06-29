import { FaStar, FaCheckCircle, FaBolt, FaMedal, FaCrown, FaShieldAlt } from "react-icons/fa";

/**
 * Provider trust visuals shared by the profile and discovery cards.
 * - TierChip: admin-set verification ladder (Bronze/Silver/Gold/Verified Pro).
 * - TrustBadges: read-time computed badges (Verified, Top Rated, Most Booked, ...).
 */

const TIERS = {
  BRONZE: { label: "Bronze", cls: "bronze", icon: FaShieldAlt },
  SILVER: { label: "Silver", cls: "silver", icon: FaMedal },
  GOLD: { label: "Gold", cls: "gold", icon: FaMedal },
  VERIFIED_PRO: { label: "Verified Pro", cls: "pro", icon: FaCrown },
};

const BADGES = {
  VERIFIED: { label: "Verified", icon: FaCheckCircle },
  TOP_RATED: { label: "Top Rated", icon: FaStar },
  MOST_BOOKED: { label: "Most Booked", icon: FaBolt },
  EXPERIENCED: { label: "Experienced", icon: FaMedal },
  FEATURED: { label: "Featured", icon: FaCrown },
};

export function TierChip({ level, size }) {
  const t = TIERS[level];
  if (!t || level === "BRONZE") return null; // bronze is the unremarkable baseline
  const Icon = t.icon;
  return (
    <span className={`sb-tier ${t.cls} ${size === "sm" ? "sm" : ""}`}>
      <Icon style={{ marginRight: 3, fontSize: size === "sm" ? 9 : 11 }} />{t.label}
    </span>
  );
}

export function TrustBadges({ badges, max }) {
  if (!Array.isArray(badges) || badges.length === 0) return null;
  const shown = max ? badges.slice(0, max) : badges;
  return (
    <div className="sb-badges">
      {shown.map((b) => {
        const meta = BADGES[b];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span className={`sb-badge trust ${b.toLowerCase()}`} key={b}>
            <Icon style={{ marginRight: 3, fontSize: 10 }} />{meta.label}
          </span>
        );
      })}
    </div>
  );
}
