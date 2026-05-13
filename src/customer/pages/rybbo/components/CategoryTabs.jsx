const CategoryTabs = ({ categories, value, onChange }) => {
  const tabs = [{ key: "all", label: "All" }, ...categories];
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 2px 8px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key} type="button" onClick={() => onChange(t.key)}
            style={{
              flexShrink: 0, padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              border: `1px solid ${active ? "#007BFF" : "var(--cm-line, #E5E7EB)"}`,
              background: active ? "#007BFF" : "transparent",
              color: active ? "#fff" : "inherit", cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryTabs;
