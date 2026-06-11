'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { SignatureCanvas } from './SignatureCanvas'

interface ReceiptSignature {
  signed_by: string
  role: string
  signed_at: string
}

interface Props {
  suratJalanId: string
  submitting: boolean
  onFinalize: () => void
  onBack: () => void
}

const REQUIRED_ROLES = ['Crew Penerima', 'Supir'] as const
const MAX_SIGNATURE_SIZE = 50000 // 50KB, sama dgn pola pengirim

export function ReceiptSignatureStep({ suratJalanId, submitting, onFinalize, onBack }: Props) {
  const [signatures, setSignatures] = useState<ReceiptSignature[]>([])
  const [signedBy, setSignedBy] = useState('')
  const [role, setRole] = useState<typeof REQUIRED_ROLES[number]>('Crew Penerima')
  const [signatureImage, setSignatureImage] = useState('')
  const [showCanvas, setShowCanvas] = useState(false)
  const [signing, setSigning] = useState(false)

  const signedRoles = signatures.map((s) => s.role)
  const missingRoles = REQUIRED_ROLES.filter((r) => !signedRoles.includes(r))

  const handleSign = async () => {
    if (!signedBy.trim()) { alert('Nama penanda tangan harus diisi'); return }
    if (!signatureImage) { alert('Tanda tangan harus digambar terlebih dahulu'); return }
    if (signedRoles.includes(role)) { alert(`${role} sudah menandatangani.`); return }
    if (signatureImage.length > MAX_SIGNATURE_SIZE) {
      alert(`Tanda tangan terlalu besar (${(signatureImage.length / 1024).toFixed(1)}KB). Coba ulang.`)
      return
    }

    setSigning(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase.rpc('sign_receipt_surat_jalan', {
        p_surat_jalan_id: suratJalanId,
        p_signed_by_name: signedBy,
        p_role: role,
        p_signature_image: signatureImage,
      })
      if (error) throw new Error(error.message)
      setSignatures(data.receipt_signatures)
      setSignedBy('')
      setSignatureImage('')
      setShowCanvas(false)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Gagal menandatangani'}`)
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex items-center gap-3 shadow-sm">
        <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-[#701604] tracking-tight">Tanda Tangan Penerimaan</h2>
          <p className="text-xs text-suka-brown/60 mt-0.5">Serah-terima Crew & Supir</p>
        </div>
      </header>

      <div className="p-6 max-w-lg mx-auto mt-6 space-y-6">
        <div className="bg-white rounded-xl border border-suka-brown/10 p-6 space-y-6 shadow-sm">
          {signatures.length > 0 && (
            <div className="bg-[#fff8f1] border border-suka-brown/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-suka-brown uppercase tracking-wider">
                Tanda tangan ({signatures.length}/2):
              </p>
              {signatures.map((s, i) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-suka-green" />
                  <span className="font-semibold">{s.signed_by}</span>
                  <span className="text-suka-brown/60 text-xs">({s.role})</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4 border-t border-suka-brown/10 pt-4">
            <p className="text-sm font-bold text-suka-brown">Tambah Tanda Tangan</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={signedBy}
                onChange={(e) => setSignedBy(e.target.value)}
                placeholder="Nama penanda tangan"
                className="bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof REQUIRED_ROLES[number])}
                className="bg-[#fff8f1] border border-suka-brown/15 rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="Crew Penerima" disabled={signedRoles.includes('Crew Penerima')}>
                  {signedRoles.includes('Crew Penerima') ? 'Crew Penerima ✓' : 'Crew Penerima'}
                </option>
                <option value="Supir" disabled={signedRoles.includes('Supir')}>
                  {signedRoles.includes('Supir') ? 'Supir ✓' : 'Supir (Pengemudi)'}
                </option>
              </select>
              <button
                onClick={() => setShowCanvas(!showCanvas)}
                className="px-4 py-2.5 border border-suka-brown/15 text-suka-brown font-semibold text-sm rounded-xl bg-white hover:bg-suka-cream transition-all"
              >
                {showCanvas ? 'Sembunyikan Canvas' : 'Gambar Tanda Tangan'}
              </button>
            </div>

            {showCanvas && <SignatureCanvas onSignatureSaved={(img) => setSignatureImage(img)} />}

            {signatureImage && (
              <div className="flex items-center gap-4 border border-suka-brown/10 p-3 bg-[#fff8f1]/50 rounded-xl">
                <div className="bg-white p-2 border border-suka-brown/10 rounded-lg">
                  <img src={signatureImage} alt="preview" className="h-10 w-auto object-contain" />
                </div>
                <button
                  onClick={handleSign}
                  disabled={signing}
                  className="px-4 py-2 bg-suka-orange hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {signing ? 'Menandatangani...' : 'Konfirmasi & Simpan'}
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onFinalize}
          disabled={submitting || missingRoles.length > 0}
          className="w-full bg-[#701604] hover:opacity-95 text-white rounded-xl py-3.5 font-bold shadow-md disabled:opacity-50 text-sm"
        >
          {submitting ? 'Menyimpan...' : 'Selesai & Simpan Penerimaan'}
        </button>
        {missingRoles.length > 0 && (
          <p className="text-xs text-center text-orange-600 font-semibold">
            ⚠️ Menunggu tanda tangan: {missingRoles.join(', ')}
          </p>
        )}
        <button
          onClick={onBack}
          disabled={submitting}
          className="w-full border border-suka-brown/15 text-suka-brown font-semibold rounded-xl py-3 text-xs bg-white hover:bg-suka-cream transition-all disabled:opacity-50"
        >
          ← Kembali ke ringkasan
        </button>
      </div>
    </div>
  )
}
