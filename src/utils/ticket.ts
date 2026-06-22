// Fichas físicas usam duas faixas com o mesmo deslocamento de exibição
// (-100): 133–198 e 200–220 (133 -> 33, 198 -> 98, 200 -> 100, 219 -> 119)
// por convenção da cozinha. Apenas a faixa 200–220 (exibida como 100–120) é
// efetivamente "para viagem" — a faixa 133–198 só compartilha o deslocamento
// de número, sem o selo de viagem.
const DISPLAY_RANGES = [
  { min: 133, max: 198 },
  { min: 200, max: 220 },
]

const TAKEOUT_RANGES = [
  { min: 200, max: 220 },
]

const TAKEOUT_DISPLAY_OFFSET = 100

function isInRange(num: number, ranges: typeof DISPLAY_RANGES): boolean {
  return ranges.some((r) => num >= r.min && num <= r.max)
}

// Cupons físicos de produto têm o formato "0844-124791" (código do produto,
// traço, número da venda) — fichas são sempre número puro, sem traço. Bipar
// um cupom por engano na tela de ficha não pode avançar pedido nenhum.
export function isCupomCode(raw: string): boolean {
  return /^\d+-\d+$/.test(raw.trim())
}

// Acha o produto cujo código casa com o início do cupom bipado.
//
// Dois problemas faziam "alguns cupons não serem lidos":
//  1. O código pode ter de 1 a 4 dígitos (o cadastro não exige 4); uma
//     comparação fixa nos 4 primeiros dígitos ignorava produtos com código
//     mais curto. Por isso comparamos usando o tamanho do próprio código.
//  2. O cupom impresso quase sempre preenche o código com zeros à esquerda
//     até 4 dígitos ("844" → "0844"), mas no cadastro o código pode ter sido
//     digitado sem o zero ("844"). Por isso também comparamos numericamente
//     os 4 primeiros dígitos com o código (0844 == 844).
//
// Em caso de empate, vence o código mais longo (mais específico), para um
// código curto não ofuscar outro maior.
export function matchProductByScan<T extends { code?: string }>(items: T[], digits: string): T | undefined {
  if (!digits) return undefined
  const first4 = digits.substring(0, 4)
  const first4Num = first4.length === 4 ? parseInt(first4, 10) : NaN
  let best: T | undefined
  for (const m of items) {
    const code = m.code
    if (!code) continue
    const prefixMatch = digits.substring(0, code.length) === code
    const padMatch = code.length <= 4 && !isNaN(first4Num) && parseInt(code, 10) === first4Num
    if (prefixMatch || padMatch) {
      if (!best || best.code!.length < code.length) best = m
    }
  }
  return best
}

export function isTakeoutTicket(ticket: string): boolean {
  const num = parseInt(ticket, 10)
  return !isNaN(num) && isInRange(num, TAKEOUT_RANGES)
}

// The physical ficha/QR code keeps its real number so printing and scanning
// stay consistent, but on screen it's shown shifted down by 100 per kitchen
// convention.
export function displayTicket(ticket: string): string {
  const num = parseInt(ticket, 10)
  if (!isNaN(num) && isInRange(num, DISPLAY_RANGES)) {
    return String(num - TAKEOUT_DISPLAY_OFFSET)
  }
  return ticket
}

// Reverses displayTicket(): staff typing on the numeric keypad sees/types the
// shifted number (33-98 or 100-120), so we map it back to the real ficha
// (133-198 or 200-220) before looking it up. QR/barcode scans already carry
// the real number and must NOT go through this.
export function parseManualTicket(input: string): string {
  const num = parseInt(input, 10)
  if (!isNaN(num) && DISPLAY_RANGES.some((r) => num + TAKEOUT_DISPLAY_OFFSET >= r.min && num + TAKEOUT_DISPLAY_OFFSET <= r.max)) {
    return String(num + TAKEOUT_DISPLAY_OFFSET)
  }
  return input
}
