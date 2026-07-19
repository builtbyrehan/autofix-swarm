"use client";

import { Search, Sparkles, Shield } from "lucide-react";
import AnimatedCard from "@/components/AnimatedCard";

const AGENTS: Array<{
  icon: typeof Search;
  title: string;
  description: string;
  from: "left" | "bottom" | "right";
}> = [
  {
    icon: Search,
    title: "Watcher",
    description:
      "Scans your code with Semgrep + GPT-5.6 to detect bugs, security issues, and code smells",
    from: "left",
  },
  {
    icon: Sparkles,
    title: "Codex Fixer",
    description:
      "Uses OpenAI Codex to write actual code fixes, safely isolated in a sandbox environment",
    from: "bottom",
  },
  {
    icon: Shield,
    title: "Reviewer",
    description:
      "Runs tests to verify fixes and generates human-readable explanations with GPT-5.6",
    from: "right",
  },
];

export default function ThreeAgentsSection() {
  return (
    <div className="mb-12">
      <h3 className="text-2xl font-bold mb-8 text-center" style={{ color: "#FFFFFF" }}>
        Three Agents. One Mission.
      </h3>

      <div className="grid md:grid-cols-3 gap-6">
        {AGENTS.map((agent, index) => {
          const Icon = agent.icon;
          return (
            <AnimatedCard key={agent.title} delay={0.2 + index * 0.2} from={agent.from}>
              <div className="glass-panel p-8 rounded-xl hover-glow text-center h-full">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(to bottom right, rgba(252, 163, 17, 0.3), rgba(252, 163, 17, 0.1))",
                    border: "1px solid rgba(252, 163, 17, 0.5)",
                  }}
                >
                  <Icon className="w-8 h-8" style={{ color: "#FCA311" }} />
                </div>
                <h4 className="text-lg font-semibold mb-2" style={{ color: "#FFFFFF" }}>
                  {agent.title}
                </h4>
                <p className="text-sm" style={{ color: "#E5E5E5" }}>
                  {agent.description}
                </p>
              </div>
            </AnimatedCard>
          );
        })}
      </div>
    </div>
  );
}