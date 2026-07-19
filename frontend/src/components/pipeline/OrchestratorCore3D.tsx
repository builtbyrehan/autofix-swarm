"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * OrchestratorCore3D — central hub of the pipeline scene.
 *
 * A low-poly torus-knot/icosahedron hybrid with slow idle rotation.
 * Emissive intensity brightens during a run's active phase and
 * pulses on completion.
 */

interface OrchestratorCore3DProps {
  /** 0–1 intensity: idle (0.2) → armed (0.1) → active (0.6) → complete burst (1.0). */
  intensity?: number;
  /** Active pipeline stage for color shifts. */
  stage?: string;
}

export function OrchestratorCore3D({
  intensity = 0.2,
  stage = "idle",
}: OrchestratorCore3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Slow idle rotation
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.3;
  });

  const emissiveColor = new THREE.Color(
    stage === "completed" ? "#22d3ee" : "#06b6d4"
  );

  return (
    <Float speed={0.5} rotationIntensity={0.1} floatIntensity={0.3}>
      <mesh ref={meshRef}>
        <torusKnotGeometry args={[0.8, 0.3, 64, 8]} />
        <MeshDistortMaterial
          color="#0ea5e9"
          emissive={emissiveColor}
          emissiveIntensity={intensity}
          metalness={0.8}
          roughness={0.2}
          distort={0.15}
          speed={2}
        />
      </mesh>
    </Float>
  );
}
