import { createRequire } from "module"
import { supabaseAdmin } from "./supabaseAdmin"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const pdfParse = require("pdf-parse")
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const reportsDir = path.join(__dirname, "reports")

type DocumentoDiagnostico = {
  id: string
  nome_arquivo: string
  caminho_storage: string
  tipo: "pdf" | "csv" | "txt" | "nao_suportado"
  bytes: number | null
  caracteres_extraidos: number
  status: "ok" | "erro" | "ignorado"
  erro?: string
}

export type DiagnosticoDocumentos = {
  processo_id: string
  documentos_encontrados: number
  texto_total_caracteres: number
  documentos: DocumentoDiagnostico[]
}

async function salvarDiagnostico(processoId: string, diagnostico: DiagnosticoDocumentos) {
  const debugPath = path.join(reportsDir, processoId, "documentos-debug.json")
  await mkdir(path.dirname(debugPath), { recursive: true })
  await writeFile(debugPath, JSON.stringify(diagnostico, null, 2), "utf-8")
}

async function downloadFileWithRetry(path: string, retries = 2) {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabaseAdmin
      .storage
      .from("documentos_processuais")
      .download(path)

    if (!error && data) {
      return data
    }

    lastError = error
  }

  throw lastError
}

export async function carregarDocumentosDoProcesso(processoId: string) {
  const debugEnabled = process.env.AGENT_DEBUG_LOG === "1"
  const { data: documentos, error } = await supabaseAdmin
    .from("documentos")
    .select("id, nome_arquivo, caminho_storage")
    .eq("processo_id", processoId)

  if (error) throw error
  if (!documentos || documentos.length === 0) {
    throw new Error("Nenhum documento encontrado para esse processo")
  }

  const documentosOrdenados = [...documentos].sort((a, b) => {
    const nomeA = String(a.nome_arquivo ?? "")
    const nomeB = String(b.nome_arquivo ?? "")
    return nomeA.localeCompare(nomeB, "pt-BR")
  })

  let textoTotal = ""
  const diagnosticoDocumentos: DocumentoDiagnostico[] = []

  for (const doc of documentosOrdenados) {
    const nomeArquivo = String(doc.nome_arquivo ?? "sem_nome")
    const fileName = nomeArquivo.toLowerCase()
    const tipo = fileName.endsWith(".pdf")
      ? "pdf"
      : fileName.endsWith(".csv")
      ? "csv"
      : fileName.endsWith(".txt")
      ? "txt"
      : "nao_suportado"

    try {
      const fileData = await downloadFileWithRetry(doc.caminho_storage)
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const documentHeader = `\n\n### DOCUMENTO: ${nomeArquivo}\n`

      if (fileName.endsWith(".pdf")) {
        const parsed = await pdfParse(buffer)
        const extractedText = String(parsed.text ?? "")
        textoTotal += documentHeader + extractedText + "\n\n"
        diagnosticoDocumentos.push({
          id: String(doc.id),
          nome_arquivo: nomeArquivo,
          caminho_storage: String(doc.caminho_storage),
          tipo,
          bytes: buffer.byteLength,
          caracteres_extraidos: extractedText.length,
          status: "ok",
        })
        continue
      }

      if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        const extractedText = buffer.toString("utf-8")
        textoTotal += documentHeader + extractedText + "\n\n"
        diagnosticoDocumentos.push({
          id: String(doc.id),
          nome_arquivo: nomeArquivo,
          caminho_storage: String(doc.caminho_storage),
          tipo,
          bytes: buffer.byteLength,
          caracteres_extraidos: extractedText.length,
          status: "ok",
        })
        continue
      }

      diagnosticoDocumentos.push({
        id: String(doc.id),
        nome_arquivo: nomeArquivo,
        caminho_storage: String(doc.caminho_storage),
        tipo,
        bytes: buffer.byteLength,
        caracteres_extraidos: 0,
        status: "ignorado",
        erro: "Formato nao suportado para extracao de texto.",
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido na extracao"
      diagnosticoDocumentos.push({
        id: String(doc.id),
        nome_arquivo: nomeArquivo,
        caminho_storage: String(doc.caminho_storage),
        tipo,
        bytes: null,
        caracteres_extraidos: 0,
        status: "erro",
        erro: message,
      })
      console.warn(
        `[agent] falha ao processar documento ${doc.nome_arquivo} (${doc.caminho_storage})`,
        error
      )
    }
  }

  if (debugEnabled) {
    await salvarDiagnostico(processoId, {
      processo_id: processoId,
      documentos_encontrados: documentosOrdenados.length,
      texto_total_caracteres: textoTotal.length,
      documentos: diagnosticoDocumentos,
    })
  }

  if (!textoTotal.trim()) {
    throw new Error("Nao foi possivel extrair texto dos documentos do processo.")
  }

  return textoTotal
}

export async function carregarDocumentosDoProcessoComDiagnostico(processoId: string) {
  const texto = await carregarDocumentosDoProcesso(processoId)
  const debugPath = path.join(reportsDir, processoId, "documentos-debug.json")
  return { texto, debugPath }
}
