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
