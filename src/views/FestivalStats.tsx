import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, LineChart, Line,
} from 'recharts'
import { TrendingUp, ShoppingBag, Receipt, CalendarDays, Trophy, Beer, CreditCard, Award } from 'lucide-react'
import {
  FESTIVAL_META, DAILY, GROUPS, PAYMENTS, TOP_REVENUE, TOP_QUANTITY,
} from '../data/festivalStats'

// Paleta festeira, coerente com o tema junino do sistema
const COLORS = ['#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#2980B9', '#8E44AD', '#7A7A58']
const PAY_COLORS = ['#C0392B', '#E67E22', '#27AE60', '#95A5A6', '#2980B9']

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function formatBRLCents(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}
function formatShort(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
  return String(v)
}

const bestDay = DAILY.reduce((a, b) => (b.fat > a.fat ? b : a))
const totalFat = FESTIVAL_META.totalFaturamento

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col">
      <div className="flex items-center gap-2 text-accent mb-1">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      </div>
      <p className="font-black text-2xl md:text-3xl text-accent-dark leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-accent">{icon}</span>
        <h3 className="font-bold text-gray-800 text-sm md:text-base">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// Ranking horizontal com barra proporcional
function Ranking({ items, unit, colors }: { items: { nome: string; total: number }[]; unit: 'brl' | 'un'; colors: string[] }) {
  const max = Math.max(...items.map((i) => i.total))
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.nome} className="flex items-center gap-3">
          <span className="w-6 text-center text-sm font-black text-gray-400 shrink-0">
            {medals[i] ?? i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs md:text-sm font-semibold text-gray-700 truncate">{item.nome}</span>
              <span className="text-xs md:text-sm font-black text-accent-dark shrink-0">
                {unit === 'brl' ? formatBRL(item.total) : `${item.total.toLocaleString('pt-BR')} un`}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: colors[i % colors.length] }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.total / max) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.04 }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FestivalStats() {
  const groupData = GROUPS.map((g) => ({ ...g, pct: (g.total / totalFat) * 100 }))

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-16">
      {/* Cabeçalho */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-accent/10 text-accent-dark rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-3">
          🎉 Retrospectiva
        </div>
        <h2 className="font-serif italic text-3xl md:text-4xl text-accent-dark">{FESTIVAL_META.nome}</h2>
        <p className="text-gray-500 text-sm mt-1">
          {FESTIVAL_META.periodo} · {FESTIVAL_META.dias} dias de festa
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi icon={<TrendingUp size={16} />} label="Faturamento" value={formatBRL(FESTIVAL_META.totalFaturamento)} sub="total no período" />
        <Kpi icon={<ShoppingBag size={16} />} label="Itens vendidos" value={FESTIVAL_META.totalItens.toLocaleString('pt-BR')} sub="produtos no total" />
        <Kpi icon={<Receipt size={16} />} label="Ticket médio" value={formatBRLCents(FESTIVAL_META.ticketMedio)} sub="por item vendido" />
        <Kpi icon={<CalendarDays size={16} />} label="Melhor dia" value={bestDay.dia} sub={formatBRL(bestDay.fat)} />
      </div>

      {/* Faturamento por dia */}
      <div className="mb-6">
        <Card title="Faturamento por dia" icon={<TrendingUp size={18} />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={DAILY} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatShort} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [formatBRL(v), 'Faturamento']}
                labelFormatter={(l) => `Dia ${l}`}
                contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }}
              />
              <Bar dataKey="fat" radius={[6, 6, 0, 0]}>
                {DAILY.map((d, i) => (
                  <Cell key={i} fill={d.dia === bestDay.dia ? '#C0392B' : '#E67E22'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Itens vendidos por dia (linha) */}
      <div className="mb-6">
        <Card title="Itens vendidos por dia" icon={<ShoppingBag size={18} />}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={DAILY} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatShort} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString('pt-BR')} itens`, 'Vendidos']}
                labelFormatter={(l) => `Dia ${l}`}
                contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }}
              />
              <Line type="monotone" dataKey="itens" stroke="#27AE60" strokeWidth={3} dot={{ r: 3, fill: '#27AE60' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Grupos + Pagamentos lado a lado */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card title="Faturamento por categoria" icon={<Beer size={18} />}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart margin={{ top: 16, bottom: 8, left: 8, right: 8 }}>
              <Pie
                data={groupData}
                dataKey="total"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius={72}
                innerRadius={42}
                paddingAngle={2}
                label={(e: { pct?: number }) => `${(e.pct ?? 0).toFixed(0)}%`}
                labelLine={false}
              >
                {groupData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Formas de pagamento" icon={<CreditCard size={18} />}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart margin={{ top: 16, bottom: 8, left: 8, right: 8 }}>
              <Pie
                data={PAYMENTS}
                dataKey="total"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius={72}
                innerRadius={42}
                paddingAngle={2}
              >
                {PAYMENTS.map((_, i) => (
                  <Cell key={i} fill={PAY_COLORS[i % PAY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Rankings de produtos */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Top 10 — Mais faturaram" icon={<Trophy size={18} />}>
          <Ranking items={TOP_REVENUE} unit="brl" colors={COLORS} />
        </Card>
        <Card title="Top 10 — Mais vendidos" icon={<Award size={18} />}>
          <Ranking items={TOP_QUANTITY} unit="un" colors={COLORS} />
        </Card>
      </div>

      <p className="text-center text-[11px] text-gray-400 mt-8">
        Fonte: {FESTIVAL_META.fonte} · Consolidado dos {FESTIVAL_META.dias} dias de festa
      </p>
    </div>
  )
}
