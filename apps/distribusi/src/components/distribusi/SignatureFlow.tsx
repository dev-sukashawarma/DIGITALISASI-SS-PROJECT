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

    setSigning(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase.rpc('sign_surat_jalan', {
        p_surat_jalan_id: suratJalanId,
        p_signed_by_name: signedBy,
        p_role: role,
        p_signature_image: signatureImage,
      })

      if (error) throw error

      onSignatureAdded(data.signatures)
      setSignedBy('')
      setSignatureImage('')
      setShowCanvas(false)
      alert(`Tanda tangan dari ${signedBy} berhasil ditambahkan`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menambah tanda tangan'
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
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold">Proses Penandatanganan</h3>

      {/* Existing signatures */}
      {signatures.length > 0 && (
        <div className="bg-blue-50 rounded p-4">
          <p className="text-sm font-medium text-blue-900 mb-2">
            Tanda tangan ({signatures.length}):
          </p>
          <div className="space-y-2">
            {signatures.map((sig, idx) => (
              <div key={idx} className="text-sm text-blue-800">
                <span className="font-medium">{sig.signed_by}</span>
                <span className="text-blue-600 ml-2">({sig.role})</span>
                <span className="text-blue-500 ml-2">
                  {new Date(sig.signed_at).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add signature form */}
      <div className="space-y-3 border-t pt-4">
        <p className="text-sm text-gray-600">Tambah Tanda Tangan</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            placeholder="Nama penanda tangan"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={signatures.some((s) => s.role === role)}
            className="border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="Kitchen SPV" disabled={signatures.some((s) => s.role === 'Kitchen SPV')}>
              Kitchen SPV {signatures.some((s) => s.role === 'Kitchen SPV') ? '✓ Sudah ditandatangani' : ''}
            </option>
            <option value="Supir" disabled={signatures.some((s) => s.role === 'Supir')}>
              Supir (Pengemudi) {signatures.some((s) => s.role === 'Supir') ? '✓ Sudah ditandatangani' : ''}
            </option>
          </select>
          <button
            onClick={() => setShowCanvas(!showCanvas)}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >
            {showCanvas ? 'Sembunyikan' : 'Gambar Tanda Tangan'}
          </button>
        </div>

        {showCanvas && (
          <SignatureCanvas onSignatureSaved={(img) => setSignatureImage(img)} />
        )}

        {signatureImage && (
          <div className="flex items-center gap-2">
            <img src={signatureImage} alt="preview" className="h-12 border rounded" />
            <button
              onClick={handleSign}
              disabled={signing}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {signing ? 'Menandatangani...' : 'Konfirmasi & Tandatangani'}
            </button>
          </div>
        )}
      </div>

      {/* Send button */}
      <div className="flex gap-3 border-t pt-4">
        <button
          onClick={handleSend}
          disabled={sending || missingRoles.length > 0}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {sending ? 'Mengirim...' : 'Kirim Surat Jalan'}
        </button>
        <span className="text-sm self-center">
          {missingRoles.length > 0 ? (
            <span className="text-orange-600">
              Menunggu tanda tangan: {missingRoles.join(', ')}
            </span>
          ) : (
            <span className="text-green-600">✓ Semua tanda tangan lengkap - siap dikirim</span>
          )}
        </span>
      </div>
    </div>
  )
}
