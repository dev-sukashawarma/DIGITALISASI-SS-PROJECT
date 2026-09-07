'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useAuth } from '@suka/auth'
import { SignatureCanvas } from './SignatureCanvas'
import { ArrowLeft, CheckCircle2, ShieldCheck, PenTool, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ReceiptSignature {
  signed_by: string
  role: string
  signed_at: string
}

interface Props {
  suratJalanId: string
  initialSignatures?: ReceiptSignature[]
  submitting: boolean
  onFinalize: () => void
  onBack: () => void
}

const REQUIRED_ROLES = ['Crew Penerima', 'Supir'] as const
const MAX_SIGNATURE_SIZE = 50000 // 50KB

export function ReceiptSignatureStep({ suratJalanId, initialSignatures, submitting, onFinalize, onBack }: Props) {
  const { outletStaff } = useAuth()
  const [signatures, setSignatures] = useState<ReceiptSignature[]>(initialSignatures || [])
  const [signedBy, setSignedBy] = useState('')
  const [role, setRole] = useState<typeof REQUIRED_ROLES[number]>('Crew Penerima')
  const [signatureImage, setSignatureImage] = useState('')
  const [showCanvas, setShowCanvas] = useState(false)
  const [signing, setSigning] = useState(false)

  // Auto-fill nama untuk Crew Penerima (staff yang login)
  const crewNameForRole = role === 'Crew Penerima' ? (outletStaff?.name || '') : ''

  const signedRoles = signatures.map((s) => s.role)
  const missingRoles = REQUIRED_ROLES.filter((r) => !signedRoles.includes(r))

  const handleSign = async () => {
    const finalName = role === 'Crew Penerima' ? crewNameForRole : signedBy
    if (!finalName.trim()) {
      toast.warning('Nama penanda tangan harus diisi')
      return
    }
    if (!signatureImage) {
      toast.warning('Goreskan tanda tangan terlebih dahulu pada canvas')
      return
    }
    if (signedRoles.includes(role)) {
      toast.warning(`${role} sudah menandatangani`)
      return
    }
    if (signatureImage.length > MAX_SIGNATURE_SIZE) {
      toast.error(`Ukuran tanda tangan terlalu besar (${(signatureImage.length / 1024).toFixed(1)}KB). Coba ulangi.`)
      return
    }

    setSigning(true)
    const supabase = createSupabaseBrowserClient()
    try {
      toast.info('Menyimpan tanda tangan...')
      const { data, error } = await supabase.rpc('sign_receipt_surat_jalan', {
        p_surat_jalan_id: suratJalanId,
        p_signed_by_name: finalName,
        p_role: role,
        p_signature_image: signatureImage,
      })
      if (error) throw new Error(error.message)
      if (!data?.receipt_signatures) throw new Error('Tidak ada data tanda tangan kembali dari server')
      setSignatures(data.receipt_signatures)
      setSignedBy('')
      setSignatureImage('')
      setShowCanvas(false)
      toast.success(`Tanda tangan ${role} (${finalName}) berhasil disimpan!`)
    } catch (err: any) {
      toast.error(`Gagal menandatangani: ${err?.message || 'Error'}`)
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-24 relative overflow-hidden bg-grain select-none">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 shadow-sm min-w-0">
        <button
          onClick={onBack}
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-sm shrink-0 cursor-pointer"
          title="Kembali ke ringkasan"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex flex-col min-w-0">
          <h2 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none truncate">
            Tanda Tangan Penerimaan
          </h2>
          <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
            {outletStaff?.name || 'Staff'} • {outletStaff?.outlets?.name ?? 'Outlet'}
          </p>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto mt-4 space-y-5 relative z-10">
        <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-orange/15 p-5 sm:p-6 space-y-5 shadow-sm">
          {signatures.length > 0 && (
            <div className="bg-[#fff8f1] border border-suka-orange/20 rounded-2xl p-4 space-y-2.5">
              <p className="text-[10px] font-black text-suka-brown uppercase tracking-wider">
                Tanda Tangan Terverifikasi ({signatures.length}/2):
              </p>
              <div className="space-y-2">
                {signatures.map((s, i) => (
                  <div key={i} className="text-xs flex items-center gap-2 bg-white/70 p-2 rounded-xl border border-suka-brown/5">
                    <CheckCircle2 size={15} className="text-suka-green shrink-0" />
                    <span className="font-extrabold text-suka-ink uppercase">{s.signed_by}</span>
                    <span className="text-suka-gray-500 font-semibold text-[10px]">({s.role})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {missingRoles.length > 0 && (
            <div className="space-y-4 border-t border-suka-brown/10 pt-4">
              <div className="flex items-center gap-2">
                <PenTool size={16} className="text-suka-orange" />
                <p className="text-xs font-black text-suka-brown uppercase tracking-wide">
                  Tambah Tanda Tangan Penerima
                </p>
              </div>

              <div className="space-y-3">
                {role === 'Crew Penerima' ? (
                  <div className="bg-[#fff8f1] border border-suka-orange/20 rounded-xl px-4 py-3 text-xs text-suka-ink font-bold">
                    Nama Staff: <span className="text-suka-brown uppercase">{crewNameForRole}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={signedBy}
                    onChange={(e) => setSignedBy(e.target.value)}
                    placeholder="Nama Pengemudi / Supir"
                    className="w-full bg-white border border-suka-brown/20 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange rounded-xl px-4 py-3 text-xs text-suka-ink font-bold uppercase shadow-inner"
                  />
                )}

                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof REQUIRED_ROLES[number])}
                  className="w-full bg-white border border-suka-brown/20 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange rounded-xl px-4 py-3 text-xs text-suka-ink font-bold uppercase shadow-inner"
                >
                  <option value="Crew Penerima" disabled={signedRoles.includes('Crew Penerima')}>
                    {signedRoles.includes('Crew Penerima') ? 'Crew Penerima (Sudah TTD) ✓' : 'Crew Penerima Outlet'}
                  </option>
                  <option value="Supir" disabled={signedRoles.includes('Supir')}>
                    {signedRoles.includes('Supir') ? 'Supir (Sudah TTD) ✓' : 'Supir / Kurir Pengantar'}
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowCanvas(!showCanvas)}
                  className="w-full py-3 border border-suka-orange/30 text-suka-brown font-extrabold text-xs uppercase tracking-wider rounded-xl bg-white hover:bg-suka-orange/5 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <PenTool size={14} />
                  {showCanvas ? 'Sembunyikan Canvas' : 'Buka Canvas Tanda Tangan'}
                </button>
              </div>

              {showCanvas && (
                <div className="animate-in fade-in">
                  <SignatureCanvas onSignatureSaved={(img) => setSignatureImage(img)} />
                </div>
              )}

              {signatureImage && (
                <div className="flex items-center gap-3 border border-suka-orange/20 p-3 bg-[#fff8f1] rounded-2xl animate-in fade-in">
                  <div className="bg-white p-1.5 border border-suka-brown/10 rounded-xl shrink-0">
                    <img src={signatureImage} alt="preview" className="h-10 w-16 object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={handleSign}
                    disabled={signing}
                    className="flex-1 py-2.5 bg-suka-orange hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm disabled:opacity-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} />
                    {signing ? 'Menyimpan...' : 'Simpan TTD Ini'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Finalize Button */}
        <div className="space-y-2.5">
          <button
            onClick={onFinalize}
            disabled={submitting || missingRoles.length > 0}
            className="w-full bg-suka-brown hover:bg-suka-ink text-white rounded-2xl py-3.5 font-black uppercase tracking-wider shadow-md disabled:opacity-50 text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck size={16} />
            {submitting ? 'Memproses Penyimpanan...' : 'Selesai & Finalisasi Penerimaan'}
          </button>

          {missingRoles.length > 0 && (
            <p className="text-[10px] text-center text-amber-700 font-extrabold uppercase tracking-wide bg-amber-50 border border-amber-200 py-2 rounded-xl">
              ⚠️ Menunggu tanda tangan: {missingRoles.join(', ')}
            </p>
          )}

          <button
            onClick={onBack}
            disabled={submitting}
            className="w-full border border-suka-brown/20 text-suka-brown font-bold rounded-2xl py-3 text-xs uppercase tracking-wider bg-white hover:bg-suka-gray-50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            ← Kembali ke Ringkasan Barang
          </button>
        </div>
      </main>
    </div>
  )
}
