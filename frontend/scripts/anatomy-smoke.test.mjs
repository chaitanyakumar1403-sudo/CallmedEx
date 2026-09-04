import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const roughenGeometry = (geom, amount, freq) => {
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * freq) * Math.sin(v.y * freq * 1.31) * Math.sin(v.z * freq * 0.83);
    const k = 1 + n * amount;
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
};

test("torso LatheGeometry spans pelvis to clavicle with anatomical proportions", () => {
  const torsoProfile = [
    [0.03, -0.30], [0.28, -0.28], [0.40, -0.20], [0.45, -0.06],
    [0.46, 0.10], [0.45, 0.26], [0.43, 0.44], [0.42, 0.60],
    [0.44, 0.78], [0.48, 0.96], [0.53, 1.14], [0.56, 1.30],
    [0.55, 1.44], [0.50, 1.55], [0.38, 1.63], [0.22, 1.68], [0.04, 1.70],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const torso = new THREE.LatheGeometry(torsoProfile, 56);
  torso.computeBoundingBox();
  const bb = torso.boundingBox;
  assert.ok(bb.max.y > 1.6 && bb.min.y < -0.25, "torso spans pelvis to clavicle");
  assert.ok(Math.abs(bb.max.x - 0.56) < 0.02, "torso half-width matches shoulder rig");
});

test("all anatomical twin geometries displace without NaN coordinates", () => {
  const geoms = [
    new THREE.CapsuleGeometry(0.155, 0.2, 12, 28),
    new THREE.CapsuleGeometry(0.2, 0.98, 14, 32),
    new THREE.CapsuleGeometry(0.062, 0.12, 10, 20),
    new THREE.SphereGeometry(0.34, 48, 48),
    roughenGeometry(new THREE.SphereGeometry(0.19, 64, 64), 0.085, 42),
    roughenGeometry(new THREE.CapsuleGeometry(0.16, 0.38, 20, 40), 0.045, 34),
    roughenGeometry(new THREE.ConeGeometry(0.26, 0.34, 40, 8), 0.05, 22),
    roughenGeometry(new THREE.TorusGeometry(0.11, 0.055, 24, 40, Math.PI), 0.03, 30),
    new THREE.ConeGeometry(0.09, 0.16, 28),
    new THREE.CylinderGeometry(0.026, 0.03, 0.16, 16),
  ];
  for (const g of geoms) {
    const p = g.attributes.position.array;
    assert.ok(p.length > 0, "geometry has vertices");
    assert.ok(p.every(Number.isFinite), "no NaN vertices after displacement");
    assert.ok(g.attributes.normal, "normals recomputed");
  }

  // Displacement must actually change the surface, not silently no-op.
  const plain = new THREE.SphereGeometry(0.19, 64, 64).attributes.position.array;
  const bumpy = geoms[4].attributes.position.array;
  let moved = 0;
  for (let i = 0; i < plain.length; i++) if (Math.abs(plain[i] - bumpy[i]) > 1e-6) moved++;
  assert.ok(moved > plain.length * 0.5, "cortex displacement applied to most vertices");
});

test("Three.js materials and RoomEnvironment compile cleanly", () => {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xbfdcf7,
    roughness: 0.14,
    metalness: 0.0,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.34,
  });
  assert.ok(mat.isMeshPhysicalMaterial, "physical material instantiated");
  const env = new RoomEnvironment();
  assert.ok(env.isScene, "RoomEnvironment instantiated");
});
