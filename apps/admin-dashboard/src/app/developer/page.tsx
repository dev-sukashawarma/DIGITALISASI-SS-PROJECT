import React from 'react'
import { Activity, Database, Users, ShieldAlert, Cpu } from 'lucide-react'

export default function DeveloperOverviewPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Overview</h1>
          <p className="text-slate-500 mt-1 font-medium">Real-time health and global metrics</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-full border border-green-200 shadow-sm font-bold text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          All Systems Operational
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Users" 
          value="1,248" 
          trend="+12 this week" 
          icon={Users} 
          color="indigo" 
        />
        <StatCard 
          title="Database Latency" 
          value="45ms" 
          trend="Healthy" 
          icon={Database} 
          color="emerald" 
        />
        <StatCard 
          title="Active Sessions" 
          value="342" 
          trend="Peak time" 
          icon={Activity} 
          color="amber" 
        />
        <StatCard 
          title="Error Rate" 
          value="0.02%" 
          trend="-0.01% from yesterday" 
          icon={ShieldAlert} 
          color="rose" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/60 backdrop-blur-md border border-white/60 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Cpu className="text-indigo-500" />
            <h2 className="text-xl font-bold text-slate-800">Server Load</h2>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {/* Mock Chart */}
            {[40, 20, 60, 80, 50, 30, 70, 90, 45, 65, 85, 30, 50, 70, 40, 90, 60].map((h, i) => (
              <div 
                key={i} 
                className="w-full bg-indigo-100 rounded-t-lg relative group transition-all hover:bg-indigo-200"
                style={{ height: `${h}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 shadow-xl border border-slate-700 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[50px] rounded-full pointer-events-none" />
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TerminalIcon className="text-indigo-400" /> System Logs
          </h2>
          <div className="space-y-3 text-xs font-mono text-slate-300">
            <div className="flex gap-2">
              <span className="text-emerald-400">[OK]</span> 
              <span>Migrated outlet schemas successfully.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-400">[WARN]</span> 
              <span>High CPU usage detected on worker 2.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400">[OK]</span> 
              <span>Supabase realtime connection established.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400">[OK]</span> 
              <span>Daily backup completed in 14s.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, trend, icon: Icon, color }: any) {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }[color as string]

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow group cursor-default">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 font-medium text-sm mb-1">{title}</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-2xl ${colorClasses} group-hover:scale-110 transition-transform`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
      </div>
      <div className="mt-4 text-sm font-medium text-slate-500">
        {trend}
      </div>
    </div>
  )
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} width="20" height="20">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}
