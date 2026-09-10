"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { CalendarDays, Navigation, TestTube } from "@/components/ui/icons";
import FieldOps3DHub, { type FieldStage, type FigureParts } from "./FieldOps3DHub";
import { summariseRuns } from "./fieldRunStages.mjs";

type Horizon = "today" | "tomorrow" | "upcoming";

interface FieldRun {
  id?: string;
  dispatch_id?: string;
  booking_id?: string;
  status?: string;
  scheduled_time?: string;
  slot_time?: string;
  selected_tests?: string[];
}

interface Props {
  /** Live dispatch runs already loaded by the dashboard — merged, not re-fetched. */
  tasks?: FieldRun[];
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Holographic field collector: scrub top, cap and mask, a gloved hand holding a
 * part-filled vacutainer, and the tube carrier on the hip. The carrier and the
 * held tube are what separate this silhouette at a glance from the physician
 * hologram on the doctor console.
 *
 * Module scope, so its identity is stable and never rebuilds the hub's scene.
 */
function buildCollector(): FigureParts {
  const group = new THREE.Group();

  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x8fd0f5,
    emissive: 0x0891b2,
    emissiveIntensity: 0.6,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    wireframe: true,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
  });
  // Opaque so the kit reads clearly against the translucent scrubs.
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x67e8f9,
    emissiveIntensity: 1.9,
    roughness: 0.12,
    metalness: 0.85,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x818cf8,
    emissive: 0x4f46e5,
    emissiveIntensity: 0.9,
    roughness: 0.4,
    metalness: 0.2,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0xf5f3ff,
    emissive: 0xa78bfa,
    emissiveIntensity: 1.1,
    roughness: 0.3,
    metalness: 0.15,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
    roughness: 0.35,
    metalness: 0.25,
  });
  const bloodMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xb91c1c,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.1,
  });

  // Scrub top: human proportions — hem, waist, chest, shoulder taper, neck.
  const scrubGeo = new THREE.LatheGeometry(
    [
      [0.0, 0.0],
      [0.55, 0.0],
      [0.57, 0.12],
      [0.53, 0.55],
      [0.52, 0.95],
      [0.58, 1.3],
      [0.61, 1.56],
      [0.46, 1.74],
      [0.25, 1.84],
      [0.14, 1.94],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    56
  );
  group.add(new THREE.Mesh(scrubGeo, holoMat));
  group.add(new THREE.Mesh(scrubGeo, wireMat));

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.2, 20), holoMat);
  neck.position.y = 1.99;
  group.add(neck);

  const headGeo = new THREE.SphereGeometry(0.31, 32, 24);
  const head = new THREE.Mesh(headGeo, holoMat);
  head.position.y = 2.3;
  head.scale.set(1, 1.1, 0.95);
  group.add(head);
  const headWire = new THREE.Mesh(headGeo, wireMat);
  headWire.position.copy(head.position);
  headWire.scale.copy(head.scale);
  group.add(headWire);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.325, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.5), capMat);
  cap.position.y = 2.31;
  cap.scale.set(1, 1.12, 0.97);
  group.add(cap);

  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), chromeMat);
  mask.position.set(0, 2.22, 0.14);
  mask.scale.set(1.15, 0.78, 0.72);
  group.add(mask);

  // Scrub V-neck, in place of the physician's coat lapels.
  const neckLineGeo = new THREE.BoxGeometry(0.055, 0.42, 0.03);
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(neckLineGeo, chromeMat);
    edge.position.set(side * 0.12, 1.52, 0.5);
    edge.rotation.set(0.16, 0, side * 0.34);
    group.add(edge);
  }

  const shoulderGeo = new THREE.SphereGeometry(0.22, 20, 16);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(shoulderGeo, holoMat);
    shoulder.position.set(side * 0.54, 1.63, 0);
    group.add(shoulder);
  }

  // Left arm hangs; sits outside the scrub radius so it reads as an arm.
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.66, 6, 16), holoMat);
  leftArm.position.set(-0.67, 1.02, 0);
  leftArm.rotation.z = -0.08;
  group.add(leftArm);
  const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 14), gloveMat);
  leftGlove.position.set(-0.7, 0.6, 0.02);
  group.add(leftGlove);

  // Right arm is a pivot group so glove and tube stay attached through the
  // pose, instead of each prop being hand-placed in world space.
  const rightArm = new THREE.Group();
  rightArm.position.set(0.56, 1.62, 0);
  rightArm.rotation.set(-0.95, 0, 0.3);
  group.add(rightArm);

  const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.62, 6, 16), holoMat);
  upperArm.position.y = -0.38;
  rightArm.add(upperArm);

  const rightGlove = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), gloveMat);
  rightGlove.position.y = -0.78;
  rightArm.add(rightGlove);

  // The held vacutainer — pulsed by the render loop as the live-draw beat.
  const heldTube = new THREE.Group();
  heldTube.position.y = -0.98;
  const tubeGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, 0.3, 18),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  heldTube.add(tubeGlass);
  const tubeFill = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.17, 16), bloodMat);
  tubeFill.position.y = -0.06;
  heldTube.add(tubeFill);
  const tubeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 18), strapMat);
  tubeCap.position.y = 0.17;
  heldTube.add(tubeCap);
  rightArm.add(heldTube);

  // Carrier strap: right shoulder down to the left hip, ending exactly where
  // the kit hangs. Any longer and it reads as a loose bar crossing the belt.
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.095, 1.15, 0.04), strapMat);
  strap.position.set(0, 1.2, 0.5);
  strap.rotation.z = 0.62;
  group.add(strap);

  // Sample carrier at the front-left hip with colour-capped tubes standing in
  // it — the clearest "this is a sample collector" cue in the silhouette. Worn
  // forward rather than side-on so it clears the left arm instead of hiding it.
  const carrier = new THREE.Group();
  carrier.position.set(-0.46, 0.68, 0.52);
  carrier.rotation.y = 0.55;
  carrier.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.2), chromeMat));
  const rackTubeGeo = new THREE.CylinderGeometry(0.037, 0.037, 0.22, 12);
  const rackCapGeo = new THREE.CylinderGeometry(0.043, 0.043, 0.045, 12);
  [0x8b5cf6, 0xef4444, 0x38bdf8].forEach((hex, i) => {
    const x = (i - 1) * 0.11;
    const tube = new THREE.Mesh(rackTubeGeo, holoMat);
    tube.position.set(x, 0.19, 0);
    carrier.add(tube);
    const rackCap = new THREE.Mesh(
      rackCapGeo,
      new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 1.2,
        roughness: 0.3,
        metalness: 0.3,
      })
    );
    rackCap.position.set(x, 0.31, 0);
    carrier.add(rackCap);
  });
  group.add(carrier);

  // Waist drawstring.
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.028, 10, 44), strapMat);
  belt.position.y = 0.92;
  belt.rotation.x = Math.PI / 2;
  group.add(belt);

  // ID badge: a blood droplet rather than the physician's medical cross.
  const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), bloodMat);
  droplet.position.set(-0.3, 1.42, 0.48);
  droplet.scale.set(0.85, 1.25, 0.6);
  group.add(droplet);

  return { group, pulse: heldTube, accent: droplet };
}

const HORIZONS: { id: Horizon; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "upcoming", label: "Upcoming" },
];

export default function PhleboFieldOps3D({ tasks }: Props) {
  const [horizon, setHorizon] = useState<Horizon>("today");
  const [jobs, setJobs] = useState<FieldRun[]>([]);
  const [syncFailed, setSyncFailed] = useState(false);

  // Read-only roster read, against the endpoint the schedule widget already uses.
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setSyncFailed(true);
      return;
    }
    const controller = new AbortController();
    fetch(`${apiBase}/api/phlebo/jobs?timeframe=${horizon}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
        setSyncFailed(false);
      })
      .catch((err) => {
        if ((err as Error)?.name === "AbortError") return;
        // Never fall back to invented volume — an empty ring is the truth here.
        setJobs([]);
        setSyncFailed(true);
      });
    return () => controller.abort();
  }, [horizon]);

  // Live dispatch runs belong to today only; folding them into a future horizon
  // would show work that is not scheduled for that day.
  const stats = useMemo(
    () => summariseRuns(jobs, horizon === "today" ? tasks || [] : []),
    [jobs, tasks, horizon]
  );

  const stages: FieldStage[] = [
    {
      id: "scheduled",
      title: "SCHEDULED",
      count: stats.scheduled,
      color: 0x38bdf8,
      css: "#38bdf8",
      cardTitle: "Scheduled Runs",
      cardSubtitle: stats.nextSlot ? `Next draw ${stats.nextSlot}` : "Doorstep roster",
      icon: <CalendarDays size={18} />,
      tint: "rgba(56, 189, 248, 0.2)",
      border: "rgba(56, 189, 248, 0.4)",
    },
    {
      id: "in_field",
      title: "IN FIELD",
      count: stats.inField,
      color: 0xf59e0b,
      css: "#fbbf24",
      cardTitle: "In Field",
      cardSubtitle: "En route · At doorstep · Drawing",
      icon: <Navigation size={18} />,
      tint: "rgba(245, 158, 11, 0.2)",
      border: "rgba(245, 158, 11, 0.4)",
    },
    {
      id: "handover",
      title: "LAB HANDOVER",
      count: stats.handover,
      color: 0x10b981,
      css: "#34d399",
      cardTitle: "Lab Handover",
      cardSubtitle: "Collected · Awaiting lab drop",
      icon: <TestTube size={18} />,
      tint: "rgba(16, 185, 129, 0.2)",
      border: "rgba(16, 185, 129, 0.4)",
    },
  ];

  return (
    <FieldOps3DHub
      title="3D Field Collection Intelligence"
      badge="Holographic Draw Model"
      subtitle="Holographic sample collector orbited by live run rings — Scheduled, In Field, Lab Handover"
      stages={stages}
      buildFigure={buildCollector}
      summaryLabel="Total runs"
      summaryNote={`${stats.tests} tests booked`}
      statusMessage={syncFailed ? "Roster sync unavailable" : null}
      controls={
        // Each option is a real roster query, not a projection.
        <div style={{ display: "flex", gap: 6 }}>
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHorizon(h.id)}
              aria-pressed={horizon === h.id}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: "11px",
                fontWeight: 700,
                border: horizon === h.id ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                background: horizon === h.id ? "rgba(2, 132, 199, 0.35)" : "rgba(15, 23, 42, 0.6)",
                color: horizon === h.id ? "#fff" : "#94a3b8",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {h.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
