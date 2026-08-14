'use client'

import React from 'react'
import { Activity, Server, Database, Clock, RefreshCw } from 'lucide-react'

export default function SystemHealthPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="text-indigo-500" /> System Health
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Monitor backend services and database status.</p>
        </div>
        
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full border border-indigo-200 shadow-sm font-bold text-sm transition-colors active:scale-95">
          <RefreshCw size={16} /> Refresh Status
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Server className="text-indigo-500" size={24} />
            <h2 className="text-xl font-bold text-slate-800">API Servers</h2>
          </div>
          <div className="space-y-4">
            <StatusItem name="Next.js App Router" status="Operational" latency="12ms" />
            <StatusItem name="Realtime WebSockets" status="Operational" latency="24ms" />
            <StatusItem name="Background Workers" status="Degraded" latency="140ms" warning />
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Database className="text-indigo-500" size={24} />
            <h2 className="text-xl font-bold text-slate-800">Supabase Database</h2>
          </div>
          <div className="space-y-4">
            <StatusItem name="Primary Region (SGP)" status="Operational" latency="45ms" />
            <StatusItem name="Read Replica" status="Operational" latency="12ms" />
            <StatusItem name="Storage API" status="Operational" latency="80ms" />
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 shadow-xl border border-slate-700 text-white relative overflow-hidden">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-400">
          <Clock size={20} /> Real-time System Logs
        </h2>
        <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-slate-300 h-64 overflow-y-auto space-y-2">
          <LogLine time="10:42:01" level="INFO" msg="User authentication successful (ID: 8x92...)" />
          <LogLine time="10:41:45" level="WARN" msg="Worker queue delay exceeding 5 seconds" />
          <LogLine time="10:41:22" level="INFO" msg="Realtime channel 'public:pos_sales' subscribed" />
          <LogLine time="10:40:10" level="ERROR" msg="Failed to sync external menu: timeout" />
          <LogLine time="10:39:05" level="INFO" msg="Database backup completed successfully" />
        </div>
      </div>
    </div>
  )
}

function StatusItem({ name, status, latency, warning = false }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/50 border border-slate-100">
      <div className="font-semibold text-slate-700">{name}</div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-slate-400">{latency}</span>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          warning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {status}
        </span>
      </div>
    </div>
  )
}

function LogLine({ time, level, msg }: any) {
  const levelColor = {
    INFO: 'text-blue-400',
    WARN: 'text-amber-400',
    ERROR: 'text-rose-400'
  }[level as string]

  return (
    <div className="flex gap-3">
      <span className="text-slate-500">[{time}]</span>
      <span className={`font-bold w-12 ${levelColor}`}>{level}</span>
      <span className="text-slate-200">{msg}</span>
    </div>
  )
}
