// Dados consolidados da Festa de São João 2026 (19 a 29/06/2026), 11 dias.
// Fonte: relatórios Smart POS (thrsoftwares.com.br), planilha "Consolidado 11 dias".
// Valores históricos e fixos — usados na landing page pública (abaixo do login).

export interface DayStat {
  dia: string
  fat: number
  itens: number
  ticket: number
}

export interface NamedTotal {
  nome: string
  total: number
}

export const FESTIVAL_META = {
  nome: 'Festa de São João 2026',
  periodo: '19 a 29 de junho de 2026',
  dias: 11,
  totalFaturamento: 376059,
  totalItens: 21218,
  ticketMedio: 17.72,
  fonte: 'Relatórios Smart POS',
}

export const DAILY: DayStat[] = [
  { dia: '19/06', fat: 40431, itens: 2418, ticket: 16.72 },
  { dia: '20/06', fat: 32752, itens: 1687, ticket: 19.41 },
  { dia: '21/06', fat: 76279, itens: 4281, ticket: 17.82 },
  { dia: '22/06', fat: 11834, itens: 567, ticket: 20.87 },
  { dia: '23/06', fat: 171, itens: 9, ticket: 19.0 },
  { dia: '24/06', fat: 25442, itens: 1274, ticket: 19.97 },
  { dia: '25/06', fat: 6534, itens: 269, ticket: 24.29 },
  { dia: '26/06', fat: 41553, itens: 2162, ticket: 19.22 },
  { dia: '27/06', fat: 63853, itens: 3875, ticket: 16.48 },
  { dia: '28/06', fat: 51174, itens: 3009, ticket: 17.01 },
  { dia: '29/06', fat: 26036, itens: 1667, ticket: 15.62 },
]

// Faturamento por grupo de produto (R$)
export const GROUPS: NamedTotal[] = [
  { nome: 'Bebidas', total: 191793 },
  { nome: 'Porção', total: 93875 },
  { nome: 'Lanche', total: 37170 },
  { nome: 'Japonês', total: 25067 },
  { nome: 'Vinhos', total: 17554 },
  { nome: 'Drinks', total: 8764 },
  { nome: 'Banheiro', total: 1836 },
]

// Faturamento por forma de pagamento (R$)
export const PAYMENTS: NamedTotal[] = [
  { nome: 'Cartão de Crédito', total: 151276 },
  { nome: 'Cartão de Débito', total: 132958 },
  { nome: 'Dinheiro', total: 49623 },
  { nome: 'Marcar (fiado)', total: 21608 },
  { nome: 'PIX', total: 20594 },
]

// Top produtos por faturamento (R$)
export const TOP_REVENUE: NamedTotal[] = [
  { nome: 'Brahma Chopão', total: 95964 },
  { nome: 'Heineken Chopão', total: 42811 },
  { nome: 'Lanche Grego', total: 26005 },
  { nome: 'Brahma Chopinho', total: 23880 },
  { nome: 'Porção de Carne', total: 20605 },
  { nome: 'Acarajapa', total: 20482 },
  { nome: 'Espetinho de Frango', total: 19110 },
  { nome: 'Polenta Recheada', total: 14700 },
  { nome: 'Refrigerante', total: 12664 },
  { nome: 'Lanche Calabresa', total: 11165 },
]

// Top produtos por quantidade (unidades)
export const TOP_QUANTITY: NamedTotal[] = [
  { nome: 'Brahma Chopão', total: 6170 },
  { nome: 'Heineken Chopão', total: 2747 },
  { nome: 'Brahma Chopinho', total: 1990 },
  { nome: 'Refrigerante', total: 1583 },
  { nome: 'Água', total: 1542 },
  { nome: 'Lanche Grego', total: 743 },
  { nome: 'Espetinho de Frango', total: 637 },
  { nome: 'Banheiro', total: 612 },
  { nome: 'Heineken Chopinho', total: 601 },
  { nome: 'Acarajapa', total: 539 },
]
