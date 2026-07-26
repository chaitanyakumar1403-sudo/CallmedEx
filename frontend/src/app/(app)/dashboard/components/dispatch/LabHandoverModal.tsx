"use client";

import { Button, Field, Modal, TextArea, TextInput } from "@/components/ui";

type LabField = "labHubName" | "barcodes" | "notes";

/**
 * Phlebotomist sample handover to a diagnostic lab hub — the chain-of-custody
 * record for the tubes collected on this task. Same three fields (hub name,
 * barcode list, handover/cold-chain note) and the same
 * `${activeTask.id}/lab-handover` payload shape as the hand-rolled overlay it
 * replaces.
 */
export function LabHandoverModal({
  open, onClose, labHubName, barcodes, notes, onChange, onSubmit, loading,
}: {
  open: boolean;
  onClose: () => void;
  labHubName: string;
  barcodes: string;
  notes: string;
  onChange: (field: LabField, value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sample handover to lab hub"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} loading={loading}>
            Confirm handover
          </Button>
        </>
      }
    >
      <p className="cm-modal-lede">
        Record the diagnostic hub details and sample container barcodes before dropping off tubes.
      </p>

      <Field label="Diagnostic lab hub name" id="lab-hub-name">
        <TextInput value={labHubName} onChange={(e) => onChange("labHubName", e.target.value)} />
      </Field>

      <Field label="Sample barcode IDs / tube numbers" id="lab-barcodes">
        <TextInput
          placeholder="e.g. BAR-98231, BAR-98232 (EDTA / SST)"
          value={barcodes}
          onChange={(e) => onChange("barcodes", e.target.value)}
        />
      </Field>

      <Field
        label="Handover notes & temp verification"
        id="lab-notes"
        hint="Cold chain status, transport container temperature"
      >
        <TextArea rows={3} value={notes} onChange={(e) => onChange("notes", e.target.value)} />
      </Field>
    </Modal>
  );
}
