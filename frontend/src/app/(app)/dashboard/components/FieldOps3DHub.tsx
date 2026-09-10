"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BarChart3, RefreshCw, Sparkles } from "@/components/ui/icons";

/**
 * Shared holographic field-operations hub.
 *
 * The scene, interaction, resize and disposal behaviour is identical for every
 * visiting-provider role; only the figure at the centre, the three stage rings
 * and the sidebar copy change. Roles own their own data fetching and hand the
 * finished counts down, so this file never knows about an endpoint.
 */

export interface FieldStage {
  /** Stable key used for focus state. */
  id: string;
  /** Ring chip label, upper case, e.g. "AT BEDSIDE". */
  title: string;
  count: number;
  /** three.js ring colour. */
  color: number;
  /** CSS twin of `color`, for the sprite chip and the sidebar accent. */
  css: string;
  cardTitle: string;
  cardSubtitle: string;
  icon: React.ReactNode;
  /** Sidebar icon chip background and border. */
  tint: string;
  border: string;
}

export interface FigureParts {
  group: THREE.Group;
  /** Scaled by the render loop as the role's live-work beat. */
  pulse: THREE.Object3D;
  /** Optional slower accent beat, scaled on Y only. */
  accent?: THREE.Object3D;
}

interface Props {
  title: string;
  badge: string;
  subtitle: string;
  /** Exactly three stages, outermost ring last. */
  stages: FieldStage[];
  /** Must be stable across renders — read through a ref, never a scene dep. */
  buildFigure: () => FigureParts;
  summaryLabel: string;
  /** Right-hand note on the summary ribbon, e.g. "10 tests booked". */
  summaryNote: string;
  /** Replaces the HUD hint and turns the status dot red when set. */
  statusMessage?: string | null;
  /** Role-owned header control, e.g. a horizon selector. */
  controls?: React.ReactNode;
}

/**
 * Fixed geometry for the three rings. The faint full torus is the 100% track,
 * the bright thick arc is that stage's share of the total, and the orbiting
 * beads are the individual jobs.
 */
const RING_SLOTS = [
  { radius: 2.3, tiltX: -0.22, tiltY: 0, y: 0.85, spin: 0.0042, labelPos: [-1.95, 0.6, 2.0] as const },
  { radius: 2.95, tiltX: 0.2, tiltY: 0.6, y: 1.45, spin: -0.0032, labelPos: [2.25, 1.6, 1.75] as const },
  { radius: 3.55, tiltX: -0.16, tiltY: -0.7, y: 2.05, spin: 0.0024, labelPos: [-2.5, 2.75, 1.3] as const },
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

export default function FieldOps3DHub({
  title,
  badge,
  subtitle,
  stages,
  buildFigure,
  summaryLabel,
  summaryNote,
  statusMessage,
  controls,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [focusStage, setFocusStage] = useState<string | null>(null);

  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Live values the render loop and the scene builder read, so a changing prop
  // identity never tears down a working WebGL context.
  const rotatingRef = useRef(isRotating);
  const focusRef = useRef<string | null>(focusStage);
  const stagesRef = useRef(stages);
  const buildFigureRef = useRef(buildFigure);
  useEffect(() => {
    rotatingRef.current = isRotating;
  }, [isRotating]);
  useEffect(() => {
    focusRef.current = focusStage;
  }, [focusStage]);
  useEffect(() => {
    stagesRef.current = stages;
    buildFigureRef.current = buildFigure;
  });

  // Primitive dep: the scene rebuilds only when a count actually moves.
  const countKey = useMemo(() => stages.map((s) => `${s.id}:${s.count}`).join("|"), [stages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const config = stagesRef.current;
    const runTotal = config.reduce((sum, s) => sum + s.count, 0);

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

    const { group: figure, pulse, accent } = buildFigureRef.current();
    figure.position.y = 0.16;
    figure.scale.setScalar(1.2);
    rootGroup.add(figure);

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

    // Shared bead geometry: one job bead is a body plus a coloured cap.
    const beadBodyGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 12);
    const beadCapGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.05, 12);
    const hitProxies: THREE.Mesh[] = [];
    const labelGroup = new THREE.Group();
    scene.add(labelGroup);

    const rings = config.slice(0, RING_SLOTS.length).map((stage, index) => {
      const slot = RING_SLOTS[index];
      const count = stage.count;
      const ratio = runTotal > 0 ? count / runTotal : 0;

      const group = new THREE.Group();
      group.position.y = slot.y;
      // YXZ so tiltY swings the tilt direction around a ring that stays near-horizontal.
      group.rotation.order = "YXZ";
      group.rotation.set(-Math.PI / 2 + slot.tiltX, slot.tiltY, 0);

      const trackMat = new THREE.MeshBasicMaterial({
        color: stage.color,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(new THREE.TorusGeometry(slot.radius, 0.016, 8, 128), trackMat));

      // Bright arc = this stage's share of the provider's workload.
      const arcLen = Math.max(0.18, ratio * Math.PI * 2);
      const arcMat = new THREE.MeshBasicMaterial({
        color: stage.color,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(new THREE.TorusGeometry(slot.radius, 0.055, 10, 128, arcLen), arcMat));

      // One bead per job, capped so a busy day stays readable. An empty stage
      // keeps a dim idle ring rather than collapsing to a bare circle.
      const beadCount = count > 0 ? Math.min(12, count) : 3;
      const beadBodyMat = new THREE.MeshBasicMaterial({
        color: 0xe2f3ff,
        transparent: true,
        opacity: count > 0 ? 0.85 : 0.3,
        depthWrite: false,
      });
      const beadCapMat = new THREE.MeshBasicMaterial({
        color: stage.color,
        transparent: true,
        opacity: count > 0 ? 1 : 0.35,
      });
      const beads = new THREE.Group();
      for (let i = 0; i < beadCount; i += 1) {
        const angle = (i / beadCount) * Math.PI * 2;
        const bead = new THREE.Group();
        bead.position.set(Math.cos(angle) * slot.radius, Math.sin(angle) * slot.radius, 0);
        // Lay each bead along the ring radius, cap outward, like a rotor rack.
        bead.rotation.z = angle - Math.PI / 2;
        bead.add(new THREE.Mesh(beadBodyGeo, beadBodyMat));
        const beadCap = new THREE.Mesh(beadCapGeo, beadCapMat);
        beadCap.position.y = 0.105;
        bead.add(beadCap);
        beads.add(bead);
      }
      group.add(beads);

      // Fat invisible torus gives the thin ring a forgiving hover/click target.
      const proxy = new THREE.Mesh(
        new THREE.TorusGeometry(slot.radius, 0.3, 6, 48),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      proxy.userData.stage = stage.id;
      group.add(proxy);
      hitProxies.push(proxy);

      const label = makeLabelSprite(stage.title, `${count} · ${Math.round(ratio * 100)}%`, stage.css);
      if (label) {
        label.position.set(slot.labelPos[0], slot.labelPos[1], slot.labelPos[2]);
        labelGroup.add(label);
      }

      rootGroup.add(group);
      return {
        id: stage.id,
        group,
        trackMat,
        arcMat,
        beadBodyMat,
        beadCapMat,
        beads,
        label,
        spin: slot.spin,
        lit: count > 0,
      };
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
      const target = hits[0]?.object.userData.stage as string | undefined;
      // Local highlight only — this hub never drives dispatch or roster state.
      if (target) setFocusStage((prev) => (prev === target ? null : target));
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

      figure.position.y = 0.16 + Math.sin(t * 1.1) * 0.045 * motion;
      pulse.scale.setScalar(1 + Math.sin(t * 4.4) * 0.09 * motion);
      if (accent) accent.scale.y = 1.25 + Math.sin(t * 2.2) * 0.12 * motion;

      const sweep = reduceMotion ? 0.5 : (t * 0.42) % 1;
      scanRing.position.y = 0.25 + sweep * 2.75;
      (scanRing.material as THREE.MeshBasicMaterial).opacity = 0.6 * Math.sin(sweep * Math.PI);

      dust.rotation.y += 0.0006 * motion;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      const nextHover = (hits[0]?.object.userData.stage as string | undefined) ?? null;
      if (nextHover !== hovered) {
        hovered = nextHover;
        setHoveredStage(nextHover);
      }
      domEl.style.cursor = nextHover ? "pointer" : dragging ? "grabbing" : "grab";

      const focus = hovered ?? focusRef.current;

      for (const ring of rings) {
        const isFocus = focus === ring.id;
        const dim = focus !== null && !isFocus;
        // An empty stage stays visibly quiet even when nothing else is focused.
        const base = ring.lit ? 1 : 0.35;

        ring.beads.rotation.z += ring.spin * motion * (isFocus ? 2.2 : 1);
        ring.arcMat.opacity = lerp(ring.arcMat.opacity, isFocus ? 1 : dim ? 0.2 : 0.72, 0.12);
        ring.trackMat.opacity = lerp(ring.trackMat.opacity, dim ? 0.09 : 0.26, 0.12);
        ring.beadCapMat.opacity = lerp(ring.beadCapMat.opacity, dim ? 0.25 : base, 0.12);
        ring.beadBodyMat.opacity = lerp(ring.beadBodyMat.opacity, dim ? 0.2 : base * 0.85, 0.12);
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
  }, [countKey]);

  const cardStyle: React.CSSProperties = {
    width: "100%",
    font: "inherit",
    color: "inherit",
    textAlign: "left",
  };

  const focusedId = hoveredStage || focusStage;
  const focused = stages.find((s) => s.id === focusedId);

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
              <span>{title}</span>
              <span className="cm-3d-hub__badge">{badge}</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 500, marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        {controls}
      </div>

      {/* Main Grid: 3D Viewport + Stage Sidebar */}
      <div className="cm-3d-hub__body">
        <div className="cm-3d-viewport">
          {/* Canvas mount only — every figure it shows is duplicated in the sidebar */}
          <div ref={containerRef} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />

          {/* Top-Left Status Overlay */}
          <div className="cm-3d-hud-overlay">
            <div className="cm-3d-hud-chip">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: statusMessage ? "#f87171" : "#4ade80",
                  boxShadow: statusMessage ? "0 0 6px #f87171" : "0 0 6px #4ade80",
                }}
              />
              {statusMessage ? (
                <span>{statusMessage}</span>
              ) : focused ? (
                <span>
                  Focus: <strong style={{ color: "#38bdf8" }}>{focused.cardTitle}</strong>
                </span>
              ) : (
                <span>Drag to orbit · Click a ring to focus</span>
              )}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="cm-3d-hud-controls">
            <button
              type="button"
              className="cm-3d-control-btn"
              onClick={() => setIsRotating((v) => !v)}
              title="Toggle auto-rotation"
            >
              <RefreshCw size={12} />
              <span>{isRotating ? "Auto-Orbit On" : "Orbit Paused"}</span>
            </button>
            <button type="button" className="cm-3d-control-btn" onClick={() => setFocusStage(null)}>
              <span>Reset Focus</span>
            </button>
          </div>
        </div>

        {/* Stage Breakdown Sidebar */}
        <div className="cm-3d-sidebar">
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              className={`cm-3d-modality-card ${focusStage === stage.id ? "cm-3d-modality-card--active" : ""}`}
              onClick={() => setFocusStage((prev) => (prev === stage.id ? null : stage.id))}
              aria-pressed={focusStage === stage.id}
              style={cardStyle}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  className="cm-3d-modality-card__icon"
                  style={{ background: stage.tint, border: `1px solid ${stage.border}`, color: stage.css }}
                >
                  {stage.icon}
                </span>
                <span>
                  <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 800, color: "#f1f5f9" }}>
                    {stage.cardTitle}
                  </span>
                  <span style={{ display: "block", fontSize: "0.72rem", color: "#94a3b8" }}>{stage.cardSubtitle}</span>
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                <span className="cm-3d-modality-card__count" style={{ display: "block" }}>
                  {stage.count}
                </span>
                <span style={{ display: "block", fontSize: "10px", color: stage.css, fontWeight: 700 }}>
                  {pct(stage.count)}% of total
                </span>
              </span>
            </button>
          ))}

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
              gap: 12,
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
              <BarChart3 size={14} style={{ color: "#38bdf8" }} />
              <span>{summaryLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38bdf8" }}>{total}</span>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>{summaryNote}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
