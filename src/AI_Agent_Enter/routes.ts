import express from "express"
import { analisarProcesso, type AgentAnalysis } from "./agent"
import { supabaseAdmin } from "./supabaseAdmin"
import { mkdir, access, writeFile } from "node:fs/promises"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const reportsDir = path.join(__dirname, "reports")
const latexCompileBaseUrl = process.env.LATEX_COMPILE_API_URL ?? "https://latexonline.cc"
const reportsBucket = process.env.AGENT_REPORTS_BUCKET ?? "documentos_processuais"

type ExternalPdfResult = {
  storagePath: string
  signedUrl: string
}

function escapeLatex(value: unknown) {
  const text = String(value ?? "")
  return text
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("&", "\\&")
    .replaceAll("%", "\\%")
    .replaceAll("$", "\\$")
    .replaceAll("#", "\\#")
    .replaceAll("_", "\\_")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("~", "\\textasciitilde{}")
    .replaceAll("^", "\\textasciicircum{}")
}

function renderLatexList(items: string[], emptyMessage: string) {
  if (!items || items.length === 0) {
    return `\\begin{itemize}\n\\item ${escapeLatex(emptyMessage)}\n\\end{itemize}`
  }

  const content = items.map((item) => `\\item ${escapeLatex(item)}`).join("\n")
  return `\\begin{itemize}\n${content}\n\\end{itemize}`
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "N/A"
  }
  return `R\\$ ${escapeLatex(Math.round(value))}`
}

function buildLatexReport(processoId: string, result: AgentAnalysis) {
  const identificacao = result.identificacao
  const templateVersion = "v2-completo"
  const shapItems = result.shap_transparencia
    .slice(0, 8)
    .map((item) => `\\item ${escapeLatex(item.feature)}: ${escapeLatex(item.valor.toFixed(4))}`)
    .join("\\n")
  const limiarText =
    result.limiar_ativo == null ? "N/A" : escapeLatex(result.limiar_ativo.toFixed(4))
  const pImprocedencia =
    result.probabilidades_base.p_improcedencia == null
      ? "N/A"
      : escapeLatex((result.probabilidades_base.p_improcedencia * 100).toFixed(2))
  const pParcial =
    result.probabilidades_base.p_parcial_procedencia == null
      ? "N/A"
      : escapeLatex((result.probabilidades_base.p_parcial_procedencia * 100).toFixed(2))
  const pProcedencia =
    result.probabilidades_base.p_procedencia == null
      ? "N/A"
      : escapeLatex((result.probabilidades_base.p_procedencia * 100).toFixed(2))
  const pNaoExito =
    result.probabilidades_base.p_nao_exito == null
      ? "N/A"
      : escapeLatex((result.probabilidades_base.p_nao_exito * 100).toFixed(2))
  const qualitativeScore =
    result.qualitative_score == null
      ? "N/A"
      : escapeLatex(result.qualitative_score.toFixed(4))

  return `
% template_version: ${templateVersion}
\\documentclass[12pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[brazil]{babel}
\\usepackage{lmodern}
\\usepackage{geometry}
\\usepackage{enumitem}
\\geometry{margin=2.5cm}
\\title{Relatório de Análise Jurídica}
\\author{Sistema de IA}
\\date{}
\\begin{document}
\\maketitle
\\section*{Identificação do caso}
\\textbf{Número do processo:} ${escapeLatex(identificacao.numero_processo || processoId)} \\\\
\\textbf{UF:} ${escapeLatex(identificacao.uf)} \\\\
\\textbf{Comarca:} ${escapeLatex(identificacao.comarca)} \\\\
\\textbf{Valor da causa:} ${formatCurrency(identificacao.valor_causa)}

\\section*{Resumo dos fatos}
${escapeLatex(result.resumo_fatos)}

\\section*{Alegações da parte autora}
${renderLatexList(result.alegacoes_autor, "Sem alegacoes registradas.")}

\\section*{Documentos e evidências apresentadas pelo banco}
${renderLatexList(result.documentos_banco, "Sem documentos bancarios destacados.")}

\\section*{Pontos críticos do caso}
\\subsection*{Pontos favoráveis ao banco}
${renderLatexList(result.pontos_favoraveis_banco, "Sem pontos favoraveis mapeados.")}

\\subsection*{Pontos desfavoráveis ao banco}
${renderLatexList(result.pontos_desfavoraveis_banco, "Sem pontos desfavoraveis mapeados.")}

\\subsection*{Observações importantes}
${escapeLatex(result.observacoes_importantes)}

\\section*{Fatores jurídicos relevantes}
% preenchido pelo master agent
Autor pessoa idosa: ${escapeLatex(result.fatores_juridicos_relevantes.autor_idoso)} \\\\
Autor aposentado/pensionista: ${escapeLatex(result.fatores_juridicos_relevantes.autor_aposentado)} \\\\
Pedido de tutela de urgência: ${escapeLatex(result.fatores_juridicos_relevantes.pedido_tutela_urgencia)} \\\\
Pedido de dano moral: ${escapeLatex(result.fatores_juridicos_relevantes.pedido_dano_moral)} \\\\
Valor do dano moral: ${formatCurrency(result.fatores_juridicos_relevantes.valor_dano_moral)} \\\\
Pedido de repetição de indébito: ${escapeLatex(result.fatores_juridicos_relevantes.pedido_repeticao_indebito)} \\\\
Alegação de vulnerabilidade econômica: ${escapeLatex(result.fatores_juridicos_relevantes.alegacao_vulnerabilidade)} \\\\
Uso indevido de dados: ${escapeLatex(result.fatores_juridicos_relevantes.alegacao_uso_indevido_dados)}

\\section*{Análise preditiva}
Probabilidade de êxito do banco: ${escapeLatex(result.analise_preditiva.probabilidade_exito_banco)}\\% \\\\
Probabilidade de não êxito do banco: ${escapeLatex(result.analise_preditiva.probabilidade_nao_exito_banco)}\\% \\\\
Classificação preditiva: ${escapeLatex(result.analise_preditiva.classificacao_preditiva)} \\\\
Confiança do modelo: ${escapeLatex(result.analise_preditiva.confianca_modelo)}\\% \\\\
P(Improcedência): ${pImprocedencia}\\% \\\\
P(Parcial procedência): ${pParcial}\\% \\\\
P(Procedência): ${pProcedencia}\\% \\\\
P(Não êxito): ${pNaoExito}\\% \\\\
Qualitative score (S\\_LLM): ${qualitativeScore} \\\\
Limiar dinâmico ativo: ${limiarText} \\\\
Decisão da política: ${escapeLatex(result.decisao_politica)}

\\section*{Recomendação estratégica}
Recomendação: ${escapeLatex(result.recomendacao_estrategica.recomendacao)} \\\\
Valor sugerido: ${formatCurrency(result.recomendacao_estrategica.valor_sugerido)} \\\\
Faixa de negociação: ${formatCurrency(result.recomendacao_estrategica.faixa_negociacao.minimo)} a ${formatCurrency(result.recomendacao_estrategica.faixa_negociacao.maximo)} \\\\
Justificativa econômica: ${escapeLatex(result.recomendacao_estrategica.justificativa_economica)}

\\section*{Transparência do modelo (SHAP)}
\\begin{itemize}
${shapItems || "\\\\item SHAP indisponível para este caso."}
\\end{itemize}
\\end{document}
`.trimStart()
}

async function generateReportFiles(processoId: string, result: AgentAnalysis) {
  const processDir = path.join(reportsDir, processoId)
  const texPath = path.join(processDir, "relatorio.tex")
  const pdfPath = path.join(processDir, "relatorio.pdf")
  const latex = buildLatexReport(processoId, result)

  await mkdir(processDir, { recursive: true })
  await writeFile(texPath, latex, "utf-8")

  let pdfAvailable = false
  let pdfError: string | null = null

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "pdflatex",
        [
          "-interaction=nonstopmode",
          "-halt-on-error",
          "-output-directory",
          processDir,
          texPath,
        ],
        { stdio: "ignore" }
      )
      proc.on("error", reject)
      proc.on("close", (code) => {
        if (code === 0) {
          resolve()
          return
        }
        reject(new Error(`pdflatex saiu com código ${code}`))
      })
    })

    await access(pdfPath)
    pdfAvailable = true
  } catch (error) {
    pdfError = error instanceof Error ? error.message : "Falha ao gerar PDF"
  }

  return {
    texPath,
    pdfPath,
    pdfAvailable,
    pdfError,
  }
}

async function compileLatexWithExternalApi(latex: string) {
  const compileUrl = `${latexCompileBaseUrl.replace(/\/+$/, "")}/compile?command=pdflatex&force=true&text=${encodeURIComponent(latex)}`
  const response = await fetch(compileUrl, { method: "GET" })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Compilacao externa falhou (${response.status}): ${errorBody.slice(0, 400)}`)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/pdf")) {
    const body = await response.text()
    throw new Error(`Compilacao externa retornou conteudo inesperado: ${contentType}. Corpo: ${body.slice(0, 400)}`)
  }

  const bytes = await response.arrayBuffer()
  return Buffer.from(bytes)
}

async function uploadPdfAndCreateSignedUrl(processoId: string, pdfBuffer: Buffer): Promise<ExternalPdfResult> {
  const storagePath = `processos/${processoId}/relatorios/relatorio.pdf`

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from(reportsBucket)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data: signedData, error: signedError } = await supabaseAdmin
    .storage
    .from(reportsBucket)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)

  if (signedError || !signedData?.signedUrl) {
    throw signedError ?? new Error("Nao foi possivel criar URL assinada do PDF.")
  }

  return {
    storagePath,
    signedUrl: signedData.signedUrl,
  }
}

async function compileAndStorePdfFromLatex(processoId: string, latex: string) {
  const pdfBuffer = await compileLatexWithExternalApi(latex)
  return uploadPdfAndCreateSignedUrl(processoId, pdfBuffer)
}

router.post("/analisar/:processoId", async (req, res) => {
  try {
    const { processoId } = req.params

    const resultado = await analisarProcesso(processoId)
    const report = await generateReportFiles(processoId, resultado)
    const reportBaseUrl = `${req.protocol}://${req.get("host")}/agent/relatorio/${processoId}`
    const enrichedResult = {
      ...resultado,
      relatorio_tex_url: `${reportBaseUrl}/tex`,
      relatorio_pdf_url: null,
      debug_documentos_url: `${reportBaseUrl}/debug/documentos`,
      debug_analise_url: `${reportBaseUrl}/debug/analise`,
      relatorio_pdf_disponivel: false,
      relatorio_pdf_erro: null,
      relatorio_tex_path: report.texPath,
      relatorio_pdf_path: report.pdfPath,
      relatorio_pdf_storage_bucket: null,
      relatorio_pdf_storage_path: null,
      relatorio_pdf_signed_url: null,
      debug_documentos_path: path.join(path.dirname(report.texPath), "documentos-debug.json"),
      debug_analise_path: path.join(path.dirname(report.texPath), "analise-debug.json"),
    }

    const { error: analysisError } = await supabaseAdmin
      .from("analises_agentes")
      .upsert(
        {
          processo_id: processoId,
          resultado_agentes: enrichedResult
        },
        { onConflict: "processo_id" }
      )

    if (analysisError) throw analysisError

    const { error: processError } = await supabaseAdmin
      .from("processos")
      .update({
        status: "analise_advogado",
      })
      .eq("id", processoId)

    if (processError) throw processError

    res.json({
      sucesso: true,
      processoId,
      resultado: enrichedResult
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      sucesso: false,
      erro: "Falha ao analisar processo"
    })
  }
})

router.post("/compile-latex", async (req, res) => {
  try {
    const processoId = String(req.body?.processoId ?? "").trim()
    const latexFromBody = typeof req.body?.latex === "string" ? req.body.latex : ""

    if (!processoId) {
      res.status(400).json({ sucesso: false, erro: "processoId é obrigatório." })
      return
    }

    const texPath = path.join(reportsDir, processoId, "relatorio.tex")
    const latex = latexFromBody || await readFile(texPath, "utf-8")
    const compiled = await compileAndStorePdfFromLatex(processoId, latex)

    const { data: currentAnalysis, error: readError } = await supabaseAdmin
      .from("analises_agentes")
      .select("resultado_agentes")
      .eq("processo_id", processoId)
      .single()

    if (readError) {
      throw readError
    }

    const mergedResult = {
      ...(currentAnalysis?.resultado_agentes ?? {}),
      relatorio_pdf_disponivel: true,
      relatorio_pdf_erro: null,
      relatorio_pdf_storage_bucket: reportsBucket,
      relatorio_pdf_storage_path: compiled.storagePath,
      relatorio_pdf_signed_url: compiled.signedUrl,
    }

    const { error: updateError } = await supabaseAdmin
      .from("analises_agentes")
      .update({ resultado_agentes: mergedResult })
      .eq("processo_id", processoId)

    if (updateError) {
      throw updateError
    }

    res.json({
      sucesso: true,
      processoId,
      relatorio_pdf_storage_bucket: reportsBucket,
      relatorio_pdf_storage_path: compiled.storagePath,
      relatorio_pdf_signed_url: compiled.signedUrl,
      relatorio_pdf_url: `${req.protocol}://${req.get("host")}/agent/relatorio/${processoId}/pdf`,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      sucesso: false,
      erro: "Falha ao compilar LaTeX em API externa.",
    })
  }
})

router.get("/relatorio/:processoId/tex", async (req, res) => {
  try {
    const { processoId } = req.params
    const { data, error } = await supabaseAdmin
      .from("analises_agentes")
      .select("resultado_agentes")
      .eq("processo_id", processoId)
      .single()

    if (error || !data?.resultado_agentes?.relatorio_tex_path) {
      res.status(404).json({ sucesso: false, erro: "Relatorio TEX nao encontrado." })
      return
    }

    res.download(data.resultado_agentes.relatorio_tex_path, `relatorio-${processoId}.tex`)
  } catch (err) {
    console.error(err)
    res.status(500).json({ sucesso: false, erro: "Falha ao baixar TEX." })
  }
})

router.get("/relatorio/:processoId/pdf", async (req, res) => {
  try {
    const { processoId } = req.params
    const { data, error } = await supabaseAdmin
      .from("analises_agentes")
      .select("resultado_agentes")
      .eq("processo_id", processoId)
      .single()

    const storageBucket = data?.resultado_agentes?.relatorio_pdf_storage_bucket
    const storagePath = data?.resultado_agentes?.relatorio_pdf_storage_path

    if (!error && storageBucket && storagePath) {
      const { data: signedData, error: signedError } = await supabaseAdmin
        .storage
        .from(storageBucket)
        .createSignedUrl(storagePath, 60 * 10)

      if (!signedError && signedData?.signedUrl) {
        res.redirect(signedData.signedUrl)
        return
      }
    }

    if (error || !data?.resultado_agentes?.relatorio_pdf_path) {
      res.status(404).json({ sucesso: false, erro: "Relatorio PDF nao encontrado." })
      return
    }

    await access(data.resultado_agentes.relatorio_pdf_path)
    res.download(data.resultado_agentes.relatorio_pdf_path, `relatorio-${processoId}.pdf`)
  } catch (err) {
    console.error(err)
    res.status(404).json({ sucesso: false, erro: "PDF ainda nao disponivel para este processo." })
  }
})

router.get("/relatorio/:processoId/debug/documentos", async (req, res) => {
  try {
    const { processoId } = req.params
    const { data, error } = await supabaseAdmin
      .from("analises_agentes")
      .select("resultado_agentes")
      .eq("processo_id", processoId)
      .single()

    if (error || !data?.resultado_agentes?.debug_documentos_path) {
      res.status(404).json({ sucesso: false, erro: "Debug de documentos nao encontrado." })
      return
    }

    await access(data.resultado_agentes.debug_documentos_path)
    res.download(data.resultado_agentes.debug_documentos_path, `debug-documentos-${processoId}.json`)
  } catch (err) {
    console.error(err)
    res.status(404).json({ sucesso: false, erro: "Debug de documentos indisponivel." })
  }
})

router.get("/relatorio/:processoId/debug/analise", async (req, res) => {
  try {
    const { processoId } = req.params
    const { data, error } = await supabaseAdmin
      .from("analises_agentes")
      .select("resultado_agentes")
      .eq("processo_id", processoId)
      .single()

    if (error || !data?.resultado_agentes?.debug_analise_path) {
      res.status(404).json({ sucesso: false, erro: "Debug da analise nao encontrado." })
      return
    }

    await access(data.resultado_agentes.debug_analise_path)
    res.download(data.resultado_agentes.debug_analise_path, `debug-analise-${processoId}.json`)
  } catch (err) {
    console.error(err)
    res.status(404).json({ sucesso: false, erro: "Debug da analise indisponivel." })
  }
})

export default router
