import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaTrashAlt, FaPaperPlane, FaRobot } from "react-icons/fa";
import { useChatbot } from "../context/ChatbotContext";
import { processMessage } from "../services/chatbotService";
import { rechargeService } from "../services/rechargeService";
import MessageBubble from "./chatbot/MessageBubble";
import { sanitizeBackendMessage } from "../utils/userMessages";

const TAWK_TO_ID = "68d37d4a56af9719235895be/1j5t22r24";

const ChatbotPanel = () => {
  const navigate = useNavigate();
  const { isOpen, messages, isTyping, closePanel, addUserMessage, addBotMessage, setIsTyping, clearConversation } = useChatbot();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const handleSend = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed) return;
    setInput("");
    addUserMessage(trimmed);
    setIsTyping(true);

    try {
      const result = await processMessage(trimmed, messages);
      setIsTyping(false);

      if (result.navigate) {
        addBotMessage(result.reply, { actions: result.actions, cardType: result.cardType, cardData: result.cardData });
        setTimeout(() => { closePanel(); navigate(result.navigate); }, 800);
        return;
      }

      addBotMessage(result.reply, {
        actions: result.actions,
        cardType: result.cardType,
        cardData: result.cardData,
      });
    } catch (err) {
      setIsTyping(false);
      addBotMessage("Something went wrong. Please try again.", { actions: ["Check Balance", "Recharge", "Talk to Agent"] });
    }
  }, [input, messages, addUserMessage, addBotMessage, setIsTyping, closePanel, navigate]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChipAction = (action) => {
    // Map chip labels to messages
    const chipMap = {
      "Open Live Chat": "__LIVE_CHAT__",
      "Call Support": "__CALL__",
      "WhatsApp": "__WHATSAPP__",
      "Confirm": "__CONFIRM__",
      "Cancel": "__CANCEL__",
    };
    if (chipMap[action]) {
      handleSpecialAction(chipMap[action]);
    } else {
      handleSend(action);
    }
  };

  const handleSpecialAction = (action) => {
    if (action === "__LIVE_CHAT__") openTawkChat();
    else if (action === "__CALL__") window.open("tel:+918655681213");
    else if (action === "__WHATSAPP__") window.open("https://wa.me/918655681213", "_blank");
  };

  const openTawkChat = () => {
    if (window.Tawk_API?.maximize) { window.Tawk_API.maximize(); return; }
    const s = document.createElement("script");
    s.src = `https://embed.tawk.to/${TAWK_TO_ID}`;
    s.async = true;
    s.onload = () => setTimeout(() => window.Tawk_API?.maximize?.(), 1000);
    document.head.appendChild(s);
  };

  const handleConfirm = async (data) => {
    addUserMessage("Confirm & Pay");
    setIsTyping(true);

    try {
      if (data.action === "recharge") {
        const payload = {
          amount: data.amount,
          operatorId: data.operatorData?.operatorId || data.operatorData?.id,
          validity: 30,
          payType: "wallet",
          mobile: data.mobile,
          name: "Customer",
          field1: data.mobile,
          field2: null,
          viewBillResponse: {},
        };
        const res = await rechargeService.recharge(payload);
        setIsTyping(false);
        if (res.success) {
          const txnId = res.data?.txnId || res.data?.txnid || `VB${Date.now()}`;
          addBotMessage(`Recharge successful! 🎉\nTransaction ID: ${txnId}\nAmount: ₹${data.amount}\nMobile: ${data.mobile}`, {
            actions: ["Check Balance", "Recharge Another", "View Receipt"],
            cardType: "transaction_detail",
            cardData: { id: txnId, amount: data.amount, status: "SUCCESS", operator: data.operator, mobile: data.mobile, date: new Date().toISOString() },
          });
        } else {
          addBotMessage(`Payment failed: ${sanitizeBackendMessage(res.message, "Unknown error")}. Please try again or use a different payment method.`, {
            actions: ["Try Again", "Talk to Agent", "Check Balance"],
          });
        }
      }
    } catch (err) {
      setIsTyping(false);
      addBotMessage("Payment failed. Please try again.", { actions: ["Try Again", "Talk to Agent"] });
    }
  };

  const handleCancel = () => {
    addBotMessage("No problem! The payment has been cancelled. Is there anything else I can help with?", {
      actions: ["Check Balance", "Recharge", "View Offers"],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="cb-overlay">
      <div className="cb-panel">
        {/* Header */}
        <div className="cb-header">
          <div className="cb-header-left">
            <div className="cb-header-avatar"><FaRobot /></div>
            <div>
              <div className="cb-header-name">VasBazaar Assistant</div>
              <div className="cb-header-status">
                <span className="cb-status-dot" /> Online
              </div>
            </div>
          </div>
          <div className="cb-header-actions">
            <button type="button" className="cb-header-btn" onClick={clearConversation} title="Clear chat"><FaTrashAlt /></button>
            <button type="button" className="cb-header-btn" onClick={closePanel} title="Close"><FaTimes /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="cb-messages">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onAction={handleChipAction}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              onLiveChat={openTawkChat}
              onCall={() => window.open("tel:+918655681213")}
              onWhatsApp={() => window.open("https://wa.me/918655681213", "_blank")}
            />
          ))}
          {isTyping && (
            <div className="cb-msg cb-msg--bot">
              <div className="cb-msg-avatar">VB</div>
              <div className="cb-msg-body">
                <div className="cb-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="cb-input-bar">
          <input
            ref={inputRef}
            className="cb-input"
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          <button type="button" className="cb-send-btn" onClick={() => handleSend()} disabled={isTyping || !input.trim()}>
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPanel;
