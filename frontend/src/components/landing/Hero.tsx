"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowRight, Bug, CheckCircle2, Wrench } from "lucide-react";
import { Button } from "@/components/ui";
import { DURATION, ease, EASE } from "@/lib/easing";
import { getRenderTier, type RenderTier } from "@/lib/capability";

const stages = ["watcher", "codex", "reviewer"] as const;

const stageConfig = {
  watcher: { label: "Detect", color: "hsl(199 89% 48%)", icon: Bug },
  codex: { label: "Fix", color: "hsl(173 80% 45%)", icon: Wrench },
  reviewer: { label: "Verify", color: "hsl(158 64% 45%)", icon: CheckCircle2 },
};

const headlineWords = ["Find", "Bugs.", "Fix", "Them.", "Automatically."];

const HeroScene3DLazy = dynamic(
  () =>
    import("./HeroScene3D").then((mod) => ({
      default: mod.HeroScene3D,
    })),
  {
    ssr: false,
    loading: () => <MiniPipeline />,
  }
);

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [tier, setTier] = useState<RenderTier>("2d");

  useEffect(() => {
    setTier(getRenderTier());
  }, []);

  const handleMouse = useRef((e: MouseEvent) => {
    const el = sectionRef.current;
    if (!el) return;
    el.style.setProperty("--mx", String(e.clientX / window.innerWidth));
    el.style.setProperty("--my", String(e.clientY / window.innerHeight));
  });

  useEffect(() => {
    const fn = handleMouse.current;
    window.addEventListener("mousemove", fn, { passive: true });
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-20 sm:py-28 lg:py-36"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: ease(EASE.primary) }}
          >
            <motion.p
              className="telemetry-label mb-4"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: DURATION.base }}
            >
              OpenAI Build Week · Developer Tools
            </motion.p>

            <h1 className="text-display font-bold tracking-tight text-foreground sm:text-[3.25rem] lg:text-[4rem]">
              {headlineWords.map((word, i) => {
                const isHighlight = word === "Automatically.";
                return (
                  <motion.span
                    key={word}
                    className="inline-block"
                    initial={{ opacity: 0, y: 24, letterSpacing: "0.1em" }}
                    animate={{ opacity: 1, y: 0, letterSpacing: "inherit" }}
                    transition={{
                      delay: 0.15 + i * 0.08,
                      duration: 0.5,
                      ease: ease(EASE.primary),
                    }}
                  >
                    {isHighlight ? (
                      <span
                        className="bg-gradient-to-r from-watcher to-reviewer bg-clip-text text-transparent"
                        style={{
                          backgroundSize: "200% 200%",
                          backgroundPosition:
                            "calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%)",
                        }}
                      >
                        {word}
                      </span>
                    ) : (
                      word
                    )}{" "}
                  </motion.span>
                );
              })}
            </h1>

            <motion.p
              className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: DURATION.base }}
            >
              Three specialized AI agents scan your code, write the fix with Codex,
              and verify it passes tests — producing a human-readable explanation
              so you can trust and merge in seconds.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: DURATION.base }}
            >
              <Button variant="primary" size="lg" asChild>
                <Link href="/dashboard">
                  Launch Command Center
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg">
                View Architecture
              </Button>
            </motion.div>

            <motion.p
              className="mt-6 text-sm italic text-muted-foreground/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: DURATION.base }}
            >
              A system that finds its own bugs, fixes them with Codex, and explains
              why — so developers don&apos;t have to.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: DURATION.slow,
              ease: ease(EASE.primary),
              delay: 0.2,
            }}
            className="flex items-center justify-center"
          >
            {tier === "3d" ? <HeroScene3DLazy /> : <MiniPipeline />}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function MiniPipeline() {
  return (
    <svg
      viewBox="0 0 400 200"
      className="h-auto w-full max-w-[480px]"
      fill="none"
      aria-label="Pipeline: Watcher detects bugs, Codex writes fixes, Reviewer verifies"
      role="img"
    >
      {stages.map((stage, i) => {
        if (i === 0) return null;
        const x1 = 80 + (i - 1) * 160;
        return (
          <line
            key={`line-${stage}`}
            x1={x1 + 30}
            y1={100}
            x2={x1 + 130}
            y2={100}
            stroke="hsl(217 33% 18%)"
            strokeWidth="2"
          >
            <animate
              attributeName="stroke"
              values={`hsl(217 33% 18%);${stageConfig[stage].color};hsl(217 33% 18%)`}
              dur="3s"
              begin={`${(i - 1) * 1.1}s`}
              repeatCount="indefinite"
            />
          </line>
        );
      })}

      {stages.map((stage, i) => {
        const cx = 80 + i * 160;
        const { label, color, icon: Icon } = stageConfig[stage];

        return (
          <g key={stage}>
            <circle cx={cx} cy={100} r={38} fill={`${color}15`}>
              <animate
                attributeName="r"
                values="38;44;38"
                dur="3s"
                begin={`${i * 1.1}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;1;0"
                dur="3s"
                begin={`${i * 1.1}s`}
                repeatCount="indefinite"
              />
            </circle>

            <circle cx={cx} cy={100} r={30} fill="hsl(217 33% 11%)" stroke={color} strokeWidth="1.5">
              <animate
                attributeName="stroke-opacity"
                values="0.3;1;0.3"
                dur="3s"
                begin={`${i * 1.1}s`}
                repeatCount="indefinite"
              />
            </circle>

            <text
              x={cx}
              y={90}
              textAnchor="middle"
              fill={color}
              fontFamily="var(--font-mono)"
              fontSize="10"
              fontWeight="600"
              letterSpacing="0.1em"
            >
              {String(i + 1).padStart(2, "0")}
            </text>

            <text
              x={cx}
              y={158}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontFamily="var(--font-mono)"
              fontSize="11"
              fontWeight="500"
              letterSpacing="0.05em"
            >
              {label.toUpperCase()}
            </text>

            <foreignObject x={cx - 8} y={96} width={16} height={16}>
              <Icon
                style={{ color, width: 16, height: 16 }}
              />
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
