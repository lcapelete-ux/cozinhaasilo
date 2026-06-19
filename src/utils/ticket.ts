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
