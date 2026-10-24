import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Trophy, Crown, Users, Maximize, Minimize } from 'lucide-react'
import { subscribeDonations, subscribeDonationGoal, META_PADRAO } from '../services/firebaseService'
import { formatBRL, rankDonors, totalDonated } from '../utils/donations'
import type { Donation } from '../types'
import './oktoberfest.css'

export default function OktoberfestHero() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [meta, setMeta] = useState(META_PADRAO)
  const [page, setPage] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  // Margem de segurança para painel de LED que corta as bordas (overscan, ou
  // sinal 16:9 num painel 3:2). Define uma vez por aparelho abrindo a página
  // com ?margem=8 — o valor fica guardado. ?margem=0 volta ao normal.
  const [margem] = useState(() => {
    try {
      const url = new URLSearchParams(window.location.search).get('margem')
      if (url !== null) {
        const n = Math.min(15, Math.max(0, Number(url) || 0))
        localStorage.setItem('telao-margem', String(n))
        return n
      }
      return Math.min(15, Math.max(0, Number(localStorage.getItem('telao-margem')) || 0))
    } catch {
      return 0
    }
  })
  useEffect(() => subscribeDonations(setDonations), [])
  useEffect(() => subscribeDonationGoal(setMeta), [])
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const ranking = useMemo(() => rankDonors(donations), [donations])
  const total = useMemo(() => totalDonated(donations), [donations])
  const pages = Math.max(1, Math.ceil((ranking.length - 3) / 4))
  useEffect(() => {
    setPage(0)
    if (pages <= 1) return
    const timer = window.setInterval(() => setPage(p => (p + 1) % pages), 12000)
    return () => window.clearInterval(timer)
  }, [pages])
  const currentPage = page % pages
  const rest = ranking.slice(3 + currentPage * 4, 7 + currentPage * 4)
  const percent = meta > 0 ? total / meta * 100 : 0
  const reached = meta > 0 && total >= meta
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { /* Browsers without fullscreen support keep the responsive layout. */ }
  }

  return (
    <section
      className="oktober-board"
      aria-label="Doadômetro do Oktoberfest em prol do Lar São Cristóvão"
      style={
        margem
          ? {
              transform: `scale(${1 - margem / 100})`,
              transformOrigin: 'center center',
              // Pinta a faixa que sobra ao redor com o fundo do quadro, para a
              // margem não aparecer clara no painel.
              boxShadow: '0 0 0 100vmax #091b2f',
            }
          : undefined
      }
    >
      <header className="oktober-header">
        <div className="oktober-logo" role="img" aria-label="Oktoberfest Laranjal Paulista — logo original">
          <img src={`${import.meta.env.BASE_URL}oktoberfest-original.jpg`} alt="" />
        </div>
        <div className="oktober-header-copy"><span className="oktober-eyebrow">Laranjal Paulista · 2026</span><p>Uma festa de todos.<br /><strong>Uma causa que nos une.</strong></p></div>
        <button className="oktober-fullscreen" onClick={toggleFullscreen} title={fullscreen ? 'Sair da tela cheia' : 'Exibir no telão'} aria-label={fullscreen ? 'Sair da tela cheia' : 'Exibir no telão'}>{fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      </header>

      <div className="oktober-main">
        <article className={`oktober-meter ${reached ? 'is-complete' : ''}`}>
          <div className="oktober-eyebrow"><Heart size={17} /> Doadômetro solidário</div>
          <h1>Juntos pelo<br /><span>Lar São Cristóvão</span></h1>
          <p className="oktober-description">Cada doação se transforma em cuidado, carinho e acolhimento.</p>
          <div className="oktober-total-label">Já arrecadamos</div>
          <motion.div key={total} initial={{ opacity: 0.5, y: 8 }} animate={{ opacity: 1, y: 0 }} className="oktober-total">{formatBRL(total)}</motion.div>
          <div className="oktober-progress-heading"><strong>{reached ? 'Meta alcançada!' : 'Nossa corrente do bem'}</strong><span>{percent.toFixed(1).replace('.', ',')}%</span></div>
          <div className="oktober-progress" role="progressbar" aria-label="Progresso da arrecadação" aria-valuenow={Math.min(100, Math.max(0, percent))} aria-valuemin={0} aria-valuemax={100}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }} transition={{ duration: 1.2 }} />
          </div>
          <div className="oktober-goal"><div><span>Meta de arrecadação</span><strong>{meta > 0 ? formatBRL(meta) : 'A definir'}</strong></div><div><span>{reached ? 'Além da meta' : 'Falta para chegar lá'}</span><strong>{formatBRL(meta > 0 ? Math.abs(meta - total) : 0)}</strong></div></div>
          <div className="oktober-impact"><Users size={24} /><p><strong>{ranking.length} {ranking.length === 1 ? 'doador fazendo' : 'doadores fazendo'} a diferença</strong><span>{reached ? 'A solidariedade continua. Vamos ainda mais longe!' : 'Faça parte dessa corrente de solidariedade.'}</span></p><Heart size={26} /></div>
        </article>

        <article className="oktober-ranking">
          <div className="oktober-ranking-heading"><div><div className="oktober-eyebrow">Quem faz a festa acontecer</div><h2><Trophy /> Ranking solidário</h2></div><span className="oktober-ranking-count">{ranking.length} {ranking.length === 1 ? 'doador' : 'doadores'}</span></div>
          {ranking.length === 0 ? <div className="oktober-empty"><Heart size={52} strokeWidth={1} /><h3>O primeiro gesto pode ser seu.</h3><p>Assim que as doações forem registradas,<br />nossos apoiadores aparecerão aqui.</p></div> : <>
            <div className="oktober-podium">
              {ranking.slice(0, 3).map((donor, i) => <div key={donor.donor} className={`oktober-winner place-${i + 1}`}>
                <div className="oktober-medallion">{i === 0 ? <Crown size={28} /> : <Trophy size={23} />}<span>{i + 1}º</span></div>
                <p title={donor.donor}>{donor.donor}</p><strong>{formatBRL(donor.total)}</strong><span className="oktober-podium-label">{i === 0 ? 'Grande coração' : 'Solidariedade que inspira'}</span>
              </div>)}
            </div>
            <div className="oktober-list">
              <AnimatePresence mode="wait"><motion.div key={currentPage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                {rest.map((donor, i) => <div className="oktober-rank-row" key={donor.donor}><span className="oktober-position">{4 + currentPage * 4 + i}<small>º</small></span><span className="oktober-donor-name" title={donor.donor}>{donor.donor}</span><strong>{formatBRL(donor.total)}</strong></div>)}
              </motion.div></AnimatePresence>
            </div>
            {pages > 1 && <div className="oktober-pagination" aria-label="Páginas do ranking">{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i)} aria-label={`Página ${i + 1} do ranking`} aria-current={currentPage === i ? 'page' : undefined} className={currentPage === i ? 'active' : ''} />)}<span>{currentPage + 1} / {pages}</span></div>}
          </>}
          <div className="oktober-ranking-footer"><Heart size={15} /> A todos que doam: o nosso muito obrigado.</div>
        </article>
      </div>
      <footer className="oktober-footer"><span>Oktoberfest <b>·</b> Laranjal Paulista</span><p>Celebrar a vida. <strong>Compartilhar o bem.</strong></p><span>Em prol do Lar São Cristóvão <Heart size={14} /></span></footer>
    </section>
  )
}
