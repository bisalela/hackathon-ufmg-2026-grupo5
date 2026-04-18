import { carregarDocumentosDoProcessoComDiagnostico } from "./loadDocuments"
import OpenAI from "openai"
import dotenv from "dotenv"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const reportsDir = path.join(__dirname, "reports")

export type AgentAnalysis = {
  analise: string
  sugestao_estrategia: "Acordo" | "Defesa"
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
  sugestao_estrategia?: "Acordo" | "Defesa" | string
  probabilidade_exito?: number
  valor_sugerido_acordo?: number
  argumentos_latex?: string[]
  analise_preditiva?: {
    probabilidade_exito_banco?: number
    probabilidade_nao_exito_banco?: number
    classificacao_preditiva?: string
    confianca_modelo?: number
  }
  recomendacao_estrategica?: {
    recomendacao?: "Acordo" | "Defesa" | string
    valor_sugerido?: number
    faixa_negociacao?: {
      minimo?: number
      maximo?: number
    }
    justificativa_economica?: string
  }
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

function toNonNegativeInteger(value: unknown, fallback = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.round(numeric))
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

async function gerarAnaliseFinal(estrutura: CaseStructure) {
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
  "sugestao_estrategia": "Acordo ou Defesa",
  "probabilidade_exito": numero inteiro de 0 a 100,
  "valor_sugerido_acordo": numero em reais (0 se estrategia for Defesa),
  "argumentos_latex": ["argumento 1", "argumento 2", "argumento 3"],
  "analise_preditiva": {
    "probabilidade_exito_banco": numero inteiro de 0 a 100,
    "probabilidade_nao_exito_banco": numero inteiro de 0 a 100,
    "classificacao_preditiva": "texto curto",
    "confianca_modelo": numero inteiro de 0 a 100
  },
  "recomendacao_estrategica": {
    "recomendacao": "Acordo ou Defesa",
    "valor_sugerido": numero em reais,
    "faixa_negociacao": {
      "minimo": numero em reais,
      "maximo": numero em reais
    },
    "justificativa_economica": "texto objetivo"
  }
}
Regras:
- "sugestao_estrategia" deve ser exatamente "Acordo" ou "Defesa".
- "argumentos_latex" deve ter entre 2 e 5 itens objetivos.
- "probabilidade_exito" representa chance de exito do banco.
- "analise_preditiva.probabilidade_exito_banco" e "probabilidade_nao_exito_banco" devem somar aproximadamente 100.
- "recomendacao_estrategica.recomendacao" deve ser consistente com "sugestao_estrategia".
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

async function salvarDebugAnalise(
  processoId: string,
  payload: {
    input_characters: number
    documentos_debug_path: string
    estrutura_extraida: CaseStructure
    saida_modelo_final: FinalModelOutput
  }
) {
  if (process.env.AGENT_DEBUG_LOG !== "1") {
    return
  }

  const debugPath = path.join(reportsDir, processoId, "analise-debug.json")
  await mkdir(path.dirname(debugPath), { recursive: true })
  await writeFile(debugPath, JSON.stringify(payload, null, 2), "utf-8")
}

export async function analisarProcesso(processoId: string) {
  const { texto, debugPath } = await carregarDocumentosDoProcessoComDiagnostico(processoId)
  const estrutura = await extrairEstruturaRica(texto)
  const parsed = await gerarAnaliseFinal(estrutura)

  await salvarDebugAnalise(processoId, {
    input_characters: texto.length,
    documentos_debug_path: debugPath,
    estrutura_extraida: estrutura,
    saida_modelo_final: parsed,
  })

  const strategy =
    parsed.sugestao_estrategia === "Defesa" ? "Defesa" : "Acordo"

  const normalizedProbability = toPercentage(parsed.probabilidade_exito, 50)
  const normalizedSuggestedAmount = toNonNegativeInteger(parsed.valor_sugerido_acordo, 0)
  const args = sanitizeList(parsed.argumentos_latex, [
    "Nao foi possivel extrair argumentos estruturados para este caso.",
  ]).slice(0, 5)

  const exitoBanco = toPercentage(
    parsed.analise_preditiva?.probabilidade_exito_banco,
    normalizedProbability
  )
  const naoExitoBanco = toPercentage(
    parsed.analise_preditiva?.probabilidade_nao_exito_banco,
    100 - exitoBanco
  )

  const recRaw = parsed.recomendacao_estrategica?.recomendacao
  const recomendacao = recRaw === "Defesa" ? "Defesa" : strategy
  const valorSugerido = toNonNegativeInteger(
    parsed.recomendacao_estrategica?.valor_sugerido,
    strategy === "Acordo" ? normalizedSuggestedAmount : 0
  )
  const faixaMin = toNonNegativeInteger(
    parsed.recomendacao_estrategica?.faixa_negociacao?.minimo,
    Math.round(valorSugerido * 0.85)
  )
  const faixaMax = toNonNegativeInteger(
    parsed.recomendacao_estrategica?.faixa_negociacao?.maximo,
    Math.round(valorSugerido * 1.15)
  )

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

  return {
    analise: String(parsed.analise ?? "").trim() || "Analise indisponivel.",
    sugestao_estrategia: strategy,
    probabilidade_exito: normalizedProbability,
    valor_sugerido_acordo:
      strategy === "Acordo" ? normalizedSuggestedAmount : 0,
    argumentos_latex: args,
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
      probabilidade_exito_banco: exitoBanco,
      probabilidade_nao_exito_banco: naoExitoBanco,
      classificacao_preditiva:
        String(parsed.analise_preditiva?.classificacao_preditiva ?? "").trim() ||
        (exitoBanco >= 60 ? "Favoravel ao banco" : "Risco relevante para o banco"),
      confianca_modelo: toPercentage(parsed.analise_preditiva?.confianca_modelo, 70),
    },
    recomendacao_estrategica: {
      recomendacao,
      valor_sugerido: recomendacao === "Acordo" ? valorSugerido : 0,
      faixa_negociacao: {
        minimo: recomendacao === "Acordo" ? Math.min(faixaMin, faixaMax) : 0,
        maximo: recomendacao === "Acordo" ? Math.max(faixaMin, faixaMax) : 0,
      },
      justificativa_economica:
        String(parsed.recomendacao_estrategica?.justificativa_economica ?? "").trim() ||
        "Recomendacao baseada no balanceamento entre risco juridico, custo processual e exposicao financeira.",
    },
  } satisfies AgentAnalysis
}
