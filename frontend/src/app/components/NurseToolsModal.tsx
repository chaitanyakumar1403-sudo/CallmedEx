"use client";

import { useState } from "react";
import { Banner, Button, Card, Field, Modal, Select, TextInput } from "@/components/ui";

interface NurseToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Nurse field reference: an IV drip-rate calculator and a visit vitals
 * logger, unchanged in formula/fields from the hand-rolled overlay this
 * replaces. Modal now owns the dialog role, focus trap, Esc and scroll lock
 * that overlay never had.
 */
export default function NurseToolsModal({ isOpen, onClose }: NurseToolsModalProps) {
  const [ivVolume, setIvVolume] = useState("500");
  const [ivHours, setIvHours] = useState("4");
  const [dropFactor, setDropFactor] = useState("20");
  const [calculatedRate, setCalculatedRate] = useState<number | null>(null);

  // Vitals Logger
  const [bpSystolic, setBpSystolic] = useState("120");
  const [bpDiastolic, setBpDiastolic] = useState("80");
  const [spo2, setSpo2] = useState("98");
  const [pulse, setPulse] = useState("72");
  const [vitalsSaved, setVitalsSaved] = useState(false);

  const calculateIvRate = () => {
    const vol = parseFloat(ivVolume);
    const hrs = parseFloat(ivHours);
    const df = parseFloat(dropFactor);
    if (vol > 0 && hrs > 0) {
      const minutes = hrs * 60;
      const rate = (vol * df) / minutes;
      setCalculatedRate(Math.round(rate));
    }
  };

  const handleSaveVitals = () => {
    setVitalsSaved(true);
    setTimeout(() => setVitalsSaved(false), 3000);
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Nurse Clinical Assistant">
      <p className="cm-modal-lede">Field Care Engine</p>

      <section className="cm-modal-section">
        <h3 className="cm-modal-section__title">IV Infusion Drip Rate Calculator</h3>
        <Card>
          <div className="cm-vitals-grid">
            <Field label="Volume (mL)" id="nurse-iv-volume">
              <TextInput type="number" value={ivVolume} onChange={(e) => setIvVolume(e.target.value)} />
            </Field>
            <Field label="Time (Hours)" id="nurse-iv-hours">
              <TextInput type="number" value={ivHours} onChange={(e) => setIvHours(e.target.value)} />
            </Field>
            <Field label="Drop Factor (gtt/mL)" id="nurse-drop-factor">
              <Select value={dropFactor} onChange={(e) => setDropFactor(e.target.value)}>
                <option value="20">20 (Standard Adult)</option>
                <option value="15">15 (Blood Set)</option>
                <option value="60">60 (Micro Drip)</option>
              </Select>
            </Field>
          </div>

          <Button variant="secondary" onClick={calculateIvRate}>Calculate Rate</Button>

          {calculatedRate !== null && (
            <Banner tone="done">
              Required Drip Rate: {calculatedRate} drops/min (gtt/min)
            </Banner>
          )}
        </Card>
      </section>

      <section className="cm-modal-section">
        <h3 className="cm-modal-section__title">Record Visit Vitals &amp; Triage</h3>
        <Card>
          <div className="cm-vitals-grid">
            <Field label="Systolic BP" id="nurse-bp-systolic">
              <TextInput type="number" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} />
            </Field>
            <Field label="Diastolic BP" id="nurse-bp-diastolic">
              <TextInput type="number" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} />
            </Field>
            <Field label="SpO2 (%)" id="nurse-spo2">
              <TextInput type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
            </Field>
            <Field label="Pulse (bpm)" id="nurse-pulse">
              <TextInput type="number" value={pulse} onChange={(e) => setPulse(e.target.value)} />
            </Field>
          </div>

          <Button variant="primary" onClick={handleSaveVitals}>Log Patient Vitals</Button>

          {vitalsSaved && (
            <Banner tone="done">Vitals Logged &amp; Sent to Doctor!</Banner>
          )}
        </Card>
      </section>
    </Modal>
  );
}
