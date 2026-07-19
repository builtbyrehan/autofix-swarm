"use client";

import { motion } from "framer-motion";
import { Bug, CheckCircle2, Shield, Wrench } from "lucide-react";
import { HudPanel } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DURATION, EASE, ease } from "@/lib/easing";

/**
 * AgentShowcase — three HUD cards explaining the agent roles.
 * Reads as "Three Agents. One Mission." with each agent getting
 * its identity color, glow on hover, and a short description.
 */

const agents = [
  {
    id: "watcher",
    label: "Watcher",
    tagline: "Bug Detection",
    color: "hsl(199 89% 48%)",
    glowClass: "hover:shadow-glow-cyan",
    description:
      "Scans your code with Semgrep (static analysis) + GPT-5.6 (semantic gap analysis) to detect bugs, security vulnerabilities, and code quality issues.",
    icon: Bug,
    capabilities: ["Semgrep CE", "GPT-5.6", "AST fallback"],
  },
  {
    id: "codex",
    label: "Codex Fixer",
    tagline: "Code Generation",
    color: "hsl(173 80% 45%)",
    glowClass: "hover:shadow-glow-teal",
    description:
      "Uses OpenAI Codex to write the actual code fix. Runs inside a sandboxed Docker container — no network, read-only filesystem, non-root user.",
    icon: Wrench,
    capabilities: ["Codex CLI", "Docker sandbox", "Diff generation"],
  },
  {
    id: "reviewer",
    label: "Reviewer",
    tagline: "Verification & Explanation",
    color: "hsl(158 64% 45%)",
    glowClass: "hover:shadow-glow-emerald",
    description:
      "Runs pytest to verify the fix, then generates a plain-English explanation with GPT-5.6 so you can trust and merge it quickly.",
    icon: CheckCircle2,
    capabilities: ["pytest", "GPT-5.6", "Confidence scoring"],
  },
] as const;

export function AgentShowcase() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: DURATION.base }}
          className="mb-10 text-center"
        >
          <p className="telemetry-label mb-3">Architecture</p>
          <h2 className="text-xl font-semibold text-foreground">
            Three Agents. One Mission.
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {agents.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: DURATION.base,
                  ease: ease(EASE.primary),
                  delay: 0.1 * i,
                }}
              >
                <HudPanel
                  brackets
                  tilt
                  className={cn("h-full p-6 transition-shadow duration-400", agent.glowClass)}
                >
                  {/* Agent identity */}
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${agent.color} 15%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${agent.color} 30%, transparent)`,
                      }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: agent.color }}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {agent.label}
                      </h3>
                      <p
                        className="telemetry-label"
                        style={{ color: agent.color }}
                      >
                        {agent.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                    {agent.description}
                  </p>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-2">
                    {agent.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="rounded px-2 py-0.5 text-xs font-mono text-muted-foreground"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${agent.color} 8%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${agent.color} 20%, transparent)`,
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </HudPanel>
              </motion.div>
            );
          })}
        </div>

        {/* Safety callout */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: DURATION.base, delay: 0.3 }}
          className="mt-8"
        >
          <HudPanel elev={0} className="flex items-start gap-3 p-4">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-watcher" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Safety by design:</span>{" "}
              Codex runs in an isolated Docker container with no network access,
              read-only filesystem, dropped capabilities, and non-root user.
              The original repository is hash-verified before and after execution.
              No agent calls another agent&apos;s tools directly — all coordination
              goes through the orchestrator.
            </p>
          </HudPanel>
        </motion.div>
      </div>
    </section>
  );
}
