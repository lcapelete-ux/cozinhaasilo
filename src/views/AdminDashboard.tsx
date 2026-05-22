import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Package, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { subscribeAllOrders } from '../services/firebaseService'
import type { Order } from '../types'

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    const unsub = subscribeAllOrders(setOrders)
    return unsub
  }, [])

  const delivered = orders.filter((o) => o.status === 'delivered')
  const active = orders.filter((o) => o.status !== 'delivered')

  const totalRevenue = delivered.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0),
    0
  )

  // Avg time pending → ready (in minutes)
  const avgTime = (() => {
    const times = delivered.map((o) => {
      const diff = (o.updated_at.getTime() - o.created_at.getTime()) / 60000
      return diff
    }).filter((t) => t > 0 && t < 180)
    if (times.length === 0) return 0
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  })()

  // Sales by hour
  const hourCounts: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hourCounts[h] = 0
  delivered.forEach((o) => {
    const h = o.created_at.getHours()
    hourCounts[h] = (hourCounts[h] || 0) + 1
  })
  const hourData = Object.entries(hourCounts)
    .filter(([h]) => {
      const hour = Number(h)
      return hour >= 8 && hour <= 23
    })
    .map(([h, count]) => ({ hora: `${h}h`, pedidos: count }))

  // Top items
  const itemCounts: Record<string, number> = {}
  delivered.forEach((o) => {
    o.items.forEach((i) => {
      itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity
    })
  })
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, qty]) => ({ name, qty }))

  const stats = [
    { label: 'Pedidos entregues', value: delivered.length, icon: Package, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pedidos ativos', value: active.length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Faturamento total', value: `R$ ${totalRevenue.toFixed(2)}`, icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Tempo médio (min)', value: avgTime, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif italic text-3xl text-accent-dark flex items-center gap-2">
          <BarChart3 className="text-accent" size={28} />
          Dashboard
        </h1>
        <p className="text-gray-500 text-sm">Visão geral do evento</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white rounded-3xl p-4 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-2xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales by hour */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <h2 className="font-serif italic text-lg text-accent-dark mb-4">Pedidos por hora</h2>
          {delivered.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              Sem dados ainda
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="pedidos" fill="#5A5A40" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top items */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <h2 className="font-serif italic text-lg text-accent-dark mb-4">Itens mais vendidos</h2>
          {topItems.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              Sem dados ainda
            </div>
          ) : (
            <div className="space-y-2">
              {topItems.map(({ name, qty }, i) => {
                const max = topItems[0].qty
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <span className="text-sm text-gray-700 w-28 truncate">{name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(qty / max) * 100}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className="bg-accent h-full rounded-full"
                      />
                    </div>
                    <span className="text-xs font-bold text-accent-dark w-6 text-right">{qty}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
