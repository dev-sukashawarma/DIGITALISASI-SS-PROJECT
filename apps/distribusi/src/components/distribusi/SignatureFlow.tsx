'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
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
  const [role, setRole] = useState('Kitchen SPV')
  const [signatureImage, setSignatureImage] = useState<string>('')
  const [showCanvas, setShowCanvas] = useState(false)
  const [signing, setSigning] = useState(false)
  const [sending, setSending] = useState(false)

  const REQUIRED_ROLES = ['Kitchen SPV', 'Supir']
  const signedRoles = signatures.map((s) => s.role)
  const missingRoles = REQUIRED_ROLES.filter((r) => !signedRoles.includes(r))

  const handleSign = async () => {
    if (!signedBy.trim()) {
      alert('Nama penanda tangan harus diisi')
      return
    }

    if (!signatureImage) {
      alert('Tanda tangan harus digambar terlebih dahulu')
      return
    }

    if (signatures.some((s) => s.role === role)) {
      alert(`${role} sudah menandatangani. Tidak bisa menambah tanda tangan ganda.`)
      return
    }

    if (signatureImage.length > MAX_SIGNATURE_SIZE) {
      alert(
        `Tanda tangan terlalu besar (${(signatureImage.length / 1024).toFixed(1)}KB). Coba ulang dengan stroke yang lebih ringan atau canvas yang lebih kecil.`
      )
      return
    }

    setSigning(true)
    const supabase = createClient()

    try {
      console.log('Signing with image size:', signatureImage.length, 'bytes')

      const { data, error } = await supabase.rpc('sign_surat_jalan', {
        p_surat_jalan_id: suratJalanId,
        p_signed_by_name: signedBy,
        p_role: role,
        p_signature_image: signatureImage,
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
      alert(`Tanda tangan dari ${signedBy} berhasil ditambahkan`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menambah tanda tangan'
      console.error('Full error:', err)
      alert(`Error: ${message}`)
    } finally {
      setSigning(false)
    }
  }

  const handleSend = async () => {
    if (missingRoles.length > 0) {
      alert(`Tanda tangan yang masih diperlukan: ${missingRoles.join(', ')}`)
      return
    }

    setSending(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.rpc('send_surat_jalan_signed', {
        p_surat_jalan_id: suratJalanId,
      })

      if (error) throw error

      alert('Surat Jalan berhasil dikirim!')
      onSent()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengirim'
      alert(`Error: ${message}`)
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
      <div className="space-y-4 border-t border-suka-brown/10 pt-4">
        <p className="text-sm font-bold text-suka-brown">Tambah Tanda Tangan Baru</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            placeholder="Nama penanda tangan"
            className="flex-1 bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm transition-all"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-[#fff8f1] border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl px-4 py-2.5 text-sm transition-all"
          >
            <option
              value="Kitchen SPV"
              disabled={signatures.some((s) => s.role === 'Kitchen SPV')}
            >
              {signatures.some((s) => s.role === 'Kitchen SPV')
                ? 'Kitchen SPV ✓'
                : 'Kitchen SPV'}
            </option>
            <option
              value="Supir"
              disabled={signatures.some((s) => s.role === 'Supir')}
            >
              {signatures.some((s) => s.role === 'Supir')
                ? 'Supir ✓'
                : 'Supir (Pengemudi)'}
            </option>
          </select>
          <button
            onClick={() => setShowCanvas(!showCanvas)}
            className="px-4 py-2.5 border border-suka-brown/15 text-suka-brown font-semibold text-sm rounded-xl bg-white hover:bg-suka-cream transition-all cursor-pointer"
          >
            {showCanvas ? 'Sembunyikan Canvas' : 'Gambar Tanda Tangan'}
          </button>
        </div>

        {showCanvas && (
          <SignatureCanvas onSignatureSaved={(img) => setSignatureImage(img)} />
        )}

        {signatureImage && (
          <div className="flex items-center gap-4 border border-suka-brown/10 p-3 bg-[#fff8f1]/50 rounded-xl">
            <div className="bg-white p-2 border border-suka-brown/10 rounded-lg">
              <img src={signatureImage} alt="preview" className="h-10 w-auto object-contain" />
            </div>
            <button
              onClick={handleSign}
              disabled={signing}
              className="px-4 py-2 bg-suka-orange hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {signing ? 'Menandatangani...' : 'Konfirmasi & Simpan'}
            </button>
          </div>
        )}
      </div>

      {/* Send button */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-suka-brown/10 pt-4">
        <button
          onClick={handleSend}
          disabled={sending || missingRoles.length > 0}
          className="w-full sm:w-auto px-6 py-3 bg-[#701604] hover:opacity-95 text-white font-bold text-sm rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer"
        >
          {sending ? 'Mengirim...' : 'Kirim Surat Jalan'}
        </button>
        <span className="text-xs font-bold tracking-wide">
          {missingRoles.length > 0 ? (
            <span className="text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg">
              ⚠️ Menunggu tanda tangan: {missingRoles.join(', ')}
            </span>
          ) : (
            <span className="text-suka-green bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
              ✓ Semua tanda tangan lengkap - Siap dikirim
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
