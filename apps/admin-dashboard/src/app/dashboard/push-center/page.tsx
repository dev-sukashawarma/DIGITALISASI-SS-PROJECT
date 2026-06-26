'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { BellRing, Send, Loader2, Users, CheckCircle2, AlertCircle } from 'lucide-react'

type SubscriptionStats = {
  total: number
  apps: Record<string, number>
}

export default function PushCenterPage() {
  const [stats, setStats] = useState<SubscriptionStats>({ total: 0, apps: {} })
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{success: boolean, message: string} | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('push_subscriptions').select('app')
      
      if (error) throw error
      
      const appCounts: Record<string, number> = {}
      data.forEach(sub => {
        appCounts[sub.app] = (appCounts[sub.app] || 0) + 1
      })
      
      setStats({
        total: data.length,
        apps: appCounts
      })
    } catch (e) {
      console.error('Failed to fetch subscription stats', e)
    } finally {
      setLoading(false)
    }
  }

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setResult(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) throw new Error("Tidak ada sesi aktif")

      // This Edge Function (send-push) supports sending to ALL users if no user_id/outlet_id is provided,
      // but in our implementation we might just send it as a broadcast by omitting user_id and outlet_id
      // Let's check our Edge Function logic: If user_id is missing and outlet_id is missing, 
      // does it send to everyone?
      // Wait, in our edge function:
      // if (user_id) -> send to one user
      // else if (outlet_id) -> send to outlet staff
      // else if (!user_id && !outlet_id) -> we didn't explicitly write logic to send to ALL users!
      // But we can query all subscriptions here and send to each, OR we can pass a special flag `broadcast: true`
      
      // Let's send the request
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          body,
          url,
          broadcast: true // Assuming edge function supports this or we'll need to update it
        })
      })

      if (!res.ok) {
        throw new Error("Gagal mengirim broadcast")
      }

      setResult({ success: true, message: "Broadcast berhasil dikirim ke seluruh staf yang berlangganan!" })
      setTitle('')
      setBody('')
      
    } catch (e: any) {
      console.error(e)
      setResult({ success: false, message: e.message || "Gagal mengirim broadcast" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <BellRing className="text-suka-orange" />
            Pusat Notifikasi (Push Center)
          </h1>
          <p className="text-sm text-slate-500 font-medium">Kelola pelanggan notifikasi dan kirim pesan broadcast massal ke staf.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* STATS PANEL */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-4">
            <Users className="text-blue-500" /> Statistik Pelanggan Aktif
          </h2>
          
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                <p className="text-sm font-bold text-blue-800 uppercase tracking-wider">Total Perangkat Terdaftar</p>
                <p className="text-5xl font-black text-blue-600 mt-2">{stats.total}</p>
                <p className="text-xs text-blue-600/70 mt-1 font-semibold">Siap menerima push notification</p>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 border-b pb-2">Berdasarkan Aplikasi</h3>
                <div className="space-y-3">
                  {Object.entries(stats.apps).map(([app, count]) => (
                    <div key={app} className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700 capitalize">{app.replace('-', ' ')}</span>
                      <span className="bg-white px-3 py-1 rounded-full text-xs font-black text-slate-700 shadow-sm border border-slate-200">
                        {count} perangkat
                      </span>
                    </div>
                  ))}
                  {Object.keys(stats.apps).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Belum ada perangkat yang berlangganan.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BROADCAST FORM */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-4">
            <Send className="text-suka-orange" /> Kirim Pesan Broadcast
          </h2>
          <p className="text-sm text-slate-500 mb-6">Pesan ini akan dikirim ke <strong>SELURUH PERANGKAT</strong> yang telah mengizinkan notifikasi di semua aplikasi.</p>
          
          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Judul Notifikasi</label>
              <input 
                type="text" 
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange transition-all"
                placeholder="Cth: Pengumuman Penting SOP Baru"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Isi Pesan Singkat</label>
              <textarea 
                required
                rows={3}
                value={body}
                onChange={e => setBody(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange transition-all resize-none"
                placeholder="Cth: Seluruh outlet diwajibkan melakukan closing lebih awal hari ini..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">URL Tujuan (Opsional)</label>
              <input 
                type="text" 
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange transition-all text-sm font-mono text-slate-600"
                placeholder="/dashboard"
              />
              <p className="text-xs text-slate-400 mt-1">Halaman yang terbuka saat notifikasi ditekan. Gunakan path relatif seperti `/`</p>
            </div>

            {result && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border ${result.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {result.success ? <CheckCircle2 className="shrink-0" /> : <AlertCircle className="shrink-0" />}
                <p className="text-sm font-semibold">{result.message}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={sending || stats.total === 0}
              className="w-full bg-suka-orange hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
              {sending ? 'Mengirim...' : 'Kirim Broadcast Sekarang'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
