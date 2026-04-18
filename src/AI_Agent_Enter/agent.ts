import {
  carregarDocumentosDoProcessoComDiagnostico,
  type DocumentoProcessado,
} from "./loadDocuments"
import OpenAI from "openai"
import dotenv from "dotenv"
import { mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
import { calculateSettlementValue } from "./settlementCalculator"

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const reportsDir = path.join(__dirname, "reports")
const defaultPythonBin = path.join(__dirname, "venv", "bin", "python")
const pythonBin = process.env.AGENT_PYTHON_BIN
  ?? (existsSync(defaultPythonBin) ? defaultPythonBin : "python3")
const predictorScript = path.join(__dirname, "predict.py")
const precheckEnabled = process.env.AGENT_ENABLE_PRECHECK === "1"

export type PolicyDecision = "ACORDO" | "DEFESA" | "EXTINTO"

export type AgentAnalysis = {
  analise: string
  sugestao_estrategia: "Acordo" | "Defesa" | "Extinto"
  probabilidade_exito: number
  valor_sugerido_acordo: number
  argumentos_latex: string[]
  identificacao: {
    numero_processo: string
    uf: string
    comarca: string
    valor_causa: number | null
  }
  resumo_fatos: string
  alegacoes_autor: string[]
  documentos_banco: string[]
  pontos_favoraveis_banco: string[]
  pontos_desfavoraveis_banco: string[]
  observacoes_importantes: string
  fatores_juridicos_relevantes: {
    autor_idoso: "sim" | "não" | "incerto"
    autor_aposentado: "sim" | "não" | "incerto"
    pedido_tutela_urgencia: "sim" | "não" | "incerto"
    pedido_dano_moral: "sim" | "não" | "incerto"
    valor_dano_moral: number | null
    pedido_repeticao_indebito: "sim" | "não" | "incerto"
    alegacao_vulnerabilidade: "sim" | "não" | "incerto"
    alegacao_uso_indevido_dados: "sim" | "não" | "incerto"
  }
  analise_preditiva: {
    probabilidade_exito_banco: number
    probabilidade_nao_exito_banco: number
    classificacao_preditiva: string
    confianca_modelo: number
  }
  recomendacao_estrategica: {
    recomendacao: "Acordo" | "Defesa"
    valor_sugerido: number
    faixa_negociacao: {
      minimo: number
      maximo: number
    }
    justificativa_economica: string
    metodo_calculo: string
  }
  decisao_politica: PolicyDecision
  limiar_ativo: number | null
  qualitative_score: number | null
  probabilidades_base: {
    p_improcedencia: number | null
    p_parcial_procedencia: number | null
    p_procedencia: number | null
    p_nao_exito: number | null
  }
  shap_transparencia: Array<{
    feature: string
    valor: number
  }>
  preflight: {
    extinto: boolean
    documentos_obrigatorios_faltantes: string[]
    justificativa: string
  }
}

type CaseStructure = {
  identificacao?: {
    numero_processo?: string
    uf?: string
    comarca?: string
    valor_causa?: number | null
  }
  fatores_relevantes?: {
    autor_idoso?: "sim" | "não" | "incerto" | "nao"
    autor_aposentado?: "sim" | "não" | "incerto" | "nao"
    pedido_tutela_urgencia?: "sim" | "não" | "nao"
    pedido_dano_moral?: "sim" | "não" | "nao"
    valor_dano_moral?: number | null
    pedido_repeticao_indebito?: "sim" | "não" | "nao"
    alegacao_vulnerabilidade?: "sim" | "não" | "nao"
    alegacao_uso_indevido_dados?: "sim" | "não" | "nao"
  }
  resumo_caso?: string
  alegacoes_autor?: string[]
  documentos_banco?: string[]
  pontos_favoraveis_banco?: string[]
  pontos_desfavoraveis_banco?: string[]
  observacoes_importantes?: string
}

type FinalModelOutput = {
  analise?: string
  argumentos_latex?: string[]
  analise_preditiva?: {
    classificacao_preditiva?: string
    confianca_modelo?: number
  }
  recomendacao_estrategica?: {
    justificativa_economica?: string
  }
}

type MlPredictOutput = {
  probabilities: {
    improcedencia: number
    parcial_procedencia: number
    procedencia: number
  }
  p_nao_exito: number
  shap_values: Array<{ feature: string; value: number }>
  model_metadata?: Record<string, unknown>
}

function extractJsonObject(raw: string) {
  const cleaned = raw.trim()
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    return cleaned
  }

  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Resposta do modelo nao retornou JSON valido.")
  }

  return cleaned.slice(firstBrace, lastBrace + 1)
}

function requireContent(content: string | null) {
  if (!content) {
    throw new Error("Resposta vazia do modelo.")
  }
  return content
}

function normalizeSimNaoIncerto(value: unknown): "sim" | "não" | "incerto" {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
  if (normalized === "sim") return "sim"
  if (normalized === "nao" || normalized === "não") return "não"
  return "incerto"
}

function toNonNegativeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, numeric)
}

function toNonNegativeInteger(value: unknown, fallback = 0) {
  return Math.round(toNonNegativeNumber(value, fallback))
}

function toPercentage(value: unknown, fallback = 0) {
  return Math.max(0, Math.min(100, toNonNegativeInteger(value, fallback)))
}

function sanitizeList(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback
  const list = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
  return list.length > 0 ? list : fallback
}

function toTitleStrategy(decision: PolicyDecision): "Acordo" | "Defesa" | "Extinto" {
  if (decision === "ACORDO") return "Acordo"
  if (decision === "DEFESA") return "Defesa"
  return "Extinto"
}

function parseDocumentSections(textoDocumentos: string) {
  const rawParts = textoDocumentos.split("### DOCUMENTO:")
  const sections: Array<{ nome: string; conteudo: string }> = []

  for (const part of rawParts.slice(1)) {
    const lines = part.trim().split(/\r?\n/)
    const nome = String(lines.shift() ?? "sem_nome").trim()
    const conteudo = lines.join("\n").trim()
    sections.push({ nome, conteudo })
  }

  return sections
}

function splitAutosSubsidios(textoDocumentos: string) {
  const sections = parseDocumentSections(textoDocumentos)
  const autosChunks: string[] = []
  const subsidiosChunks: string[] = []

  for (const section of sections) {
    const key = section.nome.toLowerCase()
    const chunk = `DOCUMENTO: ${section.nome}\n${section.conteudo}`

    if (
      key.includes("subsid") ||
      key.includes("defesa") ||
      key.includes("contest") ||
      key.includes("intern")
    ) {
      subsidiosChunks.push(chunk)
      continue
    }

    autosChunks.push(chunk)
  }

  return {
    autos: autosChunks.join("\n\n").trim(),
    subsidios: subsidiosChunks.join("\n\n").trim(),
  }
}

function hasDocByKeywords(
  documentos: DocumentoProcessado[],
  textoDocumentos: string,
  keywords: string[]
) {
  const namesJoined = documentos
    .map((doc) => doc.nome_arquivo.toLowerCase())
    .join(" ")
  const corpus = `${namesJoined} ${textoDocumentos.toLowerCase()}`
  return keywords.some((keyword) => corpus.includes(keyword))
}

function preflightMandatoryDocuments(
  documentos: DocumentoProcessado[],
  textoDocumentos: string
) {
  if (!precheckEnabled) {
    return {
      extinto: false,
      documentos_obrigatorios_faltantes: [],
      justificativa:
        "Pre-flight em modo informativo (AGENT_ENABLE_PRECHECK != 1): política e ML executados normalmente.",
    }
  }

  const missing: string[] = []

  const hasIdentity = hasDocByKeywords(documentos, textoDocumentos, [
    "rg",
    "cpf",
    "cnh",
    "identidade",
    "documento pessoal",
  ])
  if (!hasIdentity) {
    missing.push("RG/CPF/CNH")
  }

  const hasAddress = hasDocByKeywords(documentos, textoDocumentos, [
    "comprovante de residencia",
    "comprovante residência",
    "residencia",
    "residência",
    "proof of address",
  ])
  if (!hasAddress) {
    missing.push("Comprovante de residência")
  }

  const hasPowerOfAttorney = hasDocByKeywords(documentos, textoDocumentos, [
    "procuracao",
    "procuração",
    "instrumento de mandato",
    "power of attorney",
  ])
  if (!hasPowerOfAttorney) {
    missing.push("Procuração")
  }

  return {
    extinto: missing.length > 0,
    documentos_obrigatorios_faltantes: missing,
    justificativa:
      missing.length > 0
        ? `Extinto por ausência de documentos obrigatórios: ${missing.join(", ")}.`
        : "Pre-flight concluído: documentação obrigatória mínima presente.",
  }
}

async function extrairEstruturaRica(textoDocumentos: string) {
  const prompt = `
Você é um agente jurídico especialista em organizar documentação de processos cíveis de transação não reconhecida.

Sua tarefa é analisar os documentos abaixo e retornar APENAS um JSON válido com a seguinte estrutura:

{
  "identificacao": {
    "numero_processo": "",
    "uf": "",
    "comarca": "",
    "valor_causa": null
  },

  "fatores_relevantes": {
    "autor_idoso": "sim/não/incerto",
    "autor_aposentado": "sim/não/incerto",
    "pedido_tutela_urgencia": "sim/não",
    "pedido_dano_moral": "sim/não",
    "valor_dano_moral": null,
    "pedido_repeticao_indebito": "sim/não",
    "alegacao_vulnerabilidade": "sim/não",
    "alegacao_uso_indevido_dados": "sim/não"
  },

  "resumo_caso": "",
  "alegacoes_autor": [],
  "documentos_banco": [],
  "pontos_favoraveis_banco": [],
  "pontos_desfavoraveis_banco": [],
  "observacoes_importantes": ""
}

Regras:
- Não invente informação.
- Se algo não estiver claro, use null, lista vazia ou "incerto".
- Retorne apenas JSON válido.
- "resumo_caso" deve ser um parágrafo curto e objetivo.
- "alegacoes_autor" deve listar os principais argumentos do autor.
- "documentos_banco" deve listar os principais documentos/evidências do banco.
- "pontos_favoraveis_banco" e "pontos_desfavoraveis_banco" devem ser objetivos.
- "observacoes_importantes" deve destacar nuances sensíveis do caso.

Documentos:
${textoDocumentos}
`.trim()

  const resposta = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: "Você organiza documentos jurídicos em JSON estruturado.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  })

  const content = requireContent(resposta.choices[0].message.content)
  const jsonText = extractJsonObject(content)
  return JSON.parse(jsonText) as CaseStructure
}

async function gerarAnaliseNarrativa(estrutura: CaseStructure) {
  const resposta = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `Voce e um assistente juridico do banco.
Com base no JSON estruturado do caso, responda EXCLUSIVAMENTE em JSON valido, sem markdown, sem comentarios e sem texto adicional.
Formato esperado:
{
  "analise": "resumo objetivo em portugues",
  "argumentos_latex": ["argumento 1", "argumento 2", "argumento 3"],
  "analise_preditiva": {
    "classificacao_preditiva": "texto curto",
    "confianca_modelo": numero inteiro de 0 a 100
  },
  "recomendacao_estrategica": {
    "justificativa_economica": "texto objetivo"
  }
}
Regras:
- "argumentos_latex" deve ter entre 2 e 5 itens objetivos.
- Se houver incerteza relevante, mencione no campo "analise".`,
      },
      {
        role: "user",
        content: JSON.stringify(estrutura),
      },
    ],
  })

  const content = requireContent(resposta.choices[0].message.content)
  const jsonText = extractJsonObject(content)
  return JSON.parse(jsonText) as FinalModelOutput
}

async function runMlPredictor(payload: {
  identificacao: CaseStructure["identificacao"]
  resumo_caso: string
  alegacoes_autor: string[]
  observacoes_importantes: string
}) {
  const input = JSON.stringify(payload)

  return await new Promise<MlPredictOutput>((resolve, reject) => {
    const proc = spawn(pythonBin, [predictorScript], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })

    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    proc.on("error", (error) => {
      reject(new Error(`Falha ao iniciar bridge Python: ${error.message}`))
    })

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Bridge Python retornou código ${code}. stderr: ${stderr.slice(0, 1200)}`))
        return
      }

      try {
        const parsed = JSON.parse(stdout.trim()) as MlPredictOutput
        resolve(parsed)
      } catch (error) {
        reject(new Error(`Saída inválida do bridge Python: ${(error as Error).message}. stdout: ${stdout.slice(0, 1200)}`))
      }
    })

    proc.stdin.write(input)
    proc.stdin.end()
  })
}

async function runQualitativeSubAgent(textoDocumentos: string) {
  const { autos, subsidios } = splitAutosSubsidios(textoDocumentos)

  const resposta = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `Você é um subagente qualitativo jurídico.
Avalie nuances agravantes/atenuantes e retorne SOMENTE JSON:
{
  "qualitative_score": numero entre 0.0 e 1.0,
  "justificativa": "texto curto"
}
Sem markdown.`,
      },
      {
        role: "user",
        content: `AUTOS:\n${autos || "(vazio)"}\n\nSUBSIDIOS:\n${subsidios || "(vazio)"}`,
      },
    ],
  })

  const content = requireContent(resposta.choices[0].message.content)
  const jsonText = extractJsonObject(content)
  const parsed = JSON.parse(jsonText) as {
    qualitative_score?: number
    justificativa?: string
  }

  return {
    qualitative_score: Math.max(0, Math.min(1, Number(parsed.qualitative_score ?? 0.5))),
    justificativa: String(parsed.justificativa ?? "Sem justificativa qualitativa adicional.").trim(),
  }
}

function calculatePolicyDecision(params: {
  pNaoExito: number
  qualitativeScore: number
}) {
  const limiarAtivo = 0.30 + params.qualitativeScore * (0.60 - 0.30)
  const decision: Exclude<PolicyDecision, "EXTINTO"> =
    params.pNaoExito > limiarAtivo ? "ACORDO" : "DEFESA"

  return {
    limiarAtivo,
    decision,
  }
}

function inferSubAssuntoEncoded(estrutura: CaseStructure) {
  const corpus = [
    estrutura.resumo_caso ?? "",
    ...(estrutura.alegacoes_autor ?? []),
    estrutura.observacoes_importantes ?? "",
  ]
    .join(" ")
    .toLowerCase()

  const keywords = [
    "fraude",
    "golpe",
    "terceiro",
    "uso indevido",
    "dados pessoais",
    "conta de terceiro",
  ]
  return keywords.some((k) => corpus.includes(k)) ? 1 : 0
}

function inferDocFlag(items: string[] | undefined, keywords: string[]) {
  const txt = (items ?? []).join(" ").toLowerCase()
  return keywords.some((k) => txt.includes(k)) ? 1 : 0
}

function fallbackCaseStructure(processoId: string, texto: string): CaseStructure {
  const ufMatch = texto.match(/\b(AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RS|SC|SE|SP|TO)\b/i)
  const valorMatch = texto.match(/valor da causa[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i)
  const valor = valorMatch ? Number(String(valorMatch[1]).replace(",", ".")) : null

  return {
    identificacao: {
      numero_processo: processoId,
      uf: ufMatch ? ufMatch[1].toUpperCase() : "incerto",
      comarca: "incerta",
      valor_causa: Number.isFinite(valor as number) ? valor : null,
    },
    fatores_relevantes: {
      autor_idoso: "incerto",
      autor_aposentado: "incerto",
      pedido_tutela_urgencia: "não",
      pedido_dano_moral: "não",
      valor_dano_moral: null,
      pedido_repeticao_indebito: "não",
      alegacao_vulnerabilidade: "não",
      alegacao_uso_indevido_dados: "não",
    },
    resumo_caso: "Estrutura extraída por fallback técnico. Revise os documentos manualmente.",
    alegacoes_autor: [],
    documentos_banco: [],
    pontos_favoraveis_banco: [],
    pontos_desfavoraveis_banco: [],
    observacoes_importantes: "",
  }
}

function defaultMlOutput(): MlPredictOutput {
  return {
    probabilities: {
      improcedencia: 0.5,
      parcial_procedencia: 0.25,
      procedencia: 0.25,
    },
    p_nao_exito: 0.5,
    shap_values: [
      { feature: "fallback_ml", value: 0 },
    ],
    model_metadata: {
      source: "fallback",
    },
  }
}

async function salvarDebugAnalise(
  processoId: string,
  payload: Record<string, unknown>
) {
  if (process.env.AGENT_DEBUG_LOG !== "1") {
    return
  }

  const debugPath = path.join(reportsDir, processoId, "analise-debug.json")
  await mkdir(path.dirname(debugPath), { recursive: true })
  await writeFile(debugPath, JSON.stringify(payload, null, 2), "utf-8")
}

export async function analisarProcesso(processoId: string) {
  const { texto, debugPath, documentos } = await carregarDocumentosDoProcessoComDiagnostico(processoId)
  let estrutura: CaseStructure
  try {
    estrutura = await extrairEstruturaRica(texto)
  } catch {
    estrutura = fallbackCaseStructure(processoId, texto)
  }

  let narrativa: FinalModelOutput
  try {
    narrativa = await gerarAnaliseNarrativa(estrutura)
  } catch {
    narrativa = {
      analise: "Análise narrativa em fallback técnico.",
      argumentos_latex: ["Narração gerada em modo fallback."],
      analise_preditiva: {
        classificacao_preditiva: "Fallback técnico",
        confianca_modelo: 50,
      },
      recomendacao_estrategica: {
        justificativa_economica: "Subagente narrativo indisponível; justificativa padrão aplicada.",
      },
    }
  }
  const preflight = preflightMandatoryDocuments(documentos, texto)

  const identificacao = {
    numero_processo: String(estrutura.identificacao?.numero_processo ?? "").trim() || processoId,
    uf: String(estrutura.identificacao?.uf ?? "").trim() || "incerto",
    comarca: String(estrutura.identificacao?.comarca ?? "").trim() || "incerta",
    valor_causa:
      estrutura.identificacao?.valor_causa == null
        ? null
        : toNonNegativeInteger(estrutura.identificacao.valor_causa, 0),
  }

  const fatores = {
    autor_idoso: normalizeSimNaoIncerto(estrutura.fatores_relevantes?.autor_idoso),
    autor_aposentado: normalizeSimNaoIncerto(estrutura.fatores_relevantes?.autor_aposentado),
    pedido_tutela_urgencia: normalizeSimNaoIncerto(
      estrutura.fatores_relevantes?.pedido_tutela_urgencia
    ),
    pedido_dano_moral: normalizeSimNaoIncerto(estrutura.fatores_relevantes?.pedido_dano_moral),
    valor_dano_moral:
      estrutura.fatores_relevantes?.valor_dano_moral == null
        ? null
        : toNonNegativeInteger(estrutura.fatores_relevantes.valor_dano_moral, 0),
    pedido_repeticao_indebito: normalizeSimNaoIncerto(
      estrutura.fatores_relevantes?.pedido_repeticao_indebito
    ),
    alegacao_vulnerabilidade: normalizeSimNaoIncerto(
      estrutura.fatores_relevantes?.alegacao_vulnerabilidade
    ),
    alegacao_uso_indevido_dados: normalizeSimNaoIncerto(
      estrutura.fatores_relevantes?.alegacao_uso_indevido_dados
    ),
  }

  let decisaoPolitica: PolicyDecision = "EXTINTO"
  let limiarAtivo: number | null = 0.3
  let qualitativeScore: number | null = 0
  let pImprocedencia: number | null = 0
  let pParcialProcedencia: number | null = 0
  let pProcedencia: number | null = 0
  let pNaoExito: number | null = 0
  let valorSugeridoAcordo = 0
  let shapTransparencia: Array<{ feature: string; valor: number }> = []
  let justificativaEconomicaExtra = ""
  let policyWarnings: string[] = []

  if (!preflight.extinto) {
    let ml: MlPredictOutput = defaultMlOutput()
    try {
      ml = await runMlPredictor({
        identificacao: estrutura.identificacao,
        resumo_caso: String(estrutura.resumo_caso ?? ""),
        alegacoes_autor: sanitizeList(estrutura.alegacoes_autor),
        observacoes_importantes: String(estrutura.observacoes_importantes ?? ""),
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : "falha desconhecida no bridge ML"
      policyWarnings.push(`ML fallback acionado: ${msg}`)
    }

    pImprocedencia = toNonNegativeNumber(ml.probabilities.improcedencia, 0)
    pParcialProcedencia = toNonNegativeNumber(ml.probabilities.parcial_procedencia, 0)
    pProcedencia = toNonNegativeNumber(ml.probabilities.procedencia, 0)
    pNaoExito = toNonNegativeNumber(
      ml.p_nao_exito,
      pParcialProcedencia + pProcedencia
    )

    try {
      const qualitative = await runQualitativeSubAgent(texto)
      qualitativeScore = qualitative.qualitative_score
      justificativaEconomicaExtra = qualitative.justificativa
    } catch (error) {
      const msg = error instanceof Error ? error.message : "falha desconhecida no subagente qualitativo"
      policyWarnings.push(`Qualitative fallback acionado: ${msg}`)
      qualitativeScore = 0.5
      justificativaEconomicaExtra = "Subagente qualitativo indisponível; score neutro aplicado (0.5)."
    }

    const policy = calculatePolicyDecision({
      pNaoExito: pNaoExito ?? 0.5,
      qualitativeScore: qualitativeScore ?? 0.5,
    })

    limiarAtivo = policy.limiarAtivo
    decisaoPolitica = policy.decision

    const valorCausa = toNonNegativeNumber(identificacao.valor_causa, 0)
    if (decisaoPolitica === "ACORDO" && valorCausa > 0) {
      valorSugeridoAcordo = calculateSettlementValue({
        valor_causa: valorCausa,
        uf: identificacao.uf,
        sub_assunto_encoded: inferSubAssuntoEncoded(estrutura) as 0 | 1,
        contrato: inferDocFlag(estrutura.documentos_banco, ["contrato"]) as 0 | 1,
        comprovante_credito: inferDocFlag(estrutura.documentos_banco, ["comprovante de credito", "comprovante crédito", "bacen"]) as 0 | 1,
        demonstrativo_divida: inferDocFlag(estrutura.documentos_banco, ["demonstrativo", "divida", "dívida"]) as 0 | 1,
        dossie: inferDocFlag(estrutura.documentos_banco, ["dossie", "dossiê"]) as 0 | 1,
        extrato: inferDocFlag(estrutura.documentos_banco, ["extrato"]) as 0 | 1,
        laudo_referenciado: inferDocFlag(estrutura.documentos_banco, ["laudo referenciado", "laudo"]) as 0 | 1,
      })
    }

    shapTransparencia = Array.isArray(ml.shap_values)
      ? ml.shap_values.map((item) => ({
          feature: String(item.feature ?? "feature"),
          valor: Number(item.value ?? 0),
        }))
      : []
    if (shapTransparencia.length === 0) {
      shapTransparencia = [{ feature: "fallback_ml", valor: 0 }]
    }
  } else {
    shapTransparencia = [
      {
        feature: "preflight",
        valor: 0,
      },
    ]
  }

  const sugestaoEstrategia = toTitleStrategy(decisaoPolitica)

  const normalizedProbExitoBanco =
    decisaoPolitica === "EXTINTO"
      ? 0
      : toPercentage((pImprocedencia ?? 0) * 100, 50)

  const normalizedProbNaoExitoBanco =
    decisaoPolitica === "EXTINTO"
      ? 0
      : toPercentage((pNaoExito ?? 0) * 100, 50)

  const confiancaModelo =
    decisaoPolitica === "EXTINTO"
      ? 0
      : toPercentage(narrativa.analise_preditiva?.confianca_modelo, 70)

  const argumentos = sanitizeList(narrativa.argumentos_latex, [
    "Nao foi possivel extrair argumentos estruturados para este caso.",
  ]).slice(0, 5)

  const analiseTexto = preflight.extinto
    ? `${preflight.justificativa} Caso encerrado no pre-flight sem acionar Policy Sub-Agent nem modelo preditivo.`
    : `${String(narrativa.analise ?? "").trim() || "Analise indisponivel."}${policyWarnings.length ? ` Avisos: ${policyWarnings.join(" | ")}` : ""}`

  const resultado: AgentAnalysis = {
    analise: analiseTexto,
    sugestao_estrategia: sugestaoEstrategia,
    probabilidade_exito: normalizedProbExitoBanco,
    valor_sugerido_acordo: sugestaoEstrategia === "Acordo" ? valorSugeridoAcordo : 0,
    argumentos_latex: argumentos,
    identificacao,
    resumo_fatos: String(estrutura.resumo_caso ?? "").trim() || "Resumo indisponivel.",
    alegacoes_autor: sanitizeList(estrutura.alegacoes_autor),
    documentos_banco: sanitizeList(estrutura.documentos_banco),
    pontos_favoraveis_banco: sanitizeList(estrutura.pontos_favoraveis_banco),
    pontos_desfavoraveis_banco: sanitizeList(estrutura.pontos_desfavoraveis_banco),
    observacoes_importantes:
      String(estrutura.observacoes_importantes ?? "").trim() || "Sem observacoes adicionais.",
    fatores_juridicos_relevantes: fatores,
    analise_preditiva: {
      probabilidade_exito_banco: normalizedProbExitoBanco,
      probabilidade_nao_exito_banco: normalizedProbNaoExitoBanco,
      classificacao_preditiva:
        preflight.extinto
          ? "Extinto no pre-flight"
          : String(narrativa.analise_preditiva?.classificacao_preditiva ?? "").trim() ||
            (normalizedProbExitoBanco >= 60
              ? "Favoravel ao banco"
              : "Risco relevante para o banco"),
      confianca_modelo: confiancaModelo,
    },
    recomendacao_estrategica: {
      recomendacao: sugestaoEstrategia === "Acordo" ? "Acordo" : "Defesa",
      valor_sugerido: sugestaoEstrategia === "Acordo" ? valorSugeridoAcordo : 0,
      faixa_negociacao: {
        minimo: sugestaoEstrategia === "Acordo" ? Math.round(valorSugeridoAcordo * 0.9) : 0,
        maximo: sugestaoEstrategia === "Acordo" ? Math.round(valorSugeridoAcordo * 1.1) : 0,
      },
      justificativa_economica:
        preflight.extinto
          ? preflight.justificativa
          : String(narrativa.recomendacao_estrategica?.justificativa_economica ?? "").trim() ||
            justificativaEconomicaExtra ||
            "Recomendacao baseada em política dinâmica de risco jurídico.",
      metodo_calculo:
        sugestaoEstrategia === "Acordo"
          ? "Regressao linear com coeficientes por UF e documentos (guardrails de 10% minimo e 60% maximo)."
          : "Nao aplicavel (estrategia DEFESA/EXTINTO).",
    },
    decisao_politica: decisaoPolitica,
    limiar_ativo: limiarAtivo,
    qualitative_score: qualitativeScore,
    probabilidades_base: {
      p_improcedencia: pImprocedencia,
      p_parcial_procedencia: pParcialProcedencia,
      p_procedencia: pProcedencia,
      p_nao_exito: pNaoExito,
    },
    shap_transparencia: shapTransparencia,
    preflight,
  }

  await salvarDebugAnalise(processoId, {
    input_characters: texto.length,
    documentos_debug_path: debugPath,
    documentos_processados: documentos,
    estrutura_extraida: estrutura,
    narrativa_llm: narrativa,
    resultado_final: resultado,
  })

  return resultado
}
