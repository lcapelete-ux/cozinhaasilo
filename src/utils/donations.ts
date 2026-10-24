import type { Donation } from '../types'

export interface DonorRank {
  donor: string
  total: number
  count: number
  since: Date
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

// Doações do mesmo doador somam: quem doou três vezes aparece uma vez só no
// ranking, com o total. Para o mesmo doador não se partir em duas posições
// quando o nome é digitado de outro jeito, o agrupamento ignora maiúsculas,
// acentos e espaços repetidos — "Família Schmidt" e "familia  schmidt" contam
// como a mesma pessoa. Exibe o nome como foi digitado na primeira vez.
export function donorKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function rankDonors(donations: Donation[]): DonorRank[] {
  const map = new Map<string, DonorRank>()
  for (const d of donations) {
    const name = d.donor.trim()
    if (!name) continue
    const key = donorKey(name)
    const found = map.get(key)
    if (!found) {
      map.set(key, { donor: name, total: d.amount, count: 1, since: d.created_at })
      continue
    }
    found.total += d.amount
    found.count += 1
    // A lista pode chegar em qualquer ordem, então a grafia exibida é sempre a
    // da doação mais antiga — não a da última digitada, que pode vir sem
    // acento ou em minúsculas.
    if (d.created_at < found.since) {
      found.since = d.created_at
      found.donor = name
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export function totalDonated(donations: Donation[]): number {
  return donations.reduce((s, d) => s + d.amount, 0)
}

// Aceita o valor como as pessoas digitam: "1.234,56", "1234,56" ou "1234.56".
// Havendo vírgula, ela é a casa decimal e os pontos são separador de milhar.
export function parseAmount(raw: string): number {
  let s = raw.trim().replace(/\s/g, '').replace(/^R\$?/i, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}
