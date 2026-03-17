const AppBrand = ({ subtitle }) => (
  <div className="cm-brand">
    <img src="https://webdekho.in/images/vasbazaar.png" alt="VasBazaar" className="cm-brand-logo" />
    {subtitle ? <div style={{ color: '#B0B0B0', fontSize: '0.75rem' }}>{subtitle}</div> : null}
  </div>
);

export default AppBrand;
