'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, PackageX } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { useItemPoBisaDiretur, useMutasiReturVendor, useVendorRetur } from '@/hooks/useReturVendor'
import {
  ALASAN_RETUR,
  bolehAjukanRetur,
  LABEL_ALASAN,
  sisaBisaDiretur,
  totalRetur,
  type AlasanRetur,
} from '@/lib/returVendor/aturan'
import { rupiah, tanggalWaktu } from '@/lib/format'

type Isian = { qty: string; alasan: AlasanRetur | '' }

function angka(s: string): number {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function FormAjukanRetur() {
  const router = useRouter()
  const { role } = useFinanceRole()
  const { data: vendor = [] } = useVendorRetur()
  const [supplierId, setSupplierId] = useState<string>('')
  const { data: itemPo = [], isLoading } = useItemPoBisaDiretur(supplierId || null, vendor)
  const { ajukan } = useMutasiReturVendor()
  const [isian, setIsian] = useState<Record<string, Isian>>({})
  const [alasan, setAlasan] = useState<AlasanRetur | ''>('')
  const [catatan, setCatatan] = useState('')
  const [bukti, setBukti] = useState<File[]>([])

  const dipilih = useMemo(
    () =>
      itemPo
        .map((i) => ({ i, q: angka(isian[i.purchase_order_item_id]?.qty ?? '') }))
        .filter(({ q }) => q > 0),
    [itemPo, isian],
  )

  const galat = useMemo(() => {
    if (!supplierId) return 'Pilih vendor'
    if (!alasan) return 'Pilih alasan retur'
    if (alasan === 'lainnya' && !catatan.trim()) return 'Alasan "Lainnya" wajib diberi catatan'
    if (dipilih.length === 0) return 'Isi jumlah minimal satu barang'
    for (const { i, q } of dipilih) {
      if (Number.isNaN(q)) return `Jumlah ${i.bahan_nama} tidak valid`
      if (q > sisaBisaDiretur(i.qty_terima, i.qty_retur_aktif) + 1e-6)
        return `Jumlah ${i.bahan_nama} melebihi yang bisa diretur dari ${i.nomor_po}`
    }
    return null
  }, [supplierId, alasan, catatan, dipilih])

  if (role && !bolehAjukanRetur(role)) {
    return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Anda tidak berhak mengajukan retur vendor.</p>
  }

  const kirim = async () => {
    if (galat || !alasan) return
    try {
      const id = await ajukan.mutateAsync({
        supplierId,
        alasan,
        catatan,
        bukti,
        items: dipilih.map(({ i, q }) => ({
          purchase_order_item_id: i.purchase_order_item_id,
          qty: q,
          alasan: (isian[i.purchase_order_item_id]?.alasan || alasan) as AlasanRetur,
        })),
      })
      toast.success('Retur diajukan, menunggu persetujuan finance.')
      router.push(`/pembelian/retur-vendor/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengajukan retur')
    }
  }

  return (
    <div className="space-y-5 pb-12 font-sans">
      <PageHeader title="Ajukan Retur Vendor" icon={PackageX} description="Hanya barang yang masuk lewat PO yang bisa diretur.">
        <Link href="/pembelian/retur-vendor" className="inline-flex items-center gap-1 text-sm font-semibold text-suka-brown">
          <ArrowLeft size={16} /> Kembali
        </Link>
      </PageHeader>

      <section className="space-y-3 rounded-2xl border border-suka-gray-100 bg-white p-4">
        <label className="block text-sm font-semibold text-suka-gray-600">
          Vendor
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value)
              setIsian({})
            }}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Pilih vendor…</option>
            {vendor.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nama}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-suka-gray-600">
            Alasan utama
            <select
              value={alasan}
              onChange={(e) => setAlasan(e.target.value as AlasanRetur)}
              className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Pilih alasan…</option>
              {ALASAN_RETUR.map((a) => (
                <option key={a} value={a}>
                  {LABEL_ALASAN[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-suka-gray-600">
            Bukti (foto barang, komplain outlet)
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => setBukti(Array.from(e.target.files ?? []))}
              className="mt-1 block w-full text-sm"
            />
          </label>
        </div>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Catatan
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            placeholder="Mis. komplain 5 outlet: daging terlalu berlemak"
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {supplierId && (
        <section className="overflow-x-auto rounded-2xl border border-suka-gray-100 bg-white">
          {isLoading ? (
            <p className="p-4 text-sm text-suka-gray-500">Memuat barang PO…</p>
          ) : itemPo.length === 0 ? (
            <p className="p-4 text-sm text-suka-gray-500">Belum ada PO dari vendor ini yang sudah diterima.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-suka-cream/50 text-left text-xs text-suka-gray-500">
                <tr>
                  <th className="px-3 py-2">Bahan</th>
                  <th className="px-3 py-2">PO · diterima</th>
                  <th className="px-3 py-2 text-right">Diterima</th>
                  <th className="px-3 py-2 text-right">Bisa diretur</th>
                  <th className="px-3 py-2">Jumlah retur</th>
                  <th className="px-3 py-2">Alasan (opsional)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {itemPo.map((i) => {
                  const sisa = sisaBisaDiretur(i.qty_terima, i.qty_retur_aktif)
                  const v = isian[i.purchase_order_item_id] ?? { qty: '', alasan: '' }
                  return (
                    <tr key={i.purchase_order_item_id} className={sisa <= 0 ? 'opacity-50' : ''}>
                      <td className="px-3 py-2 font-semibold text-suka-ink">{i.bahan_nama}</td>
                      <td className="px-3 py-2 text-xs text-suka-gray-500">
                        {i.nomor_po}
                        <br />
                        {tanggalWaktu(i.tanggal_terima)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {i.qty_terima} {i.satuan}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {sisa} {i.satuan}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          inputMode="decimal"
                          disabled={sisa <= 0}
                          value={v.qty}
                          onChange={(e) =>
                            setIsian((s) => ({ ...s, [i.purchase_order_item_id]: { ...v, qty: e.target.value } }))
                          }
                          placeholder="0"
                          className="w-24 rounded-lg border border-suka-gray-200 px-2 py-1 text-right"
                        />{' '}
                        <span className="text-xs text-suka-gray-500">{i.satuan}</span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={v.alasan}
                          disabled={sisa <= 0}
                          onChange={(e) =>
                            setIsian((s) => ({
                              ...s,
                              [i.purchase_order_item_id]: { ...v, alasan: e.target.value as AlasanRetur },
                            }))
                          }
                          className="rounded-lg border border-suka-gray-200 px-2 py-1 text-xs"
                        >
                          <option value="">Sama dengan alasan utama</option>
                          {ALASAN_RETUR.map((a) => (
                            <option key={a} value={a}>
                              {LABEL_ALASAN[a]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-suka-gray-100 bg-white p-4">
        <div className="text-sm">
          Nilai retur (harga beli PO):{' '}
          <b className="tabular-nums">
            {rupiah(totalRetur(dipilih.map(({ i, q }) => ({ qty: Number.isNaN(q) ? 0 : q, harga: i.harga }))))}
          </b>
          {galat && <span className="ml-3 text-xs text-red-600">{galat}</span>}
        </div>
        <button
          type="button"
          disabled={Boolean(galat) || ajukan.isPending}
          onClick={kirim}
          className="rounded-xl bg-suka-brown px-5 py-2 text-sm font-semibold text-white hover:bg-suka-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ajukan.isPending ? 'Mengirim…' : 'Ajukan retur'}
        </button>
      </div>
    </div>
  )
}
