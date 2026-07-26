"use client";

import { Button, Field, Modal, TextArea, TextInput } from "@/components/ui";

export interface Vitals {
  bp: string;
  pulse: string;
  temp: string;
  spo2: string;
}

/**
 * Nurse clinical vitals + procedure notes, captured on an in-progress home
 * visit before the task is marked complete. Same four vitals fields and the
 * same free-text procedure note as the hand-rolled overlay it replaces;
 * submitting still completes the task exactly as before. Grouped into one
 * `vitals` object rather than four flat props so the parent holds one piece
 * of state.
 */
export function VitalsModal({
  open, onClose, vitals, onChange, notes, onNotesChange, onSubmit, loading,
}: {
  open: boolean;
  onClose: () => void;
  vitals: Vitals;
  onChange: (vitals: Vitals) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload patient vitals & clinical note"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} loading={loading}>
            Save vitals & complete
          </Button>
        </>
      }
    >
      <div className="cm-vitals-grid">
        <Field label="Blood pressure (mmHg)" id="vitals-bp">
          <TextInput value={vitals.bp} onChange={(e) => onChange({ ...vitals, bp: e.target.value })} />
        </Field>
        <Field label="Pulse rate (bpm)" id="vitals-pulse">
          <TextInput value={vitals.pulse} onChange={(e) => onChange({ ...vitals, pulse: e.target.value })} />
        </Field>
        <Field label="Body temp (°F)" id="vitals-temp">
          <TextInput value={vitals.temp} onChange={(e) => onChange({ ...vitals, temp: e.target.value })} />
        </Field>
        <Field label="SpO2 (%)" id="vitals-spo2">
          <TextInput value={vitals.spo2} onChange={(e) => onChange({ ...vitals, spo2: e.target.value })} />
        </Field>
      </div>

      <Field
        label="Procedure & dressing clinical notes"
        id="vitals-notes"
        hint="Record nursing procedure, wound dressing details, medications administered."
      >
        <TextArea
          rows={3}
          placeholder="Record nursing procedure, wound dressing details, medications administered…"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
