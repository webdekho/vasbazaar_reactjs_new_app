const AppBrand = ({ subtitle }) => (
  <div className="cm-brand">
    <img src="/assets/images/Brand_logo.png" alt="vasbazaar" style={{ height: 36 }} />
    {subtitle ? <div className="cm-muted">{subtitle}</div> : null}
  </div>
);

export default AppBrand;
