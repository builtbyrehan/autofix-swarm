"use client";

import { useEffect, useState } from "react";
import { Terminal, Bug, Wrench, CheckCircle2, AlertCircle, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Terminal className="w-8 h-8 text-cyan-400" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AutoFix Swarm</h1>
                <p className="text-xs text-slate-400">Autonomous Bug Detection & Remediation</p>
              </div>
            </div>
            
            {health && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className={`status-indicator ${health.database_connected ? 'status-success' : 'status-error'}`} />
                  <span className="text-sm text-slate-300">Database</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-indicator ${health.codex_available ? 'status-success' : 'status-warning'}`} />
                  <span className="text-sm text-slate-300">Codex</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-indicator ${health.gpt_available ? 'status-success' : 'status-warning'}`} />
                  <span className="text-sm text-slate-300">GPT-5.6</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-4">
            Find Bugs. Fix Them.{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              Automatically.
            </span>
          </h2>
          <p className="text-xl text-slate-400 mb-8">
            AI-powered agents that scan, fix, and verify your code — so you don't have to.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Link 
              href="/dashboard"
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 hover:-translate-y-0.5"
            >
              Launch Dashboard
            </Link>
            <button className="px-8 py-4 bg-slate-800 text-white font-semibold rounded-lg border border-slate-700 hover:bg-slate-700 transition-all duration-300">
              View Documentation
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <div className="glass-panel p-6 rounded-xl hover-glow">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-cyan-400" />
              <span className="text-2xl font-mono font-bold text-white">{stats.totalRuns}</span>
            </div>
            <h3 className="text-slate-400 text-sm font-medium">Pipeline Runs</h3>
          </div>

          <div className="glass-panel p-6 rounded-xl hover-glow">
            <div className="flex items-center justify-between mb-4">
              <Bug className="w-8 h-8 text-red-400" />
              <span className="text-2xl font-mono font-bold text-white">{stats.totalIssues}</span>
            </div>
            <h3 className="text-slate-400 text-sm font-medium">Issues Detected</h3>
          </div>

          <div className="glass-panel p-6 rounded-xl hover-glow">
            <div className="flex items-center justify-between mb-4">
              <Wrench className="w-8 h-8 text-amber-400" />
              <span className="text-2xl font-mono font-bold text-white">{stats.totalFixes}</span>
            </div>
            <h3 className="text-slate-400 text-sm font-medium">Fixes Applied</h3>
          </div>

          <div className="glass-panel p-6 rounded-xl hover-glow">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
              <span className="text-2xl font-mono font-bold text-white">{stats.successRate}%</span>
            </div>
            <h3 className="text-slate-400 text-sm font-medium">Success Rate</h3>
          </div>
        </div>

        {/* How It Works */}
        <div className="glass-panel p-8 rounded-xl mb-12">
          <h3 className="text-2xl font-bold text-white mb-8 text-center">
            Three Agents. One Mission.
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Watcher */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Bug className="w-8 h-8 text-cyan-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Watcher</h4>
              <p className="text-slate-400 text-sm">
                Scans your code with Semgrep + GPT-5.6 to detect bugs, security issues, and code smells
              </p>
            </div>

            {/* Codex Fixer */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-teal-500/20 to-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                <Wrench className="w-8 h-8 text-teal-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Codex Fixer</h4>
              <p className="text-slate-400 text-sm">
                Uses OpenAI Codex to write actual code fixes, safely isolated in a sandbox environment
              </p>
            </div>

            {/* Reviewer */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Reviewer</h4>
              <p className="text-slate-400 text-sm">
                Runs tests to verify fixes and generates human-readable explanations with GPT-5.6
              </p>
            </div>
          </div>
        </div>

        {/* System Status */}
        {health && (
          <div className="glass-panel p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-cyan-400" />
              System Status
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">API Status</span>
                <span className="text-green-400 font-mono">{health.status}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Version</span>
                <span className="text-cyan-400 font-mono">{health.version}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Database</span>
                <span className={health.database_connected ? "text-green-400" : "text-red-400"}>
                  {health.database_connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Codex CLI</span>
                <span className={health.codex_available ? "text-green-400" : "text-amber-400"}>
                  {health.codex_available ? "Available" : "Not Available"}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-20">
        <div className="container mx-auto px-6 py-8 text-center text-slate-500 text-sm">
          <p>AutoFix Swarm v0.1.0 | Built for OpenAI Build Week</p>
          <p className="mt-2">Powered by Codex + GPT-5.6</p>
        </div>
      </footer>
    </div>
  );
}
