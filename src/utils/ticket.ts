// Fichas 200–220 são separadas para o cliente levar para viagem (to-go).
const TAKEOUT_MIN = 200
const TAKEOUT_MAX = 220

export function isTakeoutTicket(ticket: string): boolean {
  const num = parseInt(ticket, 10)
  return !isNaN(num) && num >= TAKEOUT_MIN && num <= TAKEOUT_MAX
}

// The physical ficha/QR code keeps its real number (200-219) so printing and
// scanning stay consistent, but on screen it's shown shifted down by 100
// (200 -> 100, 219 -> 119) per kitchen convention for takeout orders.
const TAKEOUT_DISPLAY_OFFSET = 100

export function displayTicket(ticket: string): string {
  const num = parseInt(ticket, 10)
  if (!isNaN(num) && num >= TAKEOUT_MIN && num <= TAKEOUT_MAX) {
    return String(num - TAKEOUT_DISPLAY_OFFSET)
  }
  return ticket
}

// Reverses displayTicket(): staff typing on the numeric keypad sees/types the
// shifted number (100-120), so we map it back to the real ficha (200-220)
// before looking it up. QR/barcode scans already carry the real number and
// must NOT go through this.
const DISPLAY_MIN = TAKEOUT_MIN - TAKEOUT_DISPLAY_OFFSET
const DISPLAY_MAX = TAKEOUT_MAX - TAKEOUT_DISPLAY_OFFSET

export function parseManualTicket(input: string): string {
  const num = parseInt(input, 10)
  if (!isNaN(num) && num >= DISPLAY_MIN && num <= DISPLAY_MAX) {
    return String(num + TAKEOUT_DISPLAY_OFFSET)
  }
  return input
}
