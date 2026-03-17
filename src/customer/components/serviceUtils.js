import {
  FaBroadcastTower,
  FaGift,
  FaMoneyBillWave,
  FaWallet,
} from "react-icons/fa";
import {
  FiBookOpen,
  FiCreditCard,
  FiDroplet,
  FiFileText,
  FiHeart,
  FiHome,
  FiMonitor,
  FiPhoneCall,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
  FiTruck,
  FiTv,
  FiUsers,
  FiWifi,
  FiZap,
} from "react-icons/fi";
import { HiMiniSquares2X2 } from "react-icons/hi2";

const palette = ["#40E0D0", "#007BFF", "#00C853", "#FF9800", "#B0B0B0", "#40E0D0", "#007BFF"];

const serviceVisualMap = [
  { match: /(prepaid|postpaid|mobile|recharge|subscription)/i, icon: FiSmartphone, accent: "#B0B0B0", highlight: "#40E0D0" },
  { match: /(dth|cable\s*tv|ott)/i, icon: FiTv, accent: "#B0B0B0", highlight: "#007BFF" },
  { match: /(electricity|power|light|ev\s*recharge|meter)/i, icon: FiZap, accent: "#B0B0B0", highlight: "#FF9800" },
  { match: /(fast\s*tag|fleet\s*card|ncmc|travel\s*card)/i, icon: FiTruck, accent: "#B0B0B0", highlight: "#40E0D0" },
  { match: /(credit\s*card|debit\s*card|card)/i, icon: FiCreditCard, accent: "#B0B0B0", highlight: "#007BFF" },
  { match: /(landline|phone|calling)/i, icon: FiPhoneCall, accent: "#B0B0B0", highlight: "#40E0D0" },
  { match: /(broadband|wifi|internet)/i, icon: FiWifi, accent: "#B0B0B0", highlight: "#007BFF" },
  { match: /(water)/i, icon: FiDroplet, accent: "#B0B0B0", highlight: "#007BFF" },
  { match: /(housing|society|rent|home|club|association)/i, icon: FiHome, accent: "#B0B0B0", highlight: "#40E0D0" },
  { match: /(piped\s*gas|lpg|gas)/i, icon: FaBroadcastTower, accent: "#B0B0B0", highlight: "#FF9800" },
  { match: /(recurring|deposit|autopay|renewal)/i, icon: FiRefreshCw, accent: "#B0B0B0", highlight: "#40E0D0" },
  { match: /(loan|repay|emi|finance)/i, icon: FaMoneyBillWave, accent: "#B0B0B0", highlight: "#007BFF" },
  { match: /(donation|charity)/i, icon: FiHeart, accent: "#B0B0B0", highlight: "#FF3B30" },
  { match: /(insurance|protection)/i, icon: FiShield, accent: "#B0B0B0", highlight: "#00C853" },
  { match: /(education|fees|school|college)/i, icon: FiBookOpen, accent: "#B0B0B0", highlight: "#FF9800" },
  { match: /(municipal|tax|challan|bill|dues)/i, icon: FiFileText, accent: "#B0B0B0", highlight: "#FF3B30" },
  { match: /(pension|agent\s*collection|society)/i, icon: FiUsers, accent: "#B0B0B0", highlight: "#40E0D0" },
  { match: /(wallet)/i, icon: FaWallet, accent: "#B0B0B0", highlight: "#007BFF" },
  { match: /(coupon|reward|gift)/i, icon: FaGift, accent: "#B0B0B0", highlight: "#FF9800" },
  { match: /(monitor|tv|screen)/i, icon: FiMonitor, accent: "#B0B0B0", highlight: "#007BFF" },
];

export const getServiceVisual = (rawName, index = 0) => {
  const matched = serviceVisualMap.find((entry) => entry.match.test(rawName));

  return {
    icon: matched?.icon || HiMiniSquares2X2,
    accentColor: matched?.accent || "#374151",
    highlightColor: matched?.highlight || palette[index % palette.length],
  };
};

export const normalizeService = (service, index) => {
  const rawName = service.serviceName || service.name || "Service";
  const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const visual = getServiceVisual(rawName, index);

  // Preserve backend image URL (icon field from API)
  const apiIcon = service.icon || service.image || service.logo || service.thumbnail || "";
  const hasApiImage = typeof apiIcon === "string" && apiIcon.startsWith("http");

  return {
    id: service.id || slug,
    name: rawName,
    slug,
    iconUrl: hasApiImage ? apiIcon : null,
    icon: visual.icon,
    accentColor: visual.accentColor,
    highlightColor: visual.highlightColor,
    priority: service.priority || index,
    original: service,
  };
};

export const toSerializableService = ({ icon, ...rest }) => rest;

export const extractSessionToken = (data) =>
  (typeof data === "string" ? data : null) ||
  data?.token ||
  data?.access_token ||
  data?.sessionToken ||
  data?.session_token ||
  data?.permanentToken ||
  null;
