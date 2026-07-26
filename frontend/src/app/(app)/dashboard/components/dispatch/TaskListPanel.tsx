"use client";

import { Button, Card, Icon, Pill } from "@/components/ui";
import { MapPin } from "@/components/ui/icons";
import type { DispatchTask } from "../ProviderDispatchTracker";

/**
 * The parenthesised note that used to hide a prescription/handover URL inside
 * a plain-text notes blob. Same parsing as before — a line containing "http"
 * becomes a link, everything else prints as-is — just without inline styles.
 */
function TaskNotes({ notes }: { notes: string }) {
  return (
    <div className="cm-notes">
      <strong>Details:</strong>
      {notes.split("\n").map((line, i) => {
        const url = line.split(" ").find((w) => w.startsWith("http"));
        return (
          <p key={i}>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                View Prescription Document
              </a>
            ) : (
              line
            )}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Incoming dispatch requests awaiting Accept/Reject. Pure presentation —
 * filtering, sorting (urgent-first) and the `actionLoading` key format
 * (`taskId + "accept"` / `taskId + "reject"`, no separator) all stay owned by
 * ProviderDispatchTracker exactly as before.
 */
export function TaskListPanel({
  tasks, actionLoading, onAccept, onReject,
}: {
  tasks: DispatchTask[];
  actionLoading: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="cm-tasklist">
      {tasks.map((t) => {
        const urgent = t.priority === "urgent";
        return (
          <Card key={t.id}>
            <div className="cm-task">
              <Pill tone={urgent ? "urgent" : "waiting"}>
                {urgent ? "Urgent — respond now" : "New request"}
              </Pill>
              <div className="cm-task__body">
                <p className="cm-task__name">
                  <Icon as={MapPin} size={14} />
                  {t.patient_address}
                </p>
                <p className="cm-task__meta">
                  {t.service_type.replace(/_/g, " ")}
                  {t.estimated_distance_km != null &&
                    ` · ${t.estimated_distance_km.toFixed(1)} km away`}
                </p>
                {t.notes && <TaskNotes notes={t.notes} />}
              </div>
              <div className="cm-task__actions">
                <Button
                  variant="ghost"
                  onClick={() => onReject(t.id)}
                  disabled={!!actionLoading}
                  loading={actionLoading === t.id + "reject"}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  onClick={() => onAccept(t.id)}
                  disabled={!!actionLoading}
                  loading={actionLoading === t.id + "accept"}
                >
                  Accept
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
