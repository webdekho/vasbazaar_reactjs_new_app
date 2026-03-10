const DataState = ({ loading, error, children, empty = null }) => {
  if (loading) return <div className="cm-loading">Loading customer data...</div>;
  if (error) return <div className="cm-status cm-status-error">{error}</div>;
  if (empty) return <div className="cm-empty">{empty}</div>;
  return children;
};

export default DataState;
