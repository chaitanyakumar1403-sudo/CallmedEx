import { Icon } from "./Icon";
import type { LucideIcon } from "./icons";

/**
 * An empty screen is an invitation to act: it names what will appear here and
 * offers the action that fills it.
 */
export function EmptyState({
  icon, title, body, action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="cm-empty">
      <span className="cm-empty__icon"><Icon as={icon} size={24} /></span>
      <p className="cm-empty__title">{title}</p>
      {body && <p className="cm-empty__body">{body}</p>}
      {action && <div className="cm-empty__action">{action}</div>}
    </div>
  );
}
