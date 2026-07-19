"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Float, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * AgentNode3D — one of three agent spheres in orbit around the core.
 *
 * Each node has:
 * - A glassy sphere with identity color
 * - A floating label (via drei <Text>)
 * - A status ring that fills clockwise as the agent's stage progresses
 * - A subtle hover glow when active
 */

interface AgentNode3DProps {
  position: [number, number, number];
  color: string;
  label: string;
  /** 0–1 ring fill progress. */
  progress: number;
  /** Active stage = higher emissive + expanded ring. */
  active: boolean;
  /** Completed state = solid ring + bright glow. */
  completed: boolean;
  onClick?: () => void;
}

export function AgentNode3D({
  position,
  color,
  label,
  progress,
  active,
  completed,
  onClick,
}: AgentNode3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Nodes orbit slowly around the core even when idle
    groupRef.current.position.x = position[0] * Math.cos(delta * 0.05) - position[2] * Math.sin(delta * 0.05);
    groupRef.current.position.z = position[0] * Math.sin(delta * 0.05) + position[2] * Math.cos(delta * 0.05);
  });

  const parsedColor = useMemo(() => new THREE.Color(color), [color]);

  return (
    <group ref={groupRef} position={position}>
      {/* Status ring — arcs around the node */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.4, 64]} />
        <meshBasicMaterial
          color={parsedColor}
          transparent
          opacity={completed ? 1 : active ? 0.8 : 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Node sphere */}
      <Float speed={0.8} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh onClick={onClick}>
          <sphereGeometry args={[0.7, 32, 32]} />
          <meshPhysicalMaterial
            color={parsedColor}
            emissive={parsedColor}
            emissiveIntensity={active ? 0.6 : completed ? 0.8 : 0.1}
            metalness={0.3}
            roughness={0.15}
            clearcoat={0.4}
            clearcoatRoughness={0.3}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Glow halo — visible when active/completed */}
        {(active || completed) && (
          <pointLight
            color={parsedColor}
            intensity={active ? 0.8 : 1.2}
            distance={4}
            decay={2}
          />
        )}
      </Float>

      {/* Floating label */}
      <Html
        position={[0, -1.6, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div className="text-center">
          <p
            className="font-mono text-xs font-semibold tracking-wider"
            style={{ color }}
          >
            {label.toUpperCase()}
          </p>
          {active && (
            <p className="font-mono text-[10px] text-muted-foreground">
              {Math.round(progress * 100)}%
            </p>
          )}
        </div>
      </Html>
    </group>
  );
}
