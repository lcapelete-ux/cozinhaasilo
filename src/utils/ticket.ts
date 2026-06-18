// Fichas de viagem (to-go) usam duas faixas de numeração física: 133–198 e
// 200–220. Em ambas, a tela mostra o número deslocado em -100 (133 -> 33,
// 198 -> 98, 200 -> 100, 219 -> 119) por convenção da cozinha.
const TAKEOUT_RANGES = [
  { min: 133, max: 198 },
  { min: 200, max: 220 },
]

const TAKEOUT_DISPLAY_OFFSET = 100

function isInTakeoutRange(num: number): boolean {
  return TAKEOUT_RANGES.some((r) => num >= r.min && num <= r.max)
}

export function isTakeoutTicket(ticket: string): boolean {
  const num = parseInt(ticket, 10)
  return !isNaN(num) && isInTakeoutRange(num)
}

// The physical ficha/QR code keeps its real number so printing and scanning
// stay consistent, but on screen it's shown shifted down by 100 per kitchen
// convention for takeout orders.
export function displayTicket(ticket: string): string {
  const num = parseInt(ticket, 10)
  if (!isNaN(num) && isInTakeoutRange(num)) {
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
  if (!isNaN(num) && TAKEOUT_RANGES.some((r) => num + TAKEOUT_DISPLAY_OFFSET >= r.min && num + TAKEOUT_DISPLAY_OFFSET <= r.max)) {
    return String(num + TAKEOUT_DISPLAY_OFFSET)
  }
  return input
}
