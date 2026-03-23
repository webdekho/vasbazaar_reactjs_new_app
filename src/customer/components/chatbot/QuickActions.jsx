const QuickActions = ({ actions, onAction }) => {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="cb-chips">
      {actions.map((action, i) => (
        <button key={i} type="button" className="cb-chip" onClick={() => onAction(action)}>
          {action}
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
