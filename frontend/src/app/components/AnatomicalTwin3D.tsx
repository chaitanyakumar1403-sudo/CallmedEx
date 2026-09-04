"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Brain,
  Eye,
  Smile,
  Ear,
  Wind,
  Heart,
  Droplet,
  Bone,
  Sparkles,
} from "lucide-react";

export interface OrganNode {
  id: string;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  y: number; // Vertical anchor in 3D coordinate system
  xOffset?: number;
  zOffset?: number;
  color: string;
  focusDistance: number;
}

export const ORGAN_3D_TARGETS: Record<string, OrganNode> = {
  head: {
    id: "head",
    name: "Brain & Nervous System",
    shortName: "Brain",
    icon: Brain,
    y: 2.15,
    color: "#4338ca",
    focusDistance: 2.7,
  },
  eyes: {
    id: "eyes",
    name: "Eyes & Vision",
    shortName: "Eyes",
    icon: Eye,
    y: 2.15,
    zOffset: 0.36,
    color: "#0284c7",
    focusDistance: 2.5,
  },
  dental: {
    id: "dental",
    name: "Teeth & Oral Care",
    shortName: "Teeth",
    icon: Smile,
    y: 1.88,
    zOffset: 0.35,
    color: "#0d9488",
    focusDistance: 2.5,
  },
  ent: {
    id: "ent",
    name: "Ears, Nose & Throat",
    shortName: "Ears/ENT",
    icon: Ear,
    y: 2.05,
    xOffset: 0.38,
    color: "#d97706",
    focusDistance: 2.6,
  },
  lungs: {
    id: "lungs",
    name: "Lungs & Respiratory",
    shortName: "Lungs",
    icon: Wind,
    y: 1.15,
    color: "#0284c7",
    focusDistance: 3.1,
  },
  heart: {
    id: "heart",
    name: "Heart & Cardiovascular",
    shortName: "Heart",
    icon: Heart,
    y: 1.1,
    xOffset: -0.12,
    zOffset: 0.2,
    color: "#d92020",
    focusDistance: 2.8,
  },
  abdomen: {
    id: "abdomen",
    name: "Liver, Gut & Metabolism",
    shortName: "Abdomen",
    icon: Droplet,
    y: 0.38,
    xOffset: 0.12,
    zOffset: 0.16,
    color: "#15803d",
    focusDistance: 3.2,
  },
  joints: {
    id: "joints",
    name: "Bones, Spine & Joints",
    shortName: "Spine/Joints",
    icon: Bone,
    y: -0.4,
    color: "#b45309",
    focusDistance: 3.6,
  },
  skin: {
    id: "skin",
    name: "Skin & Dermatology",
    shortName: "Skin",
    icon: Sparkles,
    y: 0.75,
    xOffset: -0.65,
    zOffset: 0.18,
    color: "#db2777",
    focusDistance: 3.3,
  },
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
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const organsGroupRef = useRef<THREE.Group | null>(null);
  const heartMeshRef = useRef<THREE.Group | null>(null);
  const lungsGroupRef = useRef<THREE.Group | null>(null);
  const selectedPulseRef = useRef<THREE.Mesh | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.6, 0));
  const currentLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.6, 0));

  // Initialize High-Fidelity Anatomical Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

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

    const width = container.clientWidth || 420;
    const height = container.clientHeight || 480;

    // Scene & Clean Clinical Lighting
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    // Transparent so the viewport's CSS studio backdrop shows through.
    scene.background = null;

    // Perspective Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.75, 5.0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // Studio image-based lighting — gives every surface real environment
    // reflections instead of flat directional shading.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;

    // Multi-Point Clinical Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    // Key: crisp white from front-upper-right, sculpts the torso volume.
    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    mainKeyLight.position.set(4, 7, 6);
    scene.add(mainKeyLight);

    // Rim: cyan from behind, separates the silhouette from the backdrop.
    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.15);
    rimLight.position.set(-5, 4, -6);
    scene.add(rimLight);

    // Bounce: cool floor fill so undersides never go dead black.
    const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.5);
    fillLight.position.set(-3, -5, 3);
    scene.add(fillLight);

    // Warm practical near the thorax to make the organ cluster glow.
    const organAccent = new THREE.PointLight(0xfda4af, 1.6, 6, 2);
    organAccent.position.set(0.4, 1.3, 1.5);
    scene.add(organAccent);

    // Root Group for Full Anatomical Body
    const humanBodyRoot = new THREE.Group();
    scene.add(humanBodyRoot);

    // ==========================================
    // 1. ANATOMICAL HUMAN SILHOUETTE MESH
    // ==========================================
    const humanSilhouetteGroup = new THREE.Group();
    humanBodyRoot.add(humanSilhouetteGroup);

    // Translucent clinical tissue shell — clearcoat + IBL reads as polished
    // medical acrylic rather than flat plastic.
    const holographicSkinMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfdcf7,
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    });

    // Fresnel-style rim shell: a slightly inflated back-faced copy reads as a
    // glowing contour edge. Replaces the old wireframe, which made the body
    // look faceted rather than anatomical.
    const rimShellMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.13,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const addAnatomicalPart = (geom: THREE.BufferGeometry, pos: [number, number, number], rot?: [number, number, number], scale?: [number, number, number]) => {
      const solidMesh = new THREE.Mesh(geom, holographicSkinMat);
      solidMesh.position.set(...pos);
      if (rot) solidMesh.rotation.set(...rot);
      if (scale) solidMesh.scale.set(...scale);
      humanSilhouetteGroup.add(solidMesh);

      const rimMesh = new THREE.Mesh(geom, rimShellMat);
      rimMesh.position.set(...pos);
      if (rot) rimMesh.rotation.set(...rot);
      const [sx, sy, sz] = scale ?? [1, 1, 1];
      rimMesh.scale.set(sx * 1.035, sy * 1.02, sz * 1.035);
      humanSilhouetteGroup.add(rimMesh);
    };

    // Displace vertices along their radius with a cheap sinusoidal field so
    // organs read as soft tissue instead of naked primitives.
    // ponytail: sin-field pseudo-noise, swap for simplex if it ever looks banded.
    const roughenGeometry = (geom: THREE.BufferGeometry, amount: number, freq: number) => {
      const pos = geom.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n =
          Math.sin(v.x * freq) * Math.sin(v.y * freq * 1.31) * Math.sin(v.z * freq * 0.83);
        const k = 1 + n * amount;
        pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
      }
      pos.needsUpdate = true;
      geom.computeVertexNormals();
      return geom;
    };

    // Cranium: an ovoid skull rather than a bare sphere.
    const craniumGeom = new THREE.SphereGeometry(0.34, 48, 48);
    addAnatomicalPart(craniumGeom, [0, 2.18, 0], undefined, [0.94, 1.14, 1.02]);

    // Mandible & facial mass — a second ovoid blended under the cranium reads
    // as a jawline; the old truncated cone gave the twin a robotic chin.
    const mandibleGeom = new THREE.SphereGeometry(0.26, 40, 40);
    addAnatomicalPart(mandibleGeom, [0, 1.96, 0.035], undefined, [0.95, 0.78, 1.0]);

    // Cervical Neck
    const neckGeom = new THREE.CapsuleGeometry(0.155, 0.2, 12, 28);
    addAnatomicalPart(neckGeom, [0, 1.76, 0.01], undefined, [1.0, 1.0, 0.95]);

    // Torso: one continuous lathed surface from pelvis to clavicle. Replaces the
    // three stacked cylinders whose seams read as a barrel, not a ribcage.
    const torsoProfile = [
      [0.03, -0.30], [0.28, -0.28], [0.40, -0.20], [0.45, -0.06],
      [0.46, 0.10], [0.45, 0.26], [0.43, 0.44], [0.42, 0.60],
      [0.44, 0.78], [0.48, 0.96], [0.53, 1.14], [0.56, 1.30],
      [0.55, 1.44], [0.50, 1.55], [0.38, 1.63], [0.22, 1.68], [0.04, 1.70],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const torsoGeom = new THREE.LatheGeometry(torsoProfile, 56);
    addAnatomicalPart(torsoGeom, [0, 0, 0], undefined, [1.0, 1.0, 0.72]);

    // Clavicle & Shoulder Span
    const shoulderGeom = new THREE.CapsuleGeometry(0.2, 0.98, 14, 32);
    addAnatomicalPart(shoulderGeom, [0, 1.52, 0], [0, 0, Math.PI / 2], [1.0, 1.0, 0.85]);

    // Deltoid Caps
    const deltoidGeom = new THREE.SphereGeometry(0.19, 32, 32);
    addAnatomicalPart(deltoidGeom, [-0.74, 1.5, 0], undefined, [1.0, 1.05, 0.95]);
    addAnatomicalPart(deltoidGeom, [0.74, 1.5, 0], undefined, [1.0, 1.05, 0.95]);

    // Upper Arms (Biceps / Triceps)
    const upperArmGeom = new THREE.CapsuleGeometry(0.1, 0.52, 12, 24);
    addAnatomicalPart(upperArmGeom, [-0.74, 1.12, 0], [0, 0, -0.08]);
    addAnatomicalPart(upperArmGeom, [0.74, 1.12, 0], [0, 0, 0.08]);

    // Elbow Nodes
    const elbowGeom = new THREE.SphereGeometry(0.088, 24, 24);
    addAnatomicalPart(elbowGeom, [-0.78, 0.72, 0]);
    addAnatomicalPart(elbowGeom, [0.78, 0.72, 0]);

    // Forearms
    const forearmGeom = new THREE.CapsuleGeometry(0.085, 0.5, 12, 24);
    addAnatomicalPart(forearmGeom, [-0.80, 0.35, 0], [0, 0, -0.06]);
    addAnatomicalPart(forearmGeom, [0.80, 0.35, 0], [0, 0, 0.06]);

    // Hands — flattened capsules, not boxes.
    const handGeom = new THREE.CapsuleGeometry(0.062, 0.12, 10, 20);
    addAnatomicalPart(handGeom, [-0.82, -0.05, 0], undefined, [1.0, 1.0, 0.55]);
    addAnatomicalPart(handGeom, [0.82, -0.05, 0], undefined, [1.0, 1.0, 0.55]);

    // Thighs (Quadriceps)
    const thighGeom = new THREE.CapsuleGeometry(0.185, 0.7, 14, 28);
    addAnatomicalPart(thighGeom, [-0.25, -0.72, 0], [0, 0, -0.03], [1.0, 1.0, 0.95]);
    addAnatomicalPart(thighGeom, [0.25, -0.72, 0], [0, 0, 0.03], [1.0, 1.0, 0.95]);

    // Patella Knees
    const kneeGeom = new THREE.SphereGeometry(0.125, 26, 26);
    addAnatomicalPart(kneeGeom, [-0.26, -1.30, 0.03]);
    addAnatomicalPart(kneeGeom, [0.26, -1.30, 0.03]);

    // Calves & Shin
    const calfGeom = new THREE.CapsuleGeometry(0.125, 0.72, 12, 24);
    addAnatomicalPart(calfGeom, [-0.26, -1.82, 0], [0, 0, -0.02], [1.0, 1.0, 0.92]);
    addAnatomicalPart(calfGeom, [0.26, -1.82, 0], [0, 0, 0.02], [1.0, 1.0, 0.92]);

    // Ankles
    const ankleGeom = new THREE.SphereGeometry(0.082, 20, 20);
    addAnatomicalPart(ankleGeom, [-0.26, -2.25, 0]);
    addAnatomicalPart(ankleGeom, [0.26, -2.25, 0]);

    // Feet — capsules laid along Z so the toe end tapers naturally.
    const footGeom = new THREE.CapsuleGeometry(0.072, 0.2, 10, 20);
    addAnatomicalPart(footGeom, [-0.26, -2.32, 0.08], [Math.PI / 2, 0, 0], [1.0, 1.0, 0.7]);
    addAnatomicalPart(footGeom, [0.26, -2.32, 0.08], [Math.PI / 2, 0, 0], [1.0, 1.0, 0.7]);

    // ==========================================
    // 2. VASCULAR SYSTEM (Arteries & Veins)
    // ==========================================
    const vascularGroup = new THREE.Group();
    humanBodyRoot.add(vascularGroup);

    const arteryMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.1,
    });

    const veinMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.1,
    });

    const createVesselTube = (points: THREE.Vector3[], radius: number, mat: THREE.Material) => {
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeom = new THREE.TubeGeometry(curve, 28, radius, 8, false);
      const mesh = new THREE.Mesh(tubeGeom, mat);
      vascularGroup.add(mesh);
      return mesh;
    };

    // Aortic Arch & Main Arterial Axis
    createVesselTube([
      new THREE.Vector3(-0.08, 1.1, 0.18),
      new THREE.Vector3(0, 1.35, 0.10),
      new THREE.Vector3(0.04, 1.1, 0.06),
      new THREE.Vector3(0.03, 0.4, 0.07),
      new THREE.Vector3(0, -0.15, 0.05),
    ], 0.022, arteryMat);

    // Left & Right Carotid Arteries (to Brain)
    createVesselTube([
      new THREE.Vector3(-0.03, 1.35, 0.10),
      new THREE.Vector3(-0.06, 1.72, 0.06),
      new THREE.Vector3(-0.05, 2.08, 0.04),
    ], 0.015, arteryMat);

    createVesselTube([
      new THREE.Vector3(0.03, 1.35, 0.10),
      new THREE.Vector3(0.06, 1.72, 0.06),
      new THREE.Vector3(0.05, 2.08, 0.04),
    ], 0.015, arteryMat);

    // Brachial Arteries (Arms)
    createVesselTube([
      new THREE.Vector3(-0.03, 1.35, 0.10),
      new THREE.Vector3(-0.45, 1.48, 0.04),
      new THREE.Vector3(-0.66, 1.40, 0.03),
      new THREE.Vector3(-0.73, 1.15, 0.02),
      new THREE.Vector3(-0.77, 0.74, 0.02),
      new THREE.Vector3(-0.79, 0.45, 0.02),
    ], 0.014, arteryMat);

    createVesselTube([
      new THREE.Vector3(0.03, 1.35, 0.10),
      new THREE.Vector3(0.45, 1.48, 0.04),
      new THREE.Vector3(0.66, 1.40, 0.03),
      new THREE.Vector3(0.73, 1.15, 0.02),
      new THREE.Vector3(0.77, 0.74, 0.02),
      new THREE.Vector3(0.79, 0.45, 0.02),
    ], 0.014, arteryMat);

    // Femoral Arteries (Legs)
    createVesselTube([
      new THREE.Vector3(0, -0.15, 0.05),
      new THREE.Vector3(-0.16, -0.45, 0.06),
      new THREE.Vector3(-0.23, -0.90, 0.05),
      new THREE.Vector3(-0.26, -1.30, 0.04),
      new THREE.Vector3(-0.26, -1.75, 0.03),
      new THREE.Vector3(-0.26, -2.1, 0.02),
    ], 0.016, arteryMat);

    createVesselTube([
      new THREE.Vector3(0, -0.15, 0.05),
      new THREE.Vector3(0.16, -0.45, 0.06),
      new THREE.Vector3(0.23, -0.90, 0.05),
      new THREE.Vector3(0.26, -1.30, 0.04),
      new THREE.Vector3(0.26, -1.75, 0.03),
      new THREE.Vector3(0.26, -2.1, 0.02),
    ], 0.016, arteryMat);

    // Vena Cava & Main Venous Axis
    createVesselTube([
      new THREE.Vector3(0.06, 2.05, 0.04),
      new THREE.Vector3(0.07, 1.70, 0.05),
      new THREE.Vector3(0.06, 1.25, 0.12),
      new THREE.Vector3(0.05, 0.35, 0.06),
      new THREE.Vector3(0.03, -0.18, 0.05),
    ], 0.02, veinMat);

    // Jugular Vein (Left)
    createVesselTube([
      new THREE.Vector3(-0.06, 2.05, 0.04),
      new THREE.Vector3(-0.07, 1.70, 0.05),
      new THREE.Vector3(-0.02, 1.25, 0.12),
    ], 0.014, veinMat);

    // Femoral Veins (Legs)
    createVesselTube([
      new THREE.Vector3(0.03, -0.18, 0.05),
      new THREE.Vector3(-0.18, -0.48, 0.04),
      new THREE.Vector3(-0.22, -1.25, 0.03),
      new THREE.Vector3(-0.23, -2.08, 0.02),
    ], 0.015, veinMat);

    createVesselTube([
      new THREE.Vector3(0.03, -0.18, 0.05),
      new THREE.Vector3(0.18, -0.48, 0.04),
      new THREE.Vector3(0.22, -1.25, 0.03),
      new THREE.Vector3(0.23, -2.08, 0.02),
    ], 0.015, veinMat);

    // ==========================================
    // 3. NERVOUS SYSTEM (Spinal Axis & Neural Network)
    // ==========================================
    const nervousGroup = new THREE.Group();
    humanBodyRoot.add(nervousGroup);

    const nerveMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x6366f1,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });

    // Central Spinal Cord Pathway
    const spinalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.10, -0.05),
      new THREE.Vector3(0, 1.75, -0.06),
      new THREE.Vector3(0, 1.20, -0.08),
      new THREE.Vector3(0, 0.50, -0.06),
      new THREE.Vector3(0, -0.10, -0.05),
      new THREE.Vector3(0, -0.30, -0.03),
    ]);
    const spinalCordGeom = new THREE.TubeGeometry(spinalCurve, 24, 0.018, 8, false);
    const spinalCordMesh = new THREE.Mesh(spinalCordGeom, nerveMat);
    nervousGroup.add(spinalCordMesh);

    // Vertebral Skeletal Column Ring Discs
    const vertebraeGroup = new THREE.Group();
    for (let yPos = -0.2; yPos <= 1.7; yPos += 0.11) {
      const discGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12);
      const discMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        roughness: 0.4,
        metalness: 0.1,
      });
      const disc = new THREE.Mesh(discGeom, discMat);
      disc.position.set(0, yPos, -0.07);
      vertebraeGroup.add(disc);
    }
    nervousGroup.add(vertebraeGroup);

    // ==========================================
    // 4. REALISTIC 3D HUMAN ORGANS & TARGETS
    // ==========================================
    const organsGroup = new THREE.Group();
    humanBodyRoot.add(organsGroup);
    organsGroupRef.current = organsGroup;

    // --- A. BRAIN (Cerebral Cortex Dual Hemispheres) ---
    const brainGroup = new THREE.Group();
    brainGroup.position.set(0, 2.2, 0.01);
    brainGroup.userData = { organId: "head" };

    const brainHemisphereMat = new THREE.MeshPhysicalMaterial({
      color: 0x6366f1,
      emissive: 0x312e81,
      emissiveIntensity: 0.4,
      roughness: 0.42,
      metalness: 0.0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.35,
      envMapIntensity: 1.1,
    });

    // Gyri/sulci: the cortex is a displaced sphere, so it folds like tissue.
    const hemisphereGeom = roughenGeometry(new THREE.SphereGeometry(0.19, 64, 64), 0.085, 42);
    const cerebellumGeom = roughenGeometry(new THREE.SphereGeometry(0.12, 48, 48), 0.07, 58);

    const leftHemi = new THREE.Mesh(hemisphereGeom, brainHemisphereMat);
    leftHemi.position.set(-0.082, 0, 0);
    leftHemi.scale.set(0.82, 1.0, 1.08);
    leftHemi.userData = { organId: "head" };
    brainGroup.add(leftHemi);

    const rightHemi = new THREE.Mesh(hemisphereGeom, brainHemisphereMat);
    rightHemi.position.set(0.082, 0, 0);
    rightHemi.scale.set(0.82, 1.0, 1.08);
    rightHemi.userData = { organId: "head" };
    brainGroup.add(rightHemi);

    // Cerebellum
    const cerebellum = new THREE.Mesh(cerebellumGeom, brainHemisphereMat);
    cerebellum.position.set(0, -0.14, -0.1);
    cerebellum.userData = { organId: "head" };
    brainGroup.add(cerebellum);

    organsGroup.add(brainGroup);

    // --- B. HEART (Anatomical Cardiac Muscle with Rhythmic Pulse) ---
    const heartGroup = new THREE.Group();
    heartGroup.position.set(-0.11, 1.12, 0.18);
    heartGroup.rotation.z = -0.15;
    heartGroup.userData = { organId: "heart" };
    heartMeshRef.current = heartGroup;

    const heartMat = new THREE.MeshPhysicalMaterial({
      color: 0xd92020,
      emissive: 0x991b1b,
      emissiveIntensity: 0.5,
      roughness: 0.22,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xfda4af),
      envMapIntensity: 1.3,
    });

    // Left & Right Ventricle mass — lightly displaced so the myocardium is not
    // a pair of billiard balls.
    const lVentricle = new THREE.Mesh(roughenGeometry(new THREE.SphereGeometry(0.14, 40, 40), 0.035, 26), heartMat);
    lVentricle.position.set(-0.03, -0.04, 0);
    lVentricle.scale.set(0.9, 1.15, 0.85);
    lVentricle.userData = { organId: "heart" };
    heartGroup.add(lVentricle);

    const rVentricle = new THREE.Mesh(roughenGeometry(new THREE.SphereGeometry(0.12, 40, 40), 0.035, 30), heartMat);
    rVentricle.position.set(0.06, 0.02, 0.02);
    rVentricle.scale.set(0.9, 1.0, 0.8);
    rVentricle.userData = { organId: "heart" };
    heartGroup.add(rVentricle);

    // Aortic Arch Root
    const aorticArchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(-0.02, 0.19, 0.02),
      new THREE.Vector3(0.06, 0.22, -0.02),
    ]);
    const aorticRoot = new THREE.Mesh(
      new THREE.TubeGeometry(aorticArchCurve, 16, 0.032, 8, false),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.6 })
    );
    aorticRoot.userData = { organId: "heart" };
    heartGroup.add(aorticRoot);

    // Cardiac apex — the pointed inferior tip that makes a heart read as a heart.
    const cardiacApex = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 28), heartMat);
    cardiacApex.position.set(-0.045, -0.17, 0);
    cardiacApex.rotation.set(0, 0, Math.PI + 0.22);
    cardiacApex.userData = { organId: "heart" };
    heartGroup.add(cardiacApex);

    // Pulmonary trunk + superior vena cava
    const pulmonaryTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.03, 0.16, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x60a5fa, emissive: 0x1d4ed8, emissiveIntensity: 0.45, roughness: 0.3, clearcoat: 0.8 })
    );
    pulmonaryTrunk.position.set(0.09, 0.14, 0.01);
    pulmonaryTrunk.rotation.z = 0.3;
    pulmonaryTrunk.userData = { organId: "heart" };
    heartGroup.add(pulmonaryTrunk);

    organsGroup.add(heartGroup);

    // --- C. LUNGS (Bilateral Aerodynamic Pulmonary Lobes) ---
    const lungsGroup = new THREE.Group();
    lungsGroupRef.current = lungsGroup;
    lungsGroup.userData = { organId: "lungs" };

    const lungMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x075985,
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0.0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.4,
      transparent: true,
      opacity: 0.82,
      envMapIntensity: 1.1,
    });

    // Right Lung (3 lobes composite) — spongy alveolar surface.
    const rightLung = new THREE.Mesh(roughenGeometry(new THREE.CapsuleGeometry(0.16, 0.38, 20, 40), 0.045, 34), lungMat);
    rightLung.position.set(0.24, 1.15, 0.08);
    rightLung.rotation.z = -0.1;
    rightLung.scale.set(1.0, 1.0, 0.75);
    rightLung.userData = { organId: "lungs" };
    lungsGroup.add(rightLung);

    // Left Lung (2 lobes with cardiac notch)
    const leftLung = new THREE.Mesh(roughenGeometry(new THREE.CapsuleGeometry(0.14, 0.36, 20, 40), 0.045, 38), lungMat);
    leftLung.position.set(-0.25, 1.18, 0.08);
    leftLung.rotation.z = 0.12;
    leftLung.scale.set(0.9, 1.0, 0.72);
    leftLung.userData = { organId: "lungs" };
    lungsGroup.add(leftLung);

    // Trachea and primary bronchi feeding both hila.
    const airwayMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe, emissive: 0x0ea5e9, emissiveIntensity: 0.3, roughness: 0.3, clearcoat: 0.9,
    });
    const trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 20), airwayMat);
    trachea.position.set(0, 1.52, 0.06);
    trachea.userData = { organId: "lungs" };
    lungsGroup.add(trachea);

    ([[-1, -0.2], [1, 0.2]] as [number, number][]).forEach(([dir, tilt]) => {
      const bronchus = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.24, 14), airwayMat);
      bronchus.position.set(dir * 0.11, 1.32, 0.06);
      bronchus.rotation.z = tilt * 3.2;
      bronchus.userData = { organId: "lungs" };
      lungsGroup.add(bronchus);
    });

    organsGroup.add(lungsGroup);

    // --- D. LIVER & ABDOMINAL DIGESTIVE SYSTEM ---
    const abdomenGroup = new THREE.Group();
    abdomenGroup.position.set(0, 0.38, 0.12);
    abdomenGroup.userData = { organId: "abdomen" };

    const liverMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      emissive: 0x166534,
      emissiveIntensity: 0.3,
      roughness: 0.42,
      metalness: 0.05,
    });

    // Anatomical Hepatic Wedge (Right Hypochondrium)
    const liverMesh = new THREE.Mesh(roughenGeometry(new THREE.ConeGeometry(0.17, 0.3, 40, 8), 0.05, 26), liverMat);
    liverMesh.position.set(0.13, 0.11, 0.0);
    liverMesh.rotation.set(0.18, 0, -1.42);
    liverMesh.scale.set(1.05, 1.0, 0.68);
    liverMesh.userData = { organId: "abdomen" };
    abdomenGroup.add(liverMesh);

    // Stomach / Gastric pouch (Left side)
    const stomachMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x15803d,
      emissiveIntensity: 0.28,
      roughness: 0.38,
    });
    const stomachMesh = new THREE.Mesh(roughenGeometry(new THREE.TorusGeometry(0.11, 0.055, 24, 40, Math.PI), 0.03, 30), stomachMat);
    stomachMesh.position.set(-0.14, 0.12, 0.0);
    stomachMesh.rotation.set(0.2, 0.4, 0.8);
    stomachMesh.userData = { organId: "abdomen" };
    abdomenGroup.add(stomachMesh);

    // Intestinal metabolic tract curves
    const gutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, -0.08, 0.04),
      new THREE.Vector3(0.08, -0.06, 0.06),
      new THREE.Vector3(0.10, -0.18, 0.05),
      new THREE.Vector3(-0.06, -0.22, 0.04),
      new THREE.Vector3(0.04, -0.30, 0.05),
    ]);
    const gutMesh = new THREE.Mesh(
      new THREE.TubeGeometry(gutCurve, 20, 0.028, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x14532d, emissiveIntensity: 0.45 })
    );
    gutMesh.userData = { organId: "abdomen" };
    abdomenGroup.add(gutMesh);

    organsGroup.add(abdomenGroup);

    // --- E. EYES & OPTIC SYSTEM ---
    const eyesGroup = new THREE.Group();
    eyesGroup.position.set(0, 2.13, 0.27);
    eyesGroup.userData = { organId: "eyes" };

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.75,
      roughness: 0.1,
    });

    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 24, 24), eyeMat);
    lEye.position.set(-0.11, 0, 0);
    lEye.userData = { organId: "eyes" };
    eyesGroup.add(lEye);

    const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 24, 24), eyeMat);
    rEye.position.set(0.11, 0, 0);
    rEye.userData = { organId: "eyes" };
    eyesGroup.add(rEye);

    organsGroup.add(eyesGroup);

    // --- F. DENTAL & ORAL CARE (Mandibular Arc) ---
    const dentalGroup = new THREE.Group();
    dentalGroup.position.set(0, 1.88, 0.34);
    dentalGroup.userData = { organId: "dental" };

    const dentalMat = new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      emissive: 0x0f766e,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });

    const dentalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.09, 0, -0.04),
      new THREE.Vector3(0, 0, 0.02),
      new THREE.Vector3(0.09, 0, -0.04),
    ]);
    const dentalMesh = new THREE.Mesh(new THREE.TubeGeometry(dentalCurve, 16, 0.03, 8, false), dentalMat);
    dentalMesh.userData = { organId: "dental" };
    dentalGroup.add(dentalMesh);

    organsGroup.add(dentalGroup);

    // --- G. ENT (Ears & Auditory System) ---
    const entGroup = new THREE.Group();
    entGroup.position.set(0, 2.05, 0);
    entGroup.userData = { organId: "ent" };

    const entMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0xb45309,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    });

    const lEar = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 16, 28, Math.PI * 1.35), entMat);
    lEar.position.set(-0.295, 0, 0);
    lEar.rotation.y = Math.PI / 2;
    lEar.userData = { organId: "ent" };
    entGroup.add(lEar);

    const rEar = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 16, 28, Math.PI * 1.35), entMat);
    rEar.position.set(0.295, 0, 0);
    rEar.rotation.y = -Math.PI / 2;
    rEar.userData = { organId: "ent" };
    entGroup.add(rEar);

    organsGroup.add(entGroup);

    // --- H. BONES, SPINE & ARTICULAR JOINTS ---
    const jointsGroup = new THREE.Group();
    jointsGroup.position.set(0, -0.4, 0);
    jointsGroup.userData = { organId: "joints" };

    const jointMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      emissive: 0x92400e,
      emissiveIntensity: 0.7,
      roughness: 0.25,
    });

    // Articular Joint Nodes
    const jointPositions: [number, number, number][] = [
      [-0.75, 1.92, 0], // Left Shoulder
      [0.75, 1.92, 0],  // Right Shoulder
      [-0.24, -0.90, 0.03], // Left Knee
      [0.24, -0.90, 0.03],  // Right Knee
      [0, 0.35, -0.06],     // Lumbar Spine Centroid
    ];

    jointPositions.forEach((pos) => {
      const capsule = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), jointMat);
      capsule.position.set(...pos);
      capsule.userData = { organId: "joints" };
      jointsGroup.add(capsule);
    });

    organsGroup.add(jointsGroup);

    // --- I. SKIN & DERMATOLOGY (Dermal Sensory Receptor & Halo) ---
    const skinGroup = new THREE.Group();
    skinGroup.position.set(-0.65, 0.75, 0.18);
    skinGroup.userData = { organId: "skin" };

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdb2777,
      emissive: 0xbe185d,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });

    const skinNode = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), skinMat);
    skinNode.userData = { organId: "skin" };
    skinGroup.add(skinNode);

    const skinHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.14, 24),
      new THREE.MeshBasicMaterial({ color: 0xdb2777, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    skinHalo.userData = { organId: "skin" };
    skinGroup.add(skinHalo);

    organsGroup.add(skinGroup);

    // Active Selection Pulsing Halo Target
    const pulseGeom = new THREE.RingGeometry(0.24, 0.28, 32);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const pulseRing = new THREE.Mesh(pulseGeom, pulseMat);
    pulseRing.visible = false;
    scene.add(pulseRing);
    selectedPulseRef.current = pulseRing;

    // Clinical Ground Reference Rings
    const groundRing1 = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.62, 64),
      new THREE.MeshBasicMaterial({ color: 0xcbd5e1, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    groundRing1.rotation.x = Math.PI / 2;
    groundRing1.position.y = -2.35;
    scene.add(groundRing1);

    const groundRing2 = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.115, 48),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
    );
    groundRing2.rotation.x = Math.PI / 2;
    groundRing2.position.y = -2.35;
    scene.add(groundRing2);

    // Pointer Interactivity (Raycasting directly on 3D organs)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(organsGroup.children, true);
      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj && !hitObj.userData?.organId && hitObj.parent) {
          hitObj = hitObj.parent;
        }
        if (hitObj?.userData?.organId) {
          onSelectOrgan(hitObj.userData.organId);
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    // Interactive Drag Rotation
    let isDragging = false;
    let prevMouseX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      humanBodyRoot.rotation.y += deltaX * 0.008;
      prevMouseX = e.clientX;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Render & Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth auto orbit rotation when idle
      if (rotationActive && !isDragging) {
        humanBodyRoot.rotation.y += 0.0025;
      }

      // Rhythmic Cardiac Systolic/Diastolic Heartbeat Pulse
      if (heartMeshRef.current) {
        const heartScale = 1 + Math.sin(elapsedTime * 3.6) * 0.07;
        heartMeshRef.current.scale.set(heartScale, heartScale, heartScale);
      }

      // Gentle Pulmonary Lung Expansion Cycle
      if (lungsGroupRef.current) {
        const lungScale = 1 + Math.sin(elapsedTime * 1.6) * 0.03;
        lungsGroupRef.current.scale.set(lungScale, lungScale, lungScale);
      }

      // Animate Active Selection Halo Target
      if (selectedPulseRef.current && selectedPulseRef.current.visible) {
        const pulseScale = 1 + Math.sin(elapsedTime * 4.0) * 0.12;
        selectedPulseRef.current.scale.set(pulseScale, pulseScale, 1);
      }

      // Smooth Camera Glide
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
      scene.environment = null;
      envRT.dispose();
      pmrem.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      container.replaceChildren();
    };
  }, [onSelectOrgan, rotationActive]);

  // Update LookAt and Active Highlight when selectedOrgan changes
  useEffect(() => {
    const target = ORGAN_3D_TARGETS[selectedOrgan];
    if (target && cameraRef.current) {
      targetLookAtRef.current.set(0, target.y, 0);

      // Position glowing halo at selected organ
      if (selectedPulseRef.current) {
        selectedPulseRef.current.position.set(
          target.xOffset || 0,
          target.y,
          (target.zOffset || 0.1) + 0.08
        );
        (selectedPulseRef.current.material as THREE.MeshBasicMaterial).color.set(target.color);
        selectedPulseRef.current.visible = true;
      }
    }
  }, [selectedOrgan]);

  // Viewport Zoom Handlers
  const handleZoom = useCallback((direction: "in" | "out") => {
    const camera = cameraRef.current;
    if (!camera) return;
    const factor = direction === "in" ? 0.85 : 1.15;
    camera.position.z = Math.max(2.2, Math.min(7.5, camera.position.z * factor));
    setZoomLevel(Math.round((5.0 / camera.position.z) * 100));
  }, []);

  const resetView = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(0, 0.75, 5.0);
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
      {/* 3D WebGL Canvas Viewport with HUD & Isolated Controls Scoped INSIDE Viewport */}
      <div className="cm-twin-viewport">
        {/* Dedicated WebGL Mount Target */}
        <div
          ref={mountRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            cursor: "grab",
          }}
        />

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
              background: "rgba(255, 255, 255, 0.85)",
              padding: "2px 8px",
              borderRadius: "var(--cm-radius-pill)",
              border: "1px solid var(--cm-line)",
            }}
          >
            Zoom: {zoomLevel}%
          </div>
        </div>

        {/* Viewport Floating Controls (Strictly isolated inside canvas area) */}
        <div className="cm-twin-controls">
          <button
            type="button"
            onClick={() => setRotationActive(!rotationActive)}
            className="cm-twin-ctrl-btn"
            aria-label={rotationActive ? "Pause Rotation" : "Resume Rotation"}
            title={rotationActive ? "Pause Orbit" : "Resume Orbit"}
          >
            <RotateCw size={15} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom("in")}
            className="cm-twin-ctrl-btn"
            aria-label="Zoom In"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom("out")}
            className="cm-twin-ctrl-btn"
            aria-label="Zoom Out"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="cm-twin-ctrl-btn"
            aria-label="Reset Camera View"
            title="Reset View"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* Clinical Organ Selector Ribbon with Rich Clinical Symbols (Outside & Below Viewport) */}
      <div className="cm-twin-organ-chips" role="tablist" aria-label="Select Anatomical System">
        {Object.values(ORGAN_3D_TARGETS).map((org) => {
          const Icon = org.icon;
          const isSelected = org.id === selectedOrgan;
          return (
            <button
              key={org.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectOrgan(org.id)}
              className={`cm-twin-organ-chip ${isSelected ? "cm-twin-organ-chip--selected" : ""}`}
            >
              <Icon
                size={14}
                style={{
                  color: isSelected ? "#ffffff" : org.color,
                  flexShrink: 0,
                }}
              />
              <span>{org.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
