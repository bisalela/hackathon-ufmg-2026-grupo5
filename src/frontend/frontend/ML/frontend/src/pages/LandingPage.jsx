import {
  ArrowRight,
  BarChart3,
  Briefcase,
  FileText,
  Flame,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

const highlights = [
  {
    icon: Briefcase,
    title: "Case Decision Flow",
    text: "Centralize folders, client context, and legal recommendation flow in one controlled environment.",
  },
  {
    icon: FileText,
    title: "Structured Extraction",
    text: "Turn uploaded PDFs and case files into visual fields, risk indicators, and lawyer-ready summaries.",
  },
  {
    icon: BarChart3,
    title: "Acordo vs Defesa",
    text: "Combine historical process data and AI reasoning to support consistent litigation strategy.",
  },
];

export default function LandingPage() {
  return (
    <div className="page-shell landing-shell relative overflow-hidden">
      <div className="landing-backdrop pointer-events-none absolute inset-0" />
      <div className="landing-grid pointer-events-none absolute inset-0" />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-16 pt-8 lg:px-10">
        <header className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3.5 backdrop-blur-xl animate-slide-fade">
          <div className="flex items-center gap-3">
            <span className="font-display text-xl tracking-tight text-white">EnterOS</span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              Legal AI
            </span>
          </div>

          <Link
            to="/advogado"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-200 transition duration-200 hover:bg-white/[0.10] hover:text-white"
          >
            Advogado Login
            <ArrowRight size={14} />
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="space-y-10 animate-slide-fade">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-slate-300">
              <Sparkles size={12} className="text-amber" />
              AI analysis for agreement and defense decisions
            </div>

            <div className="space-y-5">
              <h1 className="max-w-2xl font-display text-5xl leading-[1.12] text-white md:text-6xl">
                EnterOS organizes legal folders, reads the process, and delivers
                a clearer decision path.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-300">
                Upload process documents, extract structured signals, estimate litigation risk, and present a
                recommendation of <span className="text-slate-200">acordo</span> or{" "}
                <span className="text-slate-200">defesa</span> with a professional review interface.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/advogado"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition duration-200 hover:bg-slate-100"
              >
                Enter Advogado Area
                <ArrowRight size={15} />
              </Link>
              <div className="inline-flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm text-slate-300 backdrop-blur-xl">
                <ShieldCheck size={14} className="text-slate-300" />
                Demo login enabled
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {highlights.map(({ icon: Icon, title, text }, index) => (
                <article
                  key={title}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition duration-200 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.05]"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="mb-4 inline-flex rounded-xl border border-white/[0.07] bg-white/[0.06] p-2.5 text-slate-300">
                    <Icon size={16} />
                  </div>
                  <h2 className="text-sm font-semibold text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-px animate-float backdrop-blur-xl">
            <div className="rounded-2xl border border-white/[0.05] bg-black/60 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Case Snapshot
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    EnterOS Dashboard Preview
                  </h3>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-300">
                  82% risk
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Folders analyzed", "128"],
                  ["Suggested agreement", "R$ 5.040"],
                  ["Defense confidence", "32%"],
                  ["Status", "Awaiting review"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                  >
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Agent Suggestion</p>
                    <p className="mt-1.5 text-sm font-medium text-white">
                      Recommendation: acordo with capped negotiation range
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.06] text-amber">
                    <Flame size={16} />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
