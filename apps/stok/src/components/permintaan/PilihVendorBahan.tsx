'use client'
// Pemilih vendor untuk satu bahan multi-vendor. Tampil hanya bila vendor ≥ 2.
import type { Alokasi, SaldoVendor } from '@/lib/stok/alokasiVendor'

type Props = {
  vendors: SaldoVendor[]              // sisa dalam satuan DISTRIBUSI
  qtyTarget: number                   // qty baris ini dalam satuan DISTRIBUSI
  satuan: string
  alokasi: Alokasi[]                  // qty dalam satuan DISTRIBUSI
  onChange: (a: Alokasi[]) => void
  galat: string | null
  disabled?: boolean
}

export function PilihVendorBahan({ vendors, qtyTarget, satuan, alokasi, onChange, galat, disabled }: Props) {
  if (vendors.length <= 1) {
    return vendors[0] ? <p className="text-[11px] text-[#544437]">Vendor: <b>{vendors[0].vendor_nama}</b></p> : null
  }
  const pecah = alokasi.length > 1
  const ubahQty = (vendor_id: string, qty: number) =>
    onChange(alokasi.map((a) => (a.vendor_id === vendor_id ? { ...a, qty } : a)))
  // Memilih satu vendor = vendor itu menanggung SELURUH qty baris. Sebelumnya
  // memakai jumlah alokasi berjalan, yang pada hari pertama (belum ada hitung
  // fisik -> alokasiAwal mengembalikan []) selalu 0 dan membuat baris mentok di
  // "Jumlah X harus lebih dari 0" tanpa jalan keluar.
  const pilihTunggal = (vendor_id: string) => onChange([{ vendor_id, qty: qtyTarget }])

  return (
    <div className="mt-2 rounded-lg border border-[#d9c2b2]/60 p-2 space-y-1 text-[11px]">
      {vendors.map((v) => {
        const habis = v.aktif && v.sisa <= 0
        const a = alokasi.find((x) => x.vendor_id === v.vendor_id)
        return (
          <label key={v.vendor_id} className={`flex items-center gap-2 ${habis ? 'opacity-50' : ''}`}>
            {pecah ? (
              <input type="checkbox" disabled={disabled || habis} checked={!!a}
                onChange={(e) => onChange(e.target.checked ? [...alokasi, { vendor_id: v.vendor_id, qty: 0 }] : alokasi.filter((x) => x.vendor_id !== v.vendor_id))} />
            ) : (
              <input type="radio" disabled={disabled || habis} checked={!!a}
                onChange={() => pilihTunggal(v.vendor_id)} />
            )}
            <span className="flex-1">{v.vendor_nama}</span>
            <span className="text-[#544437]/70">{v.aktif ? `sisa ${v.sisa} ${satuan}` : 'belum dihitung'}{habis ? ' · habis' : ''}</span>
            {pecah && a && (
              <input type="number" min="0" step="any" disabled={disabled} value={a.qty || ''}
                onChange={(e) => ubahQty(v.vendor_id, Number(e.target.value))}
                className="w-16 rounded border border-[#d9c2b2] p-0.5 text-right" />
            )}
          </label>
        )
      })}
      {!disabled && (
        <button type="button" className="text-[#904d00] underline"
          onClick={() => onChange(pecah ? alokasi.slice(0, 1).map((a) => ({ ...a, qty: qtyTarget })) : alokasi)}
          hidden={!pecah && alokasi.length === 0}>
          {pecah ? 'Satu vendor saja' : '+ pecah vendor'}
        </button>
      )}
      {!pecah && alokasi.length > 0 && !disabled && (
        <button type="button" className="ml-2 text-[#904d00] underline"
          onClick={() => onChange([...alokasi, ...vendors.filter((v) => v.vendor_id !== alokasi[0].vendor_id && !(v.aktif && v.sisa <= 0)).slice(0, 1).map((v) => ({ vendor_id: v.vendor_id, qty: 0 }))])}>
          + pecah vendor
        </button>
      )}
      {galat && <p className="font-semibold text-red-700">{galat}</p>}
    </div>
  )
}
