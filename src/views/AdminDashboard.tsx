import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, Package, Clock, Download, Zap,
  AlertTriangle, Star, ChevronUp, ChevronDown,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { subscribeAllOrders } from '../services/firebaseService'
import type { Order } from '../types'

type Period = 'today' | 'all'

const SECTOR_COLORS: Record<string, string> = {
  Fritadeira: '#FF8800',
  Lanches: '#4488FF',
  Outros: '#9966CC',
}
const SECTOR_COLOR_DEFAULT = '#5A5A40'

function fmt(n: number) {
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

function isToday(d: Date) {
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

function orderValue(o: Order) {
  return o.items.reduce((s, i) => s + i.price * i.quantity, 0)
}

function EmptyChart() {
  return (
    <div className="h-32 flex items-center justify-center text-gray-300 text-xs">
      Sem dados ainda
    </div>
  )
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [period, setPeriod] = useState<Period>('all')

  useEffect(() => {
    const unsub = subscribeAllOrders(setOrders)
    return unsub
  }, [])

  const delivered = useMemo(() => {
    const d = orders.filter((o) => o.status === 'delivered')
    return period === 'today' ? d.filter((o) => isToday(o.created_at)) : d
  }, [orders, period])

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalRevenue = useMemo(
    () => delivered.reduce((s, o) => s + orderValue(o), 0),
    [delivered]
  )

  const avgTime = useMemo(() => {
    const times = delivered
      .map((o) => (o.updated_at.getTime() - o.created_at.getTime()) / 60000)
      .filter((t) => t > 0 && t < 180)
    return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
  }, [delivered])

  // ── Pedidos por hora ─────────────────────────────────────────────────────────
  const hourData = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let h = 8; h <= 23; h++) counts[h] = 0
    delivered.forEach((o) => {
      const h = o.created_at.getHours()
      if (h >= 8 && h <= 23) counts[h]++
    })
    return Object.entries(counts).map(([h, pedidos]) => ({
      hora: `${h}h`,
      pedidos,
      h: Number(h),
    }))
  }, [delivered])

  const peakHour = useMemo(
    () => hourData.reduce((max, h) => (h.pedidos > max.pedidos ? h : max), hourData[0] ?? { hora: '—', pedidos: 0, h: 0 }),
    [hourData]
  )

  // ── Pedidos por dia (multi-day events) ───────────────────────────────────────
  const dayData = useMemo(() => {
    const days: Record<string, number> = {}
    orders
      .filter((o) => o.status === 'delivered')
      .forEach((o) => {
        const day = o.created_at.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        days[day] = (days[day] || 0) + 1
      })
    return Object.entries(days).map(([dia, pedidos]) => ({ dia, pedidos }))
  }, [orders])

  const isMultiDay = dayData.length > 1

  // ── Estatísticas por produto ─────────────────────────────────────────────────
  const productStats = useMemo(() => {
    const stats: Record<string, { qty: number; revenue: number; sector: string }> = {}
    delivered.forEach((o) =>
      o.items.forEach((i) => {
        if (!stats[i.name]) stats[i.name] = { qty: 0, revenue: 0, sector: i.sector || 'Outros' }
        stats[i.name].qty += i.quantity
        stats[i.name].revenue += i.price * i.quantity
      })
    )
    return stats
  }, [delivered])

  const topByQty = useMemo(
    () => Object.entries(productStats).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10),
    [productStats]
  )

  const topByRevenue = useMemo(
    () => Object.entries(productStats).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5),
    [productStats]
  )

  // ── Faturamento por setor ────────────────────────────────────────────────────
  const sectorData = useMemo(() => {
    const rev: Record<string, number> = {}
    delivered.forEach((o) =>
      o.items.forEach((i) => {
        const s = i.sector || 'Outros'
        rev[s] = (rev[s] || 0) + i.price * i.quantity
      })
    )
    return Object.entries(rev)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [delivered])

  // ── Tempo médio por produto ──────────────────────────────────────────────────
  // Proxy: para cada produto, média do tempo total dos pedidos que o contêm
  const productTimes = useMemo(() => {
    const times: Record<string, number[]> = {}
    delivered.forEach((o) => {
      const t = (o.updated_at.getTime() - o.created_at.getTime()) / 60000
      if (t > 0 && t < 180) {
        const seen = new Set<string>()
        o.items.forEach((i) => {
          if (!seen.has(i.name)) {
            seen.add(i.name)
            if (!times[i.name]) times[i.name] = []
            times[i.name].push(t)
          }
        })
      }
    })
    return Object.entries(times)
      .map(([name, ts]) => ({
        name,
        avgTime: Math.round(ts.reduce((a, b) => a + b, 0) / ts.length),
        orders: ts.length,
      }))
      .filter((p) => p.orders >= 2)
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10)
  }, [delivered])

  // ── Insights automáticos ────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { type: 'info' | 'warn' | 'tip'; text: string }[] = []
    if (delivered.length < 3) return list

    if (peakHour.pedidos > 0) {
      list.push({
        type: 'info',
        text: `Horário de pico às ${peakHour.hora} com ${peakHour.pedidos} pedidos — planeje equipe extra nesse horário para a próxima festa.`,
      })
    }

    if (avgTime > 0) {
      const slowThreshold = avgTime * 1.6
      productTimes
        .filter((p) => p.avgTime > slowThreshold && p.orders >= 3)
        .slice(0, 2)
        .forEach((p) => {
          list.push({
            type: 'warn',
            text: `"${p.name}" aparece em pedidos com tempo médio de ${p.avgTime}min (${p.avgTime - avgTime}min acima da média) — avalie pré-preparo ou limite de produção simultânea.`,
          })
        })
    }

    if (topByQty.length > 0) {
      const [topName, topData] = topByQty[0]
      list.push({
        type: 'tip',
        text: `"${topName}" foi o campeão de saída com ${topData.qty} unidades — garanta estoque generoso para a próxima edição.`,
      })
    }

    if (topByRevenue.length > 0 && topByQty.length > 0 && topByRevenue[0][0] !== topByQty[0][0]) {
      const [revName, revData] = topByRevenue[0]
      list.push({
        type: 'tip',
        text: `"${revName}" gera maior receita (${fmt(revData.revenue)}) mas não é o mais pedido — um destaque no cardápio pode alavancar ainda mais o faturamento.`,
      })
    }

    if (sectorData.length > 1 && totalRevenue > 0) {
      const topSector = sectorData[0]
      const pct = ((topSector.value / totalRevenue) * 100).toFixed(0)
      list.push({
        type: 'info',
        text: `Setor "${topSector.name}" concentrou ${pct}% do faturamento — considere ampliar capacidade ou variedade nesse setor.`,
      })
    }

    if (isMultiDay && dayData.length >= 2) {
      const [d1, d2] = dayData
      if (d2.pedidos > d1.pedidos * 1.3) {
        list.push({
          type: 'info',
          text: `O volume cresceu ${Math.round(((d2.pedidos - d1.pedidos) / d1.pedidos) * 100)}% do 1º para o 2º dia — a festa aqueceu ao longo do evento.`,
        })
      }
    }

    return list
  }, [delivered, peakHour, avgTime, productTimes, topByQty, topByRevenue, sectorData, totalRevenue, isMultiDay, dayData])

  // ── PDF Export ───────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const now = new Date()
    const periodLabel =
      period === 'today'
        ? `Hoje, ${now.toLocaleDateString('pt-BR')}`
        : 'Toda a Festa'

    const tableRowProducts = topByQty
      .map(
        ([name, data], i) => `
      <tr>
        <td>${i + 1}</td><td>${name}</td><td>${data.sector}</td>
        <td>${data.qty}</td><td>${fmt(data.revenue)}</td>
        <td>${totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : 0}%</td>
      </tr>`
      )
      .join('')

    const tableRowTimes = productTimes
      .map((p) => {
        const diff = p.avgTime - avgTime
        const slow = diff > avgTime * 0.5 && avgTime > 0
        return `<tr>
          <td>${p.name}</td><td>${p.avgTime}min</td><td>${p.orders}</td>
          <td>${diff >= 0 ? '+' : ''}${diff}min</td>
          <td><span class="badge ${slow ? 'badge-warn' : 'badge-ok'}">${slow ? 'Lento' : 'Normal'}</span></td>
        </tr>`
      })
      .join('')

    const tableRowSectors = sectorData
      .map(
        (s) => `<tr>
        <td>${s.name}</td><td>${fmt(s.value)}</td>
        <td>${totalRevenue > 0 ? ((s.value / totalRevenue) * 100).toFixed(1) : 0}%</td>
      </tr>`
      )
      .join('')

    const tableRowHours = hourData
      .filter((h) => h.pedidos > 0)
      .map(
        (h) => `<tr>
        <td>${h.hora}</td><td>${h.pedidos}</td>
        <td>${delivered.length > 0 ? ((h.pedidos / delivered.length) * 100).toFixed(1) : 0}%</td>
        ${h.h === peakHour.h ? '<td><span class="badge badge-peak">Pico</span></td>' : '<td></td>'}
      </tr>`
      )
      .join('')

    const insightsHtml = insights.length
      ? insights
          .map(
            (ins) =>
              `<div class="insight ${ins.type === 'warn' ? 'warn' : ins.type === 'tip' ? 'tip' : ''}">
              ${ins.type === 'warn' ? '⚠️' : ins.type === 'tip' ? '💡' : 'ℹ️'} ${ins.text}
            </div>`
          )
          .join('')
      : '<p class="empty">Colete mais dados para gerar insights automáticos.</p>'

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório — Arraiá Lar São Cristóvão</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; max-width: 820px; margin: 0 auto; padding: 24px; color: #222; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; font-style: italic; color: #3a3a20; margin-bottom: 2px; }
  .meta { color: #888; font-size: 11px; margin-bottom: 20px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
  .stat { border: 1px solid #ddd; padding: 12px; border-radius: 8px; text-align: center; }
  .stat .val { font-size: 20px; font-weight: bold; color: #5A5A40; }
  .stat .lbl { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  h2 { font-size: 14px; font-style: italic; color: #3a3a20; border-bottom: 1px solid #e8e8d8; padding-bottom: 4px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f5f5ee; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #777; }
  td { padding: 5px 8px; border-bottom: 1px solid #f0f0e8; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 10px; font-weight: bold; }
  .badge-warn { background: #fff0dd; color: #994400; }
  .badge-ok { background: #d4edda; color: #155724; }
  .badge-peak { background: #FFD700; color: #111; }
  .insight { padding: 8px 12px; margin: 6px 0; border-left: 3px solid #5A5A40; background: #f8f8f2; font-size: 12px; border-radius: 0 4px 4px 0; }
  .insight.warn { border-color: #e08000; background: #fffaf0; }
  .insight.tip { border-color: #22884a; background: #f0fff5; }
  .empty { color: #aaa; font-size: 12px; font-style: italic; }
  .footer { margin-top: 28px; font-size: 10px; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
  <h1>🎪 Relatório — Arraiá do Lar São Cristóvão</h1>
  <p class="meta">Período: ${periodLabel} &nbsp;·&nbsp; Gerado em ${now.toLocaleString('pt-BR')}</p>

  <div class="stats">
    <div class="stat"><div class="val">${delivered.length}</div><div class="lbl">Pedidos entregues</div></div>
    <div class="stat"><div class="val">${fmt(totalRevenue)}</div><div class="lbl">Faturamento total</div></div>
    <div class="stat"><div class="val">${avgTime}min</div><div class="lbl">Tempo médio</div></div>
    <div class="stat"><div class="val">${peakHour.hora}</div><div class="lbl">Horário de pico</div></div>
  </div>

  <h2>Produtos mais vendidos</h2>
  <table>
    <thead><tr><th>#</th><th>Produto</th><th>Setor</th><th>Qtd</th><th>Faturamento</th><th>% do total</th></tr></thead>
    <tbody>${tableRowProducts}</tbody>
  </table>

  <h2>Tempo de preparo por produto</h2>
  <p style="font-size:11px;color:#999;margin-bottom:6px">Tempo médio dos pedidos que contêm cada produto. Mín. 2 pedidos para calcular.</p>
  <table>
    <thead><tr><th>Produto</th><th>Tempo médio</th><th>Nº pedidos</th><th>vs. média geral</th><th>Avaliação</th></tr></thead>
    <tbody>${tableRowTimes || '<tr><td colspan="5" style="color:#bbb;text-align:center;padding:12px">Sem dados suficientes</td></tr>'}</tbody>
  </table>

  <h2>Faturamento por setor</h2>
  <table>
    <thead><tr><th>Setor</th><th>Faturamento</th><th>% do total</th></tr></thead>
    <tbody>${tableRowSectors || '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:12px">Sem dados</td></tr>'}</tbody>
  </table>

  <h2>Pedidos por hora</h2>
  <table>
    <thead><tr><th>Hora</th><th>Pedidos</th><th>% do total</th><th></th></tr></thead>
    <tbody>${tableRowHours || '<tr><td colspan="4" style="color:#bbb;text-align:center;padding:12px">Sem dados</td></tr>'}</tbody>
  </table>

  <h2>🧠 Insights para próximas festas</h2>
  ${insightsHtml}

  <div class="footer">Arraiá do Lar São Cristóvão · Sistema de Pedidos · ${now.toLocaleDateString('pt-BR')}</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=920,height=720')
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => { win.focus(); win.print() }, 600)
    }
  }

  const hasData = delivered.length > 0

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif italic text-2xl md:text-3xl text-accent-dark flex items-center gap-2">
            <BarChart3 className="text-accent" size={26} />
            Dashboard & Relatórios
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            {orders.filter((o) => o.status === 'delivered').length} pedidos entregues no total do evento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-2xl bg-gray-100 p-1">
            <button
              onClick={() => setPeriod('today')}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                period === 'today' ? 'bg-white shadow-sm text-accent-dark' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                period === 'all' ? 'bg-white shadow-sm text-accent-dark' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Toda a festa
            </button>
          </div>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-2xl text-sm font-semibold transition-colors"
          >
            <Download size={15} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Pedidos entregues', value: delivered.length, icon: Package, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Faturamento', value: fmt(totalRevenue), icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/10' },
          { label: 'Tempo médio', value: `${avgTime}min`, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Horário de pico', value: peakHour.hora, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white rounded-3xl p-4 shadow-sm"
          >
            <div className={`w-9 h-9 rounded-2xl ${bg} flex items-center justify-center mb-2`}>
              <Icon size={17} className={color} />
            </div>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Multi-day chart */}
      {isMultiDay && (
        <div className="bg-white rounded-3xl p-4 shadow-sm mb-4">
          <h2 className="font-serif italic text-base text-accent-dark mb-3">Pedidos por dia</h2>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="pedidos" fill="#5A5A40" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Pedidos por hora */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <h2 className="font-serif italic text-base text-accent-dark mb-3">Pedidos por hora</h2>
          {!hasData ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Pedidos']} />
                <Bar dataKey="pedidos" radius={[4, 4, 0, 0]}>
                  {hourData.map((entry) => (
                    <Cell
                      key={entry.h}
                      fill={entry.h === peakHour.h && entry.pedidos > 0 ? '#FF8800' : '#5A5A40'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {hasData && (
            <p className="text-[10px] text-gray-400 mt-1 text-center">
              Barra laranja = horário de pico ({peakHour.hora}, {peakHour.pedidos} pedidos)
            </p>
          )}
        </div>

        {/* Faturamento por setor */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <h2 className="font-serif italic text-base text-accent-dark mb-4">Faturamento por setor</h2>
          {!hasData || sectorData.length === 0 ? <EmptyChart /> : (
            <div className="space-y-3">
              {sectorData.map(({ name, value }) => (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{name}</span>
                    <span className="font-bold" style={{ color: SECTOR_COLORS[name] ?? SECTOR_COLOR_DEFAULT }}>
                      {fmt(value)}
                      <span className="text-gray-400 font-normal ml-1">
                        ({totalRevenue > 0 ? ((value / totalRevenue) * 100).toFixed(0) : 0}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalRevenue > 0 ? (value / totalRevenue) * 100 : 0}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ background: SECTOR_COLORS[name] ?? SECTOR_COLOR_DEFAULT }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Products & timing row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Mais vendidos */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} className="text-accent" />
            <h2 className="font-serif italic text-base text-accent-dark">Mais vendidos</h2>
          </div>
          {topByQty.length === 0 ? <EmptyChart /> : (
            <div className="space-y-2">
              {topByQty.map(([name, data], i) => {
                const max = topByQty[0][1].qty
                const revShare = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(0) : '0'
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-4 shrink-0 text-center">{i + 1}</span>
                    <span className="text-xs text-gray-700 w-24 shrink-0 truncate" title={name}>{name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(data.qty / max) * 100}%` }}
                        transition={{ delay: i * 0.04, duration: 0.5 }}
                        className="bg-accent h-full rounded-full"
                      />
                    </div>
                    <span className="text-[11px] font-black text-accent-dark w-5 text-right shrink-0">{data.qty}</span>
                    <span className="text-[10px] text-gray-400 w-16 text-right shrink-0 tabular-nums">
                      {fmt(data.revenue)}<br />
                      <span className="text-gray-300">{revShare}% fat.</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tempo por produto */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-orange-500" />
            <h2 className="font-serif italic text-base text-accent-dark">Tempo de preparo por produto</h2>
          </div>
          {productTimes.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-300 text-xs text-center px-4">
              Mínimo 2 pedidos entregues por produto para calcular
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {productTimes.map((p) => {
                  const diff = p.avgTime - avgTime
                  const isSlow = diff > avgTime * 0.5 && avgTime > 0
                  const pct = Math.min(100, (p.avgTime / (productTimes[0].avgTime || 1)) * 100)
                  return (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 w-24 shrink-0 truncate" title={p.name}>{p.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full rounded-full ${isSlow ? 'bg-orange-400' : 'bg-green-400'}`}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-gray-700 w-10 text-right shrink-0">{p.avgTime}min</span>
                      <span className={`text-[10px] font-bold flex items-center w-10 justify-end shrink-0 ${diff > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                        {diff > 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        {Math.abs(diff)}min
                      </span>
                      {isSlow && (
                        <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full shrink-0">
                          LENTO
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 pt-2">
                vs. média geral de {avgTime}min · barras vermelhas = acima de 1,5× a média
              </p>
            </>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm mb-4">
          <h2 className="font-serif italic text-base text-accent-dark mb-3">
            🧠 Insights para próximas festas
          </h2>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`flex items-start gap-3 px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  ins.type === 'warn'
                    ? 'bg-orange-50 text-orange-900'
                    : ins.type === 'tip'
                    ? 'bg-green-50 text-green-900'
                    : 'bg-blue-50 text-blue-900'
                }`}
              >
                <span className="shrink-0 mt-0.5 text-base">
                  {ins.type === 'warn' ? '⚠️' : ins.type === 'tip' ? '💡' : 'ℹ️'}
                </span>
                <span>{ins.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <div className="bg-white rounded-3xl p-16 text-center shadow-sm">
          <BarChart3 size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">Sem pedidos entregues no período selecionado</p>
          <p className="text-gray-300 text-xs mt-1">
            Os relatórios aparecem conforme os pedidos são marcados como entregues
          </p>
        </div>
      )}
    </div>
  )
}
