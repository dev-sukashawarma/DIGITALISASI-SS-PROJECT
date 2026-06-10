'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

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
  const [role, setRole] = useState('SPV')
  const [signing, setSigning] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSign = async () => {
    if (!signedBy.trim()) {
      alert('Nama penanda tangan harus diisi')
      return
    }

    setSigning(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase.rpc('sign_surat_jalan', {
        p_surat_jalan_id: suratJalanId,
        p_signed_by_name: signedBy,
        p_role: role,
      })

      if (error) throw error

      onSignatureAdded(data.signatures)
      setSignedBy('')
      alert(`Tanda tangan dari ${signedBy} berhasil ditambahkan`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menambah tanda tangan'
      alert(`Error: ${message}`)
    } finally {
      setSigning(false)
    }
  }

  const handleSend = async () => {
    if (signatures.length === 0) {
      alert('Minimal 1 tanda tangan diperlukan untuk mengirim')
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
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="SPV">SPV</option>
            <option value="Manager">Manager</option>
            <option value="Director">Director</option>
          </select>
          <button
            onClick={handleSign}
            disabled={signing}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {signing ? 'Menandatangani...' : 'Tandatangani'}
          </button>
        </div>
      </div>

      {/* Send button */}
      <div className="flex gap-3 border-t pt-4">
        <button
          onClick={handleSend}
          disabled={sending || signatures.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {sending ? 'Mengirim...' : 'Kirim Surat Jalan'}
        </button>
        <span className="text-sm text-gray-500 self-center">
          {signatures.length === 0
            ? 'Minimal 1 tanda tangan untuk mengirim'
            : `Siap dikirim (${signatures.length} tanda tangan)`}
        </span>
      </div>
    </div>
  )
}
