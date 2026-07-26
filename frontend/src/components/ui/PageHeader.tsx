export function PageHeader({
  title, subtitle, actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="cm-dash__head">
      <div className="cm-dash__head-inner">
        <div>
          <h1 className="cm-dash__title">{title}</h1>
          {subtitle && <p className="cm-dash__sub">{subtitle}</p>}
        </div>
        {actions && <div className="cm-dash__aside">{actions}</div>}
      </div>
    </header>
  );
}
