"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import Image from "next/image";
import AnimatedBackground from "@/components/AnimatedBackground";
import AnimatedCard from "@/components/AnimatedCard";
import InfiniteScroll from "@/components/InfiniteScroll";
import Hero from "@/components/Hero";
import ThreeAgentsSection from "@/components/AgentSection";

interface HealthStatus {
  status: string;
  version: string;
  codex_available: boolean;
  gpt_available: boolean;
  database_connected: boolean;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

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
        <Hero />

        <ThreeAgentsSection />

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