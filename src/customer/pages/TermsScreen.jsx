import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";

const SECTIONS = [
  {
    title: "1. 🏢 Introduction",
    body: [
      "Welcome to Vas Payment Solutions Private Limited (\"Company\", \"we\", \"our\", \"us\").",
      "By accessing or using the VasBazaar platform (website, mobile application, or services), you agree to be bound by these Terms & Conditions.",
      "If you do not agree, please do not use the platform.",
    ],
  },
  {
    title: "2. 👤 Eligibility",
    list: [
      "You must be 18 years or older",
      "You must provide accurate and complete information",
      "You must comply with all applicable laws and regulations in India",
    ],
  },
  {
    title: "3. 📱 Services Offered",
    body: ["VasBazaar provides:"],
    list: [
      "Mobile & DTH Recharge",
      "Bill Payments (Electricity, Gas, Water, etc.)",
      "UPI-based Payments",
      "Cashback & Reward Programs",
      "Referral-based earning models",
      "Wallet services (if enabled)",
    ],
  },
  {
    title: "4. 🔐 User Account & Security",
    list: [
      "You are responsible for maintaining confidentiality of login credentials and OTPs",
      "Do not share OTP or PIN with anyone",
      "Company is not liable for unauthorized transactions due to user negligence",
    ],
  },
  {
    title: "5. 💳 Payments & Transactions",
    list: [
      "All payments are processed via authorized banking/payment partners",
      "Transactions once initiated cannot be reversed unless failed",
      "In case of failure, refunds will be processed within 5–7 working days",
      "UPI payments are governed by National Payments Corporation of India guidelines",
    ],
  },
  {
    title: "6. 🎁 Cashback & Rewards Policy",
    list: [
      "Cashback is subject to offer terms",
      "Cashback may be instant OR credited later (T+X basis)",
      "Company reserves the right to modify or withdraw offers anytime",
      "Fraudulent activity will result in cancellation of rewards and account suspension",
    ],
  },
  {
    title: "7. 🔗 Referral Program",
    list: [
      "Users can refer others and earn rewards",
      "Referral must be genuine",
      "Fake/self referrals are strictly prohibited",
      "Company reserves the right to reverse earnings in case of misuse",
    ],
  },
  {
    title: "8. 🚫 Prohibited Activities",
    body: ["Users must NOT:"],
    list: [
      "Use the platform for illegal transactions",
      "Attempt fraud, hacking, or system manipulation",
      "Use bots, automation, or exploit loopholes",
      "Provide false identity information",
    ],
    footerBody: ["Violation may result in immediate account suspension and legal action."],
  },
  {
    title: "9. 🏦 Third-Party Services",
    list: [
      "Payments may involve banks, UPI apps, and gateways",
      "Company is not responsible for bank downtime or UPI app failures",
      "Services are dependent on partners like National Payments Corporation of India and partner banks (e.g., HDFC, etc.)",
    ],
  },
  {
    title: "10. ⚠️ Limitation of Liability",
    body: ["Company shall NOT be liable for:"],
    list: [
      "Transaction delays due to bank/network issues",
      "Loss due to incorrect details entered by user",
      "Technical errors beyond control",
    ],
    footerBody: ["Maximum liability is limited to the transaction amount."],
  },
  {
    title: "11. 🔒 Privacy & Data Protection",
    list: [
      "User data is encrypted and securely stored",
      "Company will NOT share data with third parties without consent",
      "Users should NOT share bank account details, OTPs, or sensitive personal information",
    ],
  },
  {
    title: "12. ⛔ Account Suspension / Termination",
    body: ["Company may suspend or terminate an account if:"],
    list: [
      "Suspicious activity is detected",
      "Terms are violated",
      "Required by regulation",
    ],
  },
  {
    title: "13. 🧾 Refund & Cancellation Policy",
    list: [
      "Failed transactions → auto refund",
      "Successful transactions → no cancellation",
      "Refund timelines depend on bank and payment mode",
    ],
  },
  {
    title: "14. 📢 Communication Consent",
    body: ["By using the platform, you agree to receive:"],
    list: [
      "SMS / WhatsApp updates",
      "App notifications",
      "Transaction alerts",
    ],
    footerBody: ["Users can opt-out where applicable."],
  },
  {
    title: "15. ⚖️ Governing Law",
    list: [
      "These terms are governed by the laws of India",
      "Jurisdiction: Courts of Maharashtra",
    ],
  },
  {
    title: "16. 🔄 Amendments",
    list: [
      "Company can update terms anytime",
      "Continued use = acceptance of updated terms",
    ],
  },
  {
    title: "17. 📞 Contact Information",
    body: ["For support:"],
    list: ["Email: support@vasbazaar.com"],
  },
];

const TermsScreen = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <div className={`cm-terms-page${theme === "light" ? " theme-light" : ""}`}>
      <div className="cm-terms-topbar">
        <button className="cm-terms-back" type="button" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <h1 className="cm-terms-topbar-title">Terms &amp; Conditions</h1>
      </div>

      <div className="cm-terms-container">
        <div className="cm-terms-hero">
          <div className="cm-terms-hero-kicker">📜 Terms &amp; Conditions</div>
          <img
            className="cm-terms-hero-logo"
            src={theme === "light" ? "https://webdekho.in/images/vasbazaar1.png" : "https://webdekho.in/images/vasbazaar.png"}
            alt="VasBazaar"
          />
          <div className="cm-terms-hero-sub">Vas Payment Solutions Private Limited</div>
        </div>

        <div className="cm-terms-card">
          {SECTIONS.map((section) => (
            <section key={section.title} className="cm-terms-section">
              <h2 className="cm-terms-section-title">{section.title}</h2>
              {section.body?.map((paragraph, idx) => (
                <p key={`b-${idx}`} className="cm-terms-text">{paragraph}</p>
              ))}
              {section.list && (
                <ul className="cm-terms-list">
                  {section.list.map((item, idx) => (
                    <li key={`l-${idx}`}>{item}</li>
                  ))}
                </ul>
              )}
              {section.footerBody?.map((paragraph, idx) => (
                <p key={`fb-${idx}`} className="cm-terms-text">{paragraph}</p>
              ))}
            </section>
          ))}

          <div className="cm-terms-footnote">
            By continuing to use VasBazaar, you acknowledge that you have read and agreed to these terms.
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsScreen;
