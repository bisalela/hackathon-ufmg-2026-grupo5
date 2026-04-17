import { analisarProcesso } from "./agent"

async function main() {
  try {
    const processoId = "f0110ae4-8f02-424a-816a-74d1147465d2"

    console.log("rodando análise...")

    const resultado = await analisarProcesso(processoId)

    console.log("\nRESULTADO:\n")
    console.log(resultado)
  } catch (error) {
    console.error("ERRO DETALHADO:")
    console.error(error)
    console.error("JSON:", JSON.stringify(error, null, 2))
  }
}

main()