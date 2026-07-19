"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, ChevronDown, Eye, Wrench, ShieldCheck,
  Bug, CheckCircle2, Clock, Play, Menu, X, Activity
} from "lucide-react";

const STAGES = [
  {
    name: "Watcher", verb: "Detects", icon: Eye,
    copy: "Scans every file with Semgrep static analysis and GPT-5.6 semantic review, ranked by severity and confidence."
  },
  {
    name: "Codex Fixer", verb: "Patches", icon: Wrench,
    copy: "Writes the fix inside an isolated, network-disabled Docker sandbox, then validates the diff before it touches your repo."
  },
  {
    name: "Reviewer", verb: "Verifies", icon: ShieldCheck,
    copy: "Re-runs your test suite against the patch and writes a plain-English explanation of what changed."
  },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.15,0.83,0.66,1)] ${scrolled ? "bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl border-b border-[rgba(255,255,255,0.08)]" : "border-b border-transparent"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full bg-brand-gold" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-gold" />
          </span>
          <span className="font-sans text-[15px] font-medium uppercase tracking-tight text-[#fafafa]">
            AutoFix<span className="text-brand-gold">Swarm</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-9 md:flex">
          <a href="#pipeline" className="font-sans text-[13px] uppercase tracking-[0.08em] text-[#a3a3a3] transition-colors duration-300 hover:text-brand-gold">Pipeline</a>
          <Link href="/dashboard" className="font-sans text-[13px] uppercase tracking-[0.08em] text-[#a3a3a3] transition-colors duration-300 hover:text-brand-gold">Dashboard</Link>
          <a href="https://github.com/builtbyrehan/autofix-swarm" target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.08)] px-4 py-1.5 font-sans text-[13px] font-medium uppercase tracking-wide text-[#fafafa] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-gold hover:text-brand-gold">
            GitHub <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </nav>
        <button type="button" onClick={() => setOpen(v => !v)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] text-[#fafafa] transition-colors duration-300 hover:border-brand-gold md:hidden">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <div className={`fixed inset-0 z-0 flex flex-col items-center justify-center gap-8 bg-[#050505]/98 backdrop-blur-md transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <a href="#pipeline" onClick={() => setOpen(false)} className="font-sans text-2xl font-medium uppercase tracking-tight text-[#fafafa] transition-all hover:text-brand-gold">Pipeline</a>
        <Link href="/dashboard" onClick={() => setOpen(false)} className="font-sans text-2xl font-medium uppercase tracking-tight text-[#fafafa] transition-all hover:text-brand-gold">Dashboard</Link>
        <a href="https://github.com/builtbyrehan/autofix-swarm" target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="rounded-full bg-brand-gold px-6 py-2.5 font-sans text-sm font-medium uppercase tracking-wide text-[#050505]">View on GitHub</a>
      </div>
    </header>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`${className} transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <main className="noise-overlay min-h-screen bg-[#050505]">
      <Nav />

      {/* HERO */}
      <section className="relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#050505]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -right-20 top-[15%] h-[400px] w-[400px] rounded-full opacity-[0.12]" style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)", animation: "orb-drift-1 18s ease-in-out infinite", filter: "blur(60px)" }} />
          <div className="absolute -left-10 top-[40%] h-[350px] w-[350px] rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, #d97706 0%, transparent 70%)", animation: "orb-drift-2 22s ease-in-out infinite", filter: "blur(50px)" }} />
          <div className="absolute bottom-[10%] right-[15%] h-[250px] w-[250px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)", animation: "orb-drift-3 25s ease-in-out infinite", filter: "blur(45px)" }} />
        </div>
        <svg className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[1100px] -translate-x-1/2" viewBox="0 0 1100 560" fill="none" aria-hidden="true">
          <ellipse cx="550" cy="120" rx="420" ry="160" fill="url(#heroGlow)" filter="url(#heroBlur)" />
          <defs>
            <radialGradient id="heroGlow"><stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" /><stop offset="100%" stopColor="#fbbf24" stopOpacity="0" /></radialGradient>
            <filter id="heroBlur"><feGaussianBlur stdDeviation="25" /></filter>
          </defs>
        </svg>
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pb-20 pt-32 sm:px-8">
          <div className="liquid-glass relative mb-8 inline-flex w-fit animate-scale-in items-center gap-3 overflow-hidden rounded-full py-2.5 pl-3 pr-5" style={{ animationDelay: "150ms" }}>
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-flow bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full bg-brand-gold" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand-gold" /></span>
            <span className="relative font-sans text-[11px] font-medium uppercase tracking-[0.15em] text-brand-gold">Live</span>
            <span className="relative h-3 w-px shrink-0 bg-white/15" />
            <span className="relative font-sans text-[13px] font-light leading-snug text-[#a3a3a3]">Verified by <span className="text-brand-gold">Reviewer</span></span>
          </div>
          <p className="animate-rise-in font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-brand-gold" style={{ animationDelay: "250ms" }}>No Human In The Loop</p>
          <h1 className="animate-rise-in mt-3 max-w-4xl font-sans text-[40px] font-medium uppercase leading-[0.98] tracking-tight text-[#fafafa] sm:text-[56px] lg:text-[72px]" style={{ animationDelay: "350ms" }}>
            Find it. Fix it. Prove it<span className="text-brand-gold">.</span>
          </h1>
          <p className="animate-rise-in mt-6 max-w-[512px] font-sans text-[14px] font-light leading-relaxed text-[#a3a3a3]" style={{ animationDelay: "450ms" }}>
            Three autonomous agents scan your repo, patch what&apos;s broken inside a network-disabled sandbox, and run your real test suite to prove the fix holds.
          </p>
          <div className="animate-rise-in mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "550ms" }}>
            <Link href="/dashboard" className="group inline-flex items-center gap-2 rounded-full bg-brand-gold px-6 py-3 font-sans text-[13px] font-medium uppercase tracking-wide text-[#050505] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] hover:shadow-[0_0_28px_-6px_rgba(251,191,36,0.4)]">
              See It Run <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <a href="#pipeline" className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-6 py-3 font-sans text-[13px] font-medium uppercase tracking-wide text-[#fafafa] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-brand-gold hover:text-brand-gold">
              How It Works
            </a>
          </div>
        </div>
        <a href="#pipeline" aria-label="Scroll to pipeline section" className="animate-rise-in relative z-10 mb-8 hidden self-center text-white/30 transition-colors hover:text-brand-gold sm:block" style={{ animationDelay: "700ms" }}>
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </a>
      </section>

      {/* PIPELINE */}
      <section id="pipeline" className="relative bg-[#050505] px-6 py-28 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-brand-gold">The Pipeline</p>
          <h2 className="mt-3 max-w-2xl font-sans text-3xl font-medium uppercase tracking-tight text-[#fafafa] sm:text-4xl">One handoff, three agents, zero waiting.</h2>
          <div className="relative mt-16 hidden md:block">
            <div className="absolute left-0 right-0 top-9 h-px bg-white/10">
              <div className="relative h-full w-full overflow-hidden">
                <div className="absolute h-full w-24 animate-flow bg-gradient-to-r from-transparent via-brand-gold to-transparent" />
              </div>
            </div>
            <div className="relative grid grid-cols-3 gap-8">
              {STAGES.map((stage) => <StageNode key={stage.name} stage={stage} />)}
            </div>
          </div>
          <div className="mt-12 grid gap-8 md:hidden">
            {STAGES.map((stage) => <StageNode key={stage.name} stage={stage} />)}
          </div>
        </div>
      </section>

      {/* DIFF SHOWCASE */}
      <section className="relative bg-gradient-to-b from-[rgba(255,255,255,0.02)] to-transparent px-6 py-28 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.85fr_1fr] lg:items-center">
          <Reveal>
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-brand-gold">One real run</p>
            <h2 className="mt-3 font-sans text-3xl font-medium uppercase tracking-tight text-[#fafafa] sm:text-4xl">Not a mock. An actual fix.</h2>
            <p className="mt-5 max-w-md font-sans text-sm font-light leading-relaxed text-[#a3a3a3]">
              This is one of the bugs seeded into AutoFix Swarm&apos;s own eval suite — a shipping threshold that quietly excluded the exact order total it was supposed to reward.
            </p>
            <dl className="mt-8 space-y-4 border-t border-[rgba(255,255,255,0.08)] pt-6">
              <div>
                <dt className="font-sans text-[11px] font-medium uppercase tracking-widest text-[#a3a3a3]">Watcher</dt>
                <dd className="mt-1 font-sans text-sm font-light text-[#fafafa]/70">Flagged the comparison at <span className="font-mono text-brand-gold">92% confidence</span> — the docstring promises &ldquo;at or above,&rdquo; the code only checked &ldquo;above.&rdquo;</dd>
              </div>
              <div>
                <dt className="font-sans text-[11px] font-medium uppercase tracking-widest text-[#a3a3a3]">Codex Fixer</dt>
                <dd className="mt-1 font-sans text-sm font-light text-[#fafafa]/70">Changed one operator inside a sandboxed clone of the repo. No network access, no other files touched.</dd>
              </div>
              <div>
                <dt className="font-sans text-[11px] font-medium uppercase tracking-widest text-[#a3a3a3]">Reviewer</dt>
                <dd className="mt-1 font-sans text-sm font-light text-[#fafafa]/70">Reran the shipping test suite against the patch — <span className="text-brand-gold">tests passed</span>.</dd>
              </div>
            </dl>
          </Reveal>
          <Reveal delay={150}>
            <div className="overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[#050505] shadow-2xl shadow-black/40 transition-all duration-500 hover:border-brand-gold/20 hover:shadow-[0_16px_48px_-12px_rgba(251,191,36,0.08)]">
              <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-brand-gold/70" />
                <span className="ml-3 font-mono text-xs text-[#a3a3a3]">src/autofix_seed/shipping.py</span>
                <span className="ml-auto rounded bg-brand-gold-wash px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-gold">fixed</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
                <code>
                  <span className="block text-[#a3a3a3]">{"  4  def shipping_cost(subtotal: float, free_shipping_threshold: float = 50.0) -> float:"}</span>
                  <span className="block text-[#a3a3a3]">{'  5      """Return zero at or above the free-shipping threshold."""'}</span>
                  <span className="diff-removed block px-2 text-error">{"- 6      if subtotal > free_shipping_threshold:"}</span>
                  <span className="diff-added block px-2 text-success">{"+ 6      if subtotal >= free_shipping_threshold:"}</span>
                  <span className="block text-[#a3a3a3]">{"  7          return 0.0"}</span>
                  <span className="block text-[#a3a3a3]">{"  8      return 8.99"}</span>
                </code>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[rgba(255,255,255,0.02)] to-transparent px-6 py-28 sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.3), transparent)" }} />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)", filter: "blur(60px)" }} />
        <Reveal className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-brand-gold">Try it live</p>
          <h2 className="mt-3 font-sans text-3xl font-medium uppercase tracking-tight text-[#fafafa] sm:text-4xl">Watch the swarm work on real code<span className="text-brand-gold">.</span></h2>
          <p className="mx-auto mt-5 max-w-lg font-sans text-sm font-light leading-relaxed text-[#a3a3a3]">Every run on the dashboard is a real Watcher → Codex Fixer → Reviewer pass, logged end to end.</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link href="/dashboard" className="group inline-flex items-center gap-2 rounded-full bg-brand-gold px-6 py-3 font-sans text-[13px] font-medium uppercase tracking-wide text-[#050505] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_28px_-6px_rgba(251,191,36,0.4)]">
              Open Dashboard <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <a href="https://github.com/builtbyrehan/autofix-swarm" target="_blank" rel="noreferrer" className="rounded-full border border-[rgba(255,255,255,0.08)] px-6 py-3 font-sans text-[13px] font-medium uppercase tracking-wide text-[#fafafa] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-gold hover:text-brand-gold">
              Read the Code
            </a>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[rgba(255,255,255,0.08)] bg-[#050505] px-6 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-sans text-xs font-light text-[#a3a3a3]">AutoFix Swarm — built for the OpenAI Build Week hackathon.</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/builtbyrehan/autofix-swarm" target="_blank" rel="noreferrer" className="font-sans text-xs text-[#a3a3a3] transition-colors hover:text-brand-gold">GitHub</a>
            <Link href="/dashboard" className="font-sans text-xs text-[#a3a3a3] transition-colors hover:text-brand-gold">Dashboard</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function StageNode({ stage }: { stage: typeof STAGES[number] }) {
  const Icon = stage.icon;
  return (
    <div className="group relative rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.01)] p-6 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-brand-gold/30 hover:shadow-[0_8px_32px_-8px_rgba(251,191,36,0.1)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[24px] bg-gradient-to-r from-transparent via-brand-gold/0 to-transparent transition-all duration-500 group-hover:via-brand-gold/30" />
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold-wash transition-all duration-500 group-hover:border-brand-gold/50 group-hover:bg-[rgba(251,191,36,0.15)] group-hover:shadow-[0_0_20px_-4px_rgba(251,191,36,0.2)]">
        <Icon className="h-7 w-7 text-brand-gold" strokeWidth={1.75} />
      </div>
      <p className="mt-6 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-[#a3a3a3]">{stage.verb}</p>
      <h3 className="mt-1 font-sans text-xl font-medium text-[#fafafa]">{stage.name}</h3>
      <p className="mt-3 font-sans text-sm font-light leading-relaxed text-[#a3a3a3]">{stage.copy}</p>
    </div>
  );
}