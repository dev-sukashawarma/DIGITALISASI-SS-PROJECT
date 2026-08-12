'use client'

import React, { useEffect, useState } from 'react'
import { fetchOrdersGlobal } from '../actions/orderActions'
import { Search, ShoppingCart, Loader2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

export default function GlobalOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [outletFilter, setOutletFilter] = useState('')

  useEffect(() => {
    loadOrders()
  }, [outletFilter])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const data = await fetchOrdersGlobal(100, outletFilter)
      setOrders(data)
    } catch (err: any) {
      toast.error('Failed to load orders: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(o => 
    o.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const uniqueOutlets = Array.from(new Set(orders.map(o => o.outlet_id).filter(Boolean)))

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-indigo-500" /> Global Orders
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Bypass limits to view and manage all orders.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select 
            className="px-4 py-2 bg-white/60 backdrop-blur-md border border-white/60 rounded-full shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-slate-700"
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
          >
            <option value="">All Outlets</option>
            {uniqueOutlets.map(id => {
              const name = orders.find(o => o.outlet_id === id)?.outlets?.name || id
              return <option key={id} value={id}>{name}</option>
            })}
          </select>

          <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-md border border-white/60 rounded-full shadow-sm w-full sm:w-auto">
            <Search size={18} className="text-slate-400" />
            <input 
              type="text"
              placeholder="Search receipt..."
              className="bg-transparent border-none outline-none text-sm text-slate-700 w-full sm:w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/50 text-slate-700 font-bold uppercase text-xs tracking-wider border-b border-white/60">
              <tr>
                <th className="px-6 py-4">Receipt</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Outlet</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Method/Source</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              <AnimatePresence>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
                    </td>
                  </tr>
                ) : filteredOrders.map((order) => (
                  <motion.tr 
                    key={order.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-white/40 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 font-mono">{order.receipt_number || 'N/A'}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate w-24" title={order.id}>{order.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar size={14} />
                        {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy, HH:mm') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-700">{order.outlets?.name || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">
                        Rp {order.total_amount?.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold w-fit">
                            {order.payment_method || 'Unknown'}
                          </span>
                          {order.is_endorse && (
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold w-fit border border-orange-200 shadow-sm whitespace-nowrap">
                              ENDORSE
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                          {order.order_source || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {order.status || 'unknown'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {!loading && filteredOrders.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-medium">
              No orders found matching your criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
