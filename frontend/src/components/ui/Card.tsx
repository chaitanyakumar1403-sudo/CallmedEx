export function Card({
  children, className = "", interactive = false,
}: {
  children: React.ReactNode; className?: string; interactive?: boolean;
}) {
  return (
    <div className={`cm-card${interactive ? " cm-card--interactive" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

export function Panel({
  title, note, children,
}: {
  title?: string; note?: string; children: React.ReactNode;
}) {
  return (
    <section className="cm-panel">
      {title && <h2 className="cm-panel__title">{title}</h2>}
      {note && <p className="cm-panel__note">{note}</p>}
      {children}
    </section>
  );
}
