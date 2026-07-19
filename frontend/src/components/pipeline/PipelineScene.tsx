"use client";

import { Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import { Vector2 } from "three";
import { OrchestratorCore3D } from "./OrchestratorCore3D";
import { AgentNode3D } from "./AgentNode3D";
import { FlowParticles3D } from "./FlowParticles3D";
import { Skeleton } from "@/components/ui";

/**
 * PipelineScene — 3D scene root for the pipeline centerpiece.
 *
 * Composition:
 *   Environment (drei night preset)
 *   Three-point lighting (key/fill/rim)
 *   OrchestratorCore3D (center)
 *   AgentNode3D × 3 (orbiting at 120° intervals)
 *   FlowParticles3D (animated particle trails)
 *   Postprocessing: selective bloom + subtle chromatic aberration
 *
 * OrchestratorCore3D and AgentNodes react to the current pipeline stage
 * via the `stage`, `progress`, and `isRunning` props.
 */

interface PipelineSceneProps {
  stage: string;
  progress: number;
  isRunning: boolean;
  onNodeClick?: (agent: string) => void;
}

const AGENTS = [
  { agent: "watcher", label: "Watcher", color: "hsl(199 89% 48%)", angle: 0 },
  { agent: "codex", label: "Codex Fixer", color: "hsl(173 80% 45%)", angle: (2 * Math.PI) / 3 },
  { agent: "reviewer", label: "Reviewer", color: "hsl(158 64% 45%)", angle: (4 * Math.PI) / 3 },
] as const;

const STAGE_ORDER = ["idle", "scanning", "fixing", "verifying", "completed"];

function getCoreIntensity(stage: string): number {
  switch (stage) {
    case "idle": return 0.2;
    case "scanning": return 0.4;
    case "fixing": return 0.5;
    case "verifying": return 0.6;
    case "completed": return 1.0;
    default: return 0.2;
  }
}

function SceneContent({
  stage,
  progress,
  onNodeClick,
}: PipelineSceneProps) {
  const stageIdx = STAGE_ORDER.indexOf(stage);
  const coreIntensity = getCoreIntensity(stage);

  const particleFlows = useMemo(() => {
    const radius = 3.5;
    return AGENTS.map((a) => ({
      agent: a.agent,
      start: [0, 0, 0] as [number, number, number],
      end: [
        radius * Math.cos(a.angle),
        0,
        radius * Math.sin(a.angle),
      ] as [number, number, number],
    }));
  }, []);

  return (
    <>
      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.3} />
      {/* Key light — warm, from upper-right */}
      <directionalLight position={[5, 5, 5]} intensity={1.2} color="#e0f2fe" />
      {/* Fill light — cool, from lower-left */}
      <directionalLight position={[-4, -2, 3]} intensity={0.6} color="#0891b2" />
      {/* Rim light — from behind, cyan */}
      <directionalLight position={[0, 2, -6]} intensity={0.8} color="#22d3ee" />

      {/* Environment preset for reflections */}
      <Environment preset="night" />

      {/* Central core */}
      <OrchestratorCore3D intensity={coreIntensity} stage={stage} />

      {/* Agent nodes */}
      {AGENTS.map((agent, i) => {
        const radius = 3.5;
        const x = radius * Math.cos(agent.angle);
        const z = radius * Math.sin(agent.angle);

        const agentStageIdx = i + 1;
        const isActive = stageIdx === agentStageIdx;
        const isCompleted = stageIdx > agentStageIdx || (agent.agent === "reviewer" && stage === "completed");

        return (
          <AgentNode3D
            key={agent.agent}
            position={[x, 0, z]}
            color={agent.color}
            label={agent.label}
            progress={isActive ? progress : isCompleted ? 1 : 0}
            active={isActive}
            completed={isCompleted}
            onClick={() => onNodeClick?.(agent.agent)}
          />
        );
      })}

      {/* Flow particles from core to active node */}
      {particleFlows.map((flow) => {
        const agentIdx = AGENTS.findIndex((a) => a.agent === flow.agent);
        const isActive = stageIdx === agentIdx + 1;

        return (
          <FlowParticles3D
            key={flow.agent}
            start={flow.start}
            end={flow.end}
            color={AGENTS[agentIdx].color}
            intensity={isActive ? 1 : 0}
          />
        );
      })}

      {/* Subtle auto-orbit camera */}
      <CameraController active={stage !== "idle" && stage !== "completed"} />

      {/* Free camera toggle — off by default, user can enable */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={0.1}
        enabled={false}
      />
    </>
  );
}

function CameraController({ active }: { active: boolean }) {
  useFrame((state) => {
    if (active) {
      // Subtle drift when a run is in progress
      state.camera.position.x = 6 * Math.sin(state.clock.elapsedTime * 0.05);
      state.camera.position.z = 6 * Math.cos(state.clock.elapsedTime * 0.05);
      state.camera.lookAt(0, 0, 0);
    }
  });
  return null;
}

export function PipelineScene(props: PipelineSceneProps) {
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border bg-bg-0/40">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [6, 2, 6], fov: 45, near: 0.1, far: 20 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <SceneContent {...props} />
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.6}
              luminanceSmoothing={0.9}
              intensity={0.4}
              mipmapBlur
            />
            <ChromaticAberration
              offset={new Vector2(0.002, 0.002)}
              radialModulation
              modulationOffset={0}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
