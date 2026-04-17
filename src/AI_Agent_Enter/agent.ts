import { carregarDocumentosDoProcesso } from "./loadDocuments"
import OpenAI from "openai"
import dotenv from "dotenv"

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function analisarProcesso(processoId: string) {
  const texto = await carregarDocumentosDoProcesso(processoId)

  const resposta = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `Você é um assistente jurídico.
Analise o processo e gere:
- resumo
- principais pontos
- possíveis riscos
- conclusão`
      },
      {
        role: "user",
        content: texto.slice(0, 15000)
      }
    ]
  })

  return resposta.choices[0].message.content
}