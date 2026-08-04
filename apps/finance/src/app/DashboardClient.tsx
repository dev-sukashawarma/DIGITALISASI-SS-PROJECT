'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, Landmark, Banknote, Clock, History } from 'lucide-react'
import NumberFlow from '@number-flow/react'

import { Spinner, EmptyState } from '@suka/design-system'
import { useCashOverview, useCashTransactions } from '@/hooks/useCashData'
import { usePettyCashRequests } from '@/hooks/usePettyCash'
import { summarizeBalances, countPendingApproval } from '@/lib/cashSummary'
import { tanggal, rupiah } from '@/lib/format'
import { TxStatusBadge } from '@/components/ui'
import OutletRevenueTab from '@/components/OutletRevenueTab'
import PettyCashExpensesTab from '@/components/PettyCashExpensesTab'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 15 } }
}

export default function DashboardClient() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') ?? 'overview'
  const [activeTab, setActiveTab] = useState(initialTab)
  
  // Sync state if URL changes
  useEffect(() => {
    const tab = searchParams.get('tab')
    setActiveTab(tab ?? 'overview')
  }, [searchParams])

  const { locations, isLoading, error } = useCashOverview()
  const { data: txs = [], isLoading: loadingTx } = useCashTransactions(100)
  const { data: pettyCashRequests } = usePettyCashRequests('forwarded_to_finance')

  const summary = summarizeBalances(locations)
  const pending = countPendingApproval(txs)
  const pettyPending = pettyCashRequests?.length || 0
  const totalTasks = pending + pettyPending

  // Notification flag & sound on new tasks
  const prevTasksRef = React.useRef(totalTasks)
  useEffect(() => {
    if (totalTasks > 0) {
      document.title = `(${totalTasks}) SS Digital`
    } else {
      document.title = 'SS Digital Dashboard'
    }

    if (totalTasks > prevTasksRef.current) {
      try {
        // Play simple notification beep
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
        oscillator.start()
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5)
        oscillator.stop(audioCtx.currentTime + 0.5)
      } catch (e) {
        console.warn("Could not play notification sound", e)
      }
    }
    prevTasksRef.current = totalTasks
  }, [totalTasks])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans text-suka-ink bg-suka-cream min-h-screen -mx-4 sm:-mx-6 -mt-6 sm:-mt-8 pb-20">
      
      {/* Playful Header */}
      <header className="bg-suka-primary text-white p-6 md:p-10 rounded-b-[40px] shadow-lg shadow-suka-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-10 w-40 h-40 bg-suka-brown opacity-10 rounded-full blur-xl"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 100 }}>
            <p className="text-white/80 font-medium mb-1">Net Cash Dashboard 👋</p>
            <h1 className="font-display text-4xl md:text-5xl tracking-wide">Saldo &amp; Mutasi</h1>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ type: 'spring', delay: 0.2 }}
            className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="bg-white text-suka-primary p-3 rounded-xl shadow-inner">
              <Wallet size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Total Kas Keseluruhan</p>
              <p className="font-display text-2xl flex items-baseline">
                <span className="text-sm mr-1">Rp</span>
                <NumberFlow value={summary.total} />
              </p>
            </div>
          </motion.div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8">
        
        {/* Navigation Pills */}
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'transaksi', label: 'Transaksi' },
            { id: 'tugas', label: 'Tugas', badge: pending + pettyPending > 0 ? pending + pettyPending : undefined },
            { id: 'omzet', label: 'Omzet Outlet' },
            { id: 'petty-cash', label: 'Petty Cash Outlet' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-6 py-2.5 rounded-full text-sm font-bold capitalize transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              {activeTab === tab.id ? (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-suka-brown rounded-full"
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                />
              ) : null}
              <span className={`relative z-10 ${activeTab === tab.id ? 'text-white' : 'text-suka-ink/60 hover:text-suka-ink'}`}>
                {tab.label}
              </span>
              {tab.badge !== undefined && (
                <span className={`relative z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-suka-orange text-white' 
                    : 'bg-red-500 text-white'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* Main Metric Cards */}
              <motion.div variants={itemAnim} className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-xl hover:shadow-suka-green/10 transition-all">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
                          <Landmark size={20} />
                        </div>
                      </div>
                      <p className="text-suka-ink/60 text-sm font-bold uppercase tracking-wider mb-1">Saldo Bank</p>
                      <h3 className="font-display text-3xl text-suka-ink flex items-baseline">
                        <span className="text-lg mr-1 font-sans font-bold">Rp</span>
                        <NumberFlow value={summary.totalBank} />
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-xl hover:shadow-suka-primary/10 transition-all">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-orange-100 p-2.5 rounded-xl text-suka-orange">
                          <Banknote size={20} />
                        </div>
                      </div>
                      <p className="text-suka-ink/60 text-sm font-bold uppercase tracking-wider mb-1">Kas Tunai (Mengendap)</p>
                      <h3 className="font-display text-3xl text-suka-ink flex items-baseline">
                        <span className="text-lg mr-1 font-sans font-bold">Rp</span>
                        <NumberFlow value={summary.totalCash} />
                      </h3>
                    </div>
                  </div>
                </div>

              </motion.div>

              {/* Saldo per Lokasi */}
              <motion.div variants={itemAnim} className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 md:row-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-xl text-suka-brown">Saldo per Lokasi</h3>
                </div>
                
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Spinner size={28} /></div>
                  ) : locations.filter(l => l.scope !== 'outlet').length === 0 ? (
                    <EmptyState title="Belum ada rekening/kas" description="Tambahkan di menu Rekening & Kas." />
                  ) : (
                    locations.filter(l => l.scope !== 'outlet').map((l) => (
                      <motion.div 
                        key={l.id} 
                        whileHover={{ x: 4 }}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-suka-cream transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border ${l.kind === 'bank' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-orange-50 text-suka-orange border-orange-200'}`}>
                            {l.kind === 'bank' ? 'BANK' : 'TUNAI'}
                          </span>
                          <div>
                            <p className="font-bold text-sm text-suka-ink">{l.label}</p>
                            {l.bank_name && <p className="text-[10px] font-semibold text-suka-gray-400 mt-0.5">{l.bank_name} · {l.account_no}</p>}
                          </div>
                        </div>
                        <span className={`font-black text-sm ${l.saldo < 0 ? 'text-red-600' : 'text-suka-brown'}`}>
                          {rupiah(l.saldo)}
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Aktivitas Terbaru */}
              <motion.div variants={itemAnim} className="md:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-xl text-suka-brown">Aktivitas Terbaru</h3>
                  <button className="text-suka-primary hover:text-suka-primary/80 transition-colors">
                    <History size={20} />
                  </button>
                </div>

                <div className="space-y-2">
                  {loadingTx ? (
                    <div className="flex justify-center py-8"><Spinner size={28} /></div>
                  ) : txs.length === 0 ? (
                    <EmptyState title="Belum ada transaksi" />
                  ) : (
                    txs.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-3 border-b border-suka-brown/5 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-suka-brown text-sm">
                            {t.cash_location?.label ?? '—'} · <span className="text-suka-gray-400 font-semibold">{t.category ?? t.source_type}</span>
                          </p>
                          <p className="text-[10px] font-black tracking-wider uppercase text-suka-gray-400 mt-0.5">{tanggal(t.occurred_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold text-sm ${t.direction === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {t.direction === 'in' ? '+' : '−'}{rupiah(t.amount)}
                          </span>
                          <TxStatusBadge status={t.status} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>


            </motion.div>
          )}

          {activeTab === 'tugas' && (
            <motion.div 
              key="tugas"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 flex flex-col gap-4">
                <div className="bg-red-50 text-red-600 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-suka-ink/60 text-sm font-bold uppercase tracking-wider">Menunggu Approval Tx</p>
                  <h3 className="font-display text-4xl text-suka-ink mt-2">
                    <NumberFlow value={pending} />
                  </h3>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 flex flex-col gap-4">
                <div className="bg-orange-50 text-suka-orange w-12 h-12 rounded-2xl flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-suka-ink/60 text-sm font-bold uppercase tracking-wider">Petty Cash Menunggu</p>
                  <h3 className="font-display text-4xl text-suka-ink mt-2">
                    <NumberFlow value={pettyPending} />
                  </h3>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'omzet' && (
            <motion.div
              key="omzet"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}
            >
              <OutletRevenueTab />
            </motion.div>
          )}

          {activeTab === 'petty-cash' && (
            <motion.div
              key="petty-cash"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}
            >
              <PettyCashExpensesTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
