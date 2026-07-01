'use client'
import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { rupiah } from '@/lib/format'
import { parsePriceInput } from '@/lib/bahanBaku'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function BahanBakuTable({
  rows, onSave, saving,
}: {
  rows: BahanBakuWithHarga[]
  onSave: (bahanBakuId: string, harga: number) => void
  saving: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (rows.length === 0) {
    return <p className="rounded-xl bg-suka-gray-50 p-6 text-center text-sm text-gray-500">Tidak ada bahan baku.</p>
  }

  function startEdit(r: BahanBakuWithHarga) {
    setEditingId(r.id)
    setDraft(r.harga ? String(r.harga.harga_beli) : '')
  }
  function cancel() { setEditingId(null); setDraft('') }
  function commit(id: string) {
    const parsed = parsePriceInput(draft)
    if (parsed === null) return
    onSave(id, parsed)
    setEditingId(null); setDraft('')
  }

  const inputCls = 'w-28 rounded-lg border border-suka-gray-200 px-2 py-1 text-sm outline-none focus:border-suka-orange'

  return (
    <div className="overflow-x-auto rounded-2xl border border-suka-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-suka-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Kategori</th>
            <th className="px-4 py-3">Satuan</th>
            <th className="px-4 py-3">Harga Beli</th>
            <th className="px-4 py-3">Terakhir Diubah</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isEditing = editingId === r.id
            return (
              <tr key={r.id} className="border-t border-suka-gray-200">
                <td className="px-4 py-3 font-medium text-suka-ink">{r.nama}</td>
                <td className="px-4 py-3 text-gray-500">{r.kategori}</td>
                <td className="px-4 py-3 text-gray-500">{r.satuan}</td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <input
                      autoFocus className={inputCls} inputMode="numeric" value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commit(r.id); if (e.key === 'Escape') cancel() }}
                    />
                  ) : (
                    <span className={r.harga ? 'text-suka-ink' : 'text-gray-400'}>
                      {r.harga ? rupiah(r.harga.harga_beli) : '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatUpdatedAt(r.harga?.harga_updated_at ?? null)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-gray-500">
                    {isEditing ? (
                      <>
                        <button title="Simpan" disabled={saving} onClick={() => commit(r.id)} className="text-suka-green"><Check size={16} /></button>
                        <button title="Batal" disabled={saving} onClick={cancel}><X size={16} /></button>
                      </>
                    ) : (
                      <button title="Edit harga" onClick={() => startEdit(r)}><Pencil size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
