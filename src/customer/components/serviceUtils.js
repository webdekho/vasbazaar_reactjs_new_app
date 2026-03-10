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

const palette = ["#111111", "#ff7a00", "#00c2a8", "#f59e0b", "#0ea5e9", "#16a34a", "#ef4444"];

const serviceVisualMap = [
  { match: /(prepaid|postpaid|mobile|recharge|subscription)/i, icon: FiSmartphone, accent: "#4b5563", highlight: "#f59e0b" },
  { match: /(dth|cable\s*tv|ott)/i, icon: FiTv, accent: "#4b5563", highlight: "#14b8a6" },
  { match: /(electricity|power|light|ev\s*recharge|meter)/i, icon: FiZap, accent: "#374151", highlight: "#f59e0b" },
  { match: /(fast\s*tag|fleet\s*card|ncmc|travel\s*card)/i, icon: FiTruck, accent: "#374151", highlight: "#fb923c" },
  { match: /(credit\s*card|debit\s*card|card)/i, icon: FiCreditCard, accent: "#374151", highlight: "#f97316" },
  { match: /(landline|phone|calling)/i, icon: FiPhoneCall, accent: "#4b5563", highlight: "#fb923c" },
  { match: /(broadband|wifi|internet)/i, icon: FiWifi, accent: "#374151", highlight: "#38bdf8" },
  { match: /(water)/i, icon: FiDroplet, accent: "#4b5563", highlight: "#38bdf8" },
  { match: /(housing|society|rent|home|club|association)/i, icon: FiHome, accent: "#4b5563", highlight: "#f59e0b" },
  { match: /(piped\s*gas|lpg|gas)/i, icon: FaBroadcastTower, accent: "#374151", highlight: "#f97316" },
  { match: /(recurring|deposit|autopay|renewal)/i, icon: FiRefreshCw, accent: "#4b5563", highlight: "#f97316" },
  { match: /(loan|repay|emi|finance)/i, icon: FaMoneyBillWave, accent: "#374151", highlight: "#0ea5e9" },
  { match: /(donation|charity)/i, icon: FiHeart, accent: "#4b5563", highlight: "#ef4444" },
  { match: /(insurance|protection)/i, icon: FiShield, accent: "#4b5563", highlight: "#facc15" },
  { match: /(education|fees|school|college)/i, icon: FiBookOpen, accent: "#374151", highlight: "#f59e0b" },
  { match: /(municipal|tax|challan|bill|dues)/i, icon: FiFileText, accent: "#4b5563", highlight: "#ef4444" },
  { match: /(pension|agent\s*collection|society)/i, icon: FiUsers, accent: "#4b5563", highlight: "#14b8a6" },
  { match: /(wallet)/i, icon: FaWallet, accent: "#374151", highlight: "#0ea5e9" },
  { match: /(coupon|reward|gift)/i, icon: FaGift, accent: "#374151", highlight: "#f59e0b" },
  { match: /(monitor|tv|screen)/i, icon: FiMonitor, accent: "#4b5563", highlight: "#38bdf8" },
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

  return {
    id: service.id || slug,
    name: rawName,
    slug,
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
