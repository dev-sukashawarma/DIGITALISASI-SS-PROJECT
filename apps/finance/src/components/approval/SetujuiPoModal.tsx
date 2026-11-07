'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@suka/design-system'
import { X, Building2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useApprovePo, type PendingPo } from '@/hooks/usePoApproval'
import { useCashOverview } from '@/hooks/useCashData'
import { lokasiGrup, URUTAN_GRUP, GRUP_LABEL } from '@/lib/kas/grupKas'
import { rupiah, tanggal } from '@/lib/format'

/**
 * Modal untuk admin finance menyetujui PO dan menentukan rekening sumber dana pembayaran.
 * Rekening disimpan di purchase_order.cash_location_id untuk digunakan saat realisasi pembayaran vendor.
 */
export function SetujuiPoModal({
  po,
  isOpen,
  onClose,
  onGagal,
}: {
  po: PendingPo
  isOpen: boolean
  onClose: () => void
  /** Dipanggil saat RPC gagal agar daftar disegarkan */
  onGagal?: () => void
}) {
  const approve = useApprovePo()
  const { locations, isLoading: isCashLoading } = useCashOverview()

  // Rekening pusat yang aktif
  const rekeningPusat = useMemo(
    () => locations.filter((l) => l.is_active !== false && l.grup && URUTAN_GRUP.includes(l.grup)),
    [locations],
  )

  // Rekening default: jika PO sudah punya preferensi rekening atau bawaan Rekening Bahan Baku Bank
  const defaultRekeningId = useMemo(() => {
    if (po.cash_location_id && rekeningPusat.some((r) => r.id === po.cash_location_id)) {
      return po.cash_location_id
    }
    const bahanBakuBank = lokasiGrup(locations, 'bahan_baku', 'bank')[0]
    return bahanBakuBank?.id ?? rekeningPusat[0]?.id ?? ''
  }, [po.cash_location_id, locations, rekeningPusat])

  const [selectedLocationId, setSelectedLocationId] = useState<string>(defaultRekeningId)

  // Sinkronisasi bila default baru tersedia setelah loading selesai
  const activeLocationId = selectedLocationId || defaultRekeningId
  const selectedLocation = rekeningPusat.find((r) => r.id === activeLocationId) ?? rekeningPusat[0]

  if (!isOpen) return null

  const saldo = selectedLocation?.saldo ?? 0
  const sisa = saldo - po.total

  const simpan = () => {
    if (!selectedLocation) {
      toast.error('Pilih rekening sumber dana terlebih dahulu')
      return
    }

    approve.mutate(
      { poId: po.id, cashLocationId: selectedLocation.id },
      {
        onSuccess: () => {
          toast.success(`${po.nomor_po} disetujui · Sumber dana: ${selectedLocation.label}`)
          onClose()
        },
        onError: (e) => {
          toast.error((e as Error).message)
          onGagal?.()
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-suka-brown/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-suka-orange/10 text-suka-orange">
              <Building2 size={18} />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-suka-brown">Setujui Purchase Order</h2>
              <p className="text-xs text-suka-gray-500">Tentukan rekening sumber dana pembayaran</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-suka-gray-400 hover:text-suka-ink"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ringkasan PO */}
        <div className="rounded-xl bg-suka-cream/70 p-3.5 text-sm text-suka-ink space-y-1">
          <div className="font-bold text-suka-brown">{po.nomor_po}</div>
          <div className="text-xs text-suka-gray-600">{po.supplier_nama} · Diajukan {tanggal(po.tanggal_po)}</div>
          <div className="pt-1 flex items-baseline justify-between border-t border-suka-brown/10 mt-1">
            <span className="text-xs text-suka-gray-500">Total Komitmen PO:</span>
            <span className="font-bold text-suka-brown tabular-nums text-base">{rupiah(po.total)}</span>
          </div>
        </div>

        {/* Pemilihan Rekening Sumber Dana */}
        <div className="space-y-2">
          <label htmlFor="pilih-rekening-po" className="block text-xs font-bold text-suka-gray-700">
            Pilih Rekening Pembayar
          </label>
          <select
            id="pilih-rekening-po"
            value={activeLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            disabled={isCashLoading || rekeningPusat.length === 0}
            className="w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-suka-ink outline-none focus:border-suka-orange transition-colors"
          >
            {rekeningPusat.length === 0 && <option value="">— Belum ada rekening pusat aktif —</option>}
            {URUTAN_GRUP.map((g) => {
              const daftarGrup = rekeningPusat.filter((r) => r.grup === g)
              if (daftarGrup.length === 0) return null
              return (
                <optgroup key={g} label={GRUP_LABEL[g]}>
                  {daftarGrup.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} ({r.kind === 'bank' ? 'Bank' : 'Tunai'}) · Saldo {rupiah(r.saldo)}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>

        {/* Informasi Saldo Rekening Terpilih */}
        {selectedLocation && (
          <div className="rounded-xl border border-suka-brown/10 bg-suka-cream/30 p-3 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-suka-gray-600">
              <span>Saldo saat ini di {selectedLocation.label}:</span>
              <span className="font-semibold text-suka-ink tabular-nums">{rupiah(saldo)}</span>
            </div>
            <div className="flex justify-between items-center text-suka-gray-600">
              <span>Estimasi sisa saldo setelah bayar:</span>
              <span className={`font-bold tabular-nums ${sisa < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {rupiah(sisa)}
              </span>
            </div>
            <div className="pt-1 text-[11px] text-suka-gray-500 border-t border-suka-brown/5 flex items-start gap-1.5">
              {sisa >= 0 ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span>Saldo rekening mencukupi untuk komitmen anggaran PO ini.</span>
                </>
              ) : (
                <>
                  <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                  <span>
                    Saldo saat ini lebih kecil dari nilai PO. Komitmen tetap dapat disetujui, dan saldo riil baru terpotong saat realisasi bayar vendor.
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={approve.isPending}>
            Batal
          </Button>
          <Button onClick={simpan} disabled={!selectedLocation || approve.isPending}>
            {approve.isPending ? 'Menyetujui…' : 'Setujui PO'}
          </Button>
        </div>
      </div>
    </div>
  )
}
