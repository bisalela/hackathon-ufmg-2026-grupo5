import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <main className="page-shell flex min-h-screen items-center justify-center overflow-hidden bg-black px-6">
      <div className="landing-minimal-glow pointer-events-none absolute inset-0" />
      <div className="landing-minimal-vignette pointer-events-none absolute inset-0" />
      <section className="landing-minimal-stage relative flex w-full max-w-4xl flex-col items-center justify-center text-center">
        <div className="landing-minimal-wordmark-wrap">
          <h1 className="landing-minimal-wordmark font-display text-6xl tracking-[0.24em] text-white sm:text-7xl md:text-8xl">
            <span>Enter</span>{" "}
            <span className="uppercase">OS</span>
          </h1>
        </div>
        <div className="landing-minimal-divider mt-7" />
        <p className="landing-minimal-subtitle mt-7 max-w-xl text-sm uppercase tracking-[0.28em] text-white/38 sm:text-[0.8rem]">
          Plataforma de decisao juridica assistida por IA
        </p>
        <div className="landing-minimal-cta-wrap mt-10">
          <Link
            to="/advogado"
            className="landing-minimal-cta inline-flex items-center gap-3 rounded-full border border-white/14 bg-white px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-black transition duration-300 hover:scale-[1.02] hover:bg-neutral-100"
          >
            Acessar Ferramenta
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
