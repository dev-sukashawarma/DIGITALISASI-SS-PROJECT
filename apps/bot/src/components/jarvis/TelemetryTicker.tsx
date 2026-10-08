'use client'

import { useEffect, useState } from 'react'
import { Terminal, Activity, ChevronUp, ChevronDown } from 'lucide-react'

interface TelemetryTickerProps {
  diambilAt: string | null
  pollingGagal: boolean
  totalActive: number
}

const LOGS_BAWAAN = [
  'SYSTEM_INIT: Hermes Gateway established @ 127.0.0.1:8643',
  'SECURITY: SSO Session authorized (Clearance Level 5)',
  'MCP_ORCHESTRATOR: Suka Telemetry Protocol v1.4 linked',
  'NODE_SYNC: 4 Satellite AI nodes initialized and ready',
  'CRON_WATCHDOG: OPEX expense reconciliation active',
  'DIAGNOSTIC: Latency to LLM Inference Gateway: 18ms',
]

export default function TelemetryTicker({
  diambilAt,
  pollingGagal,
  totalActive,
}: TelemetryTickerProps) {
  const [bukaDetail, setBukaDetail] = useState(false)
  const [indexLog, setIndexLog] = useState(0)
  const [waktuSekarang, setWaktuSekarang] = useState('')

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
      setIndexLog((prev) => (prev + 1) % LOGS_BAWAAN.length)
    }, 4500)
    return () => clearInterval(logInterval)
  }, [])

  return (
    <footer className="relative border-t border-cyan-500/20 bg-zinc-950/90 backdrop-blur-md z-30 select-none">
      {/* Detail Log Expanded Drawer */}
      {bukaDetail && (
        <div className="p-3 border-b border-cyan-500/20 bg-black/90 font-mono-hud text-xs text-cyan-300/80 max-h-48 overflow-y-auto space-y-1">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-[10px] text-zinc-400">
            <span>REAL-TIME SYSTEM DIAGNOSTIC LOGS</span>
            <span className="text-cyan-400">HERMES KERNEL STREAM</span>
          </div>
          {LOGS_BAWAAN.map((log, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5 hover:text-cyan-100">
              <span className="text-zinc-500 text-[10px]">[{waktuSekarang}]</span>
              <span>&gt; {log}</span>
            </div>
          ))}
          {diambilAt && (
            <div className="flex items-start gap-2 py-0.5 text-emerald-400">
              <span className="text-zinc-500 text-[10px]">[{waktuSekarang}]</span>
              <span>&gt; MCP_STATUS_UPDATE: Received telemetry packet ({diambilAt})</span>
            </div>
          )}
        </div>
      )}

      {/* Main Single-line Ticker */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-hud">
        {/* Left: Terminal Icon + Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
            <Terminal className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-bold text-[10px] tracking-wider uppercase">HERMES TELEMETRY</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${pollingGagal ? 'bg-red-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-[11px] text-zinc-300">
              {pollingGagal ? 'TELEMETRY DISCONNECTED' : `LINK STABLE (${totalActive} NODES)`}
            </span>
          </div>
        </div>

        {/* Center: Cycling Active Log Ticker */}
        <div className="hidden md:flex items-center gap-2 text-cyan-400/80 text-[11px] overflow-hidden max-w-md lg:max-w-lg">
          <span className="text-zinc-600 select-none">&gt;&gt;</span>
          <span className="truncate animate-in fade-in duration-300 key={indexLog}">
            {LOGS_BAWAAN[indexLog]}
          </span>
        </div>

        {/* Right: Timestamp & Expand button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300 font-semibold">{waktuSekarang || '00:00:00.000'}</span>
            <span className="text-[10px] text-zinc-500">WIB</span>
          </div>

          <button
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
