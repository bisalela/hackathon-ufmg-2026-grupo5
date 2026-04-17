import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FileUp,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
  UploadCloud,
  UserCog,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getRole, logout, setRole } from "../lib/auth";
import { uploadProcessDocuments } from "../lib/documents";
import { supabase, supabaseConfigError } from "../lib/supabase";

const sections = [
  { id: "cases", label: "My Cases", icon: LayoutDashboard },
  { id: "upload", label: "Upload", icon: FileUp },
  { id: "analytics", label: "AI Analytics", icon: Sparkles },
];

const stageLabels = {
  nascimento: "Nascimento",
  triagem_ia: "Triagem IA",
  analise_advogado: "Analise Advogado",
  aguardando_sentenca: "Aguardando Sentenca",
  julgado: "Julgado",
};

const stageOrder = [
  "nascimento",
  "triagem_ia",
  "analise_advogado",
  "aguardando_sentenca",
  "julgado",
];

const fallbackCases = [
  {
    id: "CIV-2026-014",
    nome_pasta: "Caso Maria das Gracas",
    status: "analise_advogado",
    cliente_nome: "BANCO UFMG",
    cliente_id: "",
    valor_causa: 20000,
    valor_decisao_juiz: 5040,
    economia_gerada: 14960,
    probabilidade_exito: 78,
    sugestao_estrategia: "Acordo",
    argumentos: [
      "A prova de autenticacao possui pontos de fragilidade para defesa integral.",
      "O historico semelhante indica maior retorno financeiro com acordo controlado.",
      "A recomendacao deve ser validada pelo advogado antes do PDF final.",
    ],
    data_criacao: new Date().toISOString(),
  },
];

function Panel({ children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-white/[0.07] bg-white/[0.03] ${className}`}>
      {children}
    </section>
  );
}

function cleanFolderName(value) {
  if (!value) return "Pasta sem nome";
  return String(value).replace(/^"+|"+$/g, "");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function prettifyStatus(status) {
  return stageLabels[status] || "Em processamento";
}

function parseProbability(value) {
  if (typeof value === "number") return value;
  if (!value) return 78;
  const numeric = Number.parseFloat(String(value).replace("%", "").trim());
  return Number.isFinite(numeric) ? numeric : 78;
}

function buildEnrichedProcesses(processos, clientes, analises) {
  const clientsById = new Map(clientes.map((cliente) => [cliente.id, cliente]));
  const analysesByProcessId = new Map();

  analises.forEach((analise) => {
    if (!analysesByProcessId.has(analise.processo_id)) {
      analysesByProcessId.set(analise.processo_id, analise);
    }
  });

  return processos.map((processo) => {
    const analysis = analysesByProcessId.get(processo.id);
    const result = analysis?.resultado_agentes ?? {};

    return {
      ...processo,
      nome_pasta: cleanFolderName(processo.nome_pasta),
      cliente_nome:
        clientsById.get(processo.cliente_id)?.nome ?? "Cliente nao identificado",
      probabilidade_exito: parseProbability(result.probabilidade_exito),
      sugestao_estrategia: result.sugestao_estrategia ?? "Em analise",
      argumentos: Array.isArray(result.argumentos_latex)
        ? result.argumentos_latex
        : [
            "A analise consolidada do agent ainda nao retornou argumentos detalhados.",
          ],
      data_analise: analysis?.data_analise ?? null,
    };
  });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("analytics");
  const [dragging, setDragging] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [currentRole, setCurrentRole] = useState(getRole());
  const [lawyerComment, setLawyerComment] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [dashboardState, setDashboardState] = useState({
    processos: [],
    clientes: [],
    perfis: [],
    loading: true,
    error: "",
  });
  const [adminForm, setAdminForm] = useState({
    nomePasta: "",
    clienteId: "",
    advogadoId: "",
    valorCausa: "20000",
    valorDecisao: "5000",
    tipoDocumento: "peticao_inicial",
  });

  async function loadDashboard() {
    if (!supabase) {
      setDashboardState({
        processos: fallbackCases,
        clientes: [],
        perfis: [],
        loading: false,
        error: supabaseConfigError || "Supabase client unavailable.",
      });
      return;
    }

    try {
      const [processosRes, clientesRes, analisesRes, perfisRes] = await Promise.all([
        supabase.from("processos").select("*").order("data_criacao", {
          ascending: false,
        }),
        supabase.from("clientes").select("*"),
        supabase
          .from("analises_agentes")
          .select("*")
          .order("data_analise", { ascending: false }),
        supabase.from("perfis").select("*").order("created_at", { ascending: true }),
      ]);

      const error =
        processosRes.error ||
        clientesRes.error ||
        analisesRes.error ||
        perfisRes.error ||
        null;

      if (error) {
        setDashboardState({
          processos: fallbackCases,
          clientes: [],
          perfis: [],
          loading: false,
          error: error.message,
        });
        return;
      }

      const enrichedProcesses = buildEnrichedProcesses(
        processosRes.data ?? [],
        clientesRes.data ?? [],
        analisesRes.data ?? [],
      );
      const perfis = perfisRes.data ?? [];
      const clientes = clientesRes.data ?? [];
      const firstAdvogado =
        perfis.find((perfil) => perfil.tipo_usuario === "advogado")?.id || "";

      setDashboardState({
        processos: enrichedProcesses.length > 0 ? enrichedProcesses : fallbackCases,
        clientes,
        perfis,
        loading: false,
        error: "",
      });

      setAdminForm((current) => ({
        ...current,
        clienteId: current.clienteId || clientes[0]?.id || "",
        advogadoId: current.advogadoId || firstAdvogado,
      }));
    } catch (error) {
      setDashboardState({
        processos: fallbackCases,
        clientes: [],
        perfis: [],
        loading: false,
        error:
          error instanceof Error ? error.message : "Unexpected dashboard error.",
      });
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const activeMeta = sections.find((section) => section.id === activeSection);
  const liveProcesses = dashboardState.processos;
  const clientes = dashboardState.clientes;
  const perfis = dashboardState.perfis;
  const adminProfile = perfis.find((perfil) => perfil.tipo_usuario === "adm");
  const lawyerProfiles = perfis.filter(
    (perfil) => perfil.tipo_usuario === "advogado",
  );
  const currentCase = liveProcesses[0] ?? fallbackCases[0];
  const currentArguments = Array.isArray(currentCase.argumentos)
    ? currentCase.argumentos
    : [];
  const gaugeValue = currentCase.probabilidade_exito ?? 78;
  const gaugeData = [{ name: "success", value: gaugeValue, fill: "#d4a853" }];
  const workflowIndex = stageOrder.indexOf(currentCase.status);
  const workflowSteps = stageOrder.map((stage, index) => ({
    key: stage,
    label: stageLabels[stage],
    state:
      workflowIndex === -1
        ? "pending"
        : index < workflowIndex
          ? "done"
          : index === workflowIndex
            ? "current"
            : "pending",
  }));

  const financialChartData = [
    {
      label: "Valor da causa",
      value: Number(currentCase.valor_causa) || 0,
      fill: "#6b7280",
    },
    {
      label: "Decisao / acordo",
      value: Number(currentCase.valor_decisao_juiz) || 0,
      fill: "#d4a853",
    },
    {
      label: "Economia gerada",
      value: Number(currentCase.economia_gerada) || 0,
      fill: "#4b5563",
    },
  ];

  const recommendationSignals = [
    {
      label: "Cliente",
      value: currentCase.cliente_nome,
    },
    {
      label: "Faixa sugerida de acordo",
      value: `${formatCurrency(
        (Number(currentCase.valor_decisao_juiz) || 5040) * 0.75,
      )} - ${formatCurrency((Number(currentCase.valor_decisao_juiz) || 5040) * 1.25)}`,
    },
    {
      label: "Probabilidade de exito do banco",
      value: `${gaugeValue}%`,
    },
    {
      label: "Valor teto recomendado",
      value: formatCurrency(currentCase.valor_decisao_juiz || 5040),
    },
  ];

  const topSummaryCards = [
    {
      icon: Clock3,
      label: "Ultima analise",
      value: formatDate(currentCase.data_analise || currentCase.data_criacao),
    },
    {
      icon: TrendingUp,
      label: "Confianca da policy",
      value: `${gaugeValue}%`,
    },
    {
      icon: FolderKanban,
      label: "Status atual",
      value: prettifyStatus(currentCase.status),
    },
  ];

  function clearMessages() {
    setActionMessage("");
    setActionError("");
  }

  function queueFiles(fileList) {
    const accepted = Array.from(fileList).filter((file) =>
      [".pdf", ".csv"].some((extension) =>
        file.name.toLowerCase().endsWith(extension),
      ),
    );
    setQueuedFiles((current) => [...accepted, ...current].slice(0, 10));
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    queueFiles(event.dataTransfer.files);
  }

  async function handleCreateProcess(event) {
    event.preventDefault();
    clearMessages();

    if (!supabase) {
      setActionError("Supabase client unavailable.");
      return;
    }

    if (!adminForm.nomePasta || !adminForm.clienteId || !adminForm.advogadoId) {
      setActionError("Preencha pasta, cliente e advogado.");
      return;
    }

    setIsSaving(true);

    try {
      const { data: processRows, error: processError } = await supabase
        .from("processos")
        .insert({
          cliente_id: adminForm.clienteId,
          adm_id: adminProfile?.id ?? null,
          advogado_id: adminForm.advogadoId,
          nome_pasta: `"${adminForm.nomePasta}"`,
          status: "nascimento",
          valor_causa: Number(adminForm.valorCausa) || 0,
          valor_decisao_juiz: Number(adminForm.valorDecisao) || 0,
        })
        .select("*")
        .limit(1);

      if (processError) {
        throw processError;
      }

      const createdProcess = processRows?.[0];

      if (!createdProcess?.id) {
        throw new Error("Processo criado sem identificador retornado.");
      }

      if (queuedFiles.length > 0) {
        await uploadProcessDocuments({
          processoId: createdProcess.id,
          files: queuedFiles,
          tipoDocumento: adminForm.tipoDocumento,
          supabase,
        });
      }

      setActionMessage("Processo criado e documentos enviados ao Supabase.");
      setQueuedFiles([]);
      setAdminForm((current) => ({
        ...current,
        nomePasta: "",
      }));
      await loadDashboard();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Erro ao criar processo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLawyerDecision(approved) {
    clearMessages();

    if (!supabase) {
      setActionError("Supabase client unavailable.");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("processos")
        .update({
          sugestao_aprovada: approved,
          comentario_advogado: lawyerComment || null,
          status: "aguardando_sentenca",
        })
        .eq("id", currentCase.id);

      if (error) {
        throw error;
      }

      setActionMessage(
        approved
          ? "Sugestao aprovada e salva em Supabase."
          : "Sugestao reprovada e salva em Supabase.",
      );
      await loadDashboard();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Erro ao salvar decisao do advogado.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleRoleChange(role) {
    setCurrentRole(role);
    setRole(role);
  }

  function handleLogout() {
    logout();
    navigate("/advogado");
  }

  return (
    <div className="page-shell min-h-screen bg-black px-4 py-4 md:px-5 md:py-5">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl gap-4 lg:grid-cols-[270px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 animate-slide-fade">
          {/* Logo */}
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/50 px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.06] text-slate-300">
              <Scale size={15} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">EnterOS</p>
              <p className="text-xs text-slate-400">Advogado Workspace</p>
            </div>
          </div>

          {/* Role switcher */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs text-slate-400">
              <UserCog size={12} />
              Demo role
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["advogado", "Advogado"],
                ["adm", "Admin"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleRoleChange(value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition duration-200 ${
                    currentRole === value
                      ? "border-white/20 bg-white/[0.10] text-white"
                      : "border-white/[0.05] bg-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {sections.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition duration-200 ${
                    isActive
                      ? "border border-white/[0.10] bg-white/[0.08] text-white"
                      : "border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition duration-200 ${
                      isActive ? "bg-white/[0.10] text-white" : "bg-white/[0.04] text-slate-400"
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[10px] text-slate-500">
                      {id === "cases" && "Fila juridica"}
                      {id === "upload" &&
                        (currentRole === "adm"
                          ? "Criacao e upload"
                          : "Contexto das pastas")}
                      {id === "analytics" && "Recomendacao do agent"}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Agent signal */}
          <div className="mt-auto rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Agent signal
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-200">
              {currentCase.sugestao_estrategia === "Acordo"
                ? "Fluxo atual favorece acordo com aprovacao do advogado."
                : "Fluxo atual favorece defesa e monitoramento do processo."}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 transition duration-200 hover:bg-white/[0.08] hover:text-slate-200"
            >
              <LogOut size={12} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="space-y-4 overflow-hidden">
          {/* Header panel */}
          <Panel className="p-5 animate-slide-fade">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                  EnterOS Dashboard
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white">
                  {activeMeta?.label}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Live Supabase reads and writes for process intake, lawyer decision, and file metadata.
                </p>
                {dashboardState.loading ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Loading live Supabase data...
                  </p>
                ) : null}
                {dashboardState.error ? (
                  <p className="mt-2 text-xs text-slate-300">
                    Supabase read fallback active: {dashboardState.error}
                  </p>
                ) : null}
                {actionMessage ? (
                  <p className="mt-2 text-xs text-slate-300">{actionMessage}</p>
                ) : null}
                {actionError ? (
                  <p className="mt-2 text-xs text-red-400">{actionError}</p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {topSummaryCards.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400">
                        <Icon size={13} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-white">
                          {value}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* Cases section */}
          {activeSection === "cases" && (
            <Panel className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    Matter portfolio
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold text-white">
                    My Cases
                  </h2>
                </div>
                <div className="rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                  {liveProcesses.length} processos
                </div>
              </div>

              <div className="space-y-2">
                {liveProcesses.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition duration-200 hover:border-white/[0.12] hover:bg-white/[0.05]"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs text-slate-400">{item.cliente_nome}</p>
                        <h3 className="mt-1 text-base font-semibold text-white">
                          {item.nome_pasta}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Criado em: {formatDate(item.data_criacao)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Agent:{" "}
                          <span className="font-medium text-slate-200">
                            {item.sugestao_estrategia}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-2 text-right">
                        <div className="inline-block rounded-full border border-white/[0.07] bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-200">
                          {prettifyStatus(item.status)}
                        </div>
                        <p className="text-xs text-slate-500">
                          Valor:{" "}
                          <span className="font-medium text-slate-200">
                            {formatCurrency(item.valor_causa)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          )}

          {/* Upload section */}
          {activeSection === "upload" && (
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Panel className="p-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    {currentRole === "adm" ? "Admin Intake" : "Lawyer Intake"}
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold text-white">
                    {currentRole === "adm"
                      ? "Criar processo e enviar documentos"
                      : "Criar pasta ou anexar novos documentos"}
                  </h2>
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleCreateProcess}>
                  {currentRole === "advogado" ? (
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-xs leading-5 text-slate-300">
                      O advogado tambem pode subir documentos agora. O envio usa
                      o mesmo fluxo real do Supabase.
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs text-slate-400">
                        Nome da pasta
                      </span>
                      <input
                        type="text"
                        value={adminForm.nomePasta}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            nomePasta: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition duration-200 focus:border-white/20 focus:bg-white/[0.06]"
                        placeholder="Caso Maria das Gracas"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs text-slate-400">
                        Cliente
                      </span>
                      <select
                        value={adminForm.clienteId}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            clienteId: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition duration-200 focus:border-white/20"
                      >
                        <option value="">Selecione</option>
                        {clientes.map((cliente) => (
                          <option key={cliente.id} value={cliente.id}>
                            {cliente.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs text-slate-400">
                        Advogado responsavel
                      </span>
                      <select
                        value={adminForm.advogadoId}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            advogadoId: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition duration-200 focus:border-white/20"
                      >
                        <option value="">Selecione</option>
                        {lawyerProfiles.map((perfil) => (
                          <option key={perfil.id} value={perfil.id}>
                            {perfil.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs text-slate-400">
                        Valor da causa
                      </span>
                      <input
                        type="number"
                        value={adminForm.valorCausa}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            valorCausa: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition duration-200 focus:border-white/20"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs text-slate-400">
                        Valor decisao / acordo
                      </span>
                      <input
                        type="number"
                        value={adminForm.valorDecisao}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            valorDecisao: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition duration-200 focus:border-white/20"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-1.5 block text-xs text-slate-400">
                        Tipo do documento
                      </span>
                      <input
                        type="text"
                        value={adminForm.tipoDocumento}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            tipoDocumento: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition duration-200 focus:border-white/20"
                        placeholder="peticao_inicial"
                      />
                    </label>
                  </div>

                  <label
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition duration-200 ${
                      dragging
                        ? "border-white/30 bg-white/[0.06]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.csv"
                      multiple
                      className="hidden"
                      onChange={(event) => queueFiles(event.target.files)}
                    />
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.06] text-slate-400">
                      <UploadCloud size={20} />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-white">
                      Envie documentos para Storage
                    </h3>
                    <p className="mt-1.5 max-w-xs text-xs leading-5 text-slate-400">
                      PDF ou CSV. Cria processo em processos, envia ao bucket e registra em documentos.
                    </p>
                  </label>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition duration-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Salvando..." : "Criar processo e enviar"}
                  </button>
                </form>
              </Panel>

              <Panel className="p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                  Process context
                </p>
                <h2 className="mt-1.5 text-lg font-semibold text-white">
                  {currentRole === "adm" ? "Fila de upload" : "Upload e pastas"}
                </h2>

                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-xs text-slate-400">
                  <Search size={12} className="shrink-0" />
                  {currentRole === "adm"
                    ? "Arquivos prontos para envio ao bucket"
                    : "Arquivos selecionados e contexto das pastas"}
                </div>

                <div className="mt-4 space-y-2">
                  {(queuedFiles.length > 0
                    ? queuedFiles.map((file) => ({
                        id: file.name,
                        title: file.name,
                        meta: `${(file.size / 1000000).toFixed(2)} MB`,
                        badge: adminForm.tipoDocumento,
                      }))
                    : liveProcesses.map((processo) => ({
                        id: processo.id,
                        title: processo.nome_pasta,
                        meta: `${processo.cliente_nome} • ${formatDate(
                          processo.data_criacao,
                        )}`,
                        badge: prettifyStatus(processo.status),
                      }))
                  ).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>
                      </div>
                      <div className="ml-3 shrink-0 rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-300">
                        {item.badge}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {/* Analytics section */}
          {activeSection === "analytics" && (
            <>
              <Panel className="p-5">
                <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
                  <div>
                    <div className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-300">
                      Recomendacao: {currentCase.sugestao_estrategia}
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold leading-snug text-white">
                      {currentCase.sugestao_estrategia === "Acordo"
                        ? "Encaminhar para acordo com validacao do advogado."
                        : "Manter defesa e seguir com revisao estrategica."}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
                      Le o resultado dos agentes em Supabase e permite gravar a
                      aprovacao ou reprovacao diretamente no registro do processo.
                    </p>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {recommendationSignals.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
                        >
                          <p className="text-xs text-slate-500">{item.label}</p>
                          <p className="mt-1.5 text-sm font-semibold text-white">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Fundamentacao resumida
                      </p>
                      <div className="mt-3 space-y-2">
                        {currentArguments.map((point) => (
                          <div
                            key={point}
                            className="flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                          >
                            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                            <p className="text-xs leading-6 text-slate-300">
                              {point}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-white/[0.10] bg-white/[0.06] px-5 py-5">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                        Confianca do agent
                      </p>
                      <p className="mt-2 text-4xl font-bold text-white">{gaugeValue}%</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Processo: {currentCase.nome_pasta}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Resumo do caso atual
                      </p>
                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Cliente</span>
                          <span className="font-medium text-slate-200">
                            {currentCase.cliente_nome}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Status</span>
                          <span className="font-medium text-slate-200">
                            {prettifyStatus(currentCase.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Valor da causa</span>
                          <span className="font-medium text-slate-200">
                            {formatCurrency(currentCase.valor_causa)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Economia gerada</span>
                          <span className="font-medium text-slate-200">
                            {formatCurrency(currentCase.economia_gerada)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Comentario do advogado
                      </p>
                      <textarea
                        value={lawyerComment}
                        onChange={(event) => setLawyerComment(event.target.value)}
                        disabled={currentRole !== "advogado"}
                        className="mt-3 min-h-[100px] w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-xs text-white outline-none transition duration-200 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder={
                          currentRole === "advogado"
                            ? "Insira sua observacao para gravar em processos.comentario_advogado"
                            : "Troque para o papel Advogado para registrar a decisao."
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={currentRole !== "advogado" || isSaving}
                        onClick={() => handleLawyerDecision(true)}
                        className="flex-1 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition duration-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Aprovar recomendacao
                      </button>
                      <button
                        type="button"
                        disabled={currentRole !== "advogado" || isSaving}
                        onClick={() => handleLawyerDecision(false)}
                        className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 transition duration-200 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reprovar recomendacao
                      </button>
                    </div>
                  </div>
                </div>

                {/* Workflow steps */}
                <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Workflow atual do processo
                  </p>
                  <div className="mt-4 grid gap-2 md:grid-cols-5">
                    {workflowSteps.map((step) => (
                      <div
                        key={step.key}
                        className={`rounded-xl border px-3 py-3 text-center transition duration-200 ${
                          step.state === "done"
                            ? "border-white/[0.12] bg-white/[0.07]"
                            : step.state === "current"
                              ? "border-white/[0.15] bg-white/[0.09]"
                              : "border-white/[0.05] bg-white/[0.02]"
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
                          Etapa
                        </p>
                        <p className={`mt-1.5 text-xs font-semibold ${step.state === "pending" ? "text-slate-500" : "text-white"}`}>
                          {step.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                <Panel className="p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    Probability of Success
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold text-white">
                    Bank Success Rate
                  </h2>

                  <div className="mt-5 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        cx="50%"
                        cy="80%"
                        innerRadius="55%"
                        outerRadius="92%"
                        barSize={20}
                        startAngle={180}
                        endAngle={0}
                        data={gaugeData}
                      >
                        <RadialBar
                          background={{ fill: "rgba(255,255,255,0.05)" }}
                          clockWise
                          dataKey="value"
                          cornerRadius={12}
                        />
                        <text
                          x="50%"
                          y="70%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#ffffff"
                          fontSize="28"
                          fontWeight="600"
                        >
                          {gaugeValue}%
                        </text>
                        <text
                          x="50%"
                          y="83%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#b45309"
                          fontSize="11"
                        >
                          Chance of favorable outcome
                        </text>
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {[
                      ["Chance de acordo", `${Math.max(100 - gaugeValue, 15)}%`],
                      ["Exposicao estimada", formatCurrency(currentCase.valor_decisao_juiz)],
                      ["Risco processual", currentCase.sugestao_estrategia],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3"
                      >
                        <p className="text-[10px] text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="p-5">
                  <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                      Financial Outlook
                    </p>
                    <h2 className="mt-1.5 text-lg font-semibold text-white">
                      Cause, decision, and savings
                    </h2>
                  </div>

                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={financialChartData}
                        margin={{ top: 12, right: 12, bottom: 0, left: 8 }}
                      >
                        <XAxis
                          dataKey="label"
                          stroke="#b45309"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          stroke="#92400e"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <Legend
                          wrapperStyle={{ color: "#b45309", paddingTop: "12px", fontSize: "11px" }}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          formatter={(value) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: "rgba(9, 9, 11, 0.95)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "12px",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                        <Bar
                          name="Valor financeiro"
                          dataKey="value"
                          radius={[8, 8, 0, 0]}
                        >
                          {financialChartData.map((entry) => (
                            <Cell key={entry.label} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <Panel className="p-5">
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    Workflow Distribution
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold text-white">
                    Etapas do pipeline no dashboard
                  </h2>
                </div>

                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stageOrder.map((stage) => ({
                        stage: stageLabels[stage],
                        total: liveProcesses.filter((item) => item.status === stage)
                          .length,
                        confidence: stage === currentCase.status ? gaugeValue : 0,
                      }))}
                      layout="vertical"
                      margin={{ top: 12, right: 12, bottom: 0, left: 8 }}
                    >
                      <XAxis type="number" stroke="#92400e" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="stage"
                        stroke="#b45309"
                        axisLine={false}
                        tickLine={false}
                        width={130}
                        tick={{ fontSize: 11 }}
                      />
                      <Legend
                        wrapperStyle={{ color: "#b45309", paddingTop: "12px", fontSize: "11px" }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        contentStyle={{
                          backgroundColor: "rgba(9, 9, 11, 0.95)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Bar
                        name="Processos"
                        dataKey="total"
                        radius={[0, 8, 8, 0]}
                        fill="#f59e0b"
                      />
                      <Bar
                        name="Confianca da etapa atual"
                        dataKey="confidence"
                        radius={[0, 8, 8, 0]}
                        fill="rgba(255,255,255,0.18)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.05] text-slate-400">
                      <CheckCircle2 size={15} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Lawyer Actions
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-white">
                        Decisions now write back to processos
                      </h3>
                    </div>
                  </div>
                </Panel>

                <Panel className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.05] text-slate-400">
                      <XCircle size={15} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Supabase Sync
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-white">
                        Reads and writes connected to processos, clientes,
                        perfis, analises_agentes, and documentos
                      </h3>
                    </div>
                  </div>
                </Panel>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
