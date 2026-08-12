import type { LeaderboardEntry } from '@/lib/leaderboard'
import { rupiah, rupiahCompact } from '@/lib/format'
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'

export function OutletLeaderboard({ entries, allOutlets }: { entries: LeaderboardEntry[], allOutlets: {id: string, name: string}[] }) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const fullEntries = useMemo(() => {
    const map = new Map<string, LeaderboardEntry>()
    for (const e of entries) {
      map.set(e.outlet_id, e)
    }
    
    // Merge with all outlets to include those with 0 sales
    const combined = allOutlets.map(o => {
      if (map.has(o.id)) return map.get(o.id)!
      return {
        outlet_id: o.id,
        outlet_name: o.name,
        omzet: 0,
        orders: 0,
        aov: 0,
        deltaPct: null
      } as LeaderboardEntry
    })
    
    // Sort by omzet descending
    return combined.sort((a, b) => b.omzet - a.omzet)
  }, [entries, allOutlets])

  const displayedEntries = query.trim() === '' 
    ? (showAll ? fullEntries : fullEntries.slice(0, 5))
    : fullEntries.filter(e => e.outlet_name.toLowerCase().includes(query.toLowerCase()))

  const hasMore = query.trim() === '' && fullEntries.length > 5

  return (
    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Leaderboard Kinerja Outlet</h3>
          <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">Peringkat outlet berdasarkan omzet penjualan terkomparasi</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-suka-gray-400" />
          <input 
            type="text" 
            placeholder="Cari outlet..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-sm outline-none transition-all w-64"
          />
        </div>
      </div>

      <div className="-mx-6 sm:mx-0">
        {/* --- Mobile View (Stacked Cards) --- */}
        <div className="block sm:hidden space-y-3 px-6">
          {displayedEntries.map((e) => {
            const originalIndex = fullEntries.findIndex(x => x.outlet_id === e.outlet_id)
            const rankDisplay = originalIndex + 1

            const rankColor = originalIndex === 0 
              ? 'bg-yellow-500 text-white' 
              : originalIndex === 1 
              ? 'bg-slate-400 text-white' 
              : originalIndex === 2 
              ? 'bg-amber-600 text-white' 
              : 'bg-suka-gray-100 text-suka-gray-500'

            const deltaColor = e.deltaPct == null 
              ? 'text-suka-gray-400 bg-suka-gray-50' 
              : e.deltaPct >= 0 
              ? 'text-suka-green bg-green-50 border-green-200/50' 
              : 'text-red-700 bg-red-50 border-red-200/50'

            const cleanOutletName = e.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase()

            return (
              <div key={e.outlet_id} className="bg-white border border-suka-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${rankColor}`}>
                      {rankDisplay}
                    </span>
                    <span className="font-bold text-suka-ink text-sm truncate">{cleanOutletName}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold border shrink-0 ${deltaColor}`}>
                    {e.deltaPct == null 
                      ? '—' 
                      : `${e.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(e.deltaPct).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta',  maximumFractionDigits: 1 })}%`
                    }
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-suka-gray-50">
                  <div>
                    <p className="text-[10px] text-suka-gray-400 font-bold uppercase mb-0.5">Omzet</p>
                    <p className="font-extrabold text-suka-brown text-sm">{rupiahCompact(e.omzet)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-suka-gray-400 font-bold uppercase mb-0.5">Order</p>
                    <p className="font-extrabold text-suka-gray-700 text-sm">{e.orders.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-suka-gray-400 font-bold uppercase mb-0.5">AOV</p>
                    <p className="font-extrabold text-suka-gray-700 text-sm">{rupiahCompact(e.aov)}</p>
                  </div>
                </div>
              </div>
            )
          })}
          {displayedEntries.length === 0 && (
            <div className="py-8 text-center text-suka-gray-400 font-semibold">
              Tidak ada outlet yang sesuai pencarian
            </div>
          )}
        </div>

        {/* --- Desktop View (Table) --- */}
        <div className="hidden sm:block overflow-x-auto">
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
            {displayedEntries.map((e) => {
              // Determine original rank by finding index in the full entries array
              const originalIndex = fullEntries.findIndex(x => x.outlet_id === e.outlet_id)
              const rankDisplay = originalIndex + 1

              const rankColor = originalIndex === 0 
                ? 'bg-yellow-500 text-white' 
                : originalIndex === 1 
                ? 'bg-slate-400 text-white' 
                : originalIndex === 2 
                ? 'bg-amber-600 text-white' 
                : 'bg-suka-gray-100 text-suka-gray-500'

              const deltaColor = e.deltaPct == null 
                ? 'text-suka-gray-400 bg-suka-gray-50' 
                : e.deltaPct >= 0 
                ? 'text-suka-green bg-green-50 border-green-200/50' 
                : 'text-red-700 bg-red-50 border-red-200/50'

              const cleanOutletName = e.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase()

              return (
                <tr 
                  key={e.outlet_id}
                  className="hover:bg-suka-cream/20 transition-colors"
                >
                  <td className="py-4 px-6 text-center">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold mx-auto ${rankColor}`}>
                      {rankDisplay}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-suka-ink font-bold">{cleanOutletName}</td>
                  <td className="py-4 px-6 text-right text-suka-brown font-extrabold">{rupiah(e.omzet)}</td>
                  <td className="py-4 px-6 text-right text-suka-gray-600">{e.orders.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
                  <td className="py-4 px-6 text-right text-suka-gray-600">{rupiah(e.aov)}</td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${deltaColor}`}>
                      {e.deltaPct == null 
                        ? '—' 
                        : `${e.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(e.deltaPct).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta',  maximumFractionDigits: 1 })}%`
                      }
                    </span>
                  </td>
                </tr>
              )
            })}
            {displayedEntries.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-suka-gray-400 font-semibold">
                  Tidak ada outlet yang sesuai pencarian
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm font-bold text-suka-orange hover:text-suka-brown transition-colors hover:underline px-4 py-2"
          >
            {showAll ? 'Tampilkan Lebih Sedikit' : 'Tampilkan Lebih Banyak'}
          </button>
        </div>
      )}
    </div>
  )
}
