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

    /**
     * PERF FIX: Debounce the MutationObserver callback.
     * Previously, recalc fired on EVERY DOM mutation in the entire app
     * (childList: true, subtree: true on document.body). This caused
     * layout thrashing (getBoundingClientRect forces reflow) on every
     * state change anywhere in the component tree. Now batched to 150ms.
     */
    let debounceTimer;
    const debouncedRecalc = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(recalc, 150);
    };

    recalc();

    const observer = new MutationObserver(debouncedRecalc);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", debouncedRecalc);

    return () => {
      clearTimeout(debounceTimer);
      observer.disconnect();
      window.removeEventListener("resize", debouncedRecalc);
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
