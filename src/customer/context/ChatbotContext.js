import { createContext, useContext, useState, useCallback, useRef } from "react";

const ChatbotContext = createContext(null);

const WELCOME_MSG = {
  id: "welcome",
  role: "bot",
  type: "text",
  content: "Hi! I'm your VasBazaar assistant. I can help you with recharges, bill payments, check your balance, track transactions, and more. How can I help?",
  timestamp: Date.now(),
  actions: ["Check Balance", "Recharge", "View Offers", "Track Transaction", "File Complaint", "Talk to Agent"],
};

export const ChatbotProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationState, setConversationState] = useState({ flow: null, step: null, data: {} });
  const messageIdCounter = useRef(1);

  const nextId = () => `msg-${Date.now()}-${messageIdCounter.current++}`;

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { ...msg, id: msg.id || nextId(), timestamp: msg.timestamp || Date.now() }]);
  }, []);

  const addUserMessage = useCallback((text) => {
    addMessage({ role: "user", type: "text", content: text });
  }, [addMessage]);

  const addBotMessage = useCallback((content, options = {}) => {
    addMessage({
      role: "bot",
      type: options.type || "text",
      content,
      actions: options.actions || [],
      cardData: options.cardData || null,
      cardType: options.cardType || null,
    });
  }, [addMessage]);

  const togglePanel = useCallback(() => setIsOpen((o) => !o), []);
  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  const clearConversation = useCallback(() => {
    setMessages([{ ...WELCOME_MSG, id: nextId(), timestamp: Date.now() }]);
    setConversationState({ flow: null, step: null, data: {} });
  }, []);

  return (
    <ChatbotContext.Provider value={{
      isOpen, messages, isTyping, conversationState,
      setIsTyping, setConversationState,
      addUserMessage, addBotMessage, addMessage,
      togglePanel, openPanel, closePanel, clearConversation,
    }}>
      {children}
    </ChatbotContext.Provider>
  );
};

export const useChatbot = () => {
  const ctx = useContext(ChatbotContext);
  if (!ctx) throw new Error("useChatbot must be used within ChatbotProvider");
  return ctx;
};
