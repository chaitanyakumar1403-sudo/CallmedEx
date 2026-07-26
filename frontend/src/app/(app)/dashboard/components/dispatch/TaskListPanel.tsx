"use client";

import { useState } from "react";
import { Button, Card, Icon, Modal, Pill } from "@/components/ui";
import { MapPin } from "@/components/ui/icons";
import type { DispatchTask } from "../ProviderDispatchTracker";
import { TaskNotes } from "./TaskNotes";
import { serviceLabel } from "./serviceLabel";

/**
 * Incoming dispatch requests awaiting Accept/Reject. Pure presentation —
 * filtering, sorting (urgent-first) and the `actionLoading` key format
 * (`taskId + "accept"` / `taskId + "reject"`, no separator) all stay owned by
 * ProviderDispatchTracker exactly as before.
 *
 * Reject is gated behind a confirmation naming the specific request; Accept
 * is not. This is a deliberate asymmetry: on a phone held outdoors before
 * dawn, a mis-tap on Accept costs nothing the provider can't undo — a
 * mis-tap on Reject discards the dispatch and costs the patient their
 * collection slot, irrecoverably.
 */
export function TaskListPanel({
  tasks, actionLoading, onAccept, onReject,
}: {
  tasks: DispatchTask[];
  actionLoading: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [confirmTarget, setConfirmTarget] = useState<DispatchTask | null>(null);

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
                  {serviceLabel(t.service_type)}
                  {t.estimated_distance_km != null &&
                    ` · ${t.estimated_distance_km.toFixed(1)} km away`}
                </p>
                {t.notes && <TaskNotes notes={t.notes} heading="Details:" />}
              </div>
              <div className="cm-task__actions">
                <Button
                  variant="ghost"
                  onClick={() => setConfirmTarget(t)}
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

      <Modal
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title="Reject this request?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmTarget) onReject(confirmTarget.id);
                setConfirmTarget(null);
              }}
            >
              Reject request
            </Button>
          </>
        }
      >
        <p>
          Reject the pickup at <strong>{confirmTarget?.patient_address}</strong>? The
          patient loses this collection slot and this cannot be undone from here.
        </p>
      </Modal>
    </div>
  );
}
