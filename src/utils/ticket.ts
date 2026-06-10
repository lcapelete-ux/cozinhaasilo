// Fichas 200–220 são separadas para o cliente levar para viagem (to-go).
const TAKEOUT_MIN = 200
const TAKEOUT_MAX = 220

export function isTakeoutTicket(ticket: string): boolean {
  const num = parseInt(ticket, 10)
  return !isNaN(num) && num >= TAKEOUT_MIN && num <= TAKEOUT_MAX
}
