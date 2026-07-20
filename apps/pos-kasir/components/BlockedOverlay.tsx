'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { Ban, LogOut, ClipboardCheck, Moon, Clock, Unlock, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { postToNative, isRunningInWebView } from '@suka/design-system'

export type BlockType = 'user' | 'outlet' | 'attendance' | 'checklist' | 'closed'

export type ChecklistProgress = { total: number; done: number }

export default function BlockedOverlay({
  reason,
  type,
  progress,
  onBypass,
}: {
  reason: string
  type: BlockType
  progress?: ChecklistProgress
  onBypass?: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const [userSession, setUserSession] = useState<any>(null)
  
  // Bypass state
  const [showBypassForm, setShowBypassForm] = useState(false)
  const [bypassReason, setBypassReason] = useState('')
  const [bypassWaLink, setBypassWaLink] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [bypassError, setBypassError] = useState('')
  const [isPendingApproval, setIsPendingApproval] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session)
    })
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    queryClient.removeQueries({ queryKey: ['my-outlet'] })
    let portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      portalUrl = 'http://localhost:3010'
    }
    window.location.href = portalUrl
  }

  async function handleVerifyBypass(e: React.FormEvent) {
    e.preventDefault()
    if (!bypassReason.trim() || !userSession) return
    
    setIsVerifying(true)
    setBypassError('')
    
    try {
      // 1. Get staff profile
      const { data: staff, error: staffError } = await supabase
        .from('outlet_staff')
        .select('outlet_id, name')
        .eq('id', userSession.user.id)
        .single()
        
      if (staffError || !staff) throw new Error('Data staff tidak ditemukan')

      // 2. Insert bypass request
      const { data: insertedRequest, error: insertError } = await supabase
        .from('bypass_requests')
        .insert({
          outlet_id: staff.outlet_id,
          requested_by_name: staff.name,
          reason: bypassReason.trim(),
          status: 'pending'
        })
        .select('id')
        .single()

      if (insertError) throw new Error('Gagal mengirim pengajuan bypass')

      setIsPendingApproval(true)

      // 3. Listen to realtime changes for this specific bypass request
      const channel = supabase.channel(`bypass_request_${insertedRequest.id}`)
      channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bypass_requests',
        filter: `id=eq.${insertedRequest.id}`
      }, (payload) => {
        const newStatus = payload.new.status
        if (newStatus === 'approved') {
          if (onBypass) onBypass()
          setShowBypassForm(false)
          supabase.removeChannel(channel)
        } else if (newStatus === 'rejected') {
          setBypassError('Pengajuan bypass ditolak oleh SPV.')
          setIsPendingApproval(false)
          supabase.removeChannel(channel)
        }
      }).subscribe()

      // 4. Generate WA link and open it
      const appUrl = window.location.origin
      const approveLink = `${appUrl}/api/bypass/approve?id=${insertedRequest.id}`
      const waText = encodeURIComponent(`Halo SPV, saya mengajukan *Bypass Darurat* untuk sistem POS.\n\nKasir: ${staff.name}\nAlasan: ${bypassReason.trim()}\n\nKlik link berikut untuk menyetujui atau menolak:\n${approveLink}`)
      const generatedWaLink = `https://wa.me/6285218446637?text=${waText}`
      
      setBypassWaLink(generatedWaLink)

      // Coba trigger secara programmatis
      if (typeof window !== 'undefined') {
        if (isRunningInWebView() || (window as any).__SUKASHAWARMA_NATIVE_APP__) {
          if (!postToNative({ type: 'open-external-url', url: generatedWaLink })) {
             window.location.href = generatedWaLink
          }
        } else {
          window.open(generatedWaLink, '_blank')
        }
      }

    } catch (err: any) {
      setBypassError(err.message || 'Terjadi kesalahan sistem.')
      setIsPendingApproval(false)
    } finally {
      setIsVerifying(false)
    }
  }

  const TITLE: Record<BlockType, string> = {
    attendance: 'Menunggu Kehadiran Kru',
    checklist: 'Checklist Buka Toko Belum Selesai',
    closed: 'Toko Sudah Tutup',
    user: 'Akun Dinonaktifkan',
    outlet: 'Cabang Dinonaktifkan',
  }

  const MESSAGE: Record<BlockType, string> = {
    attendance: 'Sistem POS akan otomatis terbuka ketika ada minimal 1 kru yang melakukan absen hadir hari ini.',
    checklist: 'Dashboard kasir akan otomatis terbuka setelah seluruh tugas checklist buka toko diselesaikan oleh kru.',
    closed: 'Semua kru sudah absen pulang. Sampai jumpa besok!',
    user: 'Akun Anda saat ini sedang dinonaktifkan oleh Administrator.',
    outlet: 'Cabang tempat Anda bertugas saat ini sedang dinonaktifkan oleh Administrator.',
  }

  const ICON: Record<BlockType, ReactNode> = {
    attendance: <Clock className="w-10 h-10 text-amber-600" />,
    checklist: <ClipboardCheck className="w-10 h-10 text-amber-600" />,
    closed: <Moon className="w-10 h-10 text-indigo-600" />,
    user: <Ban className="w-10 h-10 text-red-600" />,
    outlet: <Ban className="w-10 h-10 text-red-600" />,
  }

  const ICON_BG: Record<BlockType, string> = {
    attendance: 'bg-amber-100',
    checklist: 'bg-amber-100',
    closed: 'bg-indigo-100',
    user: 'bg-red-100',
    outlet: 'bg-red-100',
  }

  const showReasonBox = type === 'user' || type === 'outlet'
  const showProgress = type === 'checklist' && progress && progress.total > 0
  const progressPct = showProgress ? Math.round((progress!.done / progress!.total) * 100) : 0

  const PULSE_LABEL: Record<string, string> = {
    attendance: 'Menunggu Sinyal Absensi...',
    checklist: 'Menunggu Checklist Diselesaikan...',
    closed: 'Menunggu Sesi Baru...',
  }
  
  const canBypass = (type === 'attendance' || type === 'checklist' || type === 'closed') && onBypass

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in text-center">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center animate-fade-up">
        {showBypassForm ? (
          <div className="w-full flex flex-col items-center animate-fade-in">
            {isPendingApproval ? (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-amber-100">
                  <Clock className="w-10 h-10 text-amber-600 animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Menunggu Persetujuan</h2>
                <p className="text-gray-500 font-medium mb-6 text-sm">
                  Pengajuan bypass telah dikirim ke SPV. Sistem akan otomatis terbuka setelah disetujui.
                </p>
                {bypassWaLink && (
                  <button
                    type="button"
                    className="w-full bg-[#25D366] text-white rounded-xl py-3.5 font-bold hover:bg-[#1DA851] transition-colors flex justify-center items-center gap-2 shadow-lg shadow-[#25D366]/20 mb-4"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        if (isRunningInWebView() || (window as any).__SUKASHAWARMA_NATIVE_APP__) {
                          if (!postToNative({ type: 'open-external-url', url: bypassWaLink })) {
                            window.location.href = bypassWaLink
                          }
                        } else {
                          window.open(bypassWaLink, '_blank')
                        }
                      }
                    }}
                  >
                    Buka WhatsApp SPV
                  </button>
                )}
                {bypassError && <p className="text-red-500 text-sm mb-4 font-medium">{bypassError}</p>}
                <button
                  type="button"
                  onClick={() => setIsPendingApproval(false)}
                  className="w-full bg-gray-100 text-gray-700 rounded-xl py-3.5 font-bold hover:bg-gray-200 transition-colors"
                >
                  Kembali
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-amber-100">
                  <AlertTriangle className="w-10 h-10 text-amber-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Pengajuan Bypass</h2>
                <p className="text-gray-500 font-medium mb-6 text-sm">
                  Sistem absensi bermasalah? Ajukan bypass darurat ke SPV Anda.
                </p>
                
                <form onSubmit={handleVerifyBypass} className="w-full space-y-4 text-left">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Alasan Bypass</label>
                    <textarea
                      value={bypassReason}
                      onChange={(e) => setBypassReason(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none h-24"
                      placeholder="Contoh: Sistem absensi error, foto tidak bisa terkirim..."
                      disabled={isVerifying}
                      autoFocus
                    />
                    {bypassError && <p className="text-red-500 text-sm mt-2 font-medium">{bypassError}</p>}
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBypassForm(false)
                        setBypassReason('')
                        setBypassError('')
                      }}
                      className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-3.5 font-bold hover:bg-gray-200 transition-colors"
                      disabled={isVerifying}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-[2] bg-amber-600 text-white rounded-xl py-3.5 font-bold hover:bg-amber-700 transition-colors flex justify-center items-center gap-2"
                      disabled={isVerifying || !bypassReason.trim()}
                    >
                      {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
                      Kirim ke SPV
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${ICON_BG[type]}`}>
              {ICON[type]}
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
              {TITLE[type]}
            </h1>
            <p className="text-gray-500 font-medium mb-6">
              {MESSAGE[type]}
            </p>

            {showProgress && (
              <div className="w-full mb-6">
                <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                  <span>Progress Checklist Buka Toko</span>
                  <span>{progress!.done}/{progress!.total} tugas</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {showReasonBox ? (
              <div className="bg-red-50 text-red-900 text-sm font-bold p-4 rounded-xl w-full mb-8 border border-red-100 text-left">
                <span className="block text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">Alasan Penonaktifan:</span>
                "{reason}"
              </div>
            ) : (type === 'attendance' || type === 'checklist' || type === 'closed') ? (
              <div className="w-full flex flex-col items-center mb-8 gap-4">
                <div className="w-full flex items-center justify-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                   <div className="animate-pulse flex items-center gap-2 text-amber-700 font-medium">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                      {PULSE_LABEL[type]}
                   </div>
                </div>
                
                {canBypass && (
                  <button 
                    onClick={() => setShowBypassForm(true)}
                    className="text-gray-400 hover:text-red-500 text-sm font-bold underline transition-colors underline-offset-4"
                  >
                    Gunakan Bypass Darurat
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full mb-8" />
            )}

            {(showReasonBox || type === 'closed') ? (
              <button
                onClick={handleLogout}
                className="w-full bg-gray-900 text-white rounded-xl py-3.5 font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Keluar / Logout
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
