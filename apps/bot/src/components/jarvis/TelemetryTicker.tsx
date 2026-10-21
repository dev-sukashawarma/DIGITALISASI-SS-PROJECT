'use client'

import { useEffect, useMemo, useState } from 'react'
import { Terminal, Activity, ChevronUp, ChevronDown } from 'lucide-react'
import type { TelemetriHariIni } from '@/lib/server/telemetriNyata'

interface TelemetryTickerProps {
  diambilAt: string | null
  pollingGagal: boolean
  totalActive: number
  telemetri?: TelemetriHariIni | null
}

const LOGS_BAWAAN = [
  'SYSTEM_INIT: Hermes Gateway established @ 127.0.0.1:8643',
  'SECURITY: SSO Session authorized (Clearance Level 5 - CEO)',
  'MCP_ORCHESTRATOR: Suka Telemetry Protocol v2.0 All-Division Linked',
  'VOICE_ENGINE: Edge Neural TTS (id-ID-ArdiNeural) Ready',
]

function fmtRpSingkat(n: number): string {
  if (!n || isNaN(n)) return 'Rp 0'
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2).replace('.', ',')} M`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')} Jt`
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)} Rb`
  return `Rp ${n}`
}

export default function TelemetryTicker({
  diambilAt,
  pollingGagal,
  totalActive,
  telemetri,
}: TelemetryTickerProps) {
  const [bukaDetail, setBukaDetail] = useState(false)
  const [indexLog, setIndexLog] = useState(0)
  const [waktuSekarang, setWaktuSekarang] = useState('')

  const daftarLogs = useMemo(() => {
    if (!telemetri) return LOGS_BAWAAN

    const logs: string[] = []
    const topHariIni = telemetri.outletsAktifTransaksi?.[0]
    const topKemarin = telemetri.ringkasanKemarin?.outletsAktifTransaksi?.[0]

    logs.push(
      `POS_LIVE: Omzet Hari Ini ${fmtRpSingkat(telemetri.omzetTotal)} (${telemetri.totalOrder} struk) • ${telemetri.outletsAktifTransaksi?.length ?? 0}/${telemetri.totalOutletAktif} Cabang Aktif`
    )

    if (telemetri.ringkasanKemarin) {
      logs.push(
        `CLOSING_YESTERDAY: Total Penjualan Kemarin ${fmtRpSingkat(telemetri.ringkasanKemarin.omzetTotal)} (${telemetri.ringkasanKemarin.totalOrder} struk) • AOV ${fmtRpSingkat(telemetri.ringkasanKemarin.aov)}`
      )
    }

    if (topHariIni) {
      logs.push(
        `TOP_BRANCH_TODAY: #1 ${topHariIni.nama} memimpin dengan ${fmtRpSingkat(topHariIni.omzet)} (${topHariIni.orderCount} struk)`
      )
    } else if (topKemarin) {
      logs.push(
        `TOP_BRANCH_YESTERDAY: #1 ${topKemarin.nama} mencetak ${fmtRpSingkat(topKemarin.omzet)} (${topKemarin.orderCount} struk)`
      )
    }

    if (telemetri.finance) {
      const overdue = telemetri.finance.utangPo.totalLewatJatuhTempo
      logs.push(
        `FINANCE_VAULT: OPEX Hari Ini ${fmtRpSingkat(telemetri.finance.pengeluaranHariIni.totalNominal)} • Utang PO ${fmtRpSingkat(telemetri.finance.utangPo.totalUtang)}${overdue > 0 ? ` (OVERDUE ${fmtRpSingkat(overdue)})` : ' (0 Overdue)'}`
      )
    }

    if (telemetri.statusBuka && telemetri.waste) {
      logs.push(
        `OPS_AUDIT: Shift Buka ${telemetri.statusBuka.totalBuka} Cabang • Void Hari Ini ${telemetri.voidOrder?.totalVoidHariIni ?? 0} struk • Waste 30H ${fmtRpSingkat(telemetri.waste.totalEstKerugianRp)}`
      )
    }

    logs.push(
      `WORKFORCE_SENTIMENT: Presensi Kru ${telemetri.persenOnTime}% On-Time (${telemetri.kehadiranTelat} telat) • Rating Google Maps ${telemetri.review?.ratingRataRata ?? 4.8} ⭐`
    )

    return [...logs, ...LOGS_BAWAAN]
  }, [telemetri])

  useEffect(() => {
    const updateWaktu = () => {
      const d = new Date()
      setWaktuSekarang(
        d.toLocaleTimeString('id-ID', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
      )
    }
    updateWaktu()
    const timer = setInterval(updateWaktu, 200)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const logInterval = setInterval(() => {
      setIndexLog((prev) => (prev + 1) % daftarLogs.length)
    }, 4200)
    return () => clearInterval(logInterval)
  }, [daftarLogs.length])

  const logAktif = daftarLogs[indexLog % daftarLogs.length] ?? LOGS_BAWAAN[0]

  return (
    <footer className="relative border-t border-cyan-500/20 bg-zinc-950/90 backdrop-blur-md z-30 select-none shrink-0">
      {/* Detail Log Expanded Drawer */}
      {bukaDetail && (
        <div className="p-3 border-b border-cyan-500/20 bg-black/95 font-mono-hud text-xs text-cyan-300/85 max-h-48 overflow-y-auto space-y-1">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-[10px] text-zinc-400">
            <span>REAL-TIME ALL-DIVISION TELEMETRY STREAM</span>
            <span className="text-cyan-400">J.A.R.V.I.S. LIVE FEED</span>
          </div>
          {daftarLogs.map((log, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5 hover:text-cyan-100">
              <span className="text-zinc-500 text-[10px] shrink-0">[{waktuSekarang}]</span>
              <span>&gt; {log}</span>
            </div>
          ))}
          {diambilAt && (
            <div className="flex items-start gap-2 py-0.5 text-emerald-400">
              <span className="text-zinc-500 text-[10px] shrink-0">[{waktuSekarang}]</span>
              <span>&gt; SUPABASE_SYNC_OK: Snapshot diterima pada {diambilAt}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Single-line Ticker */}
      <div className="max-w-[1700px] mx-auto px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-hud">
        {/* Left: Terminal Icon + Status */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
            <Terminal className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-bold text-[10px] tracking-wider uppercase">LIVE TELEMETRY</span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                pollingGagal ? 'bg-red-500 animate-ping' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="text-[11px] text-zinc-300">
              {pollingGagal ? 'TELEMETRY DISCONNECTED' : `LINK STABLE (${totalActive} DIVISIONS)`}
            </span>
          </div>
        </div>

        {/* Center: Cycling Active Live Database Headline */}
        <div className="hidden md:flex items-center gap-2 text-cyan-300/90 text-[11px] overflow-hidden max-w-xl lg:max-w-2xl flex-1 justify-center">
          <span className="text-cyan-500 font-bold select-none shrink-0">&gt;&gt;</span>
          <span key={indexLog} className="truncate animate-in fade-in duration-300">
            {logAktif}
          </span>
        </div>

        {/* Right: Timestamp & Expand button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300 font-semibold">{waktuSekarang || '00:00:00.000'}</span>
            <span className="text-[10px] text-zinc-500">WIB</span>
          </div>

          <button
            type="button"
            onClick={() => setBukaDetail(!bukaDetail)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-400 hover:text-cyan-300 hover:border-cyan-500/40 text-[10px] transition-colors cursor-pointer"
          >
            <span>CONSOLE</span>
            {bukaDetail ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </footer>
  )
}
