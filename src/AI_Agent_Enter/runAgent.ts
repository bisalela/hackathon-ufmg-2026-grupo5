import { analisarProcesso } from "./agent"

const processoId = "f0110ae4-8f02-424a-816a-74d1147465d2"

analisarProcesso(processoId)
  .then(res => {
    console.log("RESULTADO:\n", res)
  })
  .catch(err => {
    console.error(err)
  })