"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Text, Sparkles, MeshDistortMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { useMousePosition } from "@/hooks/useMousePosition";

const AGENTS = [
  { label: "Watcher", color: "#22d3ee", angle: 0 },
  { label: "Codex", color: "#2dd4bf", angle: (2 * Math.PI) / 3 },
  { label: "Reviewer", color: "#34d399", angle: (4 * Math.PI) / 3 },
];

const ORBIT_RADIUS = 2.8;

function AgentOrb({ label, color, angle }: { label: string; color: string; angle: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const parsedColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime * 0.3 + angle;
    groupRef.current.position.x = Math.cos(t) * ORBIT_RADIUS;
    groupRef.current.position.z = Math.sin(t) * ORBIT_RADIUS;
    groupRef.current.position.y = Math.sin(t * 0.7) * 0.3;
  });

  return (
    <group ref={groupRef}>
      <Float speed={0.6} rotationIntensity={0.15} floatIntensity={0.15}>
        <mesh>
          <sphereGeometry args={[0.5, 24, 24]} />
          <meshPhysicalMaterial
            color={parsedColor}
            emissive={parsedColor}
            emissiveIntensity={0.3}
            metalness={0.4}
            roughness={0.15}
            clearcoat={0.5}
            clearcoatRoughness={0.2}
            transparent
            opacity={0.9}
          />
        </mesh>
      </Float>
      <pointLight color={parsedColor} intensity={0.4} distance={3} decay={2} />
      <Text
        position={[0, -1, 0]}
        fontSize={0.2}
        color={color}
        font={undefined}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

function OrbitalCore() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.12;
    meshRef.current.rotation.y += delta * 0.25;
  });

  return (
    <Float speed={0.4} rotationIntensity={0.08} floatIntensity={0.2}>
      <mesh ref={meshRef}>
        <torusKnotGeometry args={[0.6, 0.2, 48, 6]} />
        <MeshDistortMaterial
          color="#0ea5e9"
          emissive="#22d3ee"
          emissiveIntensity={0.4}
          metalness={0.7}
          roughness={0.2}
          distort={0.12}
          speed={1.5}
        />
      </mesh>
    </Float>
  );
}

function ParallaxCamera() {
  const mouse = useMousePosition();
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const m = mouse.current;
    target.current.set(
      (m.normalizedX - 0.5) * 0.8,
      (m.normalizedY - 0.5) * -0.4,
      0
    );
    camera.position.x += (target.current.x - camera.position.x) * 0.02;
    camera.position.y += (target.current.y - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function SceneContent() {
  return (
    <>
      <OrbitalCore />
      {AGENTS.map((agent) => (
        <AgentOrb key={agent.label} {...agent} />
      ))}
      <Sparkles
        count={40}
        scale={6}
        size={2}
        speed={0.2}
        color="#22d3ee"
        opacity={0.15}
      />
      <ParallaxCamera />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.3}
          luminanceSmoothing={0.8}
          intensity={0.4}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export function HeroScene3D() {
  return (
    <div className="h-auto w-full max-w-[480px]" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 45, near: 0.1, far: 20 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "low-power",
        }}
        style={{ background: "transparent", minHeight: 320 }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
