"use client";

import { useState } from "react";
import { Banner, Modal, Pill, Stat, StatGrid } from "@/components/ui";

interface PhlebotomistToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TUBES = [
  // ui-lint-ignore-next-line tube colour is data, not design
  { color: "#8b5cf6", name: "EDTA Purple Tube", tests: "CBC, HbA1c, ESR, Blood Grouping", additive: "K2 EDTA Anticoagulant" },
  // ui-lint-ignore-next-line tube colour is data, not design
  { color: "#ef4444", name: "Serum Red Top", tests: "Lipid Profile, LFT, KFT, Thyroid, Electrolytes", additive: "Clot Activator" },
  // ui-lint-ignore-next-line tube colour is data, not design
  { color: "#64748b", name: "Sodium Fluoride Grey", tests: "Fasting Blood Glucose, PPBS, Oral Glucose Tolerance", additive: "Sodium Fluoride / Potassium Oxalate" },
  // ui-lint-ignore-next-line tube colour is data, not design
  { color: "#0284c7", name: "Sodium Citrate Light Blue", tests: "PT / INR, APTT, D-Dimer, Fibrinogen", additive: "3.2% Sodium Citrate" },
];

/**
 * Phlebotomist field reference: cold-chain status and the tube colour /
 * additive guide, unchanged from the hand-rolled overlay this replaces.
 *
 * The barcode "scanner" that used to live here generated a throwaway
 * VAM-###### and persisted nothing, sitting next to the real one in Samples
 * & Handover — two scanners where one is fake is worse than one, since a
 * collector could reasonably tag a tube here and believe it was recorded.
 * Removed in a prior pass; the pointer to the tab that actually registers a
 * tube is kept below. Modal now owns the dialog role, focus trap, Esc and
 * scroll lock that overlay never had.
 */
export default function PhlebotomistToolsModal({ isOpen, onClose }: PhlebotomistToolsModalProps) {
  const [selectedTube, setSelectedTube] = useState<string | null>(null);

  return (
    <Modal open={isOpen} onClose={onClose} title="Phlebotomist Clinical Assistant">
      <p className="cm-modal-lede">NMC Standard</p>

      <StatGrid>
        <Stat
          label="Cold-Chain Specimen Storage"
          value="3.6°C"
          meta="(Safe Range: 2°C – 8°C)"
          tone="done"
        />
      </StatGrid>
      <Pill tone="done">Temp Monitor Normal</Pill>

      <Banner tone="active">
        <strong>Registering a tube?</strong> Use <strong>Samples &amp; Handover</strong> to scan
        or mint a barcode. That records the tube against the patient&apos;s run and starts its
        custody trail — this guide is reference only.
      </Banner>

      <section className="cm-modal-section">
        <h3 className="cm-modal-section__title">Phlebotomy Tube Guide &amp; Additives</h3>
        <div className="cm-tube-grid">
          {TUBES.map((tube) => {
            const selected = selectedTube === tube.name;
            return (
              <button
                key={tube.name}
                type="button"
                className={`cm-tube-card${selected ? " cm-tube-card--selected" : ""}`}
                aria-pressed={selected}
                onClick={() => setSelectedTube(tube.name)}
              >
                <span className="cm-swatch">
                  <span
                    className="cm-swatch__chip"
                    aria-hidden="true"
                    // ui-lint-ignore-next-line tube colour is data, not design
                    style={{ "--cm-swatch": tube.color } as React.CSSProperties}
                  />
                  {tube.name}
                </span>
                <span className="cm-tube-card__meta"><strong>Tests:</strong> {tube.tests}</span>
                <span className="cm-tube-card__meta"><strong>Additive:</strong> {tube.additive}</span>
              </button>
            );
          })}
        </div>
      </section>
    </Modal>
  );
}
