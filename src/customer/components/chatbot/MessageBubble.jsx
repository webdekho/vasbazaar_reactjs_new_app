import QuickActions from "./QuickActions";
import { BalanceCard, TransactionsCard, OffersCard, ConfirmationCard, EscalateCard } from "./RichCards";

const MessageBubble = ({ message, onAction, onConfirm, onCancel, onLiveChat, onCall, onWhatsApp }) => {
  const isBot = message.role === "bot";

  return (
    <div className={`cb-msg ${isBot ? "cb-msg--bot" : "cb-msg--user"}`}>
      {isBot && <div className="cb-msg-avatar">VB</div>}
      <div className="cb-msg-body">
        {/* Text content */}
        {message.content && (
          <div className="cb-msg-bubble">
            {typeof message.content === "string"
              ? message.content.split("\n").map((line, i) => <p key={i} style={{ margin: "2px 0" }}>{line}</p>)
              : message.content}
          </div>
        )}

        {/* Rich cards */}
        {message.cardType === "balance" && message.cardData && <BalanceCard data={message.cardData} />}
        {message.cardType === "transactions" && message.cardData && <TransactionsCard data={message.cardData} />}
        {message.cardType === "transaction_detail" && message.cardData && (
          <TransactionsCard data={[message.cardData]} />
        )}
        {message.cardType === "offers" && message.cardData && <OffersCard data={message.cardData} />}
        {message.cardType === "confirmation" && message.cardData && (
          <ConfirmationCard data={message.cardData} onConfirm={onConfirm} onCancel={onCancel} />
        )}
        {message.cardType === "escalate" && (
          <EscalateCard onLiveChat={onLiveChat} onCall={onCall} onWhatsApp={onWhatsApp} />
        )}

        {/* Quick action chips */}
        {isBot && message.actions?.length > 0 && (
          <QuickActions actions={message.actions} onAction={onAction} />
        )}

        {/* Timestamp */}
        <div className="cb-msg-time">
          {new Date(message.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
