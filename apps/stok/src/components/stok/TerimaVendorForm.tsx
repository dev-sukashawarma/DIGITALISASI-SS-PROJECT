'use client'
import { useEffect, useMemo, useState } from 'react'
import { Button, Input } from '@suka/design-system'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useInfoTerimaVendor, useCatatTerimaVendor } from '@/hooks/useTerimaVendor'
import { keSatuanBesar, perluKonfirmasiJumlah } from '@/lib/stok/dropShip'

type Tingkat = 'besar' | 'tengah' | 'kecil'

function rupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

// WIB = UTC+7. Sengaja HANYA dipanggil dari useEffect/handler, bukan langsung
// saat render -- new Date()/Date.now() dipanggil saat render sebuah komponen
// client bisa beda antara render server & hydrate client (React #310 pernah
// meruntuhkan produksi stok karena pola serupa).
function tanggalWIB(offsetHari: number): string {
  return new Date(Date.now() + 7 * 3600 * 1000 - offsetHari * 86400000).toISOString().slice(0, 10)
}

type Props = { outletId: string }

export function TerimaVendorForm({ outletId }: Props) {
  const { bahanBaku } = useBahanBaku()

  const [bahanId, setBahanId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [tingkat, setTingkat] = useState<Tingkat>('besar')
  const [qty, setQty] = useState('')
  const [catatan, setCatatan] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [konfirmasi, setKonfirmasi] = useState(false)

  // Tanggal terima -- default hari ini WIB, batas RPC hari ini s/d 3 hari lalu.
  // Kosong sampai mount (client-only) supaya render pertama server & client sama.
  const [tanggal, setTanggal] = useState('')
  const [minTanggal, setMinTanggal] = useState('')
  const [maxTanggal, setMaxTanggal] = useState('')
  useEffect(() => {
    setTanggal(tanggalWIB(0))
    setMinTanggal(tanggalWIB(3))
    setMaxTanggal(tanggalWIB(0))
  }, [])

  const bahan = bahanBaku.find((b) => b.id === bahanId) ?? null
  const { data: vendors = [] } = useInfoTerimaVendor(bahanId || null)
  const vendorTerpilih = vendors.find((v) => v.supplier_id === supplierId) ?? null
  const vendor = vendorTerpilih ?? (vendors.length === 1 ? vendors[0] : null)
  const catat = useCatatTerimaVendor()

  // Vendor tunggal untuk bahan itu langsung terisi otomatis begitu daftarnya datang.
  useEffect(() => {
    if (vendors.length === 1 && supplierId !== vendors[0].supplier_id) {
      setSupplierId(vendors[0].supplier_id)
    }
    if (vendors.length !== 1 && supplierId && !vendors.some((v) => v.supplier_id === supplierId)) {
      setSupplierId('')
    }
  }, [vendors, supplierId])

  const { qtyBesar, konversiError } = useMemo(() => {
    const n = Number(qty)
    if (!bahan || !(n > 0)) return { qtyBesar: 0, konversiError: null as string | null }
    try {
      return { qtyBesar: keSatuanBesar(n, tingkat, bahan), konversiError: null as string | null }
    } catch (err) {
      return { qtyBesar: 0, konversiError: (err as Error).message }
    }
  }, [qty, tingkat, bahan])

  const nilai = vendor ? qtyBesar * vendor.harga_snapshot : 0
  const butuhKonfirmasi = vendor
    ? perluKonfirmasiJumlah({ qtyBesar, hargaSnapshot: vendor.harga_snapshot, rataPakaiHarian: vendor.rata_pakai_harian })
    : false

  const resetSetelahSimpan = () => {
    setQty('')
    setCatatan('')
    setFile(null)
    setKonfirmasi(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (konversiError) {
      toast.error(konversiError)
      return
    }
    if (!bahan || !vendor || !(qtyBesar > 0)) {
      toast.error('Lengkapi bahan, vendor, dan jumlah')
      return
    }
    if (!tanggal) {
      toast.error('Tanggal belum siap, coba lagi sesaat lagi')
      return
    }
    if (butuhKonfirmasi && !konfirmasi) {
      toast.error('Jumlah ini tidak biasa — centang konfirmasi dulu')
      return
    }

    try {
      let fotoUrl: string | undefined
      if (file) {
        const supabase = createClient()
        const ext = file.name.split('.').pop()
        const path = `terima/${outletId}/${Date.now()}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage.from('drop-ship').upload(path, file)
        if (uploadError) {
          // Foto opsional -- gagal unggah TIDAK boleh menahan pencatatan stok.
          toast.warning('Foto gagal diunggah, catatan tetap disimpan tanpa foto: ' + uploadError.message)
        } else {
          fotoUrl = supabase.storage.from('drop-ship').getPublicUrl(uploadData.path).data.publicUrl
        }
      }
      await catat.mutateAsync({
        bahanBakuId: bahan.id,
        supplierId: vendor.supplier_id,
        qty: qtyBesar,
        tanggal,
        catatan: catatan || undefined,
        fotoUrl,
      })
      toast.success(`Tercatat ${qtyBesar.toLocaleString('id-ID')} ${bahan.satuan} — stok outlet sudah bertambah`)
      resetSetelahSimpan()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/50 space-y-4">
      <div>
        <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide mb-1">Bahan</label>
        <select
          value={bahanId}
          onChange={(e) => {
            setBahanId(e.target.value)
            setSupplierId('')
            setTingkat('besar')
            setQty('')
            setKonfirmasi(false)
          }}
          className="w-full flex h-10 border border-[#d9c2b2]/60 bg-white px-3 py-2 text-xs text-[#1e1b15] font-semibold rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
        >
          <option value="">Pilih bahan…</option>
          {bahanBaku.map((b) => (
            <option key={b.id} value={b.id}>{b.nama}</option>
          ))}
        </select>
      </div>

      {bahanId && vendors.length === 0 && (
        <p className="text-xs font-semibold text-red-600">
          Bahan ini tidak punya vendor kiriman langsung. Minta Pusat mendaftarkannya di Katalog Harga Vendor.
        </p>
      )}

      {vendors.length > 1 && (
        <div>
          <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide mb-1">Vendor</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full flex h-10 border border-[#d9c2b2]/60 bg-white px-3 py-2 text-xs text-[#1e1b15] font-semibold rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
          >
            <option value="">Pilih vendor…</option>
            {vendors.map((v) => (
              <option key={v.supplier_id} value={v.supplier_id}>{v.supplier_nama}</option>
            ))}
          </select>
        </div>
      )}
      {vendor && vendors.length === 1 && (
        <p className="text-xs text-[#544437]">Vendor: <span className="font-bold">{vendor.supplier_nama}</span></p>
      )}

      {bahan && vendor && (
        <>
          <div>
            <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide mb-1">Tanggal terima</label>
            <Input
              type="date"
              value={tanggal}
              min={minTanggal}
              max={maxTanggal}
              onChange={(e) => setTanggal(e.target.value)}
              disabled={!tanggal}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide mb-1">Jumlah diterima</label>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Misal: 5"
                className="flex-1"
              />
              <select
                value={tingkat}
                onChange={(e) => setTingkat(e.target.value as Tingkat)}
                className="flex h-10 border border-[#d9c2b2]/60 bg-white px-3 py-2 text-xs text-[#1e1b15] font-semibold rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
              >
                <option value="besar">{bahan.satuan}</option>
                {bahan.satuan_tengah && bahan.faktor_tengah ? <option value="tengah">{bahan.satuan_tengah}</option> : null}
                {bahan.satuan_kecil && bahan.faktor_tampilan ? <option value="kecil">{bahan.satuan_kecil}</option> : null}
              </select>
            </div>
          </div>

          {konversiError && (
            <p className="text-xs font-semibold text-red-600">{konversiError}</p>
          )}

          {qtyBesar > 0 && !konversiError && (
            <div className={`rounded-xl p-3 text-sm space-y-1 ${butuhKonfirmasi ? 'bg-red-50 border border-red-300' : 'bg-[#f7f0ea]'}`}>
              <div className="flex justify-between">
                <span className="text-[#544437]">Akan tercatat</span>
                <b>{qtyBesar.toLocaleString('id-ID')} {bahan.satuan}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-[#544437]">Nilai (harga terkunci)</span>
                <b>{rupiah(nilai)}</b>
              </div>
              {butuhKonfirmasi && (
                <label className="flex items-start gap-2 mt-2 text-red-700 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={konfirmasi}
                    onChange={(e) => setKonfirmasi(e.target.checked)}
                    className="mt-0.5"
                  />
                  Jumlah ini jauh di atas biasanya. Saya sudah cek satuannya ({bahan.satuan}, bukan{' '}
                  {bahan.satuan_kecil ?? bahan.satuan_tengah ?? 'satuan lain'}) dan jumlahnya benar.
                </label>
              )}
            </div>
          )}
        </>
      )}

      <div>
        <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide mb-1">Catatan (opsional)</label>
        <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Misal: dikirim jam 6 pagi" />
      </div>

      <div>
        <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide mb-1">Foto bukti terima (opsional)</label>
        <Input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-[10px] text-[#544437]/60 mt-1 font-medium">Harga tidak perlu diisi — sudah dikunci sistem dari katalog vendor.</p>
      </div>

      <Button
        type="submit"
        disabled={catat.isPending || !(qtyBesar > 0) || !vendor || !!konversiError}
        className="w-full bg-[#701604] hover:bg-[#571003] text-white rounded-xl font-bold text-xs shadow-sm"
      >
        {catat.isPending ? 'Menyimpan…' : 'Catat Terima'}
      </Button>
    </form>
  )
}
