'use client'

import { useEffect, useState, useCallback } from 'react'
import { Store, AlertTriangle, RotateCw, History, ArrowRight } from 'lucide-react'
import { BoardHeader } from '@/components/BoardHeader'
import { BoardSkeleton } from '@/components/BoardSkeleton'
import { BentoLeftDeck } from '@/components/BentoLeftDeck'
import { FleetRightDeck } from '@/components/FleetRightDeck'
import { StaleWarningBanner } from '@/components/StaleWarningBanner'
import { useBoard, type BoardMode } from '@/hooks/useBoard'
import { useFlipList } from '@/hooks/useFlipList'
import { computeDelta } from '@/lib/compare'
import type { BoardRow } from '@/lib/types'

const RUPIAH_KEY = 'sales-board:show-rupiah'
const THEME_KEY = 'sales-board:theme'

export default function Page() {
  const [mode, setMode] = useState<BoardMode>('auto')
  const { data, lastOk, stale, error, refetch } = useBoard(mode)
  const [showRupiah, setShowRupiah] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [nowLabel, setNowLabel] = useState('')
  const [simulatedRows, setSimulatedRows] = useState<BoardRow[] | null>(null)

  // Sinkronisasi state lokal di klien untuk menghindari hidrasi mismatch
  useEffect(() => {
    try {
      const savedRupiah = window.localStorage.getItem(RUPIAH_KEY)
      if (savedRupiah !== null) {
        setShowRupiah(savedRupiah === '1')
      }

      const savedTheme = window.localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme)
      } else {
        setTheme('dark') // Default TV display
      }
    } catch {
      /* Mode privat / storage diblokir */
    }
  }, [])

  // Jam berjalan WIB
  useEffect(() => {
    const tick = () => {
      setNowLabel(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()) + ' WIB',
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Reset baris simulasi saat payload network baru tiba
  useEffect(() => {
    if (data?.rows) {
      setSimulatedRows(null)
    }
  }, [data?.generatedAt])

  const toggleRupiah = useCallback(() => {
    setShowRupiah((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(RUPIAH_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(THEME_KEY, next)
      } catch {}
      return next
    })
  }, [])

  // Simulasi pergeseran peringkat (Hotkey: S)
  const handleSimulateShift = useCallback(() => {
    const baseRows = simulatedRows || data?.rows
    if (!baseRows || baseRows.length < 3) return

    // Pilih outlet acak antara peringkat 2 sampai 8 untuk menyalip posisi di atasnya
    const poolSize = Math.min(8, baseRows.length - 1)
    const targetIdx = Math.floor(Math.random() * (poolSize - 1)) + 1
    const overtakeIdx = targetIdx - 1

    const targetRow = baseRows[targetIdx]
    const aboveRow = baseRows[overtakeIdx]

    // Hitung penambahan pcs agar target menyalip posisi di atasnya (+6 s/d +16 pcs)
    const pcsDiff = aboveRow.pcsToday - targetRow.pcsToday
    const boostPcs = Math.max(6, pcsDiff + Math.floor(Math.random() * 8) + 4)

    const updated = baseRows.map((r, idx) => {
      if (idx === targetIdx) {
        return {
          ...r,
          pcsToday: r.pcsToday + boostPcs,
          trxToday: r.trxToday + Math.max(1, Math.round(boostPcs / 1.5)),
          omzetToday: r.omzetToday + boostPcs * 31000,
        }
      }
      return r
    })

    // Sortir ulang descending berdasarkan pcsToday
    updated.sort((a, b) => b.pcsToday - a.pcsToday)
    setSimulatedRows(updated)
  }, [simulatedRows, data?.rows])

  // Pintasan Keyboard TV: 'R' (Rupiah), 'T' (Theme), 'F' (Fullscreen), 'S' (Simulasi Pergeseran)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        toggleRupiah()
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        toggleTheme()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        handleSimulateShift()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleRupiah, toggleTheme, handleSimulateShift])

  const activeRows = simulatedRows || (data ? data.rows : [])
  const { registerRow, shifts } = useFlipList(activeRows)

  // Tampilan skeleton saat memuat awal
  if (!data && !error) {
    return (
      <main className={`min-h-screen theme-${theme} bg-[var(--bg-page)] text-[var(--text-primary)] transition-colors duration-300`}>
        <BoardSkeleton />
      </main>
    )
  }

  // Tampilan penanganan galat
  if (!data && error) {
    return (
      <main className={`grid min-h-screen place-items-center theme-${theme} bg-[var(--bg-page)] p-6 transition-colors duration-300`}>
        <div className="max-w-md rounded-2xl border border-rose-500/30 bg-[var(--card-bg)] p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 mb-4">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Gagal Menghubungi Papan</h2>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Terjadi kendala saat mengambil data monitoring penjualan.
          </p>
          <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs font-mono text-rose-300">
            {error}
          </div>
          <button
            onClick={() => void refetch()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 hover:bg-amber-400 active:scale-[0.97] transition-all shadow-sm"
          >
            <RotateCw size={14} />
            Coba Sinkron Ulang
          </button>
        </div>
      </main>
    )
  }

  const empty = activeRows.length === 0 || activeRows.every((r) => r.pcsToday === 0)
  const isYesterday = Boolean(data?.isYesterday)

  // Metrik agregasi keseluruhan untuk Telemetry HUD
  const totalPcs = activeRows.reduce((acc, r) => acc + r.pcsToday, 0)
  const totalTrx = activeRows.reduce((acc, r) => acc + r.trxToday, 0)
  const totalOmzet = activeRows.reduce((acc, r) => acc + r.omzetToday, 0)
  const totalBasePcs = activeRows.reduce((acc, r) => acc + (r.pcsBase ?? 0), 0)
  const overallPcsDelta = computeDelta(totalPcs, totalBasePcs)

  return (
    <main
      className={`relative min-h-screen theme-${theme} bg-[var(--bg-page)] text-[var(--text-primary)] transition-colors duration-300 flex flex-col p-4 lg:p-5 gap-3 lg:gap-3.5 max-w-[1920px] mx-auto`}
    >
      {/* Background Ambient Flare & Cyber Grid Pattern */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cyber-grid bg-ambient-flare opacity-85"
      />

      <div className="relative z-10 flex flex-col gap-3 lg:gap-3.5 flex-1">
        {/* Banner Peringatan jika data tertunda / stale */}
        {stale && <StaleWarningBanner lastOk={lastOk} errorMessage={error} />}

        {/* Header Utama Papan */}
        <BoardHeader
          lastOk={lastOk}
          stale={stale}
          showRupiah={showRupiah}
          onToggleRupiah={toggleRupiah}
          theme={theme}
          onToggleTheme={toggleTheme}
          nowLabel={nowLabel}
          onSimulateShift={handleSimulateShift}
        />

        {/* Banner Informasi: Menampilkan Data Kemarin jika Hari Ini Belum Buka */}
        {isYesterday && (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-amber-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-400">
                <History size={11} />
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-amber-500/25 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/40">
                  REKAP KEMARIN
                </span>
                <strong className="font-bold text-amber-100">
                  {data?.yesterdayLabel}
                </strong>
                <span className="hidden md:inline text-[11px] text-amber-300/80">
                  - Menampilkan data hari sebelumnya (outlet belum mulai transaksi hari ini).
                </span>
                {simulatedRows && (
                  <span className="rounded bg-sky-500/20 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider text-sky-300 border border-sky-500/30">
                    SIMULASI SALIP AKTIF [S]
                  </span>
                )}
              </div>
            </div>

            {/* Selector Mode Manual (Kemarin vs Hari Ini) */}
            <div className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-black/30 p-0.5 text-[11px] font-bold shrink-0">
              <button
                onClick={() => {
                  setSimulatedRows(null)
                  setMode('yesterday')
                }}
                className={`rounded px-2 py-0.5 active:scale-[0.97] transition-all cursor-pointer ${
                  mode === 'yesterday' || mode === 'auto'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-amber-300/70 hover:text-white'
                }`}
              >
                Kemarin
              </button>
              <button
                onClick={() => {
                  setSimulatedRows(null)
                  setMode('today')
                }}
                className={`rounded px-2 py-0.5 active:scale-[0.97] transition-all cursor-pointer ${
                  mode === 'today'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-amber-300/70 hover:text-white'
                }`}
              >
                Hari Ini
              </button>
            </div>
          </div>
        )}

        {/* Jika mode dipaksa 'today' dan belum ada transaksi */}
        {empty && !isYesterday ? (
          <div className="mx-auto max-w-xl my-auto px-6 py-20 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 shadow-inner">
              <Store size={28} />
            </div>
            <h2 className="mt-4 text-xl font-black text-[var(--text-primary)]">
              Papan Siap - Belum Ada Penjualan Hari Ini
            </h2>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Sistem monitoring real-time aktif. Angka penjualan dan urutan ranking outlet akan langsung muncul otomatis begitu transaksi kasir pertama dicatat.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => {
                  setSimulatedRows(null)
                  setMode('auto')
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30 active:scale-[0.97] transition-all cursor-pointer"
              >
                <History size={13} />
                <span>Tampilkan Rekap Kemarin Dulu</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        ) : data ? (
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 flex-1 items-stretch">
            {/* 1. Left Deck (50%): Apex Hero #1 + Dual Wings #2 & #3 + 4 Bento KPI Stats */}
            <div className="w-full lg:w-1/2 flex flex-col">
              <BentoLeftDeck
                p1={activeRows[0]}
                p2={activeRows[1]}
                p3={activeRows[2]}
                summary={{
                  totalPcs,
                  totalTrx,
                  totalOmzet,
                  pcsDelta: overallPcsDelta,
                }}
                showRupiah={showRupiah}
                registerRow={registerRow}
                shifts={shifts}
              />
            </div>

            {/* 2. Right Deck (50%): Standings Fleet Grid (Ranks 4 - 20) */}
            <div className="w-full lg:w-1/2 flex flex-col">
              <FleetRightDeck
                rows={activeRows}
                showRupiah={showRupiah}
                registerRow={registerRow}
                shifts={shifts}
              />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
