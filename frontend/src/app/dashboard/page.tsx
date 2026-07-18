"use client";

import { useEffect, useState } from "react";
import { Terminal, Bug, Wrench, CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw, Play } from "lucide-react";
import Link from "next/link";

interface Issue {
  id: string;
  file: string;
  line_range: { start: number; end: number };
  description: string;
  severity: string;
  confidence: number;
  detectors: string[];
}

interface Fix {
  fix_id: string;
  issue_id: string;
  status: string;
  codex_live: boolean;
  summary: string;
  changed_files: string[];
  duration_seconds: number;
}

interface Verdict {
  verdict_id: string;
  issue_id: string;
  tests_passed: boolean;
  explanation: string;
  confidence: number;
}

interface PipelineRun {
  run_id: string;
  status: string;
  issues_found: number;
  fixes_attempted: number;
  fixes_succeeded: number;
  verifications_passed: number;
  total_duration_seconds: number;
}

export default function Dashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [latestRun, setLatestRun] = useState<PipelineRun | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  const fetchLatestResults = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/results/latest`);
      if (res.ok) {
        const data = await res.json();
        setLatestRun(data);
        
        // Fetch associated issues, fixes, verdicts
        if (data.run_id) {
          const [issuesRes, fixesRes, verdictsRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/issues/${data.run_id}`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/fixes/${data.run_id}`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/verdicts/${data.run_id}`)
          ]);
          
          if (issuesRes.ok) {
            const issuesData = await issuesRes.json();
            setIssues(issuesData.issues || []);
          }
          if (fixesRes.ok) {
            const fixesData = await fixesRes.json();
            setFixes(fixesData.fixes || []);
          }
          if (verdictsRes.ok) {
            const verdictsData = await verdictsRes.json();
            setVerdicts(verdictsData.verdicts || []);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch results:", error);
    }
  };

  const runPipeline = async () => {
    setIsRunning(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_path: "seeded_repo",
          use_semgrep: true,
          use_gpt: true,
          auto_fix_threshold: 0.7
        })
      });
      
      if (res.ok) {
        await fetchLatestResults();
      }
    } catch (error) {
      console.error("Pipeline failed:", error);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    fetchLatestResults();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'low': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <Terminal className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl font-bold text-white">AutoFix Swarm Dashboard</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={fetchLatestResults}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={runPipeline}
                disabled={isRunning}
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Pipeline
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Pipeline Status */}
        {latestRun && (
          <div className="glass-panel p-6 rounded-xl mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Latest Pipeline Run
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {latestRun.run_id.slice(0, 8)}
              </span>
            </div>
            
            <div className="grid md:grid-cols-5 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Bug className="w-5 h-5 text-red-400" />
                  <span className="text-2xl font-mono font-bold text-white">{latestRun.issues_found}</span>
                </div>
                <p className="text-xs text-slate-400">Issues Found</p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Wrench className="w-5 h-5 text-amber-400" />
                  <span className="text-2xl font-mono font-bold text-white">{latestRun.fixes_attempted}</span>
                </div>
                <p className="text-xs text-slate-400">Fixes Attempted</p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-2xl font-mono font-bold text-white">{latestRun.fixes_succeeded}</span>
                </div>
                <p className="text-xs text-slate-400">Fixes Succeeded</p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                  <span className="text-2xl font-mono font-bold text-white">{latestRun.verifications_passed}</span>
                </div>
                <p className="text-xs text-slate-400">Tests Passed</p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <span className="text-2xl font-mono font-bold text-white">
                    {latestRun.total_duration_seconds.toFixed(1)}s
                  </span>
                </div>
                <p className="text-xs text-slate-400">Duration</p>
              </div>
            </div>
          </div>
        )}

        {/* Issues List */}
        {issues.length > 0 && (
          <div className="glass-panel p-6 rounded-xl mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-400" />
              Detected Issues ({issues.length})
            </h2>
            
            <div className="space-y-3">
              {issues.map((issue) => (
                <div key={issue.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-mono border ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <code className="text-sm text-slate-300">{issue.file}</code>
                      <span className="text-xs text-slate-500">
                        L{issue.line_range.start}-{issue.line_range.end}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {(issue.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{issue.description}</p>
                  <div className="flex items-center gap-2">
                    {issue.detectors.map((detector) => (
                      <span key={detector} className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {detector}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fixes List */}
        {fixes.length > 0 && (
          <div className="glass-panel p-6 rounded-xl mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-400" />
              Applied Fixes ({fixes.length})
            </h2>
            
            <div className="space-y-3">
              {fixes.map((fix) => (
                <div key={fix.fix_id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {fix.status === 'succeeded' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <p className="text-sm font-mono text-slate-300">{fix.issue_id}</p>
                        <p className="text-xs text-slate-500">
                          {fix.codex_live ? (
                            <span className="text-cyan-400">● Live Codex</span>
                          ) : (
                            <span className="text-slate-500">○ Cached</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{fix.duration_seconds.toFixed(2)}s</span>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{fix.summary}</p>
                  {fix.changed_files.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {fix.changed_files.map((file, idx) => (
                        <code key={idx} className="text-xs bg-slate-900 text-cyan-400 px-2 py-1 rounded">
                          {file}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verdicts List */}
        {verdicts.length > 0 && (
          <div className="glass-panel p-6 rounded-xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Verification Results ({verdicts.length})
            </h2>
            
            <div className="space-y-3">
              {verdicts.map((verdict) => (
                <div key={verdict.verdict_id} className={`p-4 rounded-lg border ${verdict.tests_passed ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {verdict.tests_passed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <span className="text-sm font-mono text-slate-300">{verdict.issue_id}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {(verdict.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{verdict.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!latestRun && !isRunning && (
          <div className="glass-panel p-12 rounded-xl text-center">
            <Terminal className="w-16 h-16 text-cyan-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-white mb-2">No Pipeline Runs Yet</h3>
            <p className="text-slate-400 mb-6">Click "Run Pipeline" to start scanning for bugs</p>
            <button
              onClick={runPipeline}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
            >
              Run Your First Scan
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
