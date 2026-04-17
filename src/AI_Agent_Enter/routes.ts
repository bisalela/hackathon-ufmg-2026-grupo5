import express from "express"
import { analisarProcesso } from "./agent"
import { supabaseAdmin } from "./supabaseAdmin"

const router = express.Router()

router.post("/analisar/:processoId", async (req, res) => {
  try {
    const { processoId } = req.params

    const resultado = await analisarProcesso(processoId)

    const { error } = await supabaseAdmin
      .from("analises_agentes")
      .insert({
        processo_id: processoId,
        resultado_agentes: {
          analise: resultado
        }
      })

    if (error) throw error

    res.json({
      sucesso: true,
      processoId,
      resultado
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      sucesso: false,
      erro: "Falha ao analisar processo"
    })
  }
})

export default router