'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { SignatureCanvas } from './SignatureCanvas'

interface Signature {
  signed_by: string
  role: string
  signed_at: string
}

interface SignatureFlowProps {
  suratJalanId: string
  signatures: Signature[]
  onSignatureAdded: (newSignatures: Signature[]) => void
  onSent: () => void
}

const MAX_SIGNATURE_SIZE = 50000 // 50KB - PNG data URL limit for RPC parameter safety

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
        setKitchenStaff(data.filter(d => d.role === 'kitchen').map(d => d.name))
        setAllStaff(data.map(d => d.name))
      }
    }
    fetchStaff()
  }, [])
  const [alertConfig, setAlertConfig] = useState<{ show: boolean; title: string; message: string; type: 'error' | 'success' | 'warning' } | null>(null)
  
  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setAlertConfig({ show: true, title, message, type })
  }
  
  const closeAlert = () => setAlertConfig(null)

  const signedRoles = signatures.map((s) => s.role)
  const hasAdmin = signedRoles.includes('Admin Kitchen') || signedRoles.includes('Kitchen SPV')
  const hasSupir = signedRoles.includes('Supir')
  
  const missingRoles = []
  if (!hasAdmin) missingRoles.push('Admin Kitchen')
  if (!hasSupir) missingRoles.push('Supir')

  useEffect(() => {
    if (hasAdmin && !hasSupir) {
      if (role !== 'Supir') {
        setRole('Supir')
        setSignedBy('')
      }
    }
  }, [signatures, hasAdmin, hasSupir])

  const handleSign = async (imgToUse?: string) => {
    const finalImg = imgToUse || signatureImage;

    if (!signedBy.trim()) {
      showAlert('Peringatan', 'Nama penanda tangan harus diisi', 'warning')
      return
    }

    if (!finalImg) {
      showAlert('Peringatan', 'Tanda tangan harus digambar terlebih dahulu', 'warning')
      return
    }

    if (signatures.some((s) => s.role === role)) {
      showAlert('Peringatan', `${role} sudah menandatangani. Tidak bisa menambah tanda tangan ganda.`, 'warning')
      return
    }

    if (finalImg.length > MAX_SIGNATURE_SIZE) {
      showAlert(
        'Ukuran Terlalu Besar',
        `Tanda tangan terlalu besar (${(finalImg.length / 1024).toFixed(1)}KB). Coba ulang dengan stroke yang lebih ringan atau canvas yang lebih kecil.`,
        'warning'
      )
      return
    }

    setSigning(true)
    const supabase = createSupabaseBrowserClient()

    try {
      console.log('Signing with image size:', finalImg.length, 'bytes')

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

      console.log('Signature saved successfully:', data)
      onSignatureAdded(data.signatures)
      setSignedBy('')
      setSignatureImage('')
      setShowCanvas(false)
      showAlert('Berhasil', `Tanda tangan dari ${signedBy} berhasil ditambahkan`, 'success')
    } catch (err: any) {
      const message = err?.message || err?.details || 'Gagal menambah tanda tangan'
      console.error('Full error:', err)
      showAlert('Gagal', message, 'error')
    } finally {
      setSigning(false)
    }
  }

  const handleSend = async () => {
    if (missingRoles.length > 0) {
      showAlert('Peringatan', `Tanda tangan yang masih diperlukan: ${missingRoles.join(', ')}`, 'warning')
      return
    }

    setSending(true)
    const supabase = createSupabaseBrowserClient()

    try {
      const { error } = await supabase.rpc('send_surat_jalan_signed', {
        p_surat_jalan_id: suratJalanId,
      })

      if (error) throw error

      showAlert('Berhasil', 'Surat Jalan berhasil dikirim!', 'success')
      setTimeout(() => onSent(), 2000)
    } catch (err: any) {
      let message = err?.message || err?.details || 'Gagal mengirim'
      // Format angka desimal yang terlalu panjang dari database (e.g., 0.7400000000000000000 -> 0.74)
      message = message.replace(/(\d+\.\d+)/g, (match: string) => parseFloat(match).toString())
      showAlert('Gagal Mengirim', message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-suka-brown/10 p-6 space-y-6">
      <h3 className="text-md font-bold text-suka-brown uppercase tracking-wider">Proses Penandatanganan</h3>

      {/* Existing signatures */}
      {signatures.length > 0 && (
        <div className="bg-[#fff8f1] border border-suka-brown/10 rounded-xl p-4">
          <p className="text-xs font-bold text-suka-brown uppercase tracking-wider mb-2">
            Tanda tangan dikonfirmasi ({signatures.length}):
          </p>
          <div className="space-y-2">
            {signatures.map((sig, idx) => (
              <div key={idx} className="text-sm text-suka-ink flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-suka-green" />
                <span className="font-semibold">{sig.signed_by}</span>
                <span className="text-suka-brown/60 text-xs font-medium">({sig.role})</span>
                <span className="text-suka-brown/50 text-xs ml-auto">
                  {new Date(sig.signed_at).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add signature form */}
      {missingRoles.length > 0 && (
        <div className="space-y-4 border-t border-suka-brown/10 pt-4">
          <p className="text-sm font-bold text-suka-brown">Tambah Tanda Tangan Baru</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <select
                value={role}
                onChange={(e) => { setRole(e.target.value); setSignedBy(''); }}
                className="w-full sm:w-1/3 bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm transition-all h-[42px]"
              >
                <option value="Admin Kitchen" disabled={hasAdmin}>
                  {hasAdmin ? 'Admin Kitchen ✓' : 'Admin Kitchen'}
                </option>
                <option value="Supir" disabled={hasSupir}>
                  {hasSupir ? 'Supir ✓' : 'Supir (Pengemudi)'}
                </option>
              </select>

              <div className="flex-1 w-full flex flex-col gap-2">
                {role === 'Admin Kitchen' ? (
                  <select
                    value={signedBy}
                    onChange={(e) => setSignedBy(e.target.value)}
                    className="w-full bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm transition-all h-[42px]"
                  >
                    <option value="" disabled>Pilih Nama Admin Kitchen</option>
                    {kitchenStaff.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center gap-4 px-1 pb-1">
                      <label className="flex items-center gap-1.5 text-xs text-suka-brown font-semibold cursor-pointer">
                        <input type="radio" checked={driverType === 'internal'} onChange={() => { setDriverType('internal'); setSignedBy(''); }} className="accent-suka-orange" />
                        Supir Internal
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-suka-brown font-semibold cursor-pointer">
                        <input type="radio" checked={driverType === 'external'} onChange={() => { setDriverType('external'); setSignedBy(''); }} className="accent-suka-orange" />
                        Supir Eksternal
                      </label>
                    </div>
                    {driverType === 'internal' ? (
                      <select
                        value={signedBy}
                        onChange={(e) => setSignedBy(e.target.value)}
                        className="w-full bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm transition-all h-[42px]"
                      >
                        <option value="" disabled>Pilih Nama Supir Internal</option>
                        {allStaff.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={signedBy}
                        onChange={(e) => setSignedBy(e.target.value)}
                        placeholder="Ketik nama Lalamove / Eksternal"
                        className="w-full bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm transition-all h-[42px]"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowCanvas(!showCanvas)}
              className="w-full px-4 py-2.5 border border-suka-brown/15 text-suka-brown font-semibold text-sm rounded-xl bg-white hover:bg-suka-cream transition-all cursor-pointer mt-1"
            >
              {showCanvas ? 'Sembunyikan Canvas' : 'Gambar Tanda Tangan'}
            </button>
          </div>

          {showCanvas && !signing && (
            <SignatureCanvas onSignatureSaved={(img) => {
              setSignatureImage(img)
              handleSign(img)
            }} />
          )}
          
          {signing && (
            <div className="flex items-center justify-center p-6 bg-[#fff8f1]/50 border border-suka-brown/10 rounded-xl">
              <p className="text-suka-orange font-bold text-sm animate-pulse">Menyimpan Tanda Tangan...</p>
            </div>
          )}
        </div>
      )}

      {/* Send button */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-suka-brown/10 pt-4">
        <button
          onClick={handleSend}
          disabled={sending || missingRoles.length > 0}
          className="w-full sm:w-auto px-6 py-3 bg-[#701604] hover:opacity-95 text-white font-bold text-sm rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer"
        >
          {sending ? 'Mengirim...' : 'Kirim Surat Jalan'}
        </button>
        <div className="text-xs font-bold tracking-wide w-full sm:w-auto text-center">
          {missingRoles.length > 0 ? (
            <div className="text-orange-600 bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg w-full sm:w-auto inline-block">
              ⚠️ Menunggu tanda tangan: {missingRoles.join(', ')}
            </div>
          ) : (
            <div className="text-suka-green bg-green-50 border border-green-200 px-3 py-2 rounded-lg w-full sm:w-auto inline-block">
              ✓ Semua tanda tangan lengkap - Siap dikirim
            </div>
          )}
        </div>
      </div>
      
      {/* Alert Modal */}
      {alertConfig && alertConfig.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              alertConfig.type === 'error' ? 'bg-red-50 text-red-600' : 
              alertConfig.type === 'success' ? 'bg-green-50 text-suka-green' : 
              'bg-orange-50 text-orange-600'
            }`}>
              {alertConfig.type === 'error' && (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              )}
              {alertConfig.type === 'success' && (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              )}
              {alertConfig.type === 'warning' && (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              )}
            </div>
            <div>
              <h4 className="text-base font-bold text-suka-brown mb-1.5">{alertConfig.title}</h4>
              <p className="text-xs text-suka-brown/80 leading-relaxed">{alertConfig.message}</p>
            </div>
            <button
              onClick={closeAlert}
              className="w-full mt-2 py-2.5 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer"
            >
              OK, Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
