import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaPaperclip } from "react-icons/fa";
import { serviceChatService } from "../../services/serviceChatService";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

/**
 * Service Bazaar chat thread (PRD: Chat & Communication). Works for both sides — the
 * server tells us whether "I" am the CUSTOMER or the PROVIDER in this conversation and
 * we align my bubbles to the right. Light polling keeps the thread fresh while open.
 */
export default function ChatScreen() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const { showToast } = useToast();

  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [mySide, setMySide] = useState("CUSTOMER");
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const endRef = useRef(null);

  const load = useCallback(async (scroll = true) => {
    const res = await serviceChatService.getMessages(threadId);
    if (res.success) {
      setThread(res.data?.thread || null);
      setMessages(res.data?.messages || []);
      setMySide(res.data?.mySide || "CUSTOMER");
    } else if (loading) {
      showToast(res.message || "Conversation not found", "error");
    }
    setLoading(false);
    if (scroll) requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, [threadId, loading, showToast]);

  useEffect(() => { load(); }, [load]);

  // Light polling for incoming messages while the thread is open.
  useEffect(() => {
    const t = setInterval(() => load(false), 6000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (payload) => {
    setSending(true);
    const res = await serviceChatService.sendMessage(threadId, payload);
    setSending(false);
    if (res.success) {
      setText("");
      load();
    } else {
      showToast(res.message || "Could not send", "error");
    }
  };

  const onSendText = () => {
    const t = text.trim();
    if (!t) return;
    send({ messageText: t });
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Max attachment size is 5 MB", "error"); return; }
    setUploading(true);
    const res = await serviceBazaarService.uploadImage(file, "chat");
    setUploading(false);
    if (res.success && res.url) {
      const type = (file.type || "").startsWith("image/") ? "IMAGE" : (file.type || "").startsWith("audio/") ? "AUDIO" : "FILE";
      send({ attachmentUrl: res.url, attachmentType: type, messageText: text.trim() || null });
    } else showToast(res.message || "Upload failed", "error");
  };

  // The other party's display name depends on which side I'm on.
  const otherName = mySide === "CUSTOMER"
    ? (thread?.provider?.businessName || thread?.provider?.providerName || "Provider")
    : (thread?.customer?.name || "Customer");

  return (
    <div className="sb-page sb-chat-page">
      <div className="sb-topbar">
        <button className="sb-back" onClick={() => navigate(-1)} aria-label="Back"><FaArrowLeft /></button>
        <div>
          <h1 className="sb-title">{otherName}</h1>
          <p className="sb-sub">{mySide === "CUSTOMER" ? "Service provider" : "Customer"}</p>
        </div>
      </div>

      <div className="sb-chat-body">
        {loading ? (
          <div className="sb-empty">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="sb-empty">No messages yet. Say hello 👋</div>
        ) : messages.map((m) => {
          const mine = m.senderType === mySide;
          return (
            <div key={m.id} className={`sb-bubble-row ${mine ? "mine" : ""}`}>
              <div className={`sb-bubble ${mine ? "mine" : ""}`}>
                {m.attachmentUrl && m.attachmentType === "IMAGE" && (
                  <a href={m.attachmentUrl} target="_blank" rel="noreferrer">
                    <img src={m.attachmentUrl} alt="attachment" className="sb-bubble-img" />
                  </a>
                )}
                {m.attachmentUrl && m.attachmentType === "AUDIO" && (
                  <audio controls src={m.attachmentUrl} style={{ maxWidth: 200 }} />
                )}
                {m.attachmentUrl && m.attachmentType === "FILE" && (
                  <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="sb-bubble-file">📎 Attachment</a>
                )}
                {m.messageText && <p className="sb-bubble-text">{m.messageText}</p>}
                <span className="sb-bubble-time">
                  {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="sb-chat-composer">
        <button className="sb-chat-attach" onClick={() => fileRef.current?.click()} disabled={uploading || sending} aria-label="Attach">
          <FaPaperclip />
        </button>
        <input ref={fileRef} type="file" accept="image/*,audio/*" hidden onChange={onPickFile} />
        <input
          className="sb-chat-input"
          placeholder={uploading ? "Uploading…" : "Type a message…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSendText(); }}
          disabled={uploading}
        />
        <button className="sb-chat-send" onClick={onSendText} disabled={sending || uploading || !text.trim()} aria-label="Send">
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
}
