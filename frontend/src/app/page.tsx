"use client";

import { useEffect, useState } from "react";
import { Terminal, Bug, Wrench, CheckCircle2, AlertCircle, Clock, TrendingUp, Search, Sparkles, Shield } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import SplitText from "@/components/SplitText";
import AnimatedBackground from "@/components/AnimatedBackground";
import AnimatedCard from "@/components/AnimatedCard";
import CounterAnimation from "@/components/CounterAnimation";
import MagneticButton from "@/components/MagneticButton";
import InfiniteScroll from "@/components/InfiniteScroll";

interface HealthStatus {
  status: string;
  version: string;
  codex_available: boolean;
  gpt_available: boolean;
  database_connected: boolean;
}

interface Stats {
  totalRuns: number;
  totalIssues: number;
  totalFixes: number;
  successRate: number;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [stats] = useState<Stats>({
    totalRuns: 0,
    totalIssues: 0,
    totalFixes: 0,
    successRate: 0,
  });

  useEffect(() => {
    // Fetch health status
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/health`)
      .then(res => res.json())
      .then(setHealth)
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #000000, #14213D, #000000)' }}>
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Content */}
      <div className="relative z-10">
      {/* Header */}
      <header className="border-b backdrop-blur-xl" style={{ borderColor: 'rgba(20, 33, 61, 0.5)', background: 'rgba(20, 33, 61, 0.9)' }}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image 
                  src="/logo.png" 
                  alt="AutoFix Swarm Logo" 
                  width={40} 
                  height={40}
                  className="w-10 h-10"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>AutoFix Swarm</h1>
                <p className="text-xs" style={{ color: 'rgba(229, 229, 229, 0.7)' }}>Autonomous Bug Detection & Remediation</p>
              </div>
            </div>
            
            {health && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className={`status-indicator ${health.database_connected ? 'status-success' : 'status-error'}`} />
                  <span className="text-sm" style={{ color: '#E5E5E5' }}>Database</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-indicator ${health.codex_available ? 'status-success' : 'status-warning'}`} />
                  <span className="text-sm" style={{ color: '#E5E5E5' }}>Codex</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-indicator ${health.gpt_available ? 'status-success' : 'status-warning'}`} />
                  <span className="text-sm" style={{ color: '#E5E5E5' }}>GPT-5.6</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        {/* Hero Section */}
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
          <p className="text-xl mb-8" style={{ color: '#E5E5E5' }}>
            Less Debugging.{" "}
            <span className="bg-gradient-to-r from-[#FCA311] to-[#FFD93D] bg-clip-text text-transparent font-semibold">
              More Shipping.
            </span>
          </p>
          <p className="text-lg mb-8 max-w-3xl mx-auto" style={{ color: '#E5E5E5' }}>
            Autonomous AI agents detect bugs, generate verified fixes with Codex, validate every change, and explain the reasoning before you merge.
          </p>
          
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
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <AnimatedCard delay={0.1} from="bottom">
            <div className="glass-panel p-6 rounded-xl hover-glow">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8" style={{ color: '#FCA311' }} />
                <CounterAnimation end={stats.totalRuns} className="text-2xl font-mono font-bold" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-sm font-medium" style={{ color: '#E5E5E5' }}>Pipeline Runs</h3>
            </div>
          </AnimatedCard>

          <AnimatedCard delay={0.2} from="bottom">
            <div className="glass-panel p-6 rounded-xl hover-glow">
              <div className="flex items-center justify-between mb-4">
                <Bug className="w-8 h-8" style={{ color: '#FCA311' }} />
                <CounterAnimation end={stats.totalIssues} className="text-2xl font-mono font-bold" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-sm font-medium" style={{ color: '#E5E5E5' }}>Issues Detected</h3>
            </div>
          </AnimatedCard>

          <AnimatedCard delay={0.3} from="bottom">
            <div className="glass-panel p-6 rounded-xl hover-glow">
              <div className="flex items-center justify-between mb-4">
                <Wrench className="w-8 h-8" style={{ color: '#FCA311' }} />
                <CounterAnimation end={stats.totalFixes} className="text-2xl font-mono font-bold" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-sm font-medium" style={{ color: '#E5E5E5' }}>Fixes Applied</h3>
            </div>
          </AnimatedCard>

          <AnimatedCard delay={0.4} from="bottom">
            <div className="glass-panel p-6 rounded-xl hover-glow">
              <div className="flex items-center justify-between mb-4">
                <CheckCircle2 className="w-8 h-8" style={{ color: '#FCA311' }} />
                <CounterAnimation end={stats.successRate} suffix="%" className="text-2xl font-mono font-bold" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-sm font-medium" style={{ color: '#E5E5E5' }}>Success Rate</h3>
            </div>
          </AnimatedCard>
        </div>

        {/* How It Works */}
        <AnimatedCard className="glass-panel p-8 rounded-xl mb-12">
          <h3 className="text-2xl font-bold mb-8 text-center" style={{ color: '#FFFFFF' }}>
            Three Agents. One Mission.
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Watcher */}
            <AnimatedCard delay={0.2} from="left">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ 
                  background: 'linear-gradient(to bottom right, rgba(252, 163, 17, 0.3), rgba(252, 163, 17, 0.1))', 
                  border: '1px solid rgba(252, 163, 17, 0.5)' 
                }}>
                  <Search className="w-8 h-8" style={{ color: '#FCA311' }} />
                </div>
                <h4 className="text-lg font-semibold mb-2" style={{ color: '#FFFFFF' }}>Watcher</h4>
                <p className="text-sm" style={{ color: '#E5E5E5' }}>
                  Scans your code with Semgrep + GPT-5.6 to detect bugs, security issues, and code smells
                </p>
              </div>
            </AnimatedCard>

            {/* Codex Fixer */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ 
                background: 'linear-gradient(to bottom right, rgba(252, 163, 17, 0.3), rgba(252, 163, 17, 0.1))', 
                border: '1px solid rgba(252, 163, 17, 0.5)' 
              }}>
                <Sparkles className="w-8 h-8" style={{ color: '#FCA311' }} />
              </div>
              <h4 className="text-lg font-semibold mb-2" style={{ color: '#FFFFFF' }}>Codex Fixer</h4>
              <p className="text-sm" style={{ color: '#E5E5E5' }}>
                Uses OpenAI Codex to write actual code fixes, safely isolated in a sandbox environment
              </p>
            </div>

            {/* Reviewer */}
            <AnimatedCard delay={0.4} from="right">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ 
                  background: 'linear-gradient(to bottom right, rgba(252, 163, 17, 0.3), rgba(252, 163, 17, 0.1))', 
                  border: '1px solid rgba(252, 163, 17, 0.5)' 
                }}>
                  <Shield className="w-8 h-8" style={{ color: '#FCA311' }} />
                </div>
                <h4 className="text-lg font-semibold mb-2" style={{ color: '#FFFFFF' }}>Reviewer</h4>
                <p className="text-sm" style={{ color: '#E5E5E5' }}>
                  Runs tests to verify fixes and generates human-readable explanations with GPT-5.6
                </p>
              </div>
            </AnimatedCard>
          </div>
        </AnimatedCard>

        {/* System Status */}
        {health && (
          <AnimatedCard className="glass-panel p-6 rounded-xl" from="bottom">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <AlertCircle className="w-5 h-5" style={{ color: '#FCA311' }} />
              System Status
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                <span style={{ color: '#E5E5E5' }}>API Status</span>
                <span className="text-green-400 font-mono">{health.status}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                <span style={{ color: '#E5E5E5' }}>Version</span>
                <span className="font-mono" style={{ color: '#FCA311' }}>{health.version}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                <span style={{ color: '#E5E5E5' }}>Database</span>
                <span className={health.database_connected ? "text-green-400" : "text-red-400"}>
                  {health.database_connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                <span style={{ color: '#E5E5E5' }}>Codex CLI</span>
                <span className={health.codex_available ? "text-green-400" : "text-amber-400"}>
                  {health.codex_available ? "Available" : "Not Available"}
                </span>
              </div>
            </div>
          </AnimatedCard>
        )}
      </main>

      {/* Tech Stack Marquee */}
      <div className="py-12 border-t border-b" style={{ borderColor: 'rgba(20, 33, 61, 0.5)' }}>
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'rgba(229, 229, 229, 0.7)' }}>
            Powered By
          </p>
        </div>
        <InfiniteScroll speed={40} direction="left">
          <div className="flex items-center gap-12 px-6">
            {['OpenAI Codex', 'GPT-5.6', 'Semgrep', 'Python', 'FastAPI', 'Next.js', 'TypeScript', 'Tailwind CSS'].map((tech, idx) => (
              <div 
                key={idx} 
                className="px-6 py-3 rounded-lg border"
                style={{ 
                  background: 'rgba(20, 33, 61, 0.5)',
                  borderColor: 'rgba(252, 163, 17, 0.4)',
                  color: '#FCA311'
                }}
              >
                <span className="text-lg font-semibold font-mono">{tech}</span>
              </div>
            ))}
          </div>
        </InfiniteScroll>
      </div>

      {/* Footer */}
      <footer className="border-t mt-20" style={{ borderColor: 'rgba(20, 33, 61, 0.5)' }}>
        <div className="container mx-auto px-6 py-8 text-center text-sm" style={{ color: 'rgba(229, 229, 229, 0.6)' }}>
          <p>AutoFix Swarm v0.1.0 | Built for OpenAI Build Week</p>
          <p className="mt-2">Powered by Codex + GPT-5.6</p>
        </div>
      </footer>
      </div>
    </div>
  );
}
