import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaPhone, FaWhatsapp, FaEnvelope, FaComments,
  FaChevronDown, FaChevronRight, FaExclamationCircle, FaHeadset, FaHeart, FaRobot
} from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";
import { useChatbot } from "../context/ChatbotContext";
import { openTawkChat } from "../utils/tawk";

const faqs = [
  { q: "How to book gas?", a: "Go to Services > Gas Booking and select your provider to book a gas cylinder." },
  { q: "Are there delivery charges?", a: "Delivery charges depend on your provider and location. Check during booking." },
  { q: "How to track my payment?", a: "Go to Transaction History from the sidebar to track all payments." },
  { q: "How do payments work?", a: "Payments are processed through your wallet balance. Add money via UPI or bank transfer." },
  { q: "Can I cancel a transaction?", a: "Completed transactions cannot be cancelled. File a complaint for disputed transactions." },
  { q: "How to file a complaint?", a: "Go to File Complaint from the sidebar menu or contact our support team." },
  { q: "What if I receive a defective service?", a: "File a complaint immediately with transaction details for quick resolution." },
  { q: "How to update my address?", a: "Go to Profile from the sidebar and update your details." },
];

const HelpScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { openPanel: openChatbotPanel } = useChatbot();
  const [expanded, setExpanded] = useState(null);

  const contactCards = [
    { icon: <FaPhone />, label: "Call Support", sub: "+91 9522221213", action: () => window.open("tel:+919522221213"), color: "#00C853" },
    { icon: <FaWhatsapp />, label: "WhatsApp Chat", sub: "Quick assistance", action: () => window.open("https://api.whatsapp.com/send/?phone=919522221213&text&type=phone_number&app_absent=0", "_blank"), color: "#25D366" },
    { icon: <FaEnvelope />, label: "Email Support", sub: "support@vasbazaar.com", action: () => window.open("mailto:support@vasbazaar.com"), color: "#FF9800" },
    { icon: <FaComments />, label: "Live Chat", sub: "Chat with our agents", action: openTawkChat, color: "#007BFF" },
    { icon: <FaRobot />, label: "AI Chat", sub: "Ask our VasBazaar assistant", action: openChatbotPanel, color: "#9333EA" },
  ];

  return (
    <div className="hp-page">
      {/* Header */}
      <div className="hp-header">
        <button className="hp-back" type="button" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <div className="hp-header-text">
          <h1 className="hp-title">Help & Support</h1>
          <p className="hp-subtitle">We're here to help</p>
        </div>
      </div>

      {/* Hero card */}
      <div className="hp-hero">
        <div className="hp-hero-bg" />
        <div className="hp-hero-content">
          <div className="hp-hero-icon"><FaHeadset /></div>
          <div>
            <div className="hp-hero-title">Need assistance?</div>
            <div className="hp-hero-desc">Reach out to us through any channel below</div>
          </div>
        </div>
      </div>

      {/* Contact cards */}
      <div className="hp-section">
        <h3 className="hp-section-title">Contact Us</h3>
        <div className="hp-contacts">
          {contactCards.map((c) => (
            <button key={c.label} type="button" className="hp-contact" onClick={c.action}>
              <div className="hp-contact-icon" style={{ "--hp-color": c.color }}>
                {c.icon}
              </div>
              <div className="hp-contact-info">
                <div className="hp-contact-label">{c.label}</div>
                <div className="hp-contact-sub">{c.sub}</div>
              </div>
              <FaChevronRight className="hp-contact-arrow" />
            </button>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="hp-section">
        <h3 className="hp-section-title">Frequently Asked Questions</h3>
        <div className="hp-faq-list">
          {faqs.map((faq, i) => {
            const isOpen = expanded === i;
            return (
              <div key={i} className={`hp-faq${isOpen ? " is-open" : ""}`}>
                <button type="button" className="hp-faq-q" onClick={() => setExpanded(isOpen ? null : i)}>
                  <span className="hp-faq-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hp-faq-text">{faq.q}</span>
                  <FaChevronDown className={`hp-faq-chevron${isOpen ? " is-open" : ""}`} />
                </button>
                {isOpen && <div className="hp-faq-a">{faq.a}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Register complaint */}
      <div className="hp-section">
        <h3 className="hp-section-title">More Help</h3>
        <button type="button" className="hp-complaint-btn" onClick={() => navigate("/customer/app/file-complaint")}>
          <div className="hp-complaint-icon"><FaExclamationCircle /></div>
          <div className="hp-contact-info">
            <div className="hp-contact-label">Register Complaint</div>
            <div className="hp-contact-sub">File a BBPS complaint</div>
          </div>
          <FaChevronRight className="hp-contact-arrow" />
        </button>
      </div>

      {/* Footer */}
      <div className="hp-footer">
        <img src={theme === "light" ? "/images/vasbazaar-light.png" : "/images/vasbazaar-dark.png"} alt="VasBazaar" className="hp-footer-logo" />
        <span>VasBazaar v1.0.0</span>
        <span className="hp-footer-heart">Made with <FaHeart /> in India</span>
      </div>
    </div>
  );
};

export default HelpScreen;
