"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * FlowParticles3D — instanced particle trails along a CatmullRomCurve3 path
 * between the core and agent nodes.
 *
 * Uses a single BufferGeometry with instanced mesh for performance.
 * Particles are animated via a uProgress uniform rather than moving
 * individual meshes — cheap and scales to hundreds of particles.
 */

interface FlowParticles3DProps {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  /** 0–1 flow intensity. */
  intensity: number;
  /** Number of particles in the trail. */
  count?: number;
}

export function FlowParticles3D({
  start,
  end,
  color,
  intensity,
  count = 60,
}: FlowParticles3DProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef(0);

  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2 + 0.5,
      (start[2] + end[2]) / 2
    );
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(...start),
        mid,
        new THREE.Vector3(...end),
      ],
      false
    );
  }, [start, end]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current || intensity === 0) return;

    progressRef.current += delta * intensity * 0.3;
    if (progressRef.current > 1) progressRef.current -= 1;

    const p = progressRef.current;

    for (let i = 0; i < count; i++) {
      // Distribute particles along the curve with a phase offset
      const t = (p + i / count) % 1;
      const point = curve.getPoint(t);
      dummy.position.copy(point);

      // Size fades at the ends
      const size = Math.sin(t * Math.PI) * 0.06;
      dummy.scale.setScalar(size);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const parsedColor = useMemo(() => new THREE.Color(color), [color]);

  if (intensity === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={parsedColor} transparent opacity={0.6} />
    </instancedMesh>
  );
}
