export type SettlementCalculatorParams = {
  valor_causa: number
  uf: string
  sub_assunto_encoded: 0 | 1
  contrato: 0 | 1
  comprovante_credito: 0 | 1
  demonstrativo_divida: 0 | 1
  dossie: 0 | 1
  extrato: 0 | 1
  laudo_referenciado: 0 | 1
}

const UF_COEFFICIENTS: Record<string, number> = {
  AL: 462.75,
  AM: 472.6,
  AP: 197.47,
  BA: -255.37,
  CE: 332.34,
  DF: 616.66,
  ES: 172.59,
  GO: 5.96,
  MA: 453.48,
  MG: -33.31,
  MS: 745.56,
  MT: 609.24,
  PA: 368.89,
  PB: -68.7,
  PE: 405.3,
  PI: 11.58,
  PR: 436.56,
  RJ: 64.77,
  RN: -186.21,
  RO: 1038.62,
  RS: 162.12,
  SC: 481.0,
  SE: -161.85,
  SP: 707.46,
  TO: 687.01,
}

function ufCoefficient(uf: string) {
  const normalized = String(uf ?? "").trim().toUpperCase()
  return UF_COEFFICIENTS[normalized] ?? 0
}

export function calculateSettlementValue(params: SettlementCalculatorParams) {
  const valorCausa = Math.max(0, Number(params.valor_causa) || 0)

  const y =
    -250.11 +
    0.303 * valorCausa +
    ufCoefficient(params.uf) +
    -107.1 * params.sub_assunto_encoded +
    299.31 * params.contrato +
    128.76 * params.comprovante_credito +
    100.81 * params.demonstrativo_divida +
    -61.46 * params.dossie +
    -109.04 * params.extrato +
    -142.5 * params.laudo_referenciado

  const minViable = valorCausa * 0.1
  const cappedMax = valorCausa * 0.6
  const nonNegative = y < 0 ? minViable : y

  return Math.round(Math.min(cappedMax, Math.max(0, nonNegative)))
}

