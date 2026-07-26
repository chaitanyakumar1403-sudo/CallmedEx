"use client";

import { Banner, Button, Field, Modal, TextInput } from "@/components/ui";

/**
 * Phlebotomist pre-duty selfie gate, required by the Phlebotomist MOU before
 * duty can toggle on. Same single file field and the same submit-only-when-a-
 * file-is-present gate as the hand-rolled overlay it replaces — Modal now
 * owns focus trapping, Esc and scroll lock, none of which the old overlay had.
 */
export function SelfieModal({
  open, onClose, file, onFileChange, verifying, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  verifying: boolean;
  onSubmit: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pre-duty selfie verification"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} loading={verifying} disabled={!file}>
            Verify & go on duty
          </Button>
        </>
      }
    >
      <Banner tone="waiting">
        As per the Phlebotomist MOU, your live selfie must clearly show:
        <ul className="cm-selfie-reqs">
          <li>Your face</li>
          <li>Official uniform and ID card</li>
          <li>Sample collection kit</li>
        </ul>
      </Banner>

      <Field label="Duty selfie" id="selfie-file" hint="Live camera photo, not a gallery upload.">
        <TextInput
          type="file"
          accept="image/*"
          capture="user"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </Field>
    </Modal>
  );
}
