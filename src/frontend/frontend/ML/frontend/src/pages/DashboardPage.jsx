import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileUp,
  LayoutDashboard,
  LogOut,
  Scale,
  Sparkles,
  UserCog,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
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
        metodo_calculo:
          recomendacao.metodo_calculo || "Sem método de cálculo informado.",
      },
      decisao_politica: result.decisao_politica || null,
      limiar_ativo: Number.isFinite(Number(result.limiar_ativo))
        ? Number(result.limiar_ativo)
        : null,
      qualitative_score: Number.isFinite(Number(result.qualitative_score))
        ? Number(result.qualitative_score)
        : null,
      probabilidades_base: {
        p_improcedencia: Number.isFinite(Number(result?.probabilidades_base?.p_improcedencia))
          ? Number(result.probabilidades_base.p_improcedencia)
          : null,
        p_parcial_procedencia: Number.isFinite(
          Number(result?.probabilidades_base?.p_parcial_procedencia),
        )
          ? Number(result.probabilidades_base.p_parcial_procedencia)
          : null,
        p_procedencia: Number.isFinite(Number(result?.probabilidades_base?.p_procedencia))
          ? Number(result.probabilidades_base.p_procedencia)
          : null,
        p_nao_exito: Number.isFinite(Number(result?.probabilidades_base?.p_nao_exito))
          ? Number(result.probabilidades_base.p_nao_exito)
          : null,
      },
      shap_transparencia: Array.isArray(result.shap_transparencia)
        ? result.shap_transparencia
            .map((item) => ({
              feature: String(item?.feature || ""),
              valor: Number(item?.valor),
            }))
            .filter((item) => item.feature && Number.isFinite(item.valor))
        : [],
      preflight: {
        extinto: result?.preflight?.extinto === true,
        documentos_obrigatorios_faltantes: toList(
          result?.preflight?.documentos_obrigatorios_faltantes,
        ),
        justificativa:
          result?.preflight?.justificativa || "Sem justificativa de pre-flight.",
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

// ── Design system ─────────────────────────────────────────────────────────────

const AMBER = "#eab308";
const AMBER_DIM = "rgba(234,179,8,0.15)";
const TRACK = "rgba(255,255,255,0.06)";

const chartTooltipStyle = {
  background: "#0a0a0b",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  fontSize: "11px",
  color: "rgba(255,255,255,0.85)",
  padding: "8px 12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
};

// ── UI components ─────────────────────────────────────────────────────────────

function Spinner({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Label({ children }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
      {children}
    </p>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 ${className}`}>
      {children}
    </section>
  );
}

function StatusBadge({ item }) {
  const label = decisionBadge(item);
  const styles = {
    "Aprovado": "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400",
    "Reprovado": "border-red-500/30 bg-red-500/[0.08] text-red-400",
    "Aguardando análise": "border-amber-500/25 bg-amber-500/[0.07] text-amber-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${styles[label] ?? "border-white/10 text-slate-400"}`}>
      {label}
    </span>
  );
}

function SugestaoTag({ value }) {
  const empty = !value || value === "Sem analise";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
      empty
        ? "border-white/[0.06] text-slate-600"
        : "border-amber-500/25 bg-amber-500/[0.07] text-amber-400"
    }`}>
      {value}
    </span>
  );
}

function JudgeBadge({ item }) {
  const decided = hasJudgeDecision(item);
  return decided ? (
    <span className="inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-slate-300">
      Decisão registrada
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-white/[0.06] px-2.5 py-0.5 text-[10px] text-slate-600">
      Aguardando juiz
    </span>
  );
}

function FlagBadge({ value }) {
  if (value === "sim") {
    return (
      <span className="rounded border border-amber-500/30 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-amber-400">
        Sim
      </span>
    );
  }
  if (value === "não") {
    return (
      <span className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
        Não
      </span>
    );
  }
  return (
    <span className="rounded border border-white/[0.04] px-2 py-0.5 text-[10px] text-slate-600">
      —
    </span>
  );
}

// Animated semi-circle gauge
function GaugeMeter({ value }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const r = 52;
  const cx = 70;
  const cy = 68;
  const pathD = `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`;
  const pathLength = Math.PI * r;
  const offset = pathLength * (1 - pct / 100);
  const strokeColor = pct >= 60 ? AMBER : pct >= 35 ? "#f97316" : "#ef4444";

  return (
    <svg viewBox="0 0 140 78" className="w-full max-w-[160px]" aria-label={`${pct}% probabilidade de êxito`}>
      <path d={pathD} fill="none" stroke={TRACK} strokeWidth="9" strokeLinecap="round" />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={pathLength}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="Manrope, sans-serif">
        {pct}%
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fill="rgba(148,163,184,0.55)" fontSize="7" letterSpacing="1.4" fontFamily="Manrope, sans-serif">
        ÊXITO DO BANCO
      </text>
    </svg>
  );
}

// Thin animated bar
function ProbBar({ value, color = "amber" }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const colors = {
    amber: "#eab308",
    red: "#ef4444",
    slate: "#475569",
    white: "rgba(255,255,255,0.3)",
  };
  return (
    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: colors[color] ?? colors.amber,
          transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}

// Recharts: horizontal SHAP feature importance
function ShapChart({ data }) {
  if (!data?.length) return null;
  const chartData = [...data]
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
    .slice(0, 8)
    .map((d) => ({ name: d.feature, value: Number(d.valor.toFixed(4)) }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 32)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 48, left: 8, bottom: 0 }}>
        <XAxis
          type="number"
          tick={{ fill: "rgba(148,163,184,0.4)", fontSize: 10, fontFamily: "Manrope" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v.toFixed(2)}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fill: "rgba(148,163,184,0.65)", fontSize: 10.5, fontFamily: "Manrope" }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine x={0} stroke="rgba(255,255,255,0.08)" />
        <Tooltip
          contentStyle={chartTooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          formatter={(v) => [v.toFixed(4), "SHAP"]}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={14}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.value >= 0 ? AMBER : "rgba(148,163,184,0.25)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Recharts: base probability distribution
function ProbDistChart({ data }) {
  if (!data?.length || data.every((d) => d.value == null)) return null;
  const filled = data.filter((d) => d.value != null);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={filled} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: "rgba(148,163,184,0.55)", fontSize: 10, fontFamily: "Manrope" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          tick={{ fill: "rgba(148,163,184,0.35)", fontSize: 9, fontFamily: "Manrope" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={chartTooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          formatter={(v) => [`${(v * 100).toFixed(1)}%`, "Probabilidade"]}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {filled.map((entry, i) => {
            const maxVal = Math.max(...filled.map((d) => d.value ?? 0));
            return (
              <Cell
                key={i}
                fill={entry.value === maxVal ? AMBER : "rgba(255,255,255,0.07)"}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
        supabase.from("processos").select("*").order("data_criacao", { ascending: false }),
        supabase.from("clientes").select("*"),
        supabase.from("analises_agentes").select("*").order("data_analise", { ascending: false }),
        supabase.from("perfis").select("*").order("created_at", { ascending: true }),
      ]);

      const error =
        processosRes.error || clientesRes.error || analisesRes.error || perfisRes.error || null;

      if (error) {
        setDashboardState({ processos: [], clientes: [], perfis: [], loading: false, error: error.message });
        return;
      }

      const processos = buildEnrichedProcesses(
        processosRes.data ?? [],
        clientesRes.data ?? [],
        analisesRes.data ?? [],
      );

      setDashboardState({
        processos,
        clientes: clientesRes.data ?? [],
        perfis: perfisRes.data ?? [],
        loading: false,
        error: "",
      });

      setAdminForm((current) => {
        const lawyerProfiles = (perfisRes.data ?? []).filter((p) => p.tipo_usuario === "advogado");
        return {
          ...current,
          clienteId: current.clienteId || clientesRes.data?.[0]?.id || "",
          advogadoId: current.advogadoId || lawyerProfiles[0]?.id || "",
        };
      });
    } catch (error) {
      setDashboardState({
        processos: [], clientes: [], perfis: [], loading: false,
        error: error instanceof Error ? error.message : "Unexpected dashboard error.",
      });
    }
  }

  useEffect(() => { loadDashboard(); }, []);

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
    if (currentRole !== "adm") { setActionError("Somente ADM pode fazer upload de pastas."); return; }
    if (!supabase) { setActionError("Supabase client unavailable."); return; }
    if (!adminForm.nomePasta) { setActionError("Preencha o nome da pasta."); return; }
    if (!adminForm.clienteId) { setActionError("Cliente nao encontrado. Cadastre Banco UFMG na tabela clientes."); return; }
    if (!adminForm.advogadoId) { setActionError("Advogado nao encontrado. Cadastre Advogado 1 e Advogado 2 na tabela perfis."); return; }
    if (!adminProfile?.id) { setActionError("Perfil ADM nao encontrado na tabela perfis."); return; }
    if (queuedFiles.length === 0) { setActionError("Selecione pelo menos um arquivo (PDF/CSV)."); return; }
    if (!confirmRequiredDocs) { setActionError("Confirme que todos os arquivos necessarios foram selecionados."); return; }

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
      if (!createdProcess?.id) throw new Error("Processo criado sem identificador retornado.");

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
    if (!processId) { setActionError("Nao ha processo selecionado para analise."); return; }
    setIsSaving(true);
    try {
      const response = await fetch(`${agentApiBaseUrl}/analisar/${processId}`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.erro || payload.error || "Falha ao executar o agente.");
      setActionMessage("Analise concluida e sincronizada com o Supabase.");
      await loadDashboard();
    } catch (error) {
      if (error instanceof TypeError) {
        setActionError(`Falha de conexao com o AI Agent em ${agentApiBaseUrl}. Verifique se o backend esta rodando e se a VITE_AGENT_API_URL esta correta.`);
      } else {
        setActionError(error instanceof Error ? error.message : "Erro ao executar analise do agente.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLawyerDecision(approved) {
    clearMessages();
    if (!supabase) { setActionError("Supabase client unavailable."); return; }
    if (!currentCase?.id) { setActionError("Nao ha processo selecionado."); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({ sugestao_aprovada: approved, comentario_advogado: lawyerComment || null, status: "aguardando_sentenca" })
        .eq("id", currentCase.id);
      if (error) throw error;
      setActionMessage(approved ? "Recomendacao aprovada." : "Recomendacao reprovada.");
      await loadDashboard();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erro ao salvar decisao do advogado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveJudgeDecision() {
    clearMessages();
    if (!supabase) { setActionError("Supabase client unavailable."); return; }
    if (!currentCase?.id) { setActionError("Nao ha processo selecionado."); return; }
    const numericValue = Number(judgeDecisionValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) { setActionError("Informe um valor valido para a decisao do juiz."); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("processos")
        .update({ valor_decisao_juiz: numericValue, status: "julgado" })
        .eq("id", currentCase.id);
      if (error) throw error;
      setActionMessage("Decisao do juiz salva com sucesso.");
      await loadDashboard();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erro ao salvar decisao do juiz.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleRoleChange(role) { setCurrentRole(role); setRole(role); }
  function handleLogout() { logout(); navigate("/advogado"); }
  function handleDrop(event) { event.preventDefault(); setDragging(false); queueFiles(event.dataTransfer.files); }

  // Derived chart data
  const baseProbChartData = useMemo(() => {
    const bp = currentCase?.probabilidades_base;
    if (!bp) return [];
    return [
      { name: "Improcedência", value: bp.p_improcedencia },
      { name: "Parcial", value: bp.p_parcial_procedencia },
      { name: "Procedência", value: bp.p_procedencia },
      { name: "Não êxito", value: bp.p_nao_exito },
    ].filter((d) => d.value != null);
  }, [currentCase?.probabilidades_base]);

  return (
    <div className="page-shell min-h-screen bg-black px-4 py-4 md:px-5 md:py-5">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl gap-4 lg:grid-cols-[228px_1fr]">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          {/* Logo */}
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/60 px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/[0.08]">
              <Scale size={15} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">EnterOS</p>
              <p className="text-[11px] text-slate-500">Painel jurídico</p>
            </div>
          </div>

          {/* Role toggle */}
          <div className="rounded-xl border border-white/[0.05] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              <UserCog size={11} />
              Perfil
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[["advogado", "Advogado"], ["adm", "Admin"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleRoleChange(value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                    currentRole === value
                      ? "border-amber-500/30 bg-amber-500/[0.09] text-amber-400"
                      : "border-white/[0.04] text-slate-500 hover:border-white/[0.09] hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-0.5">
            {sections.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                    isActive
                      ? "border border-amber-500/20 bg-amber-500/[0.06] text-amber-400"
                      : "border border-transparent text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
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
            className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-500 transition-all duration-150 hover:border-red-500/25 hover:bg-red-500/[0.06] hover:text-red-400"
          >
            <LogOut size={12} />
            Logout
          </button>
        </aside>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <main className="space-y-3 overflow-hidden">

          {/* Status bar */}
          <SectionCard>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Status</p>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-white">Fluxo operacional</h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload (ADM) · análise do agente · aprovação · decisão judicial
            </p>
            {dashboardState.loading && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <Spinner size={12} className="text-amber-400" />
                <p className="text-xs text-slate-500">Carregando dados...</p>
              </div>
            )}
            {dashboardState.error && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-2">
                <XCircle size={12} className="shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{dashboardState.error}</p>
              </div>
            )}
            {actionMessage && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2">
                <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />
                <p className="text-xs text-emerald-400">{actionMessage}</p>
              </div>
            )}
            {actionError && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-2">
                <XCircle size={12} className="shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{actionError}</p>
              </div>
            )}
          </SectionCard>

          {/* ── Cases ─────────────────────────────────────────────────── */}
          {activeSection === "cases" && (
            <>
              <SectionCard>
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-600">Filtro por resultado</span>
                    <select
                      value={analysisFilter}
                      onChange={(e) => setAnalysisFilter(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-amber-500/30"
                    >
                      <option value="all">Todos</option>
                      <option value="pending">Aguardando análise</option>
                      <option value="approved">Aprovados</option>
                      <option value="rejected">Reprovados</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-600">Filtro de efetividade</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-amber-500/30"
                    >
                      <option value="all">Todos</option>
                      <option value="waiting_judge">Aguardando decisão do juiz</option>
                      <option value="solved">Solucionados</option>
                    </select>
                  </label>
                </div>
              </SectionCard>

              <SectionCard>
                <Label>Pastas / Processos</Label>
                <div className="space-y-2">
                  {filteredProcesses.length === 0 ? (
                    <p className="text-sm text-slate-600">Nenhum processo encontrado com os filtros atuais.</p>
                  ) : (
                    filteredProcesses.map((item) => {
                      const selected = currentCase?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => { setSelectedProcessId(item.id); setActiveSection("analytics"); }}
                          className={`w-full rounded-xl border p-4 text-left transition-all duration-150 ${
                            selected
                              ? "border-amber-500/25 bg-amber-500/[0.04]"
                              : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-[11px] text-slate-500">{item.cliente_nome}</p>
                              <h3 className="mt-0.5 text-sm font-semibold text-white">{item.nome_pasta}</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <SugestaoTag value={item.sugestao_estrategia} />
                              <StatusBadge item={item} />
                              <JudgeBadge item={item} />
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-600">
                            Criado em {formatDate(item.data_criacao)}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </SectionCard>
            </>
          )}

          {/* ── Upload ────────────────────────────────────────────────── */}
          {activeSection === "upload" && (
            <SectionCard>
              <Label>Upload de pasta (ADM)</Label>
              {currentRole !== "adm" ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
                  <p className="text-sm text-slate-400">
                    Apenas ADM pode criar/editar pastas. Advogado pode apenas aprovar ou reprovar análises.
                  </p>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleCreateProcess}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-600">Nome da pasta</span>
                      <input
                        type="text"
                        value={adminForm.nomePasta}
                        onChange={(e) => setAdminForm((c) => ({ ...c, nomePasta: e.target.value }))}
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-amber-500/30 focus:bg-amber-500/[0.03]"
                        placeholder="Caso Banco UFMG"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-600">Cliente</span>
                      <select
                        value={adminForm.clienteId}
                        onChange={(e) => setAdminForm((c) => ({ ...c, clienteId: e.target.value }))}
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500/30"
                      >
                        <option value="">Selecione</option>
                        {clientOptions.map((c) => (
                          <option key={c.id || "banco-ufmg"} value={c.id}>{c.nome || "Banco UFMG"}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-600">Advogado do caso</span>
                      <select
                        value={adminForm.advogadoId}
                        onChange={(e) => setAdminForm((c) => ({ ...c, advogadoId: e.target.value }))}
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500/30"
                      >
                        <option value="">Selecione</option>
                        {lawyerOptions.map((p, i) => (
                          <option key={p.id || `advogado-${i + 1}`} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`flex min-h-[130px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all duration-150 ${
                      dragging
                        ? "border-amber-500/40 bg-amber-500/[0.05]"
                        : "border-white/[0.07] hover:border-white/[0.14]"
                    }`}
                  >
                    <input type="file" accept=".pdf,.csv" multiple className="hidden" onChange={(e) => queueFiles(e.target.files)} />
                    <FileUp size={18} className="mb-2 text-slate-500" />
                    <p className="text-sm font-medium text-white">Arrastar ou selecionar arquivos</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {queuedFiles.length > 0
                        ? <span className="text-amber-400">{queuedFiles.length} arquivo(s) na fila</span>
                        : "PDF ou CSV, máximo 20 arquivos"}
                    </p>
                  </label>

                  <label className="flex items-start gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={confirmRequiredDocs}
                      onChange={(e) => setConfirmRequiredDocs(e.target.checked)}
                      className="mt-0.5 accent-amber-400"
                    />
                    Confirmo que selecionei todos os arquivos necessários para análise.
                  </label>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full rounded-xl border border-white/12 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-100 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner size={14} className="text-black/60" />
                        Salvando...
                      </span>
                    ) : "Criar processo"}
                  </button>
                </form>
              )}
            </SectionCard>
          )}

          {/* ── Analytics ─────────────────────────────────────────────── */}
          {activeSection === "analytics" && (
            <SectionCard>
              {/* Agent running banner */}
              {isSaving && (
                <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3">
                  <Spinner size={14} className="text-amber-400" />
                  <div>
                    <p className="text-xs font-semibold text-amber-400">Agente em execução</p>
                    <p className="text-[11px] text-slate-500">Aguarde enquanto o AI Agent analisa o processo...</p>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Análise do processo</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Processo atual: {currentCase?.nome_pasta ?? "Nenhum processo"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunAgent(currentCase?.id)}
                    disabled={isSaving || !currentCase?.id}
                    className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-2 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/[0.14] disabled:opacity-40"
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2"><Spinner size={11} className="text-amber-400" />Executando...</span>
                    ) : "Executar AI Agent"}
                  </button>
                  <a
                    href={currentCase?.relatorio_tex_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-xl border border-white/[0.07] px-4 py-2 text-xs font-semibold transition ${
                      currentCase?.relatorio_tex_url
                        ? "bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
                        : "pointer-events-none text-slate-600"
                    }`}
                  >
                    Baixar .tex
                  </a>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="pointer-events-none rounded-xl border border-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-700"
                  >
                    Baixar PDF
                  </a>
                </div>
              </div>

              {/* ── ADMIN ONLY: Hero gauge row ── */}
              {currentRole === "adm" && (
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-5">
                    <GaugeMeter value={currentCase?.analise_preditiva?.probabilidade_exito_banco ?? currentCase?.probabilidade_exito ?? 0} />
                    <p className="mt-2 text-[10px] text-slate-600">
                      Confiança: {Math.round(currentCase?.analise_preditiva?.confianca_modelo || 0)}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Recomendação estratégica</p>
                    <p className="mt-2 text-xl font-bold text-amber-400">
                      {currentCase?.recomendacao_estrategica?.recomendacao || "—"}
                    </p>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Valor sugerido</span>
                        <span className="font-semibold text-white">{formatCurrency(currentCase?.recomendacao_estrategica?.valor_sugerido || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Faixa mín.</span>
                        <span className="text-slate-300">{formatCurrency(currentCase?.recomendacao_estrategica?.faixa_negociacao?.minimo || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Faixa máx.</span>
                        <span className="text-slate-300">{formatCurrency(currentCase?.recomendacao_estrategica?.faixa_negociacao?.maximo || 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Análise preditiva</p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Êxito banco</span>
                          <span className="font-semibold text-amber-400">{Math.round(currentCase?.analise_preditiva?.probabilidade_exito_banco || 0)}%</span>
                        </div>
                        <ProbBar value={currentCase?.analise_preditiva?.probabilidade_exito_banco || 0} color="amber" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Não êxito</span>
                          <span className="font-semibold text-slate-300">{Math.round(currentCase?.analise_preditiva?.probabilidade_nao_exito_banco || 0)}%</span>
                        </div>
                        <ProbBar value={currentCase?.analise_preditiva?.probabilidade_nao_exito_banco || 0} color="slate" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Confiança</span>
                          <span className="font-semibold text-slate-300">{Math.round(currentCase?.analise_preditiva?.confianca_modelo || 0)}%</span>
                        </div>
                        <ProbBar value={currentCase?.analise_preditiva?.confianca_modelo || 0} color="white" />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-white/[0.05] px-2.5 py-1.5">
                        <span className="text-[10px] text-slate-500">Classificação</span>
                        <span className="text-[10px] font-semibold text-slate-300">{currentCase?.analise_preditiva?.classificacao_preditiva || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3 metric cards — both roles */}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Cliente</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {currentCase?.cliente_nome ?? "Banco UFMG"}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
                  <p className="text-xs text-amber-600/80">Sugestão do agente</p>
                  <p className="mt-1 text-sm font-bold text-amber-400">
                    {currentCase?.sugestao_estrategia ?? "Sem análise"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Probabilidade de êxito do banco</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {Math.round(currentCase?.probabilidade_exito || 0)}%
                  </p>
                  <ProbBar value={currentCase?.probabilidade_exito || 0} color="amber" />
                </div>
              </div>

              {/* Identificação */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Identificação do caso</p>
                <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p><span className="text-slate-500">Número do processo:</span>{" "}{currentCase?.identificacao?.numero_processo || currentCase?.id || "—"}</p>
                  <p><span className="text-slate-500">UF:</span>{" "}{currentCase?.identificacao?.uf || "—"}</p>
                  <p><span className="text-slate-500">Comarca:</span>{" "}{currentCase?.identificacao?.comarca || "—"}</p>
                  <p>
                    <span className="text-slate-500">Valor da causa:</span>{" "}
                    {currentCase?.identificacao?.valor_causa != null
                      ? formatCurrency(currentCase.identificacao.valor_causa)
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Resumo dos fatos */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Resumo dos fatos</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {currentCase?.resumo_fatos || "Execute o AI Agent para preencher esta seção."}
                </p>
              </div>

              {/* Alegações + Documentos */}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Alegações da parte autora</p>
                  {currentCase?.alegacoes_autor?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {currentCase.alegacoes_autor.map((item) => (
                        <li key={item} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Sem alegações registradas.</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Documentos e evidências do banco</p>
                  {currentCase?.documentos_banco?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {currentCase.documentos_banco.map((item) => (
                        <li key={item} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Sem documentos destacados.</p>
                  )}
                </div>
              </div>

              {/* Favoráveis + Desfavoráveis */}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Pontos favoráveis ao banco</p>
                  {currentCase?.pontos_favoraveis_banco?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {currentCase.pontos_favoraveis_banco.map((item) => (
                        <li key={item} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Sem pontos favoráveis mapeados.</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Pontos desfavoráveis ao banco</p>
                  {currentCase?.pontos_desfavoraveis_banco?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {currentCase.pontos_desfavoraveis_banco.map((item) => (
                        <li key={item} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Sem pontos desfavoráveis mapeados.</p>
                  )}
                </div>
              </div>

              {/* Observações importantes */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Observações importantes</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {currentCase?.observacoes_importantes || "Sem observações adicionais."}
                </p>
              </div>

              {/* Fatores jurídicos relevantes */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Fatores jurídicos relevantes</p>
                <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  {[
                    ["Autor pessoa idosa", currentCase?.fatores_juridicos_relevantes?.autor_idoso],
                    ["Autor aposentado/pensionista", currentCase?.fatores_juridicos_relevantes?.autor_aposentado],
                    ["Pedido de tutela de urgência", currentCase?.fatores_juridicos_relevantes?.pedido_tutela_urgencia],
                    ["Pedido de dano moral", currentCase?.fatores_juridicos_relevantes?.pedido_dano_moral],
                    ["Pedido de repetição de indébito", currentCase?.fatores_juridicos_relevantes?.pedido_repeticao_indebito],
                    ["Alegação de vulnerabilidade econômica", currentCase?.fatores_juridicos_relevantes?.alegacao_vulnerabilidade],
                    ["Uso indevido de dados", currentCase?.fatores_juridicos_relevantes?.alegacao_uso_indevido_dados],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-white/[0.04] px-3 py-2">
                      <span className="text-xs text-slate-300">{label}</span>
                      <FlagBadge value={normalizeFlag(value)} />
                    </div>
                  ))}
                  {currentCase?.fatores_juridicos_relevantes?.valor_dano_moral != null && (
                    <div className="flex items-center justify-between rounded-lg border border-amber-500/15 bg-amber-500/[0.03] px-3 py-2 sm:col-span-2">
                      <span className="text-xs text-slate-300">Valor do dano moral</span>
                      <span className="text-xs font-bold text-amber-400">
                        {formatCurrency(currentCase.fatores_juridicos_relevantes.valor_dano_moral)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Análise preditiva + Recomendação estratégica — both roles */}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Análise preditiva</p>
                  <div className="mt-2 space-y-2 text-sm text-slate-300">
                    <div>
                      <div className="flex justify-between text-xs">
                        <span>Probabilidade de êxito do banco</span>
                        <span className="font-semibold text-amber-400">{Math.round(currentCase?.analise_preditiva?.probabilidade_exito_banco || 0)}%</span>
                      </div>
                      <ProbBar value={currentCase?.analise_preditiva?.probabilidade_exito_banco || 0} color="amber" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs">
                        <span>Probabilidade de não êxito</span>
                        <span className="font-semibold">{Math.round(currentCase?.analise_preditiva?.probabilidade_nao_exito_banco || 0)}%</span>
                      </div>
                      <ProbBar value={currentCase?.analise_preditiva?.probabilidade_nao_exito_banco || 0} color="slate" />
                    </div>
                    <p>Classificação: {currentCase?.analise_preditiva?.classificacao_preditiva || "Não classificado"}</p>
                    <div>
                      <div className="flex justify-between text-xs">
                        <span>Confiança do modelo</span>
                        <span className="font-semibold">{Math.round(currentCase?.analise_preditiva?.confianca_modelo || 0)}%</span>
                      </div>
                      <ProbBar value={currentCase?.analise_preditiva?.confianca_modelo || 0} color="white" />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Recomendação estratégica</p>
                  <div className="mt-2 space-y-1.5 text-sm text-slate-300">
                    <p>Recomendação: <span className="font-semibold text-amber-400">{currentCase?.recomendacao_estrategica?.recomendacao || "—"}</span></p>
                    <p>
                      Valor sugerido:{" "}
                      <span className="font-semibold text-amber-400">{formatCurrency(currentCase?.recomendacao_estrategica?.valor_sugerido || 0)}</span>
                    </p>
                    <p>
                      Faixa de negociação:{" "}
                      {formatCurrency(currentCase?.recomendacao_estrategica?.faixa_negociacao?.minimo || 0)} a{" "}
                      {formatCurrency(currentCase?.recomendacao_estrategica?.faixa_negociacao?.maximo || 0)}
                    </p>
                    <p>Método de cálculo: {currentCase?.recomendacao_estrategica?.metodo_calculo || "—"}</p>
                    <p className="pt-1 text-xs">{currentCase?.recomendacao_estrategica?.justificativa_economica || "Sem justificativa econômica detalhada."}</p>
                  </div>
                </div>
              </div>

              {/* ── ADMIN ONLY: Probability distribution chart ── */}
              {currentRole === "adm" && baseProbChartData.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Distribuição de probabilidades</p>
                  <div className="mt-3">
                    <ProbDistChart data={baseProbChartData} />
                  </div>
                </div>
              )}

              {currentRole === "adm" && (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                      <p className="text-xs text-slate-500">Policy engine</p>
                      <div className="mt-2 space-y-1.5 text-sm text-slate-300">
                        <p>Decisão política: {currentCase?.decisao_politica || "—"}</p>
                        <p>
                          Limiar ativo:{" "}
                          {currentCase?.limiar_ativo != null ? currentCase.limiar_ativo.toFixed(4) : "—"}
                        </p>
                        <p>
                          Qualitative score (S_LLM):{" "}
                          {currentCase?.qualitative_score != null ? currentCase.qualitative_score.toFixed(4) : "—"}
                        </p>
                        <p>
                          P(improcedência):{" "}
                          {currentCase?.probabilidades_base?.p_improcedencia != null
                            ? `${(currentCase.probabilidades_base.p_improcedencia * 100).toFixed(2)}%` : "—"}
                        </p>
                        <p>
                          P(parcial procedência):{" "}
                          {currentCase?.probabilidades_base?.p_parcial_procedencia != null
                            ? `${(currentCase.probabilidades_base.p_parcial_procedencia * 100).toFixed(2)}%` : "—"}
                        </p>
                        <p>
                          P(procedência):{" "}
                          {currentCase?.probabilidades_base?.p_procedencia != null
                            ? `${(currentCase.probabilidades_base.p_procedencia * 100).toFixed(2)}%` : "—"}
                        </p>
                        <p>
                          P(não êxito):{" "}
                          {currentCase?.probabilidades_base?.p_nao_exito != null
                            ? `${(currentCase.probabilidades_base.p_nao_exito * 100).toFixed(2)}%` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className={`rounded-xl border p-4 ${
                      currentCase?.preflight?.extinto
                        ? "border-red-500/25 bg-red-500/[0.04]"
                        : "border-white/[0.06] bg-white/[0.03]"
                    }`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">Pre-flight</p>
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold ${
                          currentCase?.preflight?.extinto
                            ? "border-red-500/35 bg-red-500/[0.1] text-red-400"
                            : "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-400"
                        }`}>
                          {currentCase?.preflight?.extinto
                            ? <><XCircle size={10} /> EXTINTO</>
                            : <><CheckCircle2 size={10} /> Aprovado</>}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {currentCase?.preflight?.justificativa || "Sem justificativa."}
                      </p>
                      {currentCase?.preflight?.documentos_obrigatorios_faltantes?.length ? (
                        <ul className="mt-2 space-y-1 text-xs text-amber-400">
                          {currentCase.preflight.documentos_obrigatorios_faltantes.map((doc) => (
                            <li key={doc} className="flex items-center gap-1.5">
                              <AlertTriangle size={10} />
                              Faltante: {doc}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <p className="text-xs text-slate-500">Transparência do modelo (SHAP)</p>
                    {currentCase?.shap_transparencia?.length ? (
                      <div className="mt-3">
                        <ShapChart data={currentCase.shap_transparencia} />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">Sem dados SHAP para este caso.</p>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <p className="text-xs text-slate-500">Resumo gerado pelo agente</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {currentCase?.analise_texto || "Execute o AI Agent para preencher esta análise."}
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <p className="text-xs text-slate-500">Argumentos da análise</p>
                    {currentCase?.argumentos?.length ? (
                      <ul className="mt-2 space-y-2 text-sm text-slate-300">
                        {currentCase.argumentos.map((argumento) => (
                          <li key={argumento} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                            {argumento}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">Sem argumentos ainda.</p>
                    )}
                  </div>
                </>
              )}

              {/* Comentário do advogado + decisão */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Comentário do advogado</p>
                <textarea
                  value={lawyerComment}
                  onChange={(e) => setLawyerComment(e.target.value)}
                  disabled={currentRole !== "advogado"}
                  className="mt-2 min-h-[90px] w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-xs text-white outline-none transition focus:border-amber-500/25 disabled:opacity-50"
                  placeholder="Escreva uma observação para salvar no processo"
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={currentRole !== "advogado" || isSaving || !currentCase?.id}
                    onClick={() => handleLawyerDecision(true)}
                    className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-2.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/[0.14] disabled:opacity-40"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={currentRole !== "advogado" || isSaving || !currentCase?.id}
                    onClick={() => handleLawyerDecision(false)}
                    className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/[0.14] disabled:opacity-40"
                  >
                    Reprovar
                  </button>
                </div>
              </div>

              {currentRole === "adm" && (
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500">Decisão do juiz (preencher depois)</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      type="number"
                      min="0"
                      value={judgeDecisionValue}
                      onChange={(e) => setJudgeDecisionValue(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500/25"
                      placeholder="Ex: 8500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveJudgeDecision}
                      disabled={isSaving || !currentCase?.id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                    >
                      Salvar decisão
                    </button>
                  </div>
                  <div className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                    hasJudgeDecision(currentCase)
                      ? "border-white/[0.10] bg-white/[0.04] text-white"
                      : "border-white/[0.06] bg-white/[0.03] text-slate-500"
                  }`}>
                    {hasJudgeDecision(currentCase) ? (
                      <><CheckCircle2 size={14} className="text-emerald-400" /> Decisão registrada: {formatCurrency(currentCase?.valor_decisao_juiz)}</>
                    ) : (
                      <><Clock3 size={14} /> Aguardando decisão do juiz</>
                    )}
                  </div>
                </div>
              )}

              {/* Status row */}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="text-slate-500">Status da análise</p>
                  <div className="mt-1.5"><StatusBadge item={currentCase || {}} /></div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="text-slate-500">Criação</p>
                  <p className="mt-1">{formatDate(currentCase?.data_criacao)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-300">
                  <p className="text-slate-500">Última análise</p>
                  <p className="mt-1">{formatDate(currentCase?.data_analise)}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Quick summary ────────────────────────────────────────── */}
          <SectionCard>
            <Label>Resumo rápido</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Total</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-white">{liveProcesses.length}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">processos</p>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Aguardando</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-amber-400">
                  {liveProcesses.filter((item) => !hasJudgeDecision(item)).length}
                </p>
                <p className="mt-0.5 text-[11px] text-amber-600/60">decisão do juiz</p>
              </div>
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Solucionados</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-white">
                  {liveProcesses.filter((item) => hasJudgeDecision(item)).length}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">decisão registrada</p>
              </div>
            </div>
          </SectionCard>

        </main>
      </div>
    </div>
  );
}
