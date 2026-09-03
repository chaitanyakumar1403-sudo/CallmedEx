"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { RotateCw, ZoomIn, ZoomOut, Maximize2, Sparkles, Activity } from "lucide-react";

export interface OrganNode {
  id: string;
  name: string;
  y: number; // Vertical position in 3D space
  zOffset?: number;
  color: string;
  focusDistance: number;
}

export const ORGAN_3D_TARGETS: Record<string, OrganNode> = {
  head: { id: "head", name: "Brain & Nervous System", y: 2.1, color: "#4338ca", focusDistance: 2.8 },
  eyes: { id: "eyes", name: "Eyes & Vision", y: 2.05, zOffset: 0.35, color: "#0284c7", focusDistance: 2.6 },
  dental: { id: "dental", name: "Teeth & Oral Care", y: 1.85, zOffset: 0.35, color: "#0d9488", focusDistance: 2.5 },
  ent: { id: "ent", name: "Ears, Nose & Throat", y: 1.95, color: "#d97706", focusDistance: 2.5 },
  lungs: { id: "lungs", name: "Lungs & Respiratory", y: 1.1, color: "#0369a1", focusDistance: 3.2 },
  heart: { id: "heart", name: "Heart & Cardiovascular", y: 1.05, zOffset: 0.25, color: "#d92020", focusDistance: 2.9 },
  abdomen: { id: "abdomen", name: "Liver, Gut & Metabolism", y: 0.35, zOffset: 0.2, color: "#15803d", focusDistance: 3.4 },
  joints: { id: "joints", name: "Bones, Spine & Joints", y: -0.6, color: "#b45309", focusDistance: 3.8 },
  skin: { id: "skin", name: "Skin & Dermatology", y: 0.8, zOffset: 0.5, color: "#db2777", focusDistance: 3.5 },
};

interface AnatomicalTwin3DProps {
  selectedOrgan: string;
  onSelectOrgan: (organId: string) => void;
  className?: string;
}

export default function AnatomicalTwin3D({
  selectedOrgan,
  onSelectOrgan,
  className = "",
}: AnatomicalTwin3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true);
  const [rotationActive, setRotationActive] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.6, 0));
  const currentLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.6, 0));

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL support
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) {
        setWebGLSupported(false);
        return;
      }
    } catch {
      setWebGLSupported(false);
      return;
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 480;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xfcfdfd);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.8, 5.2);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x0284c7, 0.4);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x1a2b4a, 0.3);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // Create Anatomical Wireframe / Human Silhouette Form
    const bodyGroup = new THREE.Group();
    scene.add(bodyGroup);

    // Clinical Material
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    });

    const bodySolidMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.6,
      metalness: 0.05,
      transparent: true,
      opacity: 0.35,
    });

    // Head
    const headGeom = new THREE.SphereGeometry(0.42, 24, 24);
    const headMesh = new THREE.Mesh(headGeom, bodyMaterial);
    headMesh.position.set(0, 2.1, 0);
    bodyGroup.add(headMesh);

    const headSolid = new THREE.Mesh(headGeom, bodySolidMaterial);
    headSolid.position.set(0, 2.1, 0);
    bodyGroup.add(headSolid);

    // Neck
    const neckGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 16);
    const neckMesh = new THREE.Mesh(neckGeom, bodyMaterial);
    neckMesh.position.set(0, 1.7, 0);
    bodyGroup.add(neckMesh);

    // Chest & Torso
    const torsoGeom = new THREE.CylinderGeometry(0.58, 0.42, 1.6, 24);
    const torsoMesh = new THREE.Mesh(torsoGeom, bodyMaterial);
    torsoMesh.position.set(0, 0.8, 0);
    bodyGroup.add(torsoMesh);

    const torsoSolid = new THREE.Mesh(torsoGeom, bodySolidMaterial);
    torsoSolid.position.set(0, 0.8, 0);
    bodyGroup.add(torsoSolid);

    // Pelvis
    const pelvisGeom = new THREE.CylinderGeometry(0.42, 0.46, 0.6, 20);
    const pelvisMesh = new THREE.Mesh(pelvisGeom, bodyMaterial);
    pelvisMesh.position.set(0, -0.2, 0);
    bodyGroup.add(pelvisMesh);

    // Legs
    const legGeom = new THREE.CylinderGeometry(0.18, 0.12, 1.8, 16);
    const leftLeg = new THREE.Mesh(legGeom, bodyMaterial);
    leftLeg.position.set(-0.26, -1.35, 0);
    bodyGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeom, bodyMaterial);
    rightLeg.position.set(0.26, -1.35, 0);
    bodyGroup.add(rightLeg);

    // Clinical Ground Reference Rings
    const ringGeom = new THREE.RingGeometry(1.6, 1.62, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, side: THREE.DoubleSide });
    const groundRing = new THREE.Mesh(ringGeom, ringMat);
    groundRing.rotation.x = Math.PI / 2;
    groundRing.position.y = -2.25;
    scene.add(groundRing);

    // Interactive Organ Nodes Group
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);
    nodesGroupRef.current = nodesGroup;

    // Build interactive node spheres
    Object.values(ORGAN_3D_TARGETS).forEach((org) => {
      const nodeGeom = new THREE.SphereGeometry(0.09, 16, 16);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(org.color),
        emissive: new THREE.Color(org.color),
        emissiveIntensity: 0.4,
        roughness: 0.2,
      });

      const nodeMesh = new THREE.Mesh(nodeGeom, nodeMat);
      nodeMesh.position.set(0, org.y, org.zOffset || 0.1);
      nodeMesh.userData = { organId: org.id };
      nodesGroup.add(nodeMesh);

      // Outer Pulse Ring
      const pulseGeom = new THREE.RingGeometry(0.14, 0.16, 24);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(org.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const pulseMesh = new THREE.Mesh(pulseGeom, pulseMat);
      pulseMesh.position.set(0, org.y, (org.zOffset || 0.1) + 0.01);
      nodesGroup.add(pulseMesh);
    });

    // Pointer Interactivity (Raycasting)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodesGroup.children);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData?.organId) {
          onSelectOrgan(hit.userData.organId);
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    // Mouse drag rotation
    let isDragging = false;
    let prevMouseX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      bodyGroup.rotation.y += deltaX * 0.008;
      nodesGroup.rotation.y += deltaX * 0.008;
      prevMouseX = e.clientX;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Auto slow rotation if enabled and not dragging
      if (rotationActive && !isDragging) {
        bodyGroup.rotation.y += 0.003;
        nodesGroup.rotation.y += 0.003;
      }

      // Smooth camera interpolation towards selected organ lookAt
      currentLookAtRef.current.lerp(targetLookAtRef.current, 0.05);
      camera.lookAt(currentLookAtRef.current);

      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.dispose();
      container.replaceChildren();
    };
  }, [onSelectOrgan, rotationActive]);

  // Update target lookAt and camera position when selectedOrgan changes
  useEffect(() => {
    const target = ORGAN_3D_TARGETS[selectedOrgan];
    if (target && cameraRef.current) {
      targetLookAtRef.current.set(0, target.y, 0);
    }
  }, [selectedOrgan]);

  // Zoom Controls
  const handleZoom = useCallback((direction: "in" | "out") => {
    const camera = cameraRef.current;
    if (!camera) return;
    const factor = direction === "in" ? 0.85 : 1.15;
    camera.position.z = Math.max(2.2, Math.min(7.5, camera.position.z * factor));
    setZoomLevel(Math.round((5.2 / camera.position.z) * 100));
  }, []);

  const resetView = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(0, 0.8, 5.2);
    targetLookAtRef.current.set(0, 0.6, 0);
    setZoomLevel(100);
  }, []);

  if (!webGLSupported) {
    return (
      <div className="cm-twin-viewport" style={{ padding: "var(--cm-6)", textAlign: "center" }}>
        <p style={{ color: "var(--cm-ink-2)", fontSize: "var(--cm-text-sm)", fontWeight: 700 }}>
          3D Hardware Acceleration Unavailable
        </p>
        <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)" }}>
          Showing 2D High-Resolution Clinical Anatomy Map
        </p>
      </div>
    );
  }

  return (
    <div className={`cm-twin-container ${className}`.trim()}>
      {/* HUD Telemetry Header */}
      <div className="cm-twin-overlay-hud">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-2)" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "var(--cm-done)",
              boxShadow: "0 0 6px var(--cm-done)",
            }}
          />
          <span
            style={{
              fontSize: "var(--cm-text-xs)",
              fontWeight: 800,
              color: "var(--cm-navy)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Digital Anatomical Twin · 3D
          </span>
        </div>
        <div
          style={{
            fontSize: "var(--cm-text-xs)",
            fontWeight: 700,
            color: "var(--cm-ink-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Zoom: {zoomLevel}%
        </div>
      </div>

      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="cm-twin-viewport" style={{ cursor: "grab" }} />

      {/* Interactive Controls Overlay */}
      <div className="cm-twin-controls">
        <button
          type="button"
          onClick={() => setRotationActive(!rotationActive)}
          className="cm-twin-ctrl-btn"
          aria-label={rotationActive ? "Pause Rotation" : "Resume Rotation"}
          title={rotationActive ? "Pause Orbit" : "Resume Orbit"}
        >
          <RotateCw size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleZoom("in")}
          className="cm-twin-ctrl-btn"
          aria-label="Zoom In"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleZoom("out")}
          className="cm-twin-ctrl-btn"
          aria-label="Zoom Out"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="cm-twin-ctrl-btn"
          aria-label="Reset Camera View"
          title="Reset View"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Clinical Organ Selector Ribbon */}
      <div className="cm-twin-organ-chips">
        {Object.values(ORGAN_3D_TARGETS).map((org) => {
          const isSelected = org.id === selectedOrgan;
          return (
            <button
              key={org.id}
              type="button"
              onClick={() => onSelectOrgan(org.id)}
              className={`cm-twin-organ-chip ${isSelected ? "cm-twin-organ-chip--selected" : ""}`}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: org.color,
                }}
              />
              {org.name.split(" ")[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
