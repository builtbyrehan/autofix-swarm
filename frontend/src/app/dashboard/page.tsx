"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Terminal, Bug, Wrench, CheckCircle2, XCircle, Clock, ArrowLeft,
  RefreshCw, Play, TrendingUp, AlertTriangle, Code, Activity, Shield,
  Target, Upload, FileText, Copy, Trash2, ChevronDown
} from "lucide-react";
import Link from "next/link";

interface Issue { id: string; file: string; line_range: { start: number; end: number }; description: string; severity: string; confidence: number; detectors: string[]; }
interface Fix { fix_id: string; issue_id: string; status: string; codex_live: boolean; summary: string; changed_files: string[]; duration_seconds: number; }
interface Verdict { verdict_id: string; issue_id: string; tests_passed: boolean; explanation: string; confidence: number; }
interface PipelineRun { run_id: string; status: string; issues_found: number; fixes_attempted: number; fixes_succeeded: number; verifications_passed: number; total_duration_seconds: number; }

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-error bg-error/10 border-error/30",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
};

export default function Dashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [latestRun, setLatestRun] = useState<PipelineRun | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  // Paste Code state
  const [showPaste, setShowPaste] = useState(false);
  const [pastedCode, setPastedCode] = useState("");
  const [pasteLanguage, setPasteLanguage] = useState("python");
  const [pasteResult, setPasteResult] = useState<string | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);

  // Upload File state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchLatestResults = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/results/latest`);
      if (res.ok) {
        const data = await res.json();
        setLatestRun(data);
        if (data.run_id) {
          const [issuesRes, fixesRes, verdictsRes] = await Promise.all([
            fetch(`${apiUrl}/issues/${data.run_id}`),
            fetch(`${apiUrl}/fixes/${data.run_id}`),
            fetch(`${apiUrl}/verdicts/${data.run_id}`),
          ]);
          if (issuesRes.ok) setIssues((await issuesRes.json()).issues || []);
          if (fixesRes.ok) setFixes((await fixesRes.json()).fixes || []);
          if (verdictsRes.ok) setVerdicts((await verdictsRes.json()).verdicts || []);
        }
        return;
      }
    } catch {}
    try {
      const cachedRes = await fetch(`${apiUrl}/demo/cached`);
      if (cachedRes.ok) {
        const d = await cachedRes.json();
        setLatestRun(d.run); setIssues(d.issues || []); setFixes(d.fixes || []); setVerdicts(d.verdicts || []);
      }
    } catch {}
  }, [apiUrl]);

  const runPipeline = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_path: "seeded_repo", use_semgrep: true, use_gpt: true, auto_fix_threshold: 0.7 })
      });
      if (res.ok) {
        await fetchLatestResults();
      } else {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        setError(body.detail || `Request failed (${res.status})`);
      }
    } catch (e) {
      setError("Network error. Is the backend running?");
    } finally { setIsRunning(false); }
  };

  const handlePasteSubmit = async () => {
    if (!pastedCode.trim()) return;
    setPasteLoading(true); setPasteResult(null);
    try {
      const res = await fetch(`${apiUrl}/run/custom`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pastedCode, language: pasteLanguage, use_semgrep: true, use_gpt: true })
      });
      if (res.ok) {
        const data = await res.json();
        setPasteResult(`Scan complete. ${data.issues_found || 0} issues found.`);
        if (data.run_id) {
          const iRes = await fetch(`${apiUrl}/issues/${data.run_id}`);
          if (iRes.ok) { const iData = await iRes.json(); setIssues(iData.issues || []); }
        }
      } else setPasteResult("Error: Could not scan code.");
    } catch { setPasteResult("Network error. Is the backend running?"); } finally { setPasteLoading(false); }
  };

  const handleUploadSubmit = async () => {
    if (!uploadedFile) return;
    setUploadLoading(true); setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      const res = await fetch(`${apiUrl}/upload`, { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setUploadResult(`File "${uploadedFile.name}" uploaded. ${data.issues_found || 0} issues found.`);
        if (data.run_id) {
          const iRes = await fetch(`${apiUrl}/issues/${data.run_id}`);
          if (iRes.ok) { const iData = await iRes.json(); setIssues(iData.issues || []); }
        }
      } else setUploadResult("Error: Could not upload file.");
    } catch { setUploadResult("Network error."); } finally { setUploadLoading(false); }
  };

  useEffect(() => { fetchLatestResults(); }, [fetchLatestResults]);

  const getSeverityStyle = (severity: string) => SEVERITY_STYLES[severity.toLowerCase()] ?? "text-white/60 bg-white/5 border-white/15";

  return (
    <div className="min-h-screen bg-[#050505]">
      <header className="sticky top-0 z-50 border-b border-[rgba(255,255,255,0.08)] bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#a3a3a3] transition-colors hover:text-[#fafafa]"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full bg-brand-gold" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-gold" />
              </span>
              <h1 className="font-sans text-[15px] font-medium uppercase tracking-tight text-[#fafafa]">
                AutoFix<span className="text-brand-gold">Swarm</span> <span className="text-[#a3a3a3]">/ Dashboard</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowPaste(!showPaste); setShowUpload(false); }} className={`flex items-center gap-2 rounded-full border px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-wider transition-all duration-300 ${showPaste ? "border-brand-gold bg-brand-gold/10 text-brand-gold" : "border-[rgba(255,255,255,0.08)] text-[#a3a3a3] hover:border-brand-gold hover:text-brand-gold"}`}>
              <Copy className="h-3.5 w-3.5" /> Paste Code
            </button>
            <button onClick={() => { setShowUpload(!showUpload); setShowPaste(false); }} className={`flex items-center gap-2 rounded-full border px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-wider transition-all duration-300 ${showUpload ? "border-brand-gold bg-brand-gold/10 text-brand-gold" : "border-[rgba(255,255,255,0.08)] text-[#a3a3a3] hover:border-brand-gold hover:text-brand-gold"}`}>
              <Upload className="h-3.5 w-3.5" /> Upload File
            </button>
            <button onClick={fetchLatestResults} className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] text-[#a3a3a3] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-gold hover:text-brand-gold" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={runPipeline} disabled={isRunning} className="flex items-center gap-2 rounded-full bg-brand-gold px-6 py-2.5 font-sans text-[13px] font-medium uppercase tracking-wide text-[#050505] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_24px_-4px_rgba(251,191,36,0.4)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none">
              {isRunning ? <><Clock className="h-4 w-4 animate-spin" /> Running</> : <><Play className="h-4 w-4" /> Run Pipeline</>}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8">
        {/* PASTE CODE MODULE */}
        {showPaste && (
          <div className="glass-panel mb-8 rounded-[24px] p-6">
            <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
              <Copy className="h-5 w-5 text-brand-gold" /> Paste Code for Analysis
            </h2>
            <div className="mb-4 flex items-center gap-3">
              <label className="font-sans text-xs font-medium uppercase tracking-wider text-[#a3a3a3]">Language:</label>
              <div className="relative">
                <select value={pasteLanguage} onChange={e => setPasteLanguage(e.target.value)} className="appearance-none rounded-full border border-[rgba(255,255,255,0.08)] bg-white/5 pl-4 pr-10 py-2 font-mono text-sm text-[#fafafa] outline-none transition-all duration-200 cursor-pointer hover:border-brand-gold/50 hover:bg-brand-gold/[0.03] focus:border-brand-gold focus:shadow-[0_0_12px_-2px_rgba(251,191,36,0.2)]">
                  {[
                    { value: "python", label: "Python" },
                    { value: "javascript", label: "JavaScript" },
                    { value: "typescript", label: "TypeScript" },
                    { value: "go", label: "Go" },
                    { value: "rust", label: "Rust" },
                    { value: "java", label: "Java" },
                    { value: "c", label: "C" },
                    { value: "cpp", label: "C++" },
                    { value: "solidity", label: "Solidity" },
                  ].map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronDown className="h-4 w-4 text-brand-gold" />
                </div>
              </div>
            </div>
            <textarea value={pastedCode} onChange={e => setPastedCode(e.target.value)} placeholder="Paste your code here..." className="mb-4 h-48 w-full resize-y rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-4 font-mono text-sm text-[#fafafa] outline-none transition-colors placeholder:text-[#a3a3a3]/50 focus:border-brand-gold/50" spellCheck={false} />
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#a3a3a3]">{pastedCode.length} chars</span>
              <div className="flex items-center gap-3">
                {pastedCode && <button onClick={() => setPastedCode("")} className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3] transition-colors hover:border-error/50 hover:text-error"><Trash2 className="h-3.5 w-3.5" /> Clear</button>}
                <button onClick={handlePasteSubmit} disabled={pasteLoading || !pastedCode.trim()} className="flex items-center gap-2 rounded-full bg-brand-gold px-6 py-2.5 font-sans text-[13px] font-medium uppercase tracking-wide text-[#050505] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_24px_-4px_rgba(251,191,36,0.4)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none">
                  {pasteLoading ? <><Clock className="h-4 w-4 animate-spin" /> Scanning</> : <><Play className="h-4 w-4" /> Analyze Code</>}
                </button>
              </div>
            </div>
            {pasteResult && <p className="mt-4 rounded-[12px] bg-white/[0.03] p-3 font-mono text-sm text-[#fafafa]/80">{pasteResult}</p>}
          </div>
        )}

        {/* UPLOAD FILE MODULE */}
        {showUpload && (
          <div className="glass-panel mb-8 rounded-[24px] p-6">
            <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
              <Upload className="h-5 w-5 text-brand-gold" /> Upload File for Analysis
            </h2>
            <div
              className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-10 transition-colors hover:border-brand-gold/50 hover:bg-brand-gold/[0.02]"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setUploadedFile(f); }}
            >
              <Upload className="mb-4 h-10 w-10 text-[#a3a3a3]" />
              <p className="mb-1 font-sans text-sm font-medium text-[#fafafa]">{uploadedFile ? uploadedFile.name : "Drop a file here or click to browse"}</p>
              <p className="font-sans text-xs font-light text-[#a3a3a3]">Supports .py, .js, .ts, .go, .rs, .java, .c, .cpp, .sol</p>
              <input ref={fileInputRef} type="file" accept=".py,.js,.ts,.go,.rs,.java,.c,.cpp,.sol,.tsx,.jsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f); }} />
            </div>
            {uploadedFile && (
              <div className="mb-4 flex items-center justify-between rounded-[12px] bg-white/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-brand-gold" />
                  <div>
                    <p className="font-sans text-sm text-[#fafafa]">{uploadedFile.name}</p>
                    <p className="font-mono text-xs text-[#a3a3a3]">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setUploadedFile(null)} className="rounded-full border border-[rgba(255,255,255,0.08)] p-2 text-[#a3a3a3] transition-colors hover:border-error/50 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                  <button onClick={handleUploadSubmit} disabled={uploadLoading} className="flex items-center gap-2 rounded-full bg-brand-gold px-5 py-2 font-sans text-[13px] font-medium uppercase tracking-wide text-[#050505] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_24px_-4px_rgba(251,191,36,0.4)] disabled:cursor-not-allowed disabled:opacity-50">
                    {uploadLoading ? <><Clock className="h-4 w-4 animate-spin" /> Uploading</> : <><Upload className="h-4 w-4" /> Upload & Analyze</>}
                  </button>
                </div>
              </div>
            )}
            {uploadResult && <p className="rounded-[12px] bg-white/[0.03] p-3 font-mono text-sm text-[#fafafa]/80">{uploadResult}</p>}
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="mb-8 rounded-[24px] border border-error/30 bg-error/10 p-6">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
              <div>
                <h3 className="mb-1 font-sans text-sm font-medium text-[#fafafa]">Pipeline Error</h3>
                <p className="font-sans text-sm font-light text-[#a3a3a3]">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto shrink-0 text-[#a3a3a3] transition-colors hover:text-[#fafafa]"><XCircle className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* LATEST RUN STATS */}
        {latestRun && (
          <div className="glass-panel mb-8 rounded-[24px] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
                <Clock className="h-5 w-5 text-brand-gold" /> Latest Pipeline Run
              </h2>
              <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-white/5 px-3 py-1 font-mono text-xs text-[#a3a3a3]">{latestRun.run_id.slice(0, 8)}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-5">
              {[
                { icon: Bug, value: latestRun.issues_found, label: "Issues Found" },
                { icon: Wrench, value: latestRun.fixes_attempted, label: "Fixes Attempted" },
                { icon: CheckCircle2, value: latestRun.fixes_succeeded, label: "Fixes Succeeded" },
                { icon: Shield, value: latestRun.verifications_passed, label: "Tests Passed" },
                { icon: Target, value: `${latestRun.total_duration_seconds.toFixed(1)}s`, label: "Duration" },
              ].map((stat) => (
                <div key={stat.label} className="group rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-gold/30 hover:shadow-[0_8px_24px_-8px_rgba(251,191,36,0.08)]">
                  <div className="mb-2 flex items-center justify-between">
                    <stat.icon className="h-5 w-5 text-brand-gold transition-transform duration-300 group-hover:scale-110" />
                    <span className="font-mono text-2xl font-medium text-[#fafafa] transition-colors duration-300 group-hover:text-brand-gold">{stat.value}</span>
                  </div>
                  <p className="font-sans text-[11px] font-medium uppercase tracking-widest text-[#a3a3a3]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ISSUES */}
        {issues.length > 0 && (
          <div className="glass-panel mb-8 rounded-[24px] p-6">
            <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
              <Bug className="h-5 w-5 text-brand-gold" /> Detected Issues ({issues.length})
            </h2>
            <div className="space-y-3">
              {issues.map((issue) => (
                <div key={issue.id} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-4 transition-colors hover:border-white/20">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded border px-2 py-1 font-mono text-xs ${getSeverityStyle(issue.severity)}`}>{issue.severity.toUpperCase()}</span>
                      <code className="rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-[#fafafa]/80">{issue.file}</code>
                      <span className="font-mono text-xs text-[#a3a3a3]">L{issue.line_range.start}-{issue.line_range.end}</span>
                    </div>
                    <span className="font-mono text-xs text-[#a3a3a3]">{(issue.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                  <p className="mb-2 font-sans text-sm font-light text-[#fafafa]/70">{issue.description}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {issue.detectors.map(d => <span key={d} className="rounded border border-brand-gold/30 bg-brand-gold-wash px-2 py-0.5 font-mono text-xs text-brand-gold">{d}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FIXES */}
        {fixes.length > 0 && (
          <div className="glass-panel mb-8 rounded-[24px] p-6">
            <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
              <Wrench className="h-5 w-5 text-brand-gold" /> Applied Fixes ({fixes.length})
            </h2>
            <div className="space-y-3">
              {fixes.map(fix => (
                <div key={fix.fix_id} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {fix.status === "succeeded" ? <CheckCircle2 className="h-5 w-5 text-brand-gold" /> : <XCircle className="h-5 w-5 text-error" />}
                      <div>
                        <p className="font-mono text-sm text-[#fafafa]/80">{fix.issue_id}</p>
                        <p className="font-mono text-xs">{fix.codex_live ? <span className="text-brand-gold">● Live Codex</span> : <span className="text-[#a3a3a3]">○ Cached</span>}</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-[#a3a3a3]">{fix.duration_seconds.toFixed(2)}s</span>
                  </div>
                  <p className="mb-2 font-sans text-sm font-light text-[#fafafa]/70">{fix.summary}</p>
                  {fix.changed_files.length > 0 && <div className="flex flex-wrap items-center gap-2">{fix.changed_files.map((f, i) => <code key={i} className="rounded bg-white/5 px-2 py-1 font-mono text-xs text-[#fafafa]/70">{f}</code>)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VERDICTS */}
        {verdicts.length > 0 && (
          <div className="glass-panel mb-8 rounded-[24px] p-6">
            <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
              <CheckCircle2 className="h-5 w-5 text-brand-gold" /> Verification Results ({verdicts.length})
            </h2>
            <div className="space-y-3">
              {verdicts.map(v => (
                <div key={v.verdict_id} className={`rounded-lg border p-4 ${v.tests_passed ? "border-brand-gold/20 bg-white/[0.02]" : "border-error/20 bg-white/[0.02]"}`}>
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {v.tests_passed ? <CheckCircle2 className="h-5 w-5 text-brand-gold" /> : <XCircle className="h-5 w-5 text-error" />}
                      <span className="font-mono text-sm text-[#fafafa]/80">{v.issue_id}</span>
                    </div>
                    <span className="font-mono text-xs text-[#a3a3a3]">{(v.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                  <p className="font-sans text-sm font-light text-[#fafafa]/70">{v.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUCCESS RATE & BREAKDOWN */}
        {latestRun && (
          <div className="mb-8 grid gap-6 md:grid-cols-2">
            <div className="glass-panel rounded-[24px] p-6">
              <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
                <TrendingUp className="h-5 w-5 text-brand-gold" /> Success Rate
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-sans text-sm font-light text-[#a3a3a3]">Fix Success Rate</span>
                    <span className="font-mono text-sm font-medium text-[#fafafa]">{latestRun.fixes_succeeded > 0 ? Math.round((latestRun.fixes_succeeded / latestRun.fixes_attempted) * 100) : 0}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-gold/80 to-brand-gold transition-all duration-1000 ease-out" style={{ width: `${latestRun.fixes_succeeded > 0 ? (latestRun.fixes_succeeded / latestRun.fixes_attempted) * 100 : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-sans text-sm font-light text-[#a3a3a3]">Verification Rate</span>
                    <span className="font-mono text-sm font-medium text-[#fafafa]">{latestRun.fixes_succeeded > 0 ? Math.round((latestRun.verifications_passed / latestRun.fixes_succeeded) * 100) : 0}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-gold/60 to-brand-gold/70 transition-all duration-1000 ease-out" style={{ width: `${latestRun.fixes_succeeded > 0 ? (latestRun.verifications_passed / latestRun.fixes_succeeded) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-panel rounded-[24px] p-6">
              <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
                <AlertTriangle className="h-5 w-5 text-brand-gold" /> Issue Breakdown
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Critical Issues", severity: "critical", color: "text-error" },
                  { label: "High Priority", severity: "high", color: "text-orange-400" },
                  { label: "Medium Priority", severity: "medium", color: "text-amber-400" },
                  { label: "Low Priority", severity: "low", color: "text-yellow-400" },
                ].map(row => {
                  const count = issues.filter(i => i.severity === row.severity).length;
                  return (
                    <div key={row.severity} className="flex items-center justify-between rounded bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.06]">
                      <span className="font-sans text-sm font-light text-[#a3a3a3]">{row.label}</span>
                      <span className={`font-mono text-sm font-medium ${row.color}`}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!latestRun && !isRunning && (
          <div className="glass-panel rounded-[24px] p-16 text-center">
            <div className="relative mx-auto mb-6 h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-brand-gold-wash blur-xl" />
              <div className="relative flex h-24 w-24 items-center justify-center">
                <Bug className="h-12 w-12 text-brand-gold/40" />
              </div>
            </div>
            <h3 className="mb-2 font-sans text-xl font-medium text-[#fafafa]">No Pipeline Runs Yet</h3>
            <p className="mx-auto mb-8 max-w-sm font-sans text-sm font-light text-[#a3a3a3]">
              Click &ldquo;Run Pipeline&rdquo; to scan your codebase for bugs, paste code, or upload a file.
            </p>
            <button onClick={runPipeline} className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-8 py-3 font-sans text-[13px] font-medium uppercase tracking-wide text-[#050505] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_28px_-6px_rgba(251,191,36,0.4)]">
              <Play className="h-4 w-4" /> Run Pipeline
            </button>
          </div>
        )}

        {/* ACTIVITY TIMELINE */}
        {latestRun && (
          <div className="glass-panel mb-8 rounded-[24px] p-6">
            <h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
              <Activity className="h-5 w-5 text-brand-gold" /> Pipeline Activity
            </h2>
            <div className="space-y-4">
              {[
                { dot: "bg-brand-gold animate-timeline-pulse", title: "Pipeline Completed", time: "Just now", desc: `Scanned codebase, found ${latestRun.issues_found} issues, applied ${latestRun.fixes_succeeded} fixes` },
                { dot: "bg-white/30", title: "Watcher Agent Activated", time: "2 min ago", desc: "Started code analysis with Semgrep + GPT-5.6" },
                { dot: "bg-white/30", title: "Codex Fixer Applied", time: "3 min ago", desc: `Generated fixes for ${latestRun.fixes_attempted} detected issues` },
              ].map((item, i) => (
                <div key={item.title} className="flex items-start gap-4 rounded-lg bg-white/[0.03] p-3">
                  <div className={`mt-2 h-2 w-2 rounded-full ${item.dot}`} />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-sans text-sm font-medium text-[#fafafa]">{item.title}</span>
                      <span className="font-mono text-xs text-[#a3a3a3]/50">{item.time}</span>
                    </div>
                    <p className="font-sans text-sm font-light text-[#a3a3a3]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUICK ACTIONS */}
        {latestRun && (
          <div className="glass-panel mb-8 rounded-[24px] p-6">
            <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-medium text-[#fafafa]">
              <Code className="h-5 w-5 text-brand-gold" /> Quick Actions
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: Terminal, title: "View Logs", desc: "Check detailed execution logs" },
                { icon: RefreshCw, title: "Re-run Failed", desc: "Retry unsuccessful fixes" },
                { icon: Copy, title: "Paste Code", desc: "Submit code snippets for analysis", onClick: () => { setShowPaste(true); setShowUpload(false); } },
              ].map((action) => (
                <button key={action.title} onClick={action.onClick} className="group relative w-full overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/40 hover:bg-white/[0.05] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]">
                  <action.icon className="relative mb-3 h-6 w-6 text-brand-gold transition-transform duration-300 group-hover:scale-110" />
                  <h4 className="relative mb-1 font-sans font-medium text-[#fafafa]">{action.title}</h4>
                  <p className="relative font-sans text-xs font-light text-[#a3a3a3]">{action.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
