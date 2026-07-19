"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Bug, Wrench, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import SplitText from "@/components/SplitText";
import AnimatedCard from "@/components/AnimatedCard";
import CounterAnimation from "@/components/CounterAnimation";
import MagneticButton from "@/components/MagneticButton";

interface Stats {
  totalRuns: number;
  totalIssues: number;
  totalFixes: number;
  successRate: number;
}

export default function Hero() {
  const [stats, setStats] = useState<Stats>({
    totalRuns: 0,
    totalIssues: 0,
    totalFixes: 0,
    successRate: 0,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/stats`)
      .then((res) => res.json())
      .then((data) => {
        setStats({
          totalRuns: data.total_runs,
          totalIssues: data.total_issues,
          totalFixes: data.total_fixes,
          successRate: data.success_rate,
        });
        setStatsLoaded(true);
      })
      .catch(console.error);
  }, []);

  return (
    <>
      <div className="text-center mb-16">
        <SplitText
          text="Software That Fixes Itself."
          tag="h2"
          className="text-5xl font-bold mb-4"
          delay={30}
          duration={1}
          ease="power3.out"
          splitType="chars"
          from={{ opacity: 0, y: 50 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.2}
          rootMargin="0px"
          textAlign="center"
        />

        <AnimatedCard delay={0.4} from="bottom">
          <p className="text-xl mb-8" style={{ color: "#E5E5E5" }}>
            Less Debugging.{" "}
            <span className="bg-gradient-to-r from-[#FCA311] to-[#FFD93D] bg-clip-text text-transparent font-semibold">
              More Shipping.
            </span>
          </p>
        </AnimatedCard>

        <AnimatedCard delay={0.5} from="bottom">
          <p className="text-lg mb-8 max-w-3xl mx-auto" style={{ color: "#E5E5E5" }}>
            Autonomous AI agents detect bugs, generate verified fixes with Codex, validate
            every change, and explain the reasoning before you merge.
          </p>
        </AnimatedCard>

        <AnimatedCard delay={0.6} from="bottom">
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard">
              <MagneticButton className="btn-bronze px-8 py-4 rounded-lg shadow-bronze-glow">
                Launch Dashboard
              </MagneticButton>
            </Link>
            <MagneticButton className="btn-teal px-8 py-4 rounded-lg">
              View Documentation
            </MagneticButton>
          </div>
        </AnimatedCard>
      </div>

      <div className="grid md:grid-cols-4 gap-6 mb-16">
        <AnimatedCard delay={0.7} from="bottom">
          <div className="glass-panel p-6 rounded-xl hover-glow">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8" style={{ color: "#FCA311" }} />
              {statsLoaded ? (
                <CounterAnimation
                  end={stats.totalRuns}
                  className="text-2xl font-mono font-bold"
                  style={{ color: "#FFFFFF" }}
                />
              ) : (
                <span className="text-2xl font-mono font-bold" style={{ color: "#E5E5E566" }}>
                  &mdash;
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium" style={{ color: "#E5E5E5" }}>
              Pipeline Runs
            </h3>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.8} from="bottom">
          <div className="glass-panel p-6 rounded-xl hover-glow">
            <div className="flex items-center justify-between mb-4">
              <Bug className="w-8 h-8" style={{ color: "#FCA311" }} />
              {statsLoaded ? (
                <CounterAnimation
                  end={stats.totalIssues}
                  className="text-2xl font-mono font-bold"
                  style={{ color: "#FFFFFF" }}
                />
              ) : (
                <span className="text-2xl font-mono font-bold" style={{ color: "#E5E5E566" }}>
                  &mdash;
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium" style={{ color: "#E5E5E5" }}>
              Issues Detected
            </h3>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.9} from="bottom">
          <div className="glass-panel p-6 rounded-xl hover-glow">
            <div className="flex items-center justify-between mb-4">
              <Wrench className="w-8 h-8" style={{ color: "#FCA311" }} />
              {statsLoaded ? (
                <CounterAnimation
                  end={stats.totalFixes}
                  className="text-2xl font-mono font-bold"
                  style={{ color: "#FFFFFF" }}
                />
              ) : (
                <span className="text-2xl font-mono font-bold" style={{ color: "#E5E5E566" }}>
                  &mdash;
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium" style={{ color: "#E5E5E5" }}>
              Fixes Applied
            </h3>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={1.0} from="bottom">
          <div className="glass-panel p-6 rounded-xl hover-glow">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle2 className="w-8 h-8" style={{ color: "#FCA311" }} />
              {statsLoaded ? (
                <CounterAnimation
                  end={stats.successRate}
                  suffix="%"
                  className="text-2xl font-mono font-bold"
                  style={{ color: "#FFFFFF" }}
                />
              ) : (
                <span className="text-2xl font-mono font-bold" style={{ color: "#E5E5E566" }}>
                  &mdash;
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium" style={{ color: "#E5E5E5" }}>
              Success Rate
            </h3>
          </div>
        </AnimatedCard>
      </div>
    </>
  );
}