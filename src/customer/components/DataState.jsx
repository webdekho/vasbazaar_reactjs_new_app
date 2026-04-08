const SkeletonLoader = () => (
  <div className="cm-skeleton-wrap">
    {/* Search bar skeleton */}
    <div className="cm-skeleton-search-row">
      <div className="cm-skeleton-pulse cm-skeleton-search" />
      <div className="cm-skeleton-pulse cm-skeleton-logo-ph" />
    </div>
    {/* Banner slider skeleton */}
    <div className="cm-skeleton-pulse cm-skeleton-banner" />
    {/* Service grid skeleton - 4 per row */}
    <div className="cm-skeleton-svc-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="cm-skeleton-svc-item">
          <div className="cm-skeleton-pulse cm-skeleton-icon" />
          <div className="cm-skeleton-pulse cm-skeleton-text" />
        </div>
      ))}
    </div>
  </div>
);

const DataState = ({ loading, error, children, empty = null, onRetry }) => {
  if (loading) return <SkeletonLoader />;
  if (error) return (
    <div className="cm-error-state">
      <div className="cm-error-card" role="alert">
        <div className="cm-error-card-icon">!</div>
        <p className="cm-error-card-title">Connection issue</p>
        <p className="cm-error-card-msg">{typeof error === "string" ? error : "An unexpected error occurred. Please try again."}</p>
        {onRetry && <button type="button" className="cm-error-card-retry" onClick={onRetry}>Try Again</button>}
      </div>
    </div>
  );
  if (empty) return <div className="cm-empty">{empty}</div>;
  return children;
};

export default DataState;
