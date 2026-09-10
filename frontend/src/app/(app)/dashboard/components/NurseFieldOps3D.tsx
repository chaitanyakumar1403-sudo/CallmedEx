"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Bell, HeartPulse, Navigation } from "@/components/ui/icons";
import FieldOps3DHub, { type FieldStage, type FigureParts } from "./FieldOps3DHub";
import { summariseNurseVisits } from "./fieldRunStages.mjs";

interface PendingOffer {
  offer_id?: string;
  dispatch_request_id?: string;
  priority?: string;
  distance_km?: number;
}

interface ActiveVisit {
  id?: string;
  dispatch_id?: string;
  booking_id?: string;
  status?: string;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Holographic visiting nurse: teal scrubs, the classic red-cross cap, a blood
 * pressure cuff on the left arm, a cross-marked care bag at the hip, and a
 * syringe in the gloved right hand. The cap, cuff and syringe are what keep
 * this silhouette distinct from the sample collector and the physician.
 *
 * Module scope, so its identity is stable and never rebuilds the hub's scene.
 */
function buildNurse(): FigureParts {
  const group = new THREE.Group();

  // Teal cast, the colour nurses actually wear, so the role reads before the props do.
  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x9fe8dc,
    emissive: 0x0d9488,
    emissiveIntensity: 0.6,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x5eead4,
    wireframe: true,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x67e8f9,
    emissiveIntensity: 1.9,
    roughness: 0.12,
    metalness: 0.85,
  });
  const linenMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe2e8f0,
    emissiveIntensity: 1.2,
    roughness: 0.5,
    metalness: 0.05,
  });
  const crossMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.6,
    roughness: 0.25,
    metalness: 0.2,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0xf0fdfa,
    emissive: 0x2dd4bf,
    emissiveIntensity: 1.1,
    roughness: 0.3,
    metalness: 0.15,
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x1e293b,
    emissiveIntensity: 1.0,
    roughness: 0.6,
    metalness: 0.2,
  });
  const fluidMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.1,
  });

  // Scrub top: hem, waist, chest, shoulder taper, neck.
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

  // The classic folded nurse cap: a flat white crown tipped back, with the red
  // cross on its front. Fastest possible read of the role.
  const capGroup = new THREE.Group();
  capGroup.position.set(0, 2.56, -0.04);
  capGroup.rotation.x = -0.26;
  capGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.13, 24), linenMat));
  const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), linenMat);
  capBrim.position.set(0, -0.05, 0.06);
  capGroup.add(capBrim);
  const capCross = new THREE.Group();
  capCross.add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.042, 0.02), crossMat));
  capCross.add(new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.02), crossMat));
  capCross.position.set(0, 0.02, 0.27);
  capGroup.add(capCross);
  group.add(capGroup);

  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), chromeMat);
  mask.position.set(0, 2.22, 0.14);
  mask.scale.set(1.15, 0.78, 0.72);
  group.add(mask);

  // Scrub V-neck.
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

  // Left arm hangs, wearing the BP cuff — the bedside-vitals signature.
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.66, 6, 16), holoMat);
  leftArm.position.set(-0.67, 1.02, 0);
  leftArm.rotation.z = -0.08;
  group.add(leftArm);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.26, 20), cuffMat);
  cuff.position.set(-0.665, 1.24, 0);
  cuff.rotation.z = -0.08;
  group.add(cuff);
  const cuffHose = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.24, 4, 10), cuffMat);
  cuffHose.position.set(-0.78, 1.06, 0.14);
  cuffHose.rotation.set(0.4, 0, -0.5);
  group.add(cuffHose);

  const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 14), gloveMat);
  leftGlove.position.set(-0.7, 0.6, 0.02);
  group.add(leftGlove);

  // Right arm is a pivot group so glove and syringe stay attached through the
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

  // The held syringe — pulsed by the render loop as the live-procedure beat.
  const syringe = new THREE.Group();
  syringe.position.y = -0.97;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.34, 18),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x7dd3fc,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  syringe.add(barrel);
  const dose = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.19, 16), fluidMat);
  dose.position.y = -0.05;
  syringe.add(dose);
  const plungerRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.17, 12), chromeMat);
  plungerRod.position.y = 0.24;
  syringe.add(plungerRod);
  const thumbPad = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 16), chromeMat);
  thumbPad.position.y = 0.33;
  syringe.add(thumbPad);
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.025, 16), chromeMat);
  flange.position.y = 0.16;
  syringe.add(flange);
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8), chromeMat);
  needle.position.y = -0.26;
  syringe.add(needle);
  rightArm.add(syringe);

  // Bag strap: right shoulder down to the left hip, ending where the bag hangs.
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.095, 1.15, 0.04), cuffMat);
  strap.position.set(0, 1.2, 0.5);
  strap.rotation.z = 0.62;
  group.add(strap);

  // Cross-marked care bag at the front-left hip, worn forward so it clears the
  // left arm. The phlebotomist carries an open tube rack here; a nurse carries
  // a closed procedure bag.
  const bag = new THREE.Group();
  bag.position.set(-0.46, 0.68, 0.52);
  bag.rotation.y = 0.55;
  bag.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.22), linenMat));
  const bagCross = new THREE.Group();
  bagCross.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.02), crossMat));
  bagCross.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.17, 0.02), crossMat));
  bagCross.position.set(0, 0.01, 0.12);
  bag.add(bagCross);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24, Math.PI), cuffMat);
  handle.position.set(0, 0.15, 0);
  handle.rotation.y = Math.PI / 2;
  bag.add(handle);
  group.add(bag);

  // Waist drawstring.
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.028, 10, 44), cuffMat);
  belt.position.y = 0.92;
  belt.rotation.x = Math.PI / 2;
  group.add(belt);

  // Chest badge: a beating heart, matching the bedside vitals work.
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 14), crossMat);
  heart.position.set(-0.3, 1.42, 0.48);
  heart.scale.set(0.95, 1.25, 0.6);
  group.add(heart);

  return { group, pulse: syringe, accent: heart };
}

export default function NurseFieldOps3D() {
  const [offers, setOffers] = useState<PendingOffer[]>([]);
  const [visits, setVisits] = useState<ActiveVisit[]>([]);
  const [syncFailed, setSyncFailed] = useState(false);

  // Two read-only dispatch reads, both already permitted for the nurse role.
  // Nothing here accepts, declines or otherwise changes a visit.
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setSyncFailed(true);
      return;
    }
    const controller = new AbortController();
    const auth = { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal };

    const read = (path: string) =>
      fetch(`${apiBase}${path}`, auth).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status)))
      );

    Promise.all([read("/api/dispatch/offers/pending"), read("/api/dispatch/my-tasks")])
      .then(([offerData, taskData]) => {
        setOffers(Array.isArray(offerData?.offers) ? offerData.offers : []);
        setVisits(Array.isArray(taskData?.tasks) ? taskData.tasks : []);
        setSyncFailed(false);
      })
      .catch((err) => {
        if ((err as Error)?.name === "AbortError") return;
        // A zeroed hub reads as "no work waiting", which is exactly the wrong
        // thing to tell a nurse during an outage — say the sync failed instead.
        setOffers([]);
        setVisits([]);
        setSyncFailed(true);
      });
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => summariseNurseVisits(offers, visits), [offers, visits]);

  const stages: FieldStage[] = [
    {
      id: "incoming",
      title: "INCOMING",
      count: stats.incoming,
      color: 0xf43f5e,
      css: "#fb7185",
      cardTitle: "Incoming Requests",
      cardSubtitle:
        stats.urgent > 0
          ? `${stats.urgent} urgent · awaiting your response`
          : "Doorstep offers awaiting your response",
      icon: <Bell size={18} />,
      tint: "rgba(244, 63, 94, 0.2)",
      border: "rgba(244, 63, 94, 0.4)",
    },
    {
      id: "en_route",
      title: "EN ROUTE",
      count: stats.enRoute,
      color: 0xf59e0b,
      css: "#fbbf24",
      cardTitle: "En Route",
      cardSubtitle: "Accepted · Travelling to the patient",
      icon: <Navigation size={18} />,
      tint: "rgba(245, 158, 11, 0.2)",
      border: "rgba(245, 158, 11, 0.4)",
    },
    {
      id: "bedside",
      title: "AT BEDSIDE",
      count: stats.bedside,
      color: 0x10b981,
      css: "#34d399",
      cardTitle: "At Bedside",
      cardSubtitle: "Arrived · Procedure in progress",
      icon: <HeartPulse size={18} />,
      tint: "rgba(16, 185, 129, 0.2)",
      border: "rgba(16, 185, 129, 0.4)",
    },
  ];

  const summaryNote =
    stats.urgent > 0
      ? `${stats.urgent} urgent`
      : stats.nearestKm !== null
        ? `nearest ${stats.nearestKm} km`
        : "no offers waiting";

  return (
    <FieldOps3DHub
      title="3D Doorstep Nursing Intelligence"
      badge="Holographic Care Model"
      subtitle="Holographic visiting nurse orbited by live visit rings — Incoming, En Route, At Bedside"
      stages={stages}
      buildFigure={buildNurse}
      summaryLabel="Live visits"
      summaryNote={summaryNote}
      statusMessage={syncFailed ? "Dispatch sync unavailable" : null}
    />
  );
}
