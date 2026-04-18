import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Mail, ShieldCheck } from "lucide-react";
import { defaultCredentials, getRole, login } from "../lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: defaultCredentials.email,
    password: defaultCredentials.password,
    role: getRole(),
  });
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const valid = login(form.email, form.password, form.role);

    if (!valid) {
      setError("Use o e-mail demo@enteros.ai e a senha 123.");
      return;
    }

    navigate("/advogado/dashboard");
  }

  return (
    <div className="page-shell relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="absolute left-6 top-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2 text-sm text-slate-300 backdrop-blur-xl transition duration-200 hover:bg-white/[0.08] hover:text-slate-100"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
      </div>

      <section className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl animate-slide-fade lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden flex-col justify-between border-r border-white/[0.07] bg-black/40 p-10 lg:flex">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-slate-300">
              <ShieldCheck size={12} />
              Enter OS Access
            </div>
            <h1 className="mt-8 font-display text-4xl leading-tight text-white">
              Acesse o fluxo juridico da plataforma.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
              Entre com suas credenciais para revisar casos, validar a recomendacao
              do agente e seguir para o workflow completo.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Default access
            </p>
            <div className="mt-4 space-y-2.5 text-sm text-slate-300">
              <p>
                E-mail: <span className="font-semibold text-white">demo@enteros.ai</span>
              </p>
              <p>
                Senha: <span className="font-semibold text-white">123</span>
              </p>
              <p className="text-xs text-slate-400">Use esse login para acessar a area protegida da ferramenta.</p>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mx-auto max-w-md">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-400">
              Login
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              Acessar Enter OS
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Entre com e-mail e senha para continuar para o workflow da plataforma.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-300">
                  E-mail
                </span>
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.05] px-4 py-3 transition duration-200 focus-within:border-white/20 focus-within:bg-white/[0.07]">
                  <Mail size={15} className="shrink-0 text-slate-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="demo@enteros.ai"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-300">
                  Senha
                </span>
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.05] px-4 py-3 transition duration-200 focus-within:border-white/20 focus-within:bg-white/[0.07]">
                  <Lock size={15} className="shrink-0 text-slate-400" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="123"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              {error ? (
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition duration-200 hover:bg-slate-100 active:bg-slate-200"
              >
                Entrar
              </button>
            </form>

            <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className="text-xs font-medium text-slate-300">Demo role</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["advogado", "Advogado"],
                  ["adm", "Administrador"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        role: value,
                      }))
                    }
                    className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition duration-200 ${
                      form.role === value
                        ? "border-white/20 bg-white/[0.10] text-white"
                        : "border-white/[0.06] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Login demo: <span className="text-slate-300">demo@enteros.ai / 123</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
