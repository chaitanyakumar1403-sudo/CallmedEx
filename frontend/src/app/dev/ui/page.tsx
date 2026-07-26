"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  Button, Pill, Banner, Panel, Stat, StatGrid, EmptyState,
  SkeletonRows, Field, TextInput, Modal, Icon,
} from "@/components/ui";
import { ClipboardList, CheckCircle2, Wallet, MapPin } from "@/components/ui/icons";

export default function UiGallery() {
  if (process.env.NODE_ENV === "production") notFound();
  const [open, setOpen] = useState(false);

  return (
    <div className="cm-dash">
      <div className="cm-dash__body">
        <Panel title="Buttons" note="Four variants, two sizes. Minimum target 44px.">
          <div className="cm-gallery-row">
            <Button variant="primary">Go On Duty</Button>
            <Button variant="secondary">Tube guide</Button>
            <Button variant="ghost">Details</Button>
            <Button variant="danger">Go Off Duty</Button>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="secondary" size="sm">Small</Button>
            <Button variant="ghost" size="sm">Small</Button>
            <Button variant="danger" size="sm">Small</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="primary" loading>Saving</Button>
            <Button variant="secondary" iconOnly aria-label="Navigate">
              <Icon as={MapPin} size={20} />
            </Button>
          </div>
        </Panel>

        <Panel title="Status pills" note="Colour never carries meaning alone — every pill has a word.">
          <div className="cm-gallery-row">
            <Pill tone="urgent">Urgent</Pill>
            <Pill tone="active">En route</Pill>
            <Pill tone="done">Collected</Pill>
            <Pill tone="waiting">Queued</Pill>
            <Pill tone="halted">Cancelled</Pill>
          </div>
        </Panel>

        <Panel title="Banners">
          <Banner tone="done" onDismiss={() => {}}>Sample handed over to the lab.</Banner>
          <Banner tone="urgent">GPS permission denied — dispatch cannot reach you.</Banner>
          <Banner tone="active">Broadcasting location every 15 seconds.</Banner>
          <Banner tone="waiting">Waiting for the lab to verify three tubes.</Banner>
          <Banner tone="halted">This collection was cancelled by the patient.</Banner>
        </Panel>

        <Panel title="Stats">
          <StatGrid>
            <Stat label="Active tasks" value={3} meta="2 due within the hour"
                  icon={ClipboardList} tone="active" onClick={() => {}} />
            <Stat label="Done today" value={0} meta="of 8 assigned" icon={CheckCircle2} tone="done" />
            <Stat label="Today's earnings" value="₹0" meta="₹150 per verified tube" icon={Wallet} />
            <Stat label="Overdue" value={1} meta="collection missed" tone="urgent" />
          </StatGrid>
        </Panel>

        <Panel title="Empty state">
          <EmptyState
            icon={MapPin}
            title="You are Off Duty"
            body="Go on duty to start receiving field requests in your area."
            action={<Button variant="primary">Go On Duty</Button>}
          />
        </Panel>

        <Panel title="Loading"><SkeletonRows rows={3} /></Panel>

        <Panel title="Fields">
          <Field label="Certification number" id="g-cert" hint="Printed on your MLT/DMLT certificate">
            <TextInput placeholder="MLT-2024-00871" />
          </Field>
          <Field label="Collection OTP" id="g-otp" error="That OTP does not match" required>
            <TextInput inputMode="numeric" defaultValue="0000" />
          </Field>
        </Panel>

        <Panel title="Modal">
          <Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button>
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Confirm lab handover"
            footer={
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => setOpen(false)}>Confirm</Button>
              </>
            }
          >
            <Field label="Tube barcodes" id="g-bar" hint="One per line">
              <TextInput placeholder="CMX-0001" />
            </Field>
          </Modal>
        </Panel>
      </div>
    </div>
  );
}
