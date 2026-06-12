'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'
import { Monitor, LogOut, Power, Loader2, Wifi, CheckCircle2, AlertCircle, RefreshCw, QrCode, X } from 'lucide-react'

interface KioskPresence {
  userId: string
  username: string
  device_label: string
  online_at: string
}

type Toast = { type: 'success' | 'error'; message: string } | null

export default function KioskControlPanel() {
  const [outletId, setOutletId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [kiosks, setKiosks] = useState<KioskPresence[]>([])
  const [busy, setBusy] = useState<string | null>(null) // userId atau 'all' yang sedang diproses
  const [toast, setToast] = useState<Toast>(null)
  const [connected, setConnected] = useState(false)
  const [reloadKey, setReloadKey] = useState(0) // increment untuk paksa re-subscribe (tombol Refresh)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // State untuk fitur QR Auto Login
  const [qrLink, setQrLink] = useState<string | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [kioskAccounts, setKioskAccounts] = useState<{id: string, username: string}[]>([])
  const [qrModalState, setQrModalState] = useState<'loading_accounts' | 'list' | 'loading_qr' | 'qr'>('loading_accounts')
  const [selectedKiosk, setSelectedKiosk] = useState<{id: string, username: string} | null>(null)

  // Ambil outlet_id kasir yang sedang login
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setReady(true); return }
      const { data: profile } = await supabase.from('profiles').select('outlet_id').eq('id', user.id).single()
      setOutletId(profile?.outlet_id ?? null)
      setReady(true)
    })
  }, [])

  // Subscribe presence channel outlet (read-only — kasir tidak ikut track)
  useEffect(() => {
    if (!outletId) return
    const supabase = createClient()
    const channel = supabase.channel(`kiosk-control:${outletId}`)
    channelRef.current = channel

    const syncList = () => {
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>
      const list: KioskPresence[] = Object.entries(state).map(([key, metas]) => {
        const meta = metas[0] ?? {}
        return {
          userId: key,
          username: (meta.username as string) ?? key,
          device_label: (meta.device_label as string) ?? (meta.username as string) ?? 'Kiosk',
          online_at: (meta.online_at as string) ?? '',
        }
      })
      list.sort((a, b) => a.device_label.localeCompare(b.device_label))
      setKiosks(list)
    }

    channel
      .on('presence', { event: 'sync' }, syncList)
      .on('presence', { event: 'join' }, syncList)
      .on('presence', { event: 'leave' }, syncList)
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') {
          syncList()
          // Minta semua kiosk lapor hadir → daftar terisi seketika tanpa refresh kiosk
          channel.send({ type: 'broadcast', event: 'request_presence', payload: {} })
        }
      })

    // Safety net: re-baca presence berkala supaya daftar tak pernah "nyangkut"
    const interval = setInterval(syncList, 4000)

    return () => {
      clearInterval(interval)
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [outletId, reloadKey])

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    if (t) setTimeout(() => setToast(null), 3500)
  }, [])

  async function doLogout(target: string, label: string) {
    setBusy(target)
    try {
      const res = await fetch('/api/kiosk/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast({ type: 'error', message: data.error || 'Gagal me-logout device' })
      } else {
        showToast({ type: 'success', message: `${label} berhasil di-logout` })
      }
    } catch {
      showToast({ type: 'error', message: 'Gagal menghubungi server' })
    } finally {
      setBusy(null)
    }
  }

  function handleLogoutOne(k: KioskPresence) {
    if (confirm(`Logout device "${k.device_label}"? Device akan kembali ke halaman login.`)) {
      doLogout(k.userId, k.device_label)
    }
  }

  function handleLogoutAll() {
    if (kiosks.length === 0) return
    if (confirm(`Logout SEMUA ${kiosks.length} device di cabang ini? Semua device akan kembali ke login.`)) {
      doLogout('all', 'Semua device')
    }
  }

  function handleRefresh() {
    // Re-baca cepat dari channel saat ini…
    const ch = channelRef.current
    if (ch) {
      // Minta kiosk lapor hadir (broadcast), lalu baca presence terkini
      ch.send({ type: 'broadcast', event: 'request_presence', payload: {} })
      const state = ch.presenceState() as Record<string, Array<Record<string, unknown>>>
      const list: KioskPresence[] = Object.entries(state).map(([key, metas]) => {
        const meta = metas[0] ?? {}
        return {
          userId: key,
          username: (meta.username as string) ?? key,
          device_label: (meta.device_label as string) ?? (meta.username as string) ?? 'Kiosk',
          online_at: (meta.online_at as string) ?? '',
        }
      })
      list.sort((a, b) => a.device_label.localeCompare(b.device_label))
      setKiosks(list)
    }
    // …dan paksa subscribe ulang penuh agar koneksi yang bermasalah dibuat ulang.
    setReloadKey((k) => k + 1)
  }

  async function handleOpenQrModal() {
    setShowQrModal(true)
    setQrModalState('loading_accounts')
    setQrLink(null)
    setSelectedKiosk(null)
    
    try {
      const res = await fetch('/api/kasir/kiosk-accounts')
      const data = await res.json()
      if (!res.ok) {
        showToast({ type: 'error', message: data.error || 'Gagal memuat akun device' })
        setShowQrModal(false)
      } else {
        setKioskAccounts(data.accounts || [])
        setQrModalState('list')
      }
    } catch {
      showToast({ type: 'error', message: 'Gagal menghubungi server' })
      setShowQrModal(false)
    }
  }

  async function generateQrForKiosk(kiosk: {id: string, username: string}) {
    setSelectedKiosk(kiosk)
    setQrModalState('loading_qr')
    try {
      const res = await fetch('/api/kasir/generate-kiosk-qr', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiosk_id: kiosk.id })
      })
      const data = await res.json()
      if (!res.ok) {
        showToast({ type: 'error', message: data.error || 'Gagal generate QR' })
        setQrModalState('list')
      } else {
        setQrLink(data.action_link)
        setQrModalState('qr')
      }
    } catch {
      showToast({ type: 'error', message: 'Gagal menghubungi server' })
      setQrModalState('list')
    }
  }

  return (
    <>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Kontrol Device Pelanggan</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base font-medium flex items-center gap-2">
            Device yang sedang aktif di cabang Anda.
            <span className={`inline-flex items-center gap-1 text-xs font-bold ${connected ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              {connected ? 'Terhubung' : 'Menghubungkan…'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-colors"
            title="Perbarui daftar device"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleOpenQrModal}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-colors"
          >
            <QrCode className="w-5 h-5" />
            <span className="hidden sm:inline">Hubungkan via QR</span>
          </button>
          <button
            onClick={handleLogoutAll}
            disabled={kiosks.length === 0 || busy !== null}
            className="flex items-center justify-center gap-2 bg-red-500 text-white px-5 py-3 rounded-2xl font-bold hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy === 'all' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
            Logout Semua Device
          </button>
        </div>
      </div>

      {/* Guide / Tip */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-amber-800">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="text-sm">
          <p className="font-bold mb-1 text-amber-900">Panduan Mengelola Banyak Device</p>
          <p className="leading-relaxed text-amber-800/90">
            Jika ada beberapa device yang menyala bersamaan, pastikan untuk melihat 
            <span className="font-bold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded mx-1">ID Device (misal: Device-45)</span> 
            yang tampil di pojok kiri atas layar device pelanggan. Cocokkan ID tersebut dengan daftar di bawah ini untuk mengetahui pasti device mana yang akan Anda <i>logout</i>.
          </p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        {!ready ? (
          <p className="text-gray-500 font-medium flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Memuat…
          </p>
        ) : !outletId ? (
          <p className="text-gray-500 font-medium">Akun Anda tidak terhubung ke cabang mana pun.</p>
        ) : kiosks.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10">
            <Monitor className="w-12 h-12 text-gray-200 mb-3" strokeWidth={1.5} />
            <p className="font-bold text-gray-400">Tidak ada device online</p>
            <p className="text-xs text-gray-400 mt-1">Device yang menyala akan muncul otomatis di sini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kiosks.map((k) => (
              <div key={k.userId} className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 relative">
                    <Monitor className="w-5 h-5 text-emerald-600" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{k.device_label}</p>
                    <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> Online
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleLogoutOne(k)}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-bold px-3.5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 shrink-0"
                >
                  {busy === k.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Logout
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg font-semibold text-sm animate-fade-up ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 relative animate-fade-up flex flex-col items-center text-center">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
              <QrCode className="w-6 h-6" />
            </div>
            
            {qrModalState === 'loading_accounts' && (
               <div className="py-10 flex flex-col items-center gap-3">
                 <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                 <p className="text-gray-500 font-medium text-sm">Memuat akun device...</p>
               </div>
            )}
            
            {qrModalState === 'list' && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Pilih Akun Device</h2>
                <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
                  Pilih akun Device yang akan dihubungkan dengan perangkat ini.
                </p>
                <div className="w-full space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-1">
                  {kioskAccounts.length === 0 ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                      Tidak ada akun Device untuk cabang ini. Minta Admin untuk membuatnya.
                    </div>
                  ) : (
                    kioskAccounts.map(k => (
                      <button
                        key={k.id}
                        onClick={() => generateQrForKiosk(k)}
                        className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
                      >
                        <div className="font-bold text-gray-900 group-hover:text-indigo-900 truncate pr-2">{k.username}</div>
                        <div className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                          Buat QR
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {(qrModalState === 'loading_qr' || qrModalState === 'qr') && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Scan QR {selectedKiosk?.username}
                </h2>
                <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
                  Buka aplikasi kamera di tablet Device Anda dan arahkan ke kode QR ini.
                </p>
                
                <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm mb-4">
                  {qrModalState === 'loading_qr' ? (
                    <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-gray-400 font-bold animate-pulse">Menghasilkan Kode...</p>
                    </div>
                  ) : qrLink ? (
                    <QRCodeSVG value={qrLink} size={200} level="Q" includeMargin={false} />
                  ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center text-red-500 text-sm font-bold">
                      Gagal Memuat
                    </div>
                  )}
                </div>
                
                {qrModalState === 'qr' && (
                  <button
                    onClick={() => setQrModalState('list')}
                    className="text-indigo-600 font-bold text-sm hover:underline mb-4 block"
                  >
                    &larr; Kembali ke daftar akun
                  </button>
                )}
              </>
            )}
            
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  )
}
