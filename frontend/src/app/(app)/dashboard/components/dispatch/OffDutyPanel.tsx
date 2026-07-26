import { Button, EmptyState, Icon, Panel } from "@/components/ui";
import { CheckCircle2, MapPin } from "@/components/ui/icons";

const PROMISES = [
  "GPS starts automatically when you go on duty",
  "You receive real-time dispatch alerts",
  "You can accept or reject each request",
  "Earnings update after each completed job",
];

export function OffDutyPanel({ onGoOnDuty }: { onGoOnDuty: () => void }) {
  return (
    <Panel>
      <EmptyState
        icon={MapPin}
        title="You are Off Duty"
        body="Go on duty to start receiving field requests in your area."
        action={<Button variant="primary" onClick={onGoOnDuty}>Go On Duty</Button>}
      />
      <ul className="cm-promises">
        {PROMISES.map((p) => (
          <li key={p}>
            <Icon as={CheckCircle2} size={16} />
            {p}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
