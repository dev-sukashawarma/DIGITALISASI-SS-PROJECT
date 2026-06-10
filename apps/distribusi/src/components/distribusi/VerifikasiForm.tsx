'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { useSuratJalanActions } from '@/hooks/useSuratJalan'
import { useSuratJalanDetail } from '@/hooks/useSuratJalan'
import { useFileUpload } from '@/hooks/useFileUpload'
import type { SuratJalanItem } from '@/types/distribusi'

export function VerifikasiForm({ suratJalanId }: { suratJalanId: string }) {
  const router = useRouter()
  const { sj, items } = useSuratJalanDetail(suratJalanId)
  const { verify, finalize } = useSuratJalanActions()
  const { uploadFoto } = useFileUpload()
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  const handleQtyChange = (itemId: string, value: string) => {
    setFormData(prev => ({ ...prev, [itemId]: { ...prev[itemId], qty_terima: value } }))
  }

  const handleKondisiChange = (itemId: string, value: string) => {
    setFormData(prev => ({ ...prev, [itemId]: { ...prev[itemId], kondisi: value } }))
  }

  const handleFotoUpload = async (itemId: string, file: File) => {
    setUploading(prev => ({ ...prev, [itemId]: true }))
    try {
      const path = await uploadFoto(file, suratJalanId, itemId)
      setFormData(prev => ({ ...prev, [itemId]: { ...prev[itemId], foto_path: path } }))
    } catch (err) {
      alert('Gagal upload foto: ' + (err as Error).message)
    } finally {
      setUploading(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const handleVerifyItem = async (item: SuratJalanItem) => {
    setBusy(true)
    try {
      const data = formData[item.id] || {}
      if (!data.qty_terima || !data.kondisi) {
        alert('Qty dan kondisi harus diisi')
        return
      }

      const qty_terima = Number(data.qty_terima)
      const needsFoto = qty_terima !== item.qty_dikirim || data.kondisi !== 'baik'

      if (needsFoto && !data.foto_path) {
        alert('Foto diperlukan untuk item dengan selisih atau kondisi tidak baik')
        return
      }

      await verify(suratJalanId, item.id, qty_terima, data.kondisi, data.foto_path || null)
      setVerified(prev => ({ ...prev, [item.id]: true }))
    } finally {
      setBusy(false)
    }
  }

  const handleFinalize = async () => {
    if (!sj) return
    setBusy(true)
    try {
      await finalize(suratJalanId)
      alert('Kiriman selesai diverifikasi & stok diperbarui')
      router.push('/distribusi/terima')
    } catch (err) {
      alert('Gagal finalize: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!sj) return <p>Memuat…</p>

  const allVerified = items.length > 0 && items.every(it => verified[it.id])

  return (
    <div className="space-y-4">
      {items.map(item => {
        const data = formData[item.id] || {}
        const needsFoto = data.qty_terima && (Number(data.qty_terima) !== item.qty_dikirim || data.kondisi !== 'baik')

        return (
          <Card key={item.id} className={`p-4 space-y-3 ${verified[item.id] ? 'opacity-60' : ''}`}>
            <p className="font-semibold">Bahan: {item.bahan_baku_id.slice(0, 8)}…</p>
            <p className="text-sm text-gray-600">Dikirim: {item.qty_dikirim}</p>

            {!verified[item.id] ? (
              <>
                <Input type="number" placeholder="Qty Terima" inputMode="decimal"
                  value={data.qty_terima || ''} onChange={e => handleQtyChange(item.id, e.target.value)} />

                <select className="w-full border rounded p-2" value={data.kondisi || ''}
                  onChange={e => handleKondisiChange(item.id, e.target.value)}>
                  <option value="">— Pilih Kondisi —</option>
                  <option value="baik">Baik</option>
                  <option value="rusak">Rusak</option>
                  <option value="hilang_qty">Hilang Qty</option>
                </select>

                {needsFoto && (
                  <div className="border-2 border-orange-300 rounded p-3 bg-orange-50">
                    <p className="text-sm font-medium mb-2">📸 Foto diperlukan</p>
                    <input type="file" accept="image/*"
                      onChange={e => e.target.files?.[0] && handleFotoUpload(item.id, e.target.files[0])}
                      disabled={uploading[item.id]} />
                    {data.foto_path && <p className="text-xs text-green-600 mt-1">✓ Foto tersimpan</p>}
                  </div>
                )}

                <Button onClick={() => handleVerifyItem(item)} disabled={busy || uploading[item.id]}>
                  Verifikasi Item
                </Button>
              </>
            ) : (
              <p className="text-sm text-green-600 font-medium">✓ Sudah diverifikasi</p>
            )}
          </Card>
        )
      })}

      <Button disabled={!allVerified || busy} onClick={handleFinalize} className="w-full font-semibold">
        {busy ? 'Menyelesaikan…' : 'Selesaikan & Update Stok'}
      </Button>
    </div>
  )
}
