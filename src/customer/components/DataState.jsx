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

const DataState = ({ loading, error, children, empty = null }) => {
  if (loading) return <SkeletonLoader />;
  if (error) return <div className="cm-status cm-status-error">{error}</div>;
  if (empty) return <div className="cm-empty">{empty}</div>;
  return children;
};

export default DataState;
