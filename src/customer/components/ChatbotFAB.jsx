import { IoChatbubbleEllipses } from "react-icons/io5";
import { useChatbot } from "../context/ChatbotContext";
import ChatbotPanel from "./ChatbotPanel";

const ChatbotFAB = () => {
  const { isOpen, togglePanel } = useChatbot();

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button type="button" className="cb-fab" onClick={togglePanel} aria-label="Open chatbot">
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
