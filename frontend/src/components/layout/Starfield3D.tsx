"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { useMousePosition } from "@/hooks/useMousePosition";

/**
 * Starfield3D — rich cosmic WebGL background.
 *
 * Composition:
 *   - drei <Stars> — three depth layers with twinkle, warm white → cool cyan.
 *   - Nebula sprites — 3 large, soft, additive-blend clouds drifting slowly.
 *   - Shooting stars — 4 beams that fire at staggered intervals.
 *   - Mouse parallax — subtle camera tilt following the cursor.
 *   - Bloom postprocessing — selective glow on bright stars and nebulae.
 */

/* ---- Nebula configuration ---- */
interface NebulaSprite {
  position: [number, number, number];
  scale: number;
  color: string;
  opacity: number;
  speed: number;
  offset: number;
}

const NEBULAE: NebulaSprite[] = [
  { position: [-6, 3, -12], scale: 18, color: "#22d3ee", opacity: 0.12, speed: 0.06, offset: 0 },
  { position: [7, -2, -15], scale: 22, color: "#2dd4bf", opacity: 0.09, speed: 0.04, offset: 2 },
  { position: [0, 5, -18], scale: 26, color: "#34d399", opacity: 0.06, speed: 0.05, offset: 4 },
];

/* ---- Shooting star system ---- */
interface ShootingStarState {
  progress: number;
  active: boolean;
  nextTrigger: number;
}

function ShootingStarBeam({ delay }: { delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const state = useRef<ShootingStarState>({
    progress: 0,
    active: false,
    nextTrigger: delay,
  });

  useFrame((_, delta) => {
    const s = state.current;
    s.nextTrigger -= delta;

    if (!s.active && s.nextTrigger <= 0) {
      s.active = true;
      s.progress = 0;
      s.nextTrigger = 4 + Math.random() * 6;
    }

    if (s.active) {
      s.progress += delta * 1.2;
      if (s.progress >= 1) {
        s.active = false;
        s.progress = 0;
      }
    }

    if (ref.current) {
      if (s.active) {
        ref.current.visible = true;
        const t = s.progress;
        ref.current.position.set(
          -4 + t * 12,
          6 - t * 8,
          -10
        );
        ref.current.scale.set(1 + t * 2, 0.02 + t * 0.02, 1);
        const mat = ref.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.sin(t * Math.PI) * 0.9;
      } else {
        ref.current.visible = false;
      }
    }
  });

  return (
    <mesh ref={ref} visible={false}>
      <planeGeometry args={[2, 0.04]} />
      <meshBasicMaterial
        color="#e0f2fe"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ---- Nebula sprite ---- */
function Nebula({ config }: { config: NebulaSprite }) {
  const ref = useRef<THREE.Sprite>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * config.speed + config.offset;
    ref.current.position.x = config.position[0] + Math.sin(t) * 0.8;
    ref.current.position.y = config.position[1] + Math.cos(t * 0.7) * 0.5;
    ref.current.position.z = config.position[2];
  });

  return (
    <sprite
      ref={ref}
      position={config.position}
      scale={[config.scale, config.scale, 1]}
    >
      <spriteMaterial
        color={config.color}
        transparent
        opacity={config.opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

/* ---- Mouse-parallax camera controller ---- */
function ParallaxCamera() {
  const mouse = useMousePosition();
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const m = mouse.current;
    target.current.set(
      (m.normalizedX - 0.5) * 1.2,
      (m.normalizedY - 0.5) * -0.6,
      0
    );
    camera.position.x += (target.current.x - camera.position.x) * 0.02;
    camera.position.y += (target.current.y - camera.position.y) * 0.02;
    camera.lookAt(0, 0, -10);
  });

  return null;
}

/* ---- Scene content ---- */
function SceneContent() {
  return (
    <>
      {/* Multi-layer star field — warm near-white with a cool tint */}
      <Stars
        radius={100}
        depth={80}
        count={4000}
        factor={5}
        saturation={0.2}
        fade
        speed={0.4}
      />
      {/* Closer bright star layer */}
      <Stars
        radius={60}
        depth={40}
        count={1200}
        factor={6}
        saturation={0.5}
        fade
        speed={0.6}
      />
      {/* Distant sparse layer — very fine */}
      <Stars
        radius={150}
        depth={120}
        count={6000}
        factor={3}
        saturation={0.1}
        fade
        speed={0.2}
      />

      {/* Nebula sprites */}
      {NEBULAE.map((n, i) => (
        <Nebula key={`neb-${i}`} config={n} />
      ))}

      {/* Shooting stars (staggered delays) */}
      <ShootingStarBeam delay={0.5} />
      <ShootingStarBeam delay={2.8} />
      <ShootingStarBeam delay={5.1} />
      <ShootingStarBeam delay={7.4} />

      {/* Mouse parallax */}
      <ParallaxCamera />

      {/* Postprocessing */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.5}
          luminanceSmoothing={0.9}
          intensity={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

/* ---- Exported canvas ---- */
export function Starfield3D() {
  return (
    <div className="starfield-canvas" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 60, near: 0.1, far: 200 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "low-power",
        }}
        style={{ background: "transparent" }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
