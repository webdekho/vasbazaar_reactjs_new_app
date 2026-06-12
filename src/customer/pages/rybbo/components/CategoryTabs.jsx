const CategoryTabs = ({ categories, value, onChange }) => {
  const tabs = [{ key: "all", label: "All" }, ...categories];
  return (
    <div className="rybbo-tabs">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key} type="button" onClick={() => onChange(t.key)}
            className={`rybbo-tab${active ? " is-active" : ""}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryTabs;
