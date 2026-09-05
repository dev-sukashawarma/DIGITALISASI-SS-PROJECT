'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { SignatureCanvas } from './SignatureCanvas'
import { CheckCircle2, PenTool, Send, Clock, User, Truck } from 'lucide-react'
import { toast } from 'sonner'

interface Signature {
  signed_by: string
  role: string
  signed_at: string
  signature_image?: string
}

interface SignatureFlowProps {
  suratJalanId: string
  signatures: Signature[]
  onSignatureAdded: (newSignatures: Signature[]) => void
  onSent: () => void
}

const MAX_SIGNATURE_SIZE = 50000 // 50KB

export function SignatureFlow({
  suratJalanId,
  signatures,
  onSignatureAdded,
  onSent,
}: SignatureFlowProps) {
  const [signedBy, setSignedBy] = useState('')
  const [role, setRole] = useState('Admin Kitchen')
  const [signatureImage, setSignatureImage] = useState<string>('')
  const [showCanvas, setShowCanvas] = useState(false)
  const [signing, setSigning] = useState(false)
  const [sending, setSending] = useState(false)
  const [kitchenStaff, setKitchenStaff] = useState<string[]>([])
  const [allStaff, setAllStaff] = useState<string[]>([])
  const [driverType, setDriverType] = useState<'internal' | 'external'>('internal')

  useEffect(() => {
    const fetchStaff = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data } = await supabase
        .from('outlet_staff')
        .select('name, role')
        .eq('status', 'active')
        .order('name')

      if (data) {
        setKitchenStaff(data.filter((d) => d.role === 'kitchen').map((d) => d.name))
        setAllStaff(data.map((d) => d.name))
      }
    }
    fetchStaff()
  }, [])

  const signedRoles = signatures.map((s) => s.role)
  const hasAdmin = signedRoles.includes('Admin Kitchen') || signedRoles.includes('Kitchen SPV') || signedRoles.includes('Admin Gudang')
  const hasSupir = signedRoles.includes('Supir')

  const missingRoles: string[] = []
  if (!hasAdmin) missingRoles.push('Admin Gudang')
  if (!hasSupir) missingRoles.push('Supir (Kurir)')

  useEffect(() => {
    if (hasAdmin && !hasSupir) {
      if (role !== 'Supir') {
        setRole('Supir')
        setSignedBy('')
      }
    }
  }, [signatures, hasAdmin, hasSupir])

  const handleSign = async (imgToUse?: string) => {
    const finalImg = imgToUse || signatureImage

    if (!signedBy.trim()) {
      toast.warning('Pilih atau ketik nama penanda tangan terlebih dahulu')
      return
    }

    if (!finalImg) {
      toast.warning('Goreskan tanda tangan terlebih dahulu pada canvas')
      return
    }

    if (signatures.some((s) => s.role === role)) {
      toast.warning(`${role} sudah menandatangani.`)
      return
    }

    if (finalImg.length > MAX_SIGNATURE_SIZE) {
      toast.error(`Ukuran tanda tangan terlalu besar (${(finalImg.length / 1024).toFixed(1)}KB). Coba ulangi.`)
      return
    }

    setSigning(true)
    const supabase = createSupabaseBrowserClient()

    try {
      toast.info('Menyimpan tanda tangan pengirim...')
      const { data, error } = await supabase.rpc('sign_surat_jalan', {
        p_surat_jalan_id: suratJalanId,
        p_signed_by_name: signedBy,
        p_role: role,
        p_signature_image: finalImg,
      })

      if (error) {
        console.error('RPC error:', error)
        throw new Error(`Gagal menyimpan tanda tangan: ${error.message}`)
      }

      if (!data?.signatures) {
        throw new Error('Tidak ada data tanda tangan kembali dari server')
      }

      onSignatureAdded(data.signatures)
      setSignedBy('')
      setSignatureImage('')
      setShowCanvas(false)
      toast.success(`Tanda tangan ${signedBy} (${role}) berhasil ditambahkan!`)
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menambah tanda tangan')
    } finally {
      setSigning(false)
    }
  }

  const handleSend = async () => {
    if (missingRoles.length > 0) {
      toast.warning(`Tanda tangan yang masih diperlukan: ${missingRoles.join(', ')}`)
      return
    }

    setSending(true)
    const supabase = createSupabaseBrowserClient()

    try {
      toast.info('Memvalidasi dan mengirim Surat Jalan...')
      const { error } = await supabase.rpc('send_surat_jalan_signed', {
        p_surat_jalan_id: suratJalanId,
      })

      if (error) throw error

      toast.success('Surat Jalan berhasil dikirim! Status sekarang: Dalam Transit.')
      setTimeout(() => onSent(), 1000)
    } catch (err: any) {
      let message = err?.message || err?.details || 'Gagal mengirim'
      message = message.replace(/(\d+\.\d+)/g, (match: string) => parseFloat(match).toString())
      toast.error(`Gagal Mengirim: ${message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-orange/20 p-5 space-y-4 shadow-sm">
      <div className="flex justify-between items-center border-b border-suka-brown/10 pb-3">
        <div className="flex items-center gap-2">
          <PenTool size={16} className="text-suka-orange" />
          <h3 className="text-xs font-black text-suka-brown uppercase tracking-wider font-display">
            Penandatanganan Pengiriman
          </h3>
        </div>
        <span
          className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
            missingRoles.length === 0
              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
          }`}
        >
          {signatures.length}/2 TTD Lengkap
        </span>
      </div>

      {/* Progress & Confirmed Signatures */}
      {signatures.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest pl-0.5">
            Tanda Tangan Terverifikasi:
          </p>
          <div className="space-y-2">
            {signatures.map((sig, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-[#fff8f1] rounded-2xl border border-suka-orange/15 shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {sig.signature_image ? (
                    <img
                      src={sig.signature_image}
                      alt={sig.role}
                      className="h-8 w-12 bg-white rounded-lg border border-suka-brown/10 p-0.5 object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-suka-ink uppercase truncate">{sig.signed_by}</p>
                    <p className="text-[9px] text-suka-gray-500 font-semibold">{sig.role}</p>
                  </div>
                </div>
                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                  Sah ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Input TTD Baru (jika belum lengkap) */}
      {missingRoles.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="bg-[#fff8f1]/80 rounded-2xl p-3.5 border border-suka-brown/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black text-suka-brown uppercase tracking-wider">
                1. Pilih Peran Penanda Tangan
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRole('Admin Kitchen')
                  setSignedBy('')
                }}
                disabled={hasAdmin}
                className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === 'Admin Kitchen' && !hasAdmin
                    ? 'bg-suka-brown text-white border-suka-brown shadow-xs'
                    : hasAdmin
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                      : 'bg-white text-suka-brown border-suka-brown/15 hover:bg-suka-orange/5'
                }`}
              >
                <User size={13} /> Admin Gudang {hasAdmin && '✓'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('Supir')
                  setSignedBy('')
                }}
                disabled={hasSupir}
                className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === 'Supir' && !hasSupir
                    ? 'bg-suka-orange text-white border-suka-orange shadow-xs'
                    : hasSupir
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                      : 'bg-white text-suka-brown border-suka-brown/15 hover:bg-suka-orange/5'
                }`}
              >
                <Truck size={13} /> Supir / Kurir {hasSupir && '✓'}
              </button>
            </div>

            {/* Selection/Input Nama */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-suka-brown uppercase tracking-wider">
                2. Nama Petugas
              </label>

              {role === 'Admin Kitchen' ? (
                <select
                  value={signedBy}
                  onChange={(e) => setSignedBy(e.target.value)}
                  className="w-full bg-white border border-suka-brown/20 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/30 rounded-xl px-3.5 py-2.5 text-xs text-suka-ink font-bold uppercase transition-all shadow-inner h-[42px] cursor-pointer"
                >
                  <option value="" disabled>
                    -- Pilih Nama Admin Gudang --
                  </option>
                  {kitchenStaff.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 px-1">
                    <label className="flex items-center gap-1.5 text-xs text-suka-brown font-bold cursor-pointer">
                      <input
                        type="radio"
                        checked={driverType === 'internal'}
                        onChange={() => {
                          setDriverType('internal')
                          setSignedBy('')
                        }}
                        className="accent-suka-orange"
                      />
                      Supir Internal
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-suka-brown font-bold cursor-pointer">
                      <input
                        type="radio"
                        checked={driverType === 'external'}
                        onChange={() => {
                          setDriverType('external')
                          setSignedBy('')
                        }}
                        className="accent-suka-orange"
                      />
                      Vendor / Lalamove
                    </label>
                  </div>

                  {driverType === 'internal' ? (
                    <select
                      value={signedBy}
                      onChange={(e) => setSignedBy(e.target.value)}
                      className="w-full bg-white border border-suka-brown/20 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/30 rounded-xl px-3.5 py-2.5 text-xs text-suka-ink font-bold uppercase transition-all shadow-inner h-[42px] cursor-pointer"
                    >
                      <option value="" disabled>
                        -- Pilih Nama Supir Internal --
                      </option>
                      {allStaff.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={signedBy}
                      onChange={(e) => setSignedBy(e.target.value)}
                      placeholder="Ketik Nama Supir Vendor (e.g. Lalamove - Budi)"
                      className="w-full bg-white border border-suka-brown/20 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/30 rounded-xl px-3.5 py-2.5 text-xs text-suka-ink font-bold uppercase transition-all shadow-inner h-[42px]"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Toggle Canvas */}
            <button
              type="button"
              onClick={() => setShowCanvas(!showCanvas)}
              className="w-full py-2.5 border border-suka-orange/30 text-suka-brown font-extrabold text-xs uppercase tracking-wider rounded-xl bg-white hover:bg-suka-orange/5 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-98"
            >
              <PenTool size={13} className="text-suka-orange" />
              {showCanvas ? 'Tutup Canvas TTD' : 'Goreskan Tanda Tangan Digital'}
            </button>
          </div>

          {/* Signature Canvas Popup */}
          {showCanvas && !signing && (
            <div className="animate-in fade-in duration-200">
              <SignatureCanvas
                onSignatureSaved={(img) => {
                  setSignatureImage(img)
                  handleSign(img)
                }}
              />
            </div>
          )}

          {signing && (
            <div className="flex items-center justify-center p-4 bg-[#fff8f1] border border-suka-orange/20 rounded-2xl">
              <p className="text-suka-orange font-black text-xs uppercase tracking-wider animate-pulse">
                Menyimpan Tanda Tangan Digital...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Footer: Send Button */}
      <div className="border-t border-suka-brown/10 pt-3 space-y-2">
        {missingRoles.length > 0 ? (
          <div className="text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
            <Clock size={12} className="shrink-0" />
            <span>Perlu TTD: {missingRoles.join(', ')}</span>
          </div>
        ) : (
          <div className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
            <span>Semua TTD Lengkap & Valid!</span>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || missingRoles.length > 0}
          className="w-full py-3.5 bg-gradient-to-r from-suka-brown to-[#4d1003] hover:from-[#4d1003] hover:to-black text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
        >
          <Send size={14} />
          {sending ? 'Memproses Pengiriman...' : 'Kirim Surat Jalan Sekarang'}
        </button>
      </div>
    </div>
  )
}
