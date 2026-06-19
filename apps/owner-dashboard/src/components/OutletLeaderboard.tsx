import type { LeaderboardEntry } from '@/lib/leaderboard'
import { rupiah } from '@/lib/format'
import { motion, AnimatePresence } from 'framer-motion'

export function OutletLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm space-y-4">
      <div>
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Leaderboard Kinerja Outlet</h3>
        <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">Peringkat 19 outlet berdasarkan omzet penjualan terkomparasi</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-suka-gray-500 font-bold border-b border-suka-gray-100 bg-suka-cream/30">
              <th className="py-3 px-6 w-16 text-center">Rank</th>
              <th className="py-3 px-6">Nama Outlet</th>
              <th className="py-3 px-6 text-right">Omzet</th>
              <th className="py-3 px-6 text-right">Jumlah Order</th>
              <th className="py-3 px-6 text-right">AOV</th>
              <th className="py-3 px-6 text-center">Tren vs Lalu</th>
            </tr>
          </thead>
          <tbody className="font-medium divide-y divide-suka-gray-100">
            <AnimatePresence mode="popLayout">
              {entries.map((e, i) => {
                const rankColor = i === 0 
                  ? 'bg-yellow-500 text-white' 
                  : i === 1 
                  ? 'bg-slate-400 text-white' 
                  : i === 2 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-suka-gray-100 text-suka-gray-500'

                const deltaColor = e.deltaPct == null 
                  ? 'text-suka-gray-400 bg-suka-gray-50' 
                  : e.deltaPct >= 0 
                  ? 'text-suka-green bg-green-50 border-green-200/50' 
                  : 'text-red-700 bg-red-50 border-red-200/50'

                const cleanOutletName = e.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase()

                return (
                  <motion.tr 
                    key={e.outlet_id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 350, damping: 35 }}
                    className="hover:bg-suka-cream/20 transition-colors"
                  >
                    <td className="py-4 px-6 text-center">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${rankColor}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-suka-ink font-bold">{cleanOutletName}</td>
                    <td className="py-4 px-6 text-right text-suka-brown font-extrabold">{rupiah(e.omzet)}</td>
                    <td className="py-4 px-6 text-right text-suka-gray-600">{e.orders.toLocaleString('id-ID')}</td>
                    <td className="py-4 px-6 text-right text-suka-gray-600">{rupiah(e.aov)}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${deltaColor}`}>
                        {e.deltaPct == null 
                          ? '—' 
                          : `${e.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(e.deltaPct)}%`
                        }
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}
