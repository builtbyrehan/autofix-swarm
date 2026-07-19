"use client";

import { useEffect, useState } from "react";
import { Terminal, Bug, Wrench, CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw, Play, TrendingUp, AlertTriangle, Code, GitBranch, Activity, Shield, Target } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    try {
      // Try live results first
      const res = await fetch(`${apiUrl}/results/latest`);
      if (res.ok) {
        const data = await res.json();
        setLatestRun(data);
        
        // Fetch associated issues, fixes, verdicts
        if (data.run_id) {
          const [issuesRes, fixesRes, verdictsRes] = await Promise.all([
            fetch(`${apiUrl}/issues/${data.run_id}`),
            fetch(`${apiUrl}/fixes/${data.run_id}`),
            fetch(`${apiUrl}/verdicts/${data.run_id}`)
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
        return;
      }
    } catch (error) {
      console.error("Failed to fetch live results:", error);
    }
    
    // Fallback to cached demo data
    try {
      const cachedRes = await fetch(`${apiUrl}/demo/cached`);
      if (cachedRes.ok) {
        const cachedData = await cachedRes.json();
        setLatestRun(cachedData.run);
        setIssues(cachedData.issues || []);
        setFixes(cachedData.fixes || []);
        setVerdicts(cachedData.verdicts || []);
      }
    } catch (error) {
      console.error("Failed to fetch cached demo:", error);
    }
  };

  const loadDemoData = async () => {
    setIsRunning(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const cachedRes = await fetch(`${apiUrl}/demo/cached`);
      
      if (cachedRes.ok) {
        const cachedData = await cachedRes.json();
        setLatestRun(cachedData.run);
        setIssues(cachedData.issues || []);
        setFixes(cachedData.fixes || []);
        setVerdicts(cachedData.verdicts || []);
      } else {
        console.error("No demo data available");
      }
    } catch (error) {
      console.error("Failed to load demo data:", error);
    } finally {
      setIsRunning(false);
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
      case 'critical': return 'text-red-800 bg-red-100 border-red-300';
      case 'high': return 'text-orange-800 bg-orange-100 border-orange-300';
      case 'medium': return 'text-amber-800 bg-amber-100 border-amber-300';
      case 'low': return 'text-yellow-800 bg-yellow-100 border-yellow-300';
      default: return 'text-slate-800 bg-slate-100 border-slate-300';
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #000000, #14213D, #000000)' }}>
      {/* Header */}
      <header className="border-b backdrop-blur-xl sticky top-0 z-50" style={{ borderColor: 'rgba(20, 33, 61, 0.5)', background: 'rgba(20, 33, 61, 0.9)' }}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="transition-colors" style={{ color: '#E5E5E5' }} onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'} onMouseLeave={(e) => e.currentTarget.style.color = '#E5E5E5'}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Image 
                    src="/logo.png" 
                    alt="AutoFix Swarm Logo" 
                    width={32} 
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
                <h1 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>AutoFix Swarm Dashboard</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={fetchLatestResults}
                className="p-2 transition-colors"
                style={{ color: '#E5E5E5' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#E5E5E5'}
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={runPipeline}
                disabled={isRunning}
                className="btn-bronze px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#FFFFFF' }}>
                <Clock className="w-5 h-5" style={{ color: '#FCA311' }} />
                Latest Pipeline Run
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-mono border" style={{ background: 'rgba(20, 33, 61, 0.8)', color: '#E5E5E5', borderColor: 'rgba(252, 163, 17, 0.3)' }}>
                {latestRun.run_id.slice(0, 8)}
              </span>
            </div>
            
            <div className="grid md:grid-cols-5 gap-4">
              <div className="p-4 rounded-lg" style={{ background: '#E5E5E5' }}>
                <div className="flex items-center justify-between mb-2">
                  <Bug className="w-5 h-5" style={{ color: '#14213D' }} />
                  <span className="text-2xl font-mono font-bold" style={{ color: '#000000' }}>{latestRun.issues_found}</span>
                </div>
                <p className="text-xs" style={{ color: '#14213D' }}>Issues Found</p>
              </div>

              <div className="p-4 rounded-lg" style={{ background: '#E5E5E5' }}>
                <div className="flex items-center justify-between mb-2">
                  <Wrench className="w-5 h-5" style={{ color: '#14213D' }} />
                  <span className="text-2xl font-mono font-bold" style={{ color: '#000000' }}>{latestRun.fixes_attempted}</span>
                </div>
                <p className="text-xs" style={{ color: '#14213D' }}>Fixes Attempted</p>
              </div>

              <div className="p-4 rounded-lg" style={{ background: '#E5E5E5' }}>
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-5 h-5" style={{ color: '#14213D' }} />
                  <span className="text-2xl font-mono font-bold" style={{ color: '#000000' }}>{latestRun.fixes_succeeded}</span>
                </div>
                <p className="text-xs" style={{ color: '#14213D' }}>Fixes Succeeded</p>
              </div>

              <div className="p-4 rounded-lg" style={{ background: '#E5E5E5' }}>
                <div className="flex items-center justify-between mb-2">
                  <Shield className="w-5 h-5" style={{ color: '#14213D' }} />
                  <span className="text-2xl font-mono font-bold" style={{ color: '#000000' }}>{latestRun.verifications_passed}</span>
                </div>
                <p className="text-xs" style={{ color: '#14213D' }}>Tests Passed</p>
              </div>

              <div className="p-4 rounded-lg" style={{ background: '#E5E5E5' }}>
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-5 h-5" style={{ color: '#14213D' }} />
                  <span className="text-2xl font-mono font-bold" style={{ color: '#000000' }}>
                    {latestRun.total_duration_seconds.toFixed(1)}s
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#14213D' }}>Duration</p>
              </div>
            </div>
          </div>
        )}

        {/* Issues List */}
        {issues.length > 0 && (
          <div className="glass-panel p-6 rounded-xl mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <Bug className="w-5 h-5" style={{ color: '#FCA311' }} />
              Detected Issues ({issues.length})
            </h2>
            
            <div className="space-y-3">
              {issues.map((issue) => (
                <div key={issue.id} className="p-4 rounded-lg border hover:border-opacity-70 transition-colors" style={{ background: '#E5E5E5', borderColor: 'rgba(20, 33, 61, 0.3)' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-mono border ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <code className="text-sm px-2 py-0.5 rounded" style={{ color: '#000000', background: 'rgba(20, 33, 61, 0.15)' }}>{issue.file}</code>
                      <span className="text-xs" style={{ color: '#14213D' }}>
                        L{issue.line_range.start}-{issue.line_range.end}
                      </span>
                    </div>
                    <span className="text-xs font-mono" style={{ color: '#14213D' }}>
                      {(issue.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: '#000000' }}>{issue.description}</p>
                  <div className="flex items-center gap-2">
                    {issue.detectors.map((detector) => (
                      <span key={detector} className="px-2 py-0.5 rounded text-xs border" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#F59E0B' }}>
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
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <Wrench className="w-5 h-5" style={{ color: '#FCA311' }} />
              Applied Fixes ({fixes.length})
            </h2>
            
            <div className="space-y-3">
              {fixes.map((fix) => (
                <div key={fix.fix_id} className="p-4 rounded-lg border" style={{ background: '#E5E5E5', borderColor: 'rgba(20, 33, 61, 0.3)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {fix.status === 'succeeded' ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: '#059669' }} />
                      ) : (
                        <XCircle className="w-5 h-5" style={{ color: '#DC2626' }} />
                      )}
                      <div>
                        <p className="text-sm font-mono" style={{ color: '#14213D' }}>{fix.issue_id}</p>
                        <p className="text-xs" style={{ color: 'rgba(20, 33, 61, 0.7)' }}>
                          {fix.codex_live ? (
                            <span style={{ color: '#FCA311' }}>● Live Codex</span>
                          ) : (
                            <span style={{ color: 'rgba(20, 33, 61, 0.7)' }}>○ Cached</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs" style={{ color: 'rgba(20, 33, 61, 0.7)' }}>{fix.duration_seconds.toFixed(2)}s</span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: '#000000' }}>{fix.summary}</p>
                  {fix.changed_files.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {fix.changed_files.map((file, idx) => (
                        <code key={idx} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(20, 33, 61, 0.15)', color: '#000000' }}>
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
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: '#FCA311' }} />
              Verification Results ({verdicts.length})
            </h2>
            
            <div className="space-y-3">
              {verdicts.map((verdict) => (
                <div key={verdict.verdict_id} className={`p-4 rounded-lg border ${verdict.tests_passed ? 'border-green-600/30' : 'border-red-600/30'}`} style={{ background: '#E5E5E5' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {verdict.tests_passed ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: '#059669' }} />
                      ) : (
                        <XCircle className="w-5 h-5" style={{ color: '#DC2626' }} />
                      )}
                      <span className="text-sm font-mono" style={{ color: '#14213D' }}>{verdict.issue_id}</span>
                    </div>
                    <span className="text-xs" style={{ color: 'rgba(20, 33, 61, 0.7)' }}>
                      {(verdict.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#000000' }}>{verdict.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!latestRun && !isRunning && (
          <div className="glass-panel p-12 rounded-xl text-center">
            <div className="relative w-20 h-20 mx-auto mb-4 opacity-50">
              <Image 
                src="/logo.png" 
                alt="AutoFix Swarm Logo" 
                width={80} 
                height={80}
                className="w-20 h-20"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#E6E1D7' }}>No Pipeline Runs Yet</h3>
            <p className="mb-6" style={{ color: '#B8B3A8' }}>Click "Run Pipeline" to start scanning for bugs</p>
            <button
              onClick={loadDemoData}
              className="btn-bronze px-8 py-3 rounded-lg shadow-bronze-glow"
            >
              Run Your First Scan
            </button>
          </div>
        )}

        {/* Recent Activity Timeline */}
        {latestRun && (
          <div className="glass-panel p-6 rounded-xl mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <Activity className="w-5 h-5" style={{ color: '#FCA311' }} />
              Pipeline Activity
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 rounded-lg" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                <div className="w-2 h-2 rounded-full mt-2" style={{ background: '#10B981' }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium" style={{ color: '#FFFFFF' }}>Pipeline Completed</span>
                    <span className="text-xs" style={{ color: 'rgba(229, 229, 229, 0.6)' }}>Just now</span>
                  </div>
                  <p className="text-sm" style={{ color: '#E5E5E5' }}>
                    Scanned codebase, found {latestRun.issues_found} issues, applied {latestRun.fixes_succeeded} fixes
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                <div className="w-2 h-2 rounded-full mt-2" style={{ background: '#FCA311' }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium" style={{ color: '#FFFFFF' }}>Watcher Agent Activated</span>
                    <span className="text-xs" style={{ color: 'rgba(229, 229, 229, 0.6)' }}>2 min ago</span>
                  </div>
                  <p className="text-sm" style={{ color: '#E5E5E5' }}>
                    Started code analysis with Semgrep + GPT-5.6
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                <div className="w-2 h-2 rounded-full mt-2" style={{ background: '#FCA311' }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium" style={{ color: '#FFFFFF' }}>Codex Fixer Applied</span>
                    <span className="text-xs" style={{ color: 'rgba(229, 229, 229, 0.6)' }}>3 min ago</span>
                  </div>
                  <p className="text-sm" style={{ color: '#E5E5E5' }}>
                    Generated fixes for {latestRun.fixes_attempted} detected issues
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Code Quality Insights */}
        {latestRun && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="glass-panel p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
                <TrendingUp className="w-5 h-5" style={{ color: '#FCA311' }} />
                Success Rate Trend
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: '#E5E5E5' }}>Fix Success Rate</span>
                    <span className="text-sm font-mono font-bold" style={{ color: '#FFFFFF' }}>
                      {latestRun.fixes_succeeded > 0 ? Math.round((latestRun.fixes_succeeded / latestRun.fixes_attempted) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${latestRun.fixes_succeeded > 0 ? (latestRun.fixes_succeeded / latestRun.fixes_attempted) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #FCA311, #FFD93D)'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: '#E5E5E5' }}>Verification Rate</span>
                    <span className="text-sm font-mono font-bold" style={{ color: '#FFFFFF' }}>
                      {latestRun.fixes_succeeded > 0 ? Math.round((latestRun.verifications_passed / latestRun.fixes_succeeded) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${latestRun.fixes_succeeded > 0 ? (latestRun.verifications_passed / latestRun.fixes_succeeded) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #10B981, #34D399)'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: '#FCA311' }} />
                Issue Breakdown
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                  <span className="text-sm" style={{ color: '#E5E5E5' }}>Critical Issues</span>
                  <span className="text-sm font-mono font-bold text-red-400">
                    {issues.filter(i => i.severity === 'critical').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                  <span className="text-sm" style={{ color: '#E5E5E5' }}>High Priority</span>
                  <span className="text-sm font-mono font-bold text-orange-400">
                    {issues.filter(i => i.severity === 'high').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                  <span className="text-sm" style={{ color: '#E5E5E5' }}>Medium Priority</span>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    {issues.filter(i => i.severity === 'medium').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded" style={{ background: 'rgba(20, 33, 61, 0.5)' }}>
                  <span className="text-sm" style={{ color: '#E5E5E5' }}>Low Priority</span>
                  <span className="text-sm font-mono font-bold text-yellow-400">
                    {issues.filter(i => i.severity === 'low').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {latestRun && (
          <div className="glass-panel p-6 rounded-xl mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <Code className="w-5 h-5" style={{ color: '#FCA311' }} />
              Quick Actions
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <button className="p-4 rounded-lg border transition-all hover:border-opacity-100" style={{ 
                background: 'rgba(20, 33, 61, 0.5)',
                borderColor: 'rgba(252, 163, 17, 0.4)'
              }}>
                <GitBranch className="w-6 h-6 mb-2" style={{ color: '#FCA311' }} />
                <h4 className="font-semibold mb-1" style={{ color: '#FFFFFF' }}>Create PR</h4>
                <p className="text-xs" style={{ color: 'rgba(229, 229, 229, 0.7)' }}>Push fixes to new branch</p>
              </button>
              <button className="p-4 rounded-lg border transition-all hover:border-opacity-100" style={{ 
                background: 'rgba(20, 33, 61, 0.5)',
                borderColor: 'rgba(252, 163, 17, 0.4)'
              }}>
                <Terminal className="w-6 h-6 mb-2" style={{ color: '#FCA311' }} />
                <h4 className="font-semibold mb-1" style={{ color: '#FFFFFF' }}>View Logs</h4>
                <p className="text-xs" style={{ color: 'rgba(229, 229, 229, 0.7)' }}>Check detailed execution</p>
              </button>
              <button className="p-4 rounded-lg border transition-all hover:border-opacity-100" style={{ 
                background: 'rgba(20, 33, 61, 0.5)',
                borderColor: 'rgba(252, 163, 17, 0.4)'
              }}>
                <RefreshCw className="w-6 h-6 mb-2" style={{ color: '#FCA311' }} />
                <h4 className="font-semibold mb-1" style={{ color: '#FFFFFF' }}>Re-run Failed</h4>
                <p className="text-xs" style={{ color: 'rgba(229, 229, 229, 0.7)' }}>Retry unsuccessful fixes</p>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
