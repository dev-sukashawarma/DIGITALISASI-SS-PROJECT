'use client'

import React, { useState } from 'react'
import { X, Save, Loader2, FileEdit, AlertCircle } from 'lucide-react'
import { saveOpnameAuditNote } from '@/app/actions/jurnalMutasi'

interface AuditNotesModalProps {
  opnameId?: string
  initialNote?: string | null
  outletName: string
  opnameTanggal?: string
  onClose: () => void
  onSaved: (newNote: string) => void
}

export function AuditNotesModal({
  opnameId,
  initialNote,
  outletName,
  opnameTanggal,
  onClose,
  onSaved,
}: AuditNotesModalProps) {
  const [noteText, setNoteText] = useState(initialNote || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!opnameId) {
      setError('Catatan audit hanya dapat disimpan untuk mode Sesi Opname spesifik.')
      return
    }

    if (!noteText.trim()) {
      setError('Silakan masukkan catatan hasil temuan audit.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await saveOpnameAuditNote(opnameId, noteText)
      onSaved(noteText)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan catatan audit')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-suka-brown/10 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-suka-brown text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileEdit className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider">Catatan Temuan Audit</h3>
              <p className="text-[10px] text-amber-200/80 font-bold">
                {outletName} {opnameTanggal ? `• Opname ${opnameTanggal}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <span className="font-bold">Panduan Auditor:</span> Tuliskan kesimpulan mengapa terjadi selisih pada sesi opname ini (contoh: <em>&ldquo;Selisih Ayam 5 Kg disebabkan tumpah saat thawing tanpa laporan waste crew shift siang; Selisih Saos karena salah ketik satuan botol vs pack.&rdquo;</em>).
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-suka-brown/70 mb-1.5">
              Isi Catatan Investigasi
            </label>
            <textarea
              rows={5}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Tuliskan hasil investigasi dan instruksi tindak lanjut untuk outlet..."
              className="w-full p-3.5 rounded-2xl border border-suka-brown/20 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20 text-xs text-suka-brown resize-none outline-none font-medium bg-suka-cream/10"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-suka-cream/20 border-t border-suka-brown/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-white hover:bg-suka-cream text-suka-brown/70 rounded-xl font-bold text-xs border border-suka-brown/15 transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !opnameId}
            className="px-5 py-2 bg-suka-orange hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-black text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Catatan Audit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
