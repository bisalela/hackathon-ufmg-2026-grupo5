import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  FileUp,
  LayoutDashboard,
  LogOut,
  Scale,
  Sparkles,
  UserCog,
} from "lucide-react";
import { getRole, logout, setRole } from "../lib/auth";
import { uploadProcessDocuments } from "../lib/documents";
import { supabase, supabaseConfigError } from "../lib/supabase";

const sections = [
  { id: "cases", label: "Processos", icon: LayoutDashboard },
  { id: "upload", label: "Upload (ADM)", icon: FileUp },
  { id: "analytics", label: "Analise", icon: Sparkles },
];

const defaultAgentApiBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001/agent`
    : "http://localhost:3001/agent";

const agentApiBaseUrl = (
  import.meta.env.VITE_AGENT_API_URL || defaultAgentApiBaseUrl
).replace(/\/+$/, "");

function cleanFolderName(value) {
  if (!value) return "Pasta sem nome";
  return String(value).replace(/^\"+|\"+$/g, "");
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

function parseProbability(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const numeric = Number.parseFloat(String(value).replace("%", "").trim());
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
}

function normalizeFlag(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "sim") return "sim";
  if (normalized === "nao" || normalized === "não") return "não";
  return "incerto";
}

function toList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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
    const rawAnalysis = result.analise || null;
    const fatores = result.fatores_juridicos_relevantes || {};
    const analisePreditiva = result.analise_preditiva || {};
    const recomendacao = result.recomendacao_estrategica || {};
    const identificacao = result.identificacao || {};

    const exitoBanco = parseProbability(
      analisePreditiva.probabilidade_exito_banco ?? result.probabilidade_exito,
    );

    return {
      ...processo,
      nome_pasta: cleanFolderName(processo.nome_pasta),
      cliente_nome: clientsById.get(processo.cliente_id)?.nome ?? "Banco UFMG",
      probabilidade_exito: parseProbability(result.probabilidade_exito),
      sugestao_estrategia: result.sugestao_estrategia ?? "Sem analise",
      analise_texto: result.analise ?? "",
      argumentos: Array.isArray(result.argumentos_latex)
        ? result.argumentos_latex
        : rawAnalysis
          ? [rawAnalysis]
          : [],
      relatorio_pdf_url: result.relatorio_pdf_url ?? null,
      relatorio_tex_url: result.relatorio_tex_url ?? null,
      relatorio_pdf_disponivel: result.relatorio_pdf_disponivel ?? false,
      relatorio_pdf_erro: result.relatorio_pdf_erro ?? null,
      data_analise: analysis?.data_analise ?? null,
      identificacao: {
        numero_processo: identificacao.numero_processo || processo.id,
        uf: identificacao.uf || "incerto",
        comarca: identificacao.comarca || "incerta",
        valor_causa: Number.isFinite(Number(identificacao.valor_causa))
          ? Number(identificacao.valor_causa)
          : null,
      },
      resumo_fatos:
        result.resumo_fatos || rawAnalysis || "Resumo indisponível no momento.",
      alegacoes_autor: toList(result.alegacoes_autor),
      documentos_banco: toList(result.documentos_banco),
      pontos_favoraveis_banco: toList(result.pontos_favoraveis_banco),
      pontos_desfavoraveis_banco: toList(result.pontos_desfavoraveis_banco),
      observacoes_importantes:
        result.observacoes_importantes || "Sem observações adicionais.",
      fatores_juridicos_relevantes: {
        autor_idoso: normalizeFlag(fatores.autor_idoso),
        autor_aposentado: normalizeFlag(fatores.autor_aposentado),
        pedido_tutela_urgencia: normalizeFlag(fatores.pedido_tutela_urgencia),
        pedido_dano_moral: normalizeFlag(fatores.pedido_dano_moral),
        valor_dano_moral: Number.isFinite(Number(fatores.valor_dano_moral))
          ? Number(fatores.valor_dano_moral)
          : null,
        pedido_repeticao_indebito: normalizeFlag(fatores.pedido_repeticao_indebito),
        alegacao_vulnerabilidade: normalizeFlag(fatores.alegacao_vulnerabilidade),
        alegacao_uso_indevido_dados: normalizeFlag(fatores.alegacao_uso_indevido_dados),
      },
      analise_preditiva: {
        probabilidade_exito_banco: exitoBanco,
        probabilidade_nao_exito_banco: parseProbability(
          analisePreditiva.probabilidade_nao_exito_banco ?? 100 - exitoBanco,
        ),
        classificacao_preditiva:
          analisePreditiva.classificacao_preditiva || "Nao classificado",
        confianca_modelo: parseProbability(
          analisePreditiva.confianca_modelo ?? result.probabilidade_exito,
        ),
      },
      recomendacao_estrategica: {
        recomendacao: recomendacao.recomendacao || result.sugestao_estrategia || "Acordo",
        valor_sugerido: Number.isFinite(Number(recomendacao.valor_sugerido))
          ? Number(recomendacao.valor_sugerido)
          : Number(result.valor_sugerido_acordo) || 0,
        faixa_negociacao: {
          minimo: Number.isFinite(Number(recomendacao?.faixa_negociacao?.minimo))
            ? Number(recomendacao.faixa_negociacao.minimo)
            : 0,
          maximo: Number.isFinite(Number(recomendacao?.faixa_negociacao?.maximo))
            ? Number(recomendacao.faixa_negociacao.maximo)
            : 0,
        },
        justificativa_economica:
          recomendacao.justificativa_economica || "Sem justificativa econômica detalhada.",
      },
    };
  });
}

function hasJudgeDecision(item) {
  return Number(item?.valor_decisao_juiz) > 0;
}

function matchesStatusFilter(item, filter) {
  if (filter === "all") return true;
  if (filter === "waiting_judge") {
    return item.status === "aguardando_sentenca" || !hasJudgeDecision(item);
  }
  if (filter === "solved") {
    return item.status === "julgado" || hasJudgeDecision(item);
  }
  return true;
}

function matchesAnalysisFilter(item, filter) {
  if (filter === "all") return true;
  if (filter === "approved") return item.sugestao_aprovada === true;
  if (filter === "rejected") return item.sugestao_aprovada === false;
  if (filter === "pending") {
    return item.sugestao_aprovada !== true && item.sugestao_aprovada !== false;
  }
  return true;
}

function decisionBadge(item) {
  if (item.sugestao_aprovada === true) return "Aprovado";
  if (item.sugestao_aprovada === false) return "Reprovado";
  return "Aguardando análise";
}

function SectionCard({ children }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("cases");
  const [currentRole, setCurrentRole] = useState(getRole());
  const [dragging, setDragging] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [confirmRequiredDocs, setConfirmRequiredDocs] = useState(false);
  const [lawyerComment, setLawyerComment] = useState("");
  const [judgeDecisionValue, setJudgeDecisionValue] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [analysisFilter, setAnalysisFilter] = useState("all");

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
  });

  const clientes = dashboardState.clientes;
  const perfis = dashboardState.perfis;
  const liveProcesses = dashboardState.processos;

  const filteredProcesses = useMemo(
    () =>
      liveProcesses.filter(
        (item) =>
          matchesStatusFilter(item, statusFilter) &&
          matchesAnalysisFilter(item, analysisFilter),
      ),
    [liveProcesses, statusFilter, analysisFilter],
  );

  const currentCase = useMemo(() => {
    if (!selectedProcessId) return liveProcesses[0] ?? null;
    return liveProcesses.find((item) => item.id === selectedProcessId) ?? null;
  }, [liveProcesses, selectedProcessId]);

  const adminProfile = useMemo(
    () => perfis.find((perfil) => perfil.tipo_usuario === "adm"),
    [perfis],
  );

  const clientOptions = useMemo(() => {
    if (clientes.length > 0) {
      return [{ id: clientes[0].id, nome: "Banco UFMG" }];
    }
    return [{ id: "", nome: "Banco UFMG" }];
  }, [clientes]);

  const lawyerOptions = useMemo(() => {
    const lawyers = perfis.filter((perfil) => perfil.tipo_usuario === "advogado");

    if (lawyers.length >= 2) {
      return [
        { id: lawyers[0].id, nome: "Advogado 1" },
        { id: lawyers[1].id, nome: "Advogado 2" },
      ];
    }

    if (lawyers.length === 1) {
      return [
        { id: lawyers[0].id, nome: "Advogado 1" },
        { id: lawyers[0].id, nome: "Advogado 2" },
      ];
    }

    return [
      { id: "", nome: "Advogado 1" },
      { id: "", nome: "Advogado 2" },
    ];
  }, [perfis]);

  function clearMessages() {
    setActionMessage("");
    setActionError("");
  }

  function queueFiles(fileList) {
    const accepted = Array.from(fileList).filter((file) =>
      [".pdf", ".csv"].some((ext) => file.name.toLowerCase().endsWith(ext)),
    );
    setQueuedFiles((current) => [...accepted, ...current].slice(0, 20));
  }

  async function loadDashboard() {
    if (!supabase) {
      setDashboardState({
        processos: [],
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
          processos: [],
          clientes: [],
          perfis: [],
          loading: false,
          error: error.message,
        });
        return;
      }

      const processos = buildEnrichedProcesses(
        processosRes.data ?? [],
        clientesRes.data ?? [],
        analisesRes.data ?? [],
      );
      const loadedClientes = clientesRes.data ?? [];
      const loadedPerfis = perfisRes.data ?? [];

      setDashboardState({
        processos,
        clientes: loadedClientes,
        perfis: loadedPerfis,
        loading: false,
        error: "",
      });

      setAdminForm((current) => {
        const lawyerProfiles = loadedPerfis.filter(
          (perfil) => perfil.tipo_usuario === "advogado",
        );
        return {
          ...current,
          clienteId: current.clienteId || loadedClientes[0]?.id || "",
          advogadoId: current.advogadoId || lawyerProfiles[0]?.id || "",
        };
      });
    } catch (error) {
      setDashboardState({
        processos: [],
        clientes: [],
        perfis: [],
        loading: false,
        error: error instanceof Error ? error.message : "Unexpected dashboard error.",
      });
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!selectedProcessId && liveProcesses.length > 0) {
      setSelectedProcessId(liveProcesses[0].id);
    }

    if (
      selectedProcessId &&
      liveProcesses.length > 0 &&
      !liveProcesses.some((item) => item.id === selectedProcessId)
    ) {
      setSelectedProcessId(liveProcesses[0].id);
    }
  }, [liveProcesses, selectedProcessId]);

  useEffect(() => {
    setLawyerComment(currentCase?.comentario_advogado || "");
    setJudgeDecisionValue(
      hasJudgeDecision(currentCase) ? String(currentCase.valor_decisao_juiz) : "",
    );
  }, [currentCase?.id]);

  async function handleCreateProcess(event) {
    event.preventDefault();
    clearMessages();

    if (currentRole !== "adm") {
      setActionError("Somente ADM pode fazer upload de pastas.");
      return;
    }

    if (!supabase) {
      setActionError("Supabase client unavailable.");
      return;
    }

    if (!adminForm.nomePasta) {
      setActionError("Preencha o nome da pasta.");
      return;
    }

    if (!adminForm.clienteId) {
      setActionError(
        "Cliente nao encontrado. Cadastre Banco UFMG na tabela clientes.",
      );
      return;
    }

    if (!adminForm.advogadoId) {
      setActionError(
        "Advogado nao encontrado. Cadastre Advogado 1 e Advogado 2 na tabela perfis.",
      );
      return;
    }

    if (!adminProfile?.id) {
      setActionError("Perfil ADM nao encontrado na tabela perfis.");
      return;
    }

    if (queuedFiles.length === 0) {
      setActionError("Selecione pelo menos um arquivo (PDF/CSV).");
      return;
    }

    if (!confirmRequiredDocs) {
      setActionError("Confirme que todos os arquivos necessarios foram selecionados.");
      return;
    }

    setIsSaving(true);

    try {
      const { data: processRows, error: processError } = await supabase
        .from("processos")
        .insert({
          cliente_id: adminForm.clienteId,
          adm_id: adminProfile.id,
          advogado_id: adminForm.advogadoId,
          nome_pasta: `"${adminForm.nomePasta}"`,
          status: "nascimento",
        })
        .select("*")
        .limit(1);

      if (processError) throw processError;

      const createdProcess = processRows?.[0];
      if (!createdProcess?.id) {
        throw new Error("Processo criado sem identificador retornado.");
      }

      await uploadProcessDocuments({
        processoId: createdProcess.id,
        files: queuedFiles,
        tipoDocumento: "anexo",
        supabase,
      });

      setQueuedFiles([]);
      setConfirmRequiredDocs(false);
      setAdminForm((current) => ({ ...current, nomePasta: "" }));
      setSelectedProcessId(createdProcess.id);
      setActionMessage("Processo criado com sucesso.");
      await loadDashboard();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erro ao criar processo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRunAgent(processId) {
    clearMessages();

    if (!processId) {
      setActionError("Nao ha processo selecionado para analise.");
      return;
    }

    setIsSaving(true);

    try {
      const endpoint = `${agentApiBaseUrl}/analisar/${processId}`;
      const response = await fetch(endpoint, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.erro || payload.error || "Falha ao executar o agente.");
      }

      setActionMessage("Analise concluida e sincronizada com o Supabase.");
      await loadDashboard();
    } catch (error) {
      if (error instanceof TypeError) {
        setActionError(
          `Falha de conexao com o AI Agent em ${agentApiBaseUrl}. Verifique se o backend esta rodando e se a VITE_AGENT_API_URL esta correta.`,
        );
      } else {
        setActionError(
          error instanceof Error ? error.message : "Erro ao executar analise do agente.",
        );
      }
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

    if (!currentCase?.id) {
      setActionError("Nao ha processo selecionado.");
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

      if (error) throw error;

      setActionMessage(approved ? "Recomendacao aprovada." : "Recomendacao reprovada.");
      await loadDashboard();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Erro ao salvar decisao do advogado.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveJudgeDecision() {
    clearMessages();

    if (!supabase) {
      setActionError("Supabase client unavailable.");
      return;
    }

    if (!currentCase?.id) {
      setActionError("Nao ha processo selecionado.");
      return;
    }

    const numericValue = Number(judgeDecisionValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setActionError("Informe um valor valido para a decisao do juiz.");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("processos")
        .update({
          valor_decisao_juiz: numericValue,
          status: "julgado",
        })
        .eq("id", currentCase.id);

      if (error) throw error;

      setActionMessage("Decisao do juiz salva com sucesso.");
      await loadDashboard();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Erro ao salvar decisao do juiz.",
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

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    queueFiles(event.dataTransfer.files);
  }

  return (
    <div className="page-shell min-h-screen bg-black px-4 py-4 md:px-5 md:py-5">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/50 px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.06] text-slate-300">
              <Scale size={15} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">EnterOS</p>
              <p className="text-xs text-slate-400">Painel juridico</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs text-slate-400">
              <UserCog size={12} />
              Perfil
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
                  <Icon size={14} />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-xs text-slate-400 transition duration-200 hover:bg-white/[0.08] hover:text-slate-200"
          >
            <LogOut size={12} />
            Logout
          </button>
        </aside>

        <main className="space-y-4 overflow-hidden">
          <SectionCard>
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Status</p>
            <h1 className="mt-2 text-xl font-semibold text-white">Fluxo operacional</h1>
            <p className="mt-2 text-sm text-slate-400">
              Upload (ADM), analise do agente, aprovacao/reprovacao e acompanhamento de decisao judicial.
            </p>
            {dashboardState.loading ? (
              <p className="mt-2 text-xs text-slate-400">Carregando dados...</p>
            ) : null}
            {dashboardState.error ? (
              <p className="mt-2 text-xs text-red-400">Erro: {dashboardState.error}</p>
            ) : null}
            {actionMessage ? (
              <p className="mt-2 text-xs text-emerald-300">{actionMessage}</p>
            ) : null}
            {actionError ? (
              <p className="mt-2 text-xs text-red-400">{actionError}</p>
            ) : null}
          </SectionCard>

          {activeSection === "cases" ? (
            <SectionCard>
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs text-slate-400">Filtro por resultado</span>
                  <select
                    value={analysisFilter}
                    onChange={(event) => setAnalysisFilter(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Aguardando analise</option>
                    <option value="approved">Aprovados</option>
                    <option value="rejected">Reprovados</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs text-slate-400">Filtro de efetividade</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="waiting_judge">Aguardando decisao do juiz</option>
                    <option value="solved">Solucionados</option>
                  </select>
                </label>
              </div>
            </SectionCard>
          ) : null}

          {activeSection === "cases" ? (
            <SectionCard>
              <h2 className="text-lg font-semibold text-white">Pastas / Processos</h2>
              <div className="mt-4 space-y-2">
                {filteredProcesses.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum processo encontrado com os filtros atuais.</p>
                ) : (
                  filteredProcesses.map((item) => {
                    const selected = currentCase?.id === item.id;
                    const pendingJudge = !hasJudgeDecision(item);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedProcessId(item.id);
                          setActiveSection("analytics");
                        }}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          selected
                            ? "border-white/[0.25] bg-white/[0.08]"
                            : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.15]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-slate-400">{item.cliente_nome}</p>
                            <h3 className="mt-1 text-base font-semibold text-white">{item.nome_pasta}</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[10px] text-slate-200">
                              Sugestao: {item.sugestao_estrategia}
                            </span>
                            <span className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[10px] text-slate-200">
                              {decisionBadge(item)}
                            </span>
                            <span className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[10px] text-slate-200">
                              {pendingJudge ? "Decisao juiz pendente" : "Decisao juiz registrada"}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Criado em {formatDate(item.data_criacao)}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </SectionCard>
          ) : null}

          {activeSection === "upload" ? (
            <SectionCard>
              <h2 className="text-lg font-semibold text-white">Upload de pasta (ADM)</h2>

              {currentRole !== "adm" ? (
                <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  Apenas ADM pode criar/editar pastas. Advogado pode apenas aprovar ou reprovar analises.
                </p>
              ) : (
                <form className="mt-4 space-y-4" onSubmit={handleCreateProcess}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs text-slate-400">Nome da pasta</span>
                      <input
                        type="text"
                        value={adminForm.nomePasta}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            nomePasta: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none"
                        placeholder="Caso Banco UFMG"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs text-slate-400">Cliente</span>
                      <select
                        value={adminForm.clienteId}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            clienteId: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none"
                      >
                        <option value="">Selecione</option>
                        {clientOptions.map((cliente) => (
                          <option key={`${cliente.id || "banco-ufmg"}`} value={cliente.id}>
                            {cliente.nome || "Banco UFMG"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-1.5 block text-xs text-slate-400">Advogado do caso</span>
                      <select
                        value={adminForm.advogadoId}
                        onChange={(event) =>
                          setAdminForm((current) => ({
                            ...current,
                            advogadoId: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none"
                      >
                        <option value="">Selecione</option>
                        {lawyerOptions.map((perfil, index) => (
                          <option key={`${perfil.id || `advogado-${index + 1}`}`} value={perfil.id}>
                            {perfil.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition duration-200 ${
                      dragging
                        ? "border-white/30 bg-white/[0.06]"
                        : "border-white/[0.08] bg-white/[0.02]"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.csv"
                      multiple
                      className="hidden"
                      onChange={(event) => queueFiles(event.target.files)}
                    />
                    <p className="text-sm font-semibold text-white">Upload de PDF/CSV</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {queuedFiles.length} arquivo(s) na fila
                    </p>
                  </label>

                  <label className="flex items-start gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={confirmRequiredDocs}
                      onChange={(event) => setConfirmRequiredDocs(event.target.checked)}
                      className="mt-0.5"
                    />
                    Confirmo que selecionei todos os arquivos necessarios para analise.
                  </label>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition duration-200 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {isSaving ? "Salvando..." : "Criar processo"}
                  </button>
                </form>
              )}
            </SectionCard>
          ) : null}

          {activeSection === "analytics" ? (
            <SectionCard>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Analise do processo</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Processo atual: {currentCase?.nome_pasta ?? "Nenhum processo"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunAgent(currentCase?.id)}
                    disabled={isSaving || !currentCase?.id}
                    className="rounded-xl border border-white/[0.07] bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition duration-200 hover:bg-emerald-500/15 disabled:opacity-50"
                  >
                    {isSaving ? "Executando..." : "Executar AI Agent"}
                  </button>

                  <a
                    href={currentCase?.relatorio_tex_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-xl border border-white/[0.07] px-4 py-2 text-xs font-semibold transition duration-200 ${
                      currentCase?.relatorio_tex_url
                        ? "bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                        : "pointer-events-none bg-white/[0.02] text-slate-500"
                    }`}
                  >
                    Baixar .tex
                  </a>

                  <a
                    href="#"
                    onClick={(event) => event.preventDefault()}
                    className="pointer-events-none rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2 text-xs font-semibold text-slate-500"
                  >
                    Baixar PDF
                  </a>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Cliente</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {currentCase?.cliente_nome ?? "Banco UFMG"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Sugestao do agente</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {currentCase?.sugestao_estrategia ?? "Sem analise"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Confianca</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {Math.round(currentCase?.probabilidade_exito || 0)}%
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Identificacao do caso</p>
                <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>
                    <span className="text-slate-500">Numero do processo:</span>{" "}
                    {currentCase?.identificacao?.numero_processo || currentCase?.id || "-"}
                  </p>
                  <p>
                    <span className="text-slate-500">UF:</span>{" "}
                    {currentCase?.identificacao?.uf || "-"}
                  </p>
                  <p>
                    <span className="text-slate-500">Comarca:</span>{" "}
                    {currentCase?.identificacao?.comarca || "-"}
                  </p>
                  <p>
                    <span className="text-slate-500">Valor da causa:</span>{" "}
                    {currentCase?.identificacao?.valor_causa != null
                      ? formatCurrency(currentCase.identificacao.valor_causa)
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Resumo dos fatos</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {currentCase?.resumo_fatos || "Execute o AI Agent para preencher esta seção."}
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Alegacoes da parte autora</p>
                  {currentCase?.alegacoes_autor?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {currentCase.alegacoes_autor.map((item) => (
                        <li key={item} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Sem alegações registradas.</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Documentos e evidencias do banco</p>
                  {currentCase?.documentos_banco?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {currentCase.documentos_banco.map((item) => (
                        <li key={item} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Sem documentos destacados.</p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Pontos favoraveis ao banco</p>
                  {currentCase?.pontos_favoraveis_banco?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {currentCase.pontos_favoraveis_banco.map((item) => (
                        <li key={item} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Sem pontos favoráveis mapeados.</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Pontos desfavoraveis ao banco</p>
                  {currentCase?.pontos_desfavoraveis_banco?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {currentCase.pontos_desfavoraveis_banco.map((item) => (
                        <li key={item} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Sem pontos desfavoráveis mapeados.</p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Observacoes importantes</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {currentCase?.observacoes_importantes || "Sem observações adicionais."}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Fatores juridicos relevantes</p>
                <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>Autor pessoa idosa: {currentCase?.fatores_juridicos_relevantes?.autor_idoso || "incerto"}</p>
                  <p>Autor aposentado/pensionista: {currentCase?.fatores_juridicos_relevantes?.autor_aposentado || "incerto"}</p>
                  <p>Pedido de tutela de urgencia: {currentCase?.fatores_juridicos_relevantes?.pedido_tutela_urgencia || "incerto"}</p>
                  <p>Pedido de dano moral: {currentCase?.fatores_juridicos_relevantes?.pedido_dano_moral || "incerto"}</p>
                  <p>
                    Valor do dano moral:{" "}
                    {currentCase?.fatores_juridicos_relevantes?.valor_dano_moral != null
                      ? formatCurrency(currentCase.fatores_juridicos_relevantes.valor_dano_moral)
                      : "-"}
                  </p>
                  <p>Pedido de repeticao de indebito: {currentCase?.fatores_juridicos_relevantes?.pedido_repeticao_indebito || "incerto"}</p>
                  <p>Alegacao de vulnerabilidade economica: {currentCase?.fatores_juridicos_relevantes?.alegacao_vulnerabilidade || "incerto"}</p>
                  <p>Uso indevido de dados: {currentCase?.fatores_juridicos_relevantes?.alegacao_uso_indevido_dados || "incerto"}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Analise preditiva</p>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-300">
                    <p>Probabilidade de exito do banco: {Math.round(currentCase?.analise_preditiva?.probabilidade_exito_banco || 0)}%</p>
                    <p>Probabilidade de nao exito: {Math.round(currentCase?.analise_preditiva?.probabilidade_nao_exito_banco || 0)}%</p>
                    <p>Classificacao: {currentCase?.analise_preditiva?.classificacao_preditiva || "Nao classificado"}</p>
                    <p>Confianca do modelo: {Math.round(currentCase?.analise_preditiva?.confianca_modelo || 0)}%</p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Recomendacao estrategica</p>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-300">
                    <p>Recomendacao: {currentCase?.recomendacao_estrategica?.recomendacao || "-"}</p>
                    <p>
                      Valor sugerido:{" "}
                      {formatCurrency(currentCase?.recomendacao_estrategica?.valor_sugerido || 0)}
                    </p>
                    <p>
                      Faixa de negociacao:{" "}
                      {formatCurrency(currentCase?.recomendacao_estrategica?.faixa_negociacao?.minimo || 0)} a{" "}
                      {formatCurrency(currentCase?.recomendacao_estrategica?.faixa_negociacao?.maximo || 0)}
                    </p>
                    <p className="pt-1">{currentCase?.recomendacao_estrategica?.justificativa_economica || "Sem justificativa econômica detalhada."}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Resumo gerado pelo agente</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {currentCase?.analise_texto || "Execute o AI Agent para preencher esta análise."}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Argumentos da analise</p>
                {currentCase?.argumentos?.length ? (
                  <ul className="mt-2 space-y-2 text-sm text-slate-300">
                    {currentCase.argumentos.map((argumento) => (
                      <li
                        key={argumento}
                        className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                      >
                        {argumento}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">Sem argumentos ainda.</p>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Comentario do advogado</p>
                <textarea
                  value={lawyerComment}
                  onChange={(event) => setLawyerComment(event.target.value)}
                  disabled={currentRole !== "advogado"}
                  className="mt-2 min-h-[90px] w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-xs text-white outline-none disabled:opacity-50"
                  placeholder="Escreva uma observacao para salvar no processo"
                />

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={currentRole !== "advogado" || isSaving || !currentCase?.id}
                    onClick={() => handleLawyerDecision(true)}
                    className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition duration-200 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={currentRole !== "advogado" || isSaving || !currentCase?.id}
                    onClick={() => handleLawyerDecision(false)}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 transition duration-200 hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    Reprovar
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Decisao do juiz (preencher depois)</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="number"
                    min="0"
                    value={judgeDecisionValue}
                    onChange={(event) => setJudgeDecisionValue(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none"
                    placeholder="Ex: 8500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveJudgeDecision}
                    disabled={isSaving || !currentCase?.id}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition duration-200 hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    Salvar decisao
                  </button>
                </div>

                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                  {hasJudgeDecision(currentCase) ? (
                    <>
                      <CheckCircle2 size={14} />
                      Decisao registrada: {formatCurrency(currentCase?.valor_decisao_juiz)}
                    </>
                  ) : (
                    <>
                      <Clock3 size={14} />
                      Aguardando decisao do juiz
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="text-slate-500">Status da analise</p>
                  <p className="mt-1">{decisionBadge(currentCase || {})}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="text-slate-500">Criacao</p>
                  <p className="mt-1">{formatDate(currentCase?.data_criacao)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="text-slate-500">Ultima analise</p>
                  <p className="mt-1">{formatDate(currentCase?.data_analise)}</p>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard>
            <h3 className="text-sm font-semibold text-white">Resumo rapido</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                Total de analises: {liveProcesses.length}
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                Aguardando juiz: {liveProcesses.filter((item) => !hasJudgeDecision(item)).length}
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                Solucionados: {liveProcesses.filter((item) => hasJudgeDecision(item)).length}
              </div>
            </div>
          </SectionCard>
        </main>
      </div>
    </div>
  );
}
