'use client'
import { useState, useMemo } from 'react'
import type { AggregatedMenuSales } from '@/app/actions/menuSales'
import { rupiah } from '@/lib/format'
import { Crown } from 'lucide-react'
import { motion } from 'framer-motion'

export function TopMenus({ rows }: { rows: AggregatedMenuSales[] }) {
  const [mode, setMode] = useState<'qty' | 'revenue'>('qty')

  const list = useMemo(() => {
    return [...rows].sort((a, b) => b[mode] - a[mode]).slice(0, 10)
  }, [rows, mode])

  // Get max value to compute percentage width for progress bars
  const maxValue = useMemo(() => {
    if (list.length === 0) return 1
    return Math.max(...list.map(item => item[mode]))
  }, [list, mode])

  return (
    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4 flex flex-col h-full">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Menu Terlaris</h3>
          
          {/* Custom segmented control switcher */}
          <div className="bg-suka-cream p-0.5 rounded-lg border border-suka-brown/5 flex gap-0.5 text-[10px] font-bold">
            <button 
              onClick={() => setMode('qty')} 
              className={`px-3 py-1 rounded-md transition-all ${
                mode === 'qty' 
                  ? 'bg-suka-orange text-white shadow-sm' 
                  : 'text-suka-brown/60 hover:text-suka-brown'
              }`}
            >
              Porsi (Qty)
            </button>
            <button 
              onClick={() => setMode('revenue')} 
              className={`px-3 py-1 rounded-md transition-all ${
                mode === 'revenue' 
                  ? 'bg-suka-orange text-white shadow-sm' 
                  : 'text-suka-brown/60 hover:text-suka-brown'
              }`}
            >
              Omzet (Rp)
            </button>
          </div>
        </div>
        <p className="text-xs text-suka-gray-400 font-semibold mt-0.5">Menu terpopuler berdasarkan pesanan completed</p>
      </div>

      <div className="flex-1 mt-4">
        {list.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">
            Belum ada data menu
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
              hidden: {},
            }}
            className="space-y-4"
          >
            {list.map((m, i) => {
              const currentValue = m[mode]
              const percentOfMax = maxValue > 0 ? (currentValue / maxValue) * 100 : 0
              
              // Rank indicator colors
              const isTop3 = i < 3
              const rankColors = [
                'text-yellow-600 bg-yellow-50 border-yellow-200',  // 1st: Gold
                'text-slate-500 bg-slate-50 border-slate-200',     // 2nd: Silver
                'text-amber-700 bg-amber-50 border-amber-200',     // 3rd: Bronze
              ]
              
              return (
                <motion.div 
                  key={m.name} 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                  }}
                  className="space-y-1.5 group"
                >
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 font-bold text-suka-ink truncate mr-4">
                      {/* Stylized Rank Badge */}
                      <span 
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] border font-extrabold ${
                          isTop3 ? rankColors[i] : 'text-suka-gray-400 bg-suka-gray-50 border-suka-gray-100'
                        }`}
                      >
                        {i === 0 && isTop3 ? <Crown className="w-3 h-3" /> : i + 1}
                      </span>
                      <span className="truncate text-suka-ink font-bold">{m.name}</span>
                    </div>
                    <span className="font-extrabold text-suka-brown whitespace-nowrap">
                      {mode === 'qty' ? `${m.qty} porsi` : rupiah(m.revenue)}
                    </span>
                  </div>
                  
                  {/* Progress bar representing share relative to the top seller */}
                  <div className="w-full h-1.5 bg-suka-gray-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${percentOfMax}%`,
                        backgroundColor: i === 0 ? '#701604' : i === 1 ? '#f29744' : '#d9c2b2' 
                      }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </div>
  )
}
