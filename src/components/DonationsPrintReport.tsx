import { createPortal } from 'react-dom'
import { formatBRL } from '../utils/donations'
import type { DonorRank } from '../utils/donations'
import type { Donation } from '../types'

interface Props {
  ranking: DonorRank[]
  donations: Donation[]
  total: number
  meta: number
}

const dataHora = (d: Date) =>
  `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

// Folha de doadores para imprimir ou salvar em PDF. Fica fora da tela e só
// aparece na impressão — as regras em index.css escondem o resto da página.
// Assim não é preciso abrir janela nova (bloqueada por bloqueador de pop-up)
// nem carregar uma biblioteca de PDF: o próprio navegador salva em PDF.
//
// Vai para fora de #root, por um portal: escondendo a aplicação com display
// none, ela deixa de ocupar altura. Dentro do #root, o jeito de esconder era
// manter o espaço dela no papel, e o PDF saía com páginas em branco no fim.
export default function DonationsPrintReport({ ranking, donations, total, meta }: Props) {
  const agora = new Date()
  const pct = meta > 0 ? (total / meta) * 100 : 0
  const porData = [...donations].sort((a, b) => a.created_at.getTime() - b.created_at.getTime())

  return createPortal(
    <div id="relatorio-doacoes">
      <header className="rel-cabecalho">
        <h1>Doadores — Oktoberfest 2026</h1>
        <p className="rel-sub">Em prol do Lar São Cristóvão · Laranjal Paulista</p>
        <p className="rel-meta">Emitido em {dataHora(agora)}</p>
      </header>

      <section className="rel-resumo">
        <div>
          <span>Total arrecadado</span>
          <strong>{formatBRL(total)}</strong>
        </div>
        <div>
          <span>Meta</span>
          <strong>{formatBRL(meta)}</strong>
        </div>
        <div>
          <span>% da meta</span>
          <strong>{pct.toFixed(1).replace('.', ',')}%</strong>
        </div>
        <div>
          <span>Doadores</span>
          <strong>{ranking.length}</strong>
        </div>
        <div>
          <span>Doações</span>
          <strong>{donations.length}</strong>
        </div>
      </section>

      <h2>Ranking de doadores</h2>
      <table>
        <thead>
          <tr>
            <th className="rel-num">#</th>
            <th>Doador</th>
            <th className="rel-num">Doações</th>
            <th className="rel-dir">Total</th>
            <th className="rel-dir">% do total</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.donor}>
              <td className="rel-num">{i + 1}º</td>
              <td>{r.donor}</td>
              <td className="rel-num">{r.count}</td>
              <td className="rel-dir">{formatBRL(r.total)}</td>
              <td className="rel-dir">
                {total > 0 ? ((r.total / total) * 100).toFixed(1).replace('.', ',') : '0,0'}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total</td>
            <td className="rel-dir">{formatBRL(total)}</td>
            <td className="rel-dir">100,0%</td>
          </tr>
        </tfoot>
      </table>

      <h2>Lançamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Doador</th>
            <th>Observação</th>
            <th className="rel-dir">Valor</th>
          </tr>
        </thead>
        <tbody>
          {porData.map((d) => (
            <tr key={d.id}>
              <td>{dataHora(d.created_at)}</td>
              <td>{d.donor}</td>
              <td>{d.note || '—'}</td>
              <td className="rel-dir">{formatBRL(d.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total</td>
            <td className="rel-dir">{formatBRL(total)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="rel-rodape">
        A todos que doam: o nosso muito obrigado. · Oktoberfest Laranjal Paulista 2026
      </footer>
    </div>,
    document.body
  )
}
