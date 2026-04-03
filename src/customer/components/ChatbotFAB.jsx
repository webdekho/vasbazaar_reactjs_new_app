import { useEffect, useState } from "react";
import { IoChatbubbleEllipses } from "react-icons/io5";
import { useChatbot } from "../context/ChatbotContext";
import ChatbotPanel from "./ChatbotPanel";

const STICKY_SELECTORS = ".off-sticky-footer, .bf-proceed-btn";

const ChatbotFAB = () => {
  const { isOpen, togglePanel } = useChatbot();
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    const recalc = () => {
      const el = document.querySelector(STICKY_SELECTORS);
      if (el) {
        const rect = el.getBoundingClientRect();
        const footerHeight = window.innerHeight - rect.top;
        setBottomOffset(footerHeight > 0 ? footerHeight : 0);
      } else {
        setBottomOffset(0);
      }
    };

    recalc();

    const observer = new MutationObserver(recalc);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", recalc);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          type="button"
          className="cb-fab"
          onClick={togglePanel}
          aria-label="Open chatbot"
          style={bottomOffset > 0 ? { bottom: `${90 + bottomOffset}px` } : undefined}
        >
          <IoChatbubbleEllipses />
          <span className="cb-fab-pulse" />
        </button>
      )}

      {/* Chat Panel */}
      <ChatbotPanel />
    </>
  );
};

export default ChatbotFAB;
