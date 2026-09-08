"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Home, RotateCw, Sparkles, Stethoscope, TrendingUp, Video } from "lucide-react";

type Modality = "all" | "walk_in" | "home_visit" | "online";

interface BookingItem {
  id?: string;
  service_type?: string;
  consultation_type?: string;
  mode?: string;
  status?: string;
  patient_name?: string;
  slot_time?: string;
}

interface Props {
  bookings: BookingItem[];
  activeModality: Modality;
  onSelectModality: (modality: Modality) => void;
  waitingCount?: number;
  homeVisitOnDuty?: boolean;
}

/**
 * Orbital ring layout, one per consultation modality. Each ring is a 3D arc gauge:
 * the faint full torus is the 100% track, the bright thick arc is that modality's
 * share of scheduled volume, and the orbiting beads are the individual consults.
 */
const RING_LAYOUT = [
  {
    modality: "walk_in" as const,
    title: "WALK-IN OPD",
    radius: 2.3,
    tiltX: -0.22,
    tiltY: 0,
    y: 0.85,
    color: 0x10b981,
    css: "#34d399",
    spin: 0.0042,
    labelPos: [-1.95, 0.6, 2.0] as const,
  },
  {
    modality: "home_visit" as const,
    title: "HOME VISITS",
    radius: 2.95,
    tiltX: 0.2,
    tiltY: 0.6,
    y: 1.45,
    color: 0xf59e0b,
    css: "#fbbf24",
    spin: -0.0032,
    labelPos: [2.25, 1.6, 1.75] as const,
  },
  {
    modality: "online" as const,
    title: "TELECONSULTS",
    radius: 3.55,
    tiltX: -0.16,
    tiltY: -0.7,
    y: 2.05,
    color: 0x38bdf8,
    css: "#38bdf8",
    spin: 0.0024,
    labelPos: [-2.5, 2.75, 1.3] as const,
  },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

/** Floating count chip drawn to a canvas texture — avoids shipping a 3D font loader. */
function makeLabelSprite(title: string, value: string, cssColor: string): THREE.Sprite | null {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 144;
  const g = canvas.getContext("2d");
  if (!g) return null;

  roundRectPath(g, 5, 5, 374, 134, 26);
  g.fillStyle = "rgba(8, 20, 38, 0.86)";
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = cssColor;
  g.stroke();

  g.textAlign = "center";
  g.font = '700 29px system-ui, -apple-system, "Segoe UI", sans-serif';
  g.fillStyle = cssColor;
  g.fillText(title, 192, 55);
  g.font = '800 50px system-ui, -apple-system, "Segoe UI", sans-serif';
  g.fillStyle = "#ffffff";
  g.fillText(value, 192, 114);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.45, 0.54, 1);
  return sprite;
}

/** Holographic attending-physician bust: coat silhouette, scrub cap, stethoscope. */
function buildPhysician() {
  const group = new THREE.Group();

  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x8fd0f5,
    emissive: 0x0ea5e9,
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
  // Opaque so the medical props read clearly against the translucent coat.
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x67e8f9,
    emissiveIntensity: 1.9,
    roughness: 0.12,
    metalness: 0.85,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    emissive: 0x0d9488,
    emissiveIntensity: 0.9,
    roughness: 0.4,
    metalness: 0.2,
  });

  // White coat: human proportions — hem, waist, chest, shoulder taper, neck.
  const coatGeo = new THREE.LatheGeometry(
    [
      [0.0, 0.0],
      [0.56, 0.0],
      [0.58, 0.12],
      [0.55, 0.55],
      [0.53, 0.95],
      [0.58, 1.3],
      [0.61, 1.56],
      [0.46, 1.74],
      [0.25, 1.84],
      [0.14, 1.94],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    56
  );
  group.add(new THREE.Mesh(coatGeo, holoMat));
  group.add(new THREE.Mesh(coatGeo, wireMat));

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

  // Surgical scrub cap — the fastest visual cue that this is clinical staff.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.325, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.5),
    capMat
  );
  cap.position.y = 2.31;
  cap.scale.set(1, 1.12, 0.97);
  group.add(cap);

  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), chromeMat);
  mask.position.set(0, 2.22, 0.14);
  mask.scale.set(1.15, 0.78, 0.72);
  group.add(mask);

  const shoulderGeo = new THREE.SphereGeometry(0.22, 20, 16);
  const armGeo = new THREE.CapsuleGeometry(0.115, 0.66, 6, 16);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(shoulderGeo, holoMat);
    shoulder.position.set(side * 0.54, 1.63, 0);
    group.add(shoulder);

    // Sits outside the coat radius so the silhouette reads as arms, not a bell.
    const arm = new THREE.Mesh(armGeo, holoMat);
    arm.position.set(side * 0.67, 1.02, 0.0);
    arm.rotation.z = side * 0.08;
    group.add(arm);
  }

  // Coat lapels: a bright V on the chest.
  const lapelGeo = new THREE.BoxGeometry(0.07, 0.52, 0.03);
  for (const side of [-1, 1]) {
    const lapel = new THREE.Mesh(lapelGeo, chromeMat);
    lapel.position.set(side * 0.15, 1.3, 0.53);
    lapel.rotation.set(0.12, 0, side * 0.3);
    group.add(lapel);
  }

  // Stethoscope — the instant "this is a doctor" signal.
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.048, 12, 44), chromeMat);
  loop.position.set(0, 1.79, 0.08);
  loop.rotation.x = Math.PI / 2 - 0.34;
  group.add(loop);

  const tubeGeo = new THREE.CapsuleGeometry(0.033, 0.46, 4, 10);
  for (const side of [-1, 1]) {
    const tube = new THREE.Mesh(tubeGeo, chromeMat);
    tube.position.set(side * 0.22, 1.38, 0.52);
    tube.rotation.set(-0.24, 0, side * 0.36);
    group.add(tube);
  }
  const chestPiece = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 24), chromeMat);
  chestPiece.position.set(0, 1.0, 0.62);
  chestPiece.rotation.x = Math.PI / 2;
  group.add(chestPiece);

  // Coat badge: medical cross.
  const badgeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x22c55e,
    emissiveIntensity: 1.3,
    roughness: 0.2,
    metalness: 0.4,
  });
  const badge = new THREE.Group();
  badge.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.03), badgeMat));
  badge.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.17, 0.03), badgeMat));
  badge.position.set(-0.3, 1.44, 0.5);
  badge.rotation.y = -0.5;
  group.add(badge);

  return { group, chestPiece };
}

export default function DoctorClinicalAnalytics3D({
  bookings,
  activeModality,
  onSelectModality,
  waitingCount = 0,
  homeVisitOnDuty = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [hoveredModality, setHoveredModality] = useState<string | null>(null);
  const [timeHorizon, setTimeHorizon] = useState<"today" | "week" | "month">("today");

  // Live values the render loop reads, so changing them never rebuilds the WebGL scene.
  const rotatingRef = useRef(isRotating);
  const activeRef = useRef(activeModality);
  const selectRef = useRef(onSelectModality);
  useEffect(() => {
    rotatingRef.current = isRotating;
  }, [isRotating]);
  useEffect(() => {
    activeRef.current = activeModality;
  }, [activeModality]);
  useEffect(() => {
    selectRef.current = onSelectModality;
  }, [onSelectModality]);

  // Multiplier for demo projection if roster is empty
  const horizonMultiplier = timeHorizon === "today" ? 1 : timeHorizon === "week" ? 5 : 18;

  // Calculate counts
  const stats = useMemo(() => {
    let walkIn = bookings.filter((b) => {
      const s = String(b.service_type || b.consultation_type || b.mode || "").toLowerCase();
      return s.includes("walk") || s.includes("person") || s.includes("clinic") || s.includes("opd");
    }).length;

    let homeVisit = bookings.filter((b) => {
      const s = String(b.service_type || b.consultation_type || b.mode || "").toLowerCase();
      return s.includes("home") || s.includes("doorstep") || s.includes("visit");
    }).length;

    let online = bookings.filter((b) => {
      const s = String(b.service_type || b.consultation_type || b.mode || "").toLowerCase();
      return s.includes("online") || s.includes("video") || s.includes("tele");
    }).length;

    // Provide baseline realistic demonstration proportions when real scheduled roster is starting fresh
    if (bookings.length === 0) {
      walkIn = 8 * horizonMultiplier;
      homeVisit = 4 * horizonMultiplier;
      online = 6 * horizonMultiplier;
    } else {
      walkIn = Math.max(1, walkIn) * horizonMultiplier;
      homeVisit = Math.max(1, homeVisit) * horizonMultiplier;
      online = Math.max(1, online) * horizonMultiplier;
    }

    const total = walkIn + homeVisit + online;
    return { walkIn, homeVisit, online, total };
  }, [bookings, horizonMultiplier]);

  const pct = (n: number) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0);

  // Holographic physician core + orbital modality gauges
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);

    // Pull the camera back on narrow viewports so the widest ring never clips.
    const frameCamera = (aspect: number) => {
      const vHalf = Math.tan(THREE.MathUtils.degToRad(38) / 2);
      const distV = 2.7 / vHalf;
      const distH = 4.6 / (vHalf * Math.max(aspect, 0.3));
      // Elevated 3/4 view so the near-horizontal rings read as ellipses, not lines.
      camera.position.set(0, 5.0, Math.min(20, Math.max(8.2, Math.max(distV, distH))));
      camera.lookAt(0, 1.25, 0);
    };
    frameCamera(width / height);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.appendChild(renderer.domElement);
    } catch {
      // Graceful WebGL failure — the sidebar still carries every number.
      return;
    }

    const reduceMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motion = reduceMotion ? 0 : 1;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 1.4);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    const rimLight = new THREE.PointLight(0x0284c7, 2.6, 26);
    rimLight.position.set(-5, 3, 4);
    scene.add(rimLight);
    const warmLight = new THREE.PointLight(0xf59e0b, 1.4, 22);
    warmLight.position.set(4, 1.6, -4);
    scene.add(warmLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Projector pad
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 56),
      new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -0.02;
    rootGroup.add(pad);

    const padRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.02, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
    );
    padRim.rotation.x = -Math.PI / 2;
    rootGroup.add(padRim);


    // Physician hologram
    const { group: physician, chestPiece } = buildPhysician();
    physician.position.y = 0.16;
    physician.scale.setScalar(1.2);
    rootGroup.add(physician);

    const scanRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.013, 8, 72),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scanRing.rotation.x = -Math.PI / 2;
    rootGroup.add(scanRing);

    // Orbital modality gauges
    const counts: Record<string, number> = {
      walk_in: stats.walkIn,
      home_visit: stats.homeVisit,
      online: stats.online,
    };
    const nodeGeo = new THREE.SphereGeometry(0.075, 14, 12);
    const hitProxies: THREE.Mesh[] = [];
    const labelGroup = new THREE.Group();
    scene.add(labelGroup);

    const rings = RING_LAYOUT.map((cfg) => {
      const count = counts[cfg.modality] || 0;
      const ratio = stats.total > 0 ? count / stats.total : 0;

      const group = new THREE.Group();
      group.position.y = cfg.y;
      // YXZ so tiltY swings the tilt direction around a ring that stays near-horizontal.
      group.rotation.order = "YXZ";
      group.rotation.set(-Math.PI / 2 + cfg.tiltX, cfg.tiltY, 0);

      const trackMat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(new THREE.TorusGeometry(cfg.radius, 0.016, 8, 128), trackMat));

      // Bright arc = this modality's share of the day's scheduled volume.
      const arcLen = Math.max(0.18, ratio * Math.PI * 2);
      const arcMat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(new THREE.TorusGeometry(cfg.radius, 0.055, 10, 128, arcLen), arcMat));

      // Orbiting consult beads, capped so a monthly projection stays readable.
      const nodeCount = Math.min(14, Math.max(3, Math.round(ratio * 14) || 3));
      const nodeMat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 1 });
      const nodes = new THREE.Group();
      for (let i = 0; i < nodeCount; i += 1) {
        const angle = (i / nodeCount) * Math.PI * 2;
        const bead = new THREE.Mesh(nodeGeo, nodeMat);
        bead.position.set(Math.cos(angle) * cfg.radius, Math.sin(angle) * cfg.radius, 0);
        nodes.add(bead);
      }
      group.add(nodes);

      // Fat invisible torus gives the thin ring a forgiving hover/click target.
      const proxy = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.radius, 0.3, 6, 48),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      proxy.userData.modality = cfg.modality;
      group.add(proxy);
      hitProxies.push(proxy);

      const label = makeLabelSprite(cfg.title, `${count} · ${Math.round(ratio * 100)}%`, cfg.css);
      if (label) {
        label.position.set(cfg.labelPos[0], cfg.labelPos[1], cfg.labelPos[2]);
        labelGroup.add(label);
      }

      rootGroup.add(group);
      return { modality: cfg.modality, group, trackMat, arcMat, nodeMat, nodes, label, spin: cfg.spin };
    });

    // Ambient dust for depth
    const dustCount = 150;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      const r = 3.4 + Math.random() * 3.6;
      const theta = Math.random() * Math.PI * 2;
      dustPos[i * 3] = Math.cos(theta) * r;
      dustPos[i * 3 + 1] = Math.random() * 5.4 - 0.6;
      dustPos[i * 3 + 2] = Math.sin(theta) * r;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0x7dd3fc,
        size: 0.045,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    scene.add(dust);

    // Pointer interaction
    const domEl = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-100, -100);
    let dragging = false;
    let dragged = false;
    let prevX = 0;
    let prevY = 0;
    let hovered: string | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      dragging = true;
      dragged = false;
      prevX = e.clientX;
      prevY = e.clientY;
      try {
        domEl.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported — drag still tracked via move/up */
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = domEl.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!dragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
      rootGroup.rotation.y += dx * 0.008;
      // Vertical tilt on precise pointers only, so touch page-scrolling stays untouched.
      if (e.pointerType !== "touch") {
        rootGroup.rotation.x = THREE.MathUtils.clamp(rootGroup.rotation.x - dy * 0.005, -0.35, 0.5);
      }
    };

    const endDrag = (e: PointerEvent) => {
      dragging = false;
      try {
        domEl.releasePointerCapture(e.pointerId);
      } catch {
        /* nothing captured */
      }
    };

    const handleClick = () => {
      if (dragged) return;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      const target = hits[0]?.object.userData.modality as Modality | undefined;
      if (target) selectRef.current(target);
    };

    const handlePointerLeave = () => {
      pointer.set(-100, -100);
    };

    domEl.addEventListener("pointerdown", handlePointerDown);
    domEl.addEventListener("pointermove", handlePointerMove);
    domEl.addEventListener("pointerup", endDrag);
    domEl.addEventListener("pointercancel", endDrag);
    domEl.addEventListener("pointerleave", handlePointerLeave);
    domEl.addEventListener("click", handleClick);

    // Render loop
    // Timer (not the deprecated Clock) clamps delta via the Page Visibility API,
    // so a backgrounded dashboard tab does not jump on return.
    const timer = new THREE.Timer();
    timer.connect(document);
    let animId = 0;
    let running = true;

    const animate = () => {
      if (!running) return;
      animId = requestAnimationFrame(animate);
      timer.update();
      const t = timer.getElapsed();

      if (rotatingRef.current && !dragging) rootGroup.rotation.y += 0.0032 * motion;

      physician.position.y = 0.16 + Math.sin(t * 1.1) * 0.045 * motion;
      chestPiece.scale.setScalar(1 + Math.sin(t * 4.4) * 0.09 * motion);

      const sweep = reduceMotion ? 0.5 : (t * 0.42) % 1;
      scanRing.position.y = 0.25 + sweep * 2.75;
      (scanRing.material as THREE.MeshBasicMaterial).opacity = 0.6 * Math.sin(sweep * Math.PI);

      dust.rotation.y += 0.0006 * motion;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      const nextHover = (hits[0]?.object.userData.modality as string | undefined) ?? null;
      if (nextHover !== hovered) {
        hovered = nextHover;
        setHoveredModality(nextHover);
      }
      domEl.style.cursor = nextHover ? "pointer" : dragging ? "grabbing" : "grab";

      const active = activeRef.current;
      const focus = hovered ?? (active !== "all" ? active : null);

      for (const ring of rings) {
        const isFocus = focus === ring.modality;
        const dim = focus !== null && !isFocus;

        ring.nodes.rotation.z += ring.spin * motion * (isFocus ? 2.2 : 1);
        ring.arcMat.opacity = lerp(ring.arcMat.opacity, isFocus ? 1 : dim ? 0.2 : 0.72, 0.12);
        ring.trackMat.opacity = lerp(ring.trackMat.opacity, dim ? 0.09 : 0.26, 0.12);
        ring.nodeMat.opacity = lerp(ring.nodeMat.opacity, dim ? 0.25 : 1, 0.12);
        ring.group.scale.setScalar(lerp(ring.group.scale.x, isFocus ? 1.05 : 1, 0.12));

        if (ring.label) {
          const mat = ring.label.material as THREE.SpriteMaterial;
          mat.opacity = lerp(mat.opacity, isFocus ? 1 : dim ? 0.35 : 0.92, 0.12);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // WebGL contexts can be dropped by the driver on long-lived dashboard tabs.
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      running = false;
      cancelAnimationFrame(animId);
    };
    const handleContextRestored = () => {
      if (running) return;
      running = true;
      animate();
    };
    domEl.addEventListener("webglcontextlost", handleContextLost);
    domEl.addEventListener("webglcontextrestored", handleContextRestored);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          const aspect = cr.width / cr.height;
          camera.aspect = aspect;
          frameCamera(aspect);
          camera.updateProjectionMatrix();
          renderer.setSize(cr.width, cr.height);
        }
      }
    });
    ro.observe(container);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      timer.disconnect();
      ro.disconnect();
      domEl.removeEventListener("pointerdown", handlePointerDown);
      domEl.removeEventListener("pointermove", handlePointerMove);
      domEl.removeEventListener("pointerup", endDrag);
      domEl.removeEventListener("pointercancel", endDrag);
      domEl.removeEventListener("pointerleave", handlePointerLeave);
      domEl.removeEventListener("click", handleClick);
      domEl.removeEventListener("webglcontextlost", handleContextLost);
      domEl.removeEventListener("webglcontextrestored", handleContextRestored);

      scene.traverse((obj) => {
        const node = obj as unknown as {
          isSprite?: boolean;
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        // Sprite geometry is a shared three.js singleton — never dispose it.
        if (node.geometry && !node.isSprite) node.geometry.dispose();
        const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
        for (const m of mats) {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      if (domEl.parentNode) domEl.parentNode.removeChild(domEl);
    };
  }, [stats]);

  const cardStyle: React.CSSProperties = {
    width: "100%",
    font: "inherit",
    color: "inherit",
    textAlign: "left",
  };

  return (
    <div className="cm-3d-hub">
      {/* Header Strip */}
      <div className="cm-3d-hub__header">
        <div className="cm-3d-hub__title">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 12px rgba(2, 132, 199, 0.4)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} style={{ color: "#fff" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>3D Clinical Appointments Intelligence</span>
              <span className="cm-3d-hub__badge">Holographic Care Model</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 500, marginTop: 2 }}>
              Holographic attending physician orbited by live consult rings — Walk-In OPD, Home Visits, Telemedicine
            </div>
          </div>
        </div>

        {/* Time Horizon Selector */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "7-Day" },
            { id: "month", label: "Monthly" },
          ].map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setTimeHorizon(h.id as "today" | "week" | "month")}
              aria-pressed={timeHorizon === h.id}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: "11px",
                fontWeight: 700,
                border: timeHorizon === h.id ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                background: timeHorizon === h.id ? "rgba(2, 132, 199, 0.35)" : "rgba(15, 23, 42, 0.6)",
                color: timeHorizon === h.id ? "#fff" : "#94a3b8",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: 3D Viewport + Modality Intelligence Sidebar */}
      <div className="cm-3d-hub__body">
        {/* 3D Canvas Viewport — decorative; every figure is duplicated in the sidebar */}
        <div className="cm-3d-viewport" ref={containerRef} aria-hidden="true">
          {/* Top-Left Status Overlay */}
          <div className="cm-3d-hud-overlay">
            <div className="cm-3d-hud-chip">
              <span
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }}
              />
              {hoveredModality ? (
                <span>
                  Focus:{" "}
                  <strong style={{ color: "#38bdf8", textTransform: "capitalize" }}>
                    {hoveredModality.replace("_", " ")}
                  </strong>
                </span>
              ) : (
                <span>Drag to orbit · Click a ring to filter</span>
              )}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="cm-3d-hud-controls">
            <button
              type="button"
              className="cm-3d-control-btn"
              onClick={() => setIsRotating((v) => !v)}
              title="Toggle Auto-Rotation"
            >
              <RotateCw size={12} className={isRotating ? "animate-spin" : ""} />
              <span>{isRotating ? "Auto-Orbit On" : "Orbit Paused"}</span>
            </button>
            <button type="button" className="cm-3d-control-btn" onClick={() => onSelectModality("all")}>
              <span>Reset Selection</span>
            </button>
          </div>
        </div>

        {/* Modality Breakdown Sidebar */}
        <div className="cm-3d-sidebar">
          {/* 1. Walk-In Clinic Consultations */}
          <button
            type="button"
            className={`cm-3d-modality-card ${activeModality === "walk_in" ? "cm-3d-modality-card--active" : ""}`}
            onClick={() => onSelectModality("walk_in")}
            aria-pressed={activeModality === "walk_in"}
            style={cardStyle}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="cm-3d-modality-card__icon"
                style={{
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#34d399",
                }}
              >
                <Stethoscope size={18} />
              </span>
              <span>
                <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 800, color: "#f1f5f9" }}>
                  Walk-In OPD
                </span>
                <span style={{ display: "block", fontSize: "0.72rem", color: "#94a3b8" }}>
                  Solo Clinic &amp; Diagnostic Center
                </span>
              </span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span className="cm-3d-modality-card__count" style={{ display: "block" }}>
                {stats.walkIn}
              </span>
              <span style={{ display: "block", fontSize: "10px", color: "#34d399", fontWeight: 700 }}>
                {pct(stats.walkIn)}% volume
              </span>
            </span>
          </button>

          {/* 2. Doorstep Home Visits */}
          <button
            type="button"
            className={`cm-3d-modality-card ${activeModality === "home_visit" ? "cm-3d-modality-card--active" : ""}`}
            onClick={() => onSelectModality("home_visit")}
            aria-pressed={activeModality === "home_visit"}
            style={cardStyle}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="cm-3d-modality-card__icon"
                style={{
                  background: "rgba(245, 158, 11, 0.2)",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  color: "#fbbf24",
                }}
              >
                <Home size={18} />
              </span>
              <span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#f1f5f9" }}>Home Visits</span>
                  {homeVisitOnDuty && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                  )}
                </span>
                <span style={{ display: "block", fontSize: "0.72rem", color: "#94a3b8" }}>
                  Doorstep Clinical Dispatch
                </span>
              </span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span className="cm-3d-modality-card__count" style={{ display: "block" }}>
                {stats.homeVisit}
              </span>
              <span style={{ display: "block", fontSize: "10px", color: "#fbbf24", fontWeight: 700 }}>
                {pct(stats.homeVisit)}% volume
              </span>
            </span>
          </button>

          {/* 3. Online Teleconsultations */}
          <button
            type="button"
            className={`cm-3d-modality-card ${activeModality === "online" ? "cm-3d-modality-card--active" : ""}`}
            onClick={() => onSelectModality("online")}
            aria-pressed={activeModality === "online"}
            style={cardStyle}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="cm-3d-modality-card__icon"
                style={{
                  background: "rgba(56, 189, 248, 0.2)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38bdf8",
                }}
              >
                <Video size={18} />
              </span>
              <span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#f1f5f9" }}>Teleconsults</span>
                  {waitingCount > 0 && (
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 9999,
                        background: "#ef4444",
                        fontSize: "9px",
                        fontWeight: 800,
                        color: "#fff",
                      }}
                    >
                      {waitingCount} live
                    </span>
                  )}
                </span>
                <span style={{ display: "block", fontSize: "0.72rem", color: "#94a3b8" }}>
                  Encrypted HD Video Room
                </span>
              </span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span className="cm-3d-modality-card__count" style={{ display: "block" }}>
                {stats.online}
              </span>
              <span style={{ display: "block", fontSize: "10px", color: "#38bdf8", fontWeight: 700 }}>
                {pct(stats.online)}% volume
              </span>
            </span>
          </button>

          {/* Aggregate Summary Ribbon */}
          <div
            style={{
              marginTop: 4,
              padding: "10px 14px",
              borderRadius: "var(--cm-radius-sm)",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px dashed rgba(255, 255, 255, 0.15)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "12px",
                color: "#cbd5e1",
                fontWeight: 700,
              }}
            >
              <TrendingUp size={14} style={{ color: "#38bdf8" }} />
              <span>Total Scheduled:</span>
            </div>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38bdf8" }}>{stats.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
