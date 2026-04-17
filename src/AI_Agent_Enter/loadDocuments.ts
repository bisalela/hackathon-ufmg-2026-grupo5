import { createRequire } from "module"
import { supabaseAdmin } from "./supabaseAdmin"

const require = createRequire(import.meta.url)
const pdfParse = require("pdf-parse")

export async function carregarDocumentosDoProcesso(processoId: string) {
  const { data: documentos, error } = await supabaseAdmin
    .from("documentos")
    .select("id, nome_arquivo, caminho_storage")
    .eq("processo_id", processoId)

  if (error) throw error
  if (!documentos || documentos.length === 0) {
    throw new Error("Nenhum documento encontrado para esse processo")
  }

  let textoTotal = ""

  for (const doc of documentos) {
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from("documentos_processuais")
      .download(doc.caminho_storage)

    if (downloadError) throw downloadError

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const parsed = await pdfParse(buffer)

    textoTotal += parsed.text + "\n\n"
  }

  return textoTotal
}