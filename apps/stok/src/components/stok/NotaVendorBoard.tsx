'use client'
import { useEffect, useMemo, useState } from 'react'
import { Button, Input } from '@suka/design-system'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import {
  useVendorDropShip,
  useRingkasanNota,
  useDaftarCatatanNota,
  useSahkanNota,
  useTolakTerimaVendor,
  type RincianNotaVendor,
} from '@/hooks/useNotaVendor'
import { daftarTanggalTagihan, periodeTagihan } from '@/lib/stok/periodeTagihan'
import { hitungSelisihNota, BATAS_SELISIH_PERSEN } from '@/lib/stok/dropShip'

function rupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

// WIB = UTC+7. Sengaja HANYA dipanggil dari useEffect/handler, bukan langsung
// saat render -- new Date()/Date.now() saat render komponen client bisa beda
// antara render server & hydrate client (React #310, pola sama dengan
// TerimaVendorForm.tsx).
function hariIniWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

type Props = { bolehSahkan: boolean }

export function NotaVendorBoard({ bolehSahkan }: Props) {
  const { data: vendors = [] } = useVendorDropShip()
  const [supplierId, setSupplierId] = useState('')

  // Kosong sampai mount (client-only) supaya render pertama server & client
  // sama -- lihat komentar hariIniWIB() di atas.
  const [pilihanTanggal, setPilihanTanggal] = useState<string[]>([])
  const [tanggal, setTanggal] = useState('')
  useEffect(() => {
    const daftar = daftarTanggalTagihan(hariIniWIB(), 6)
    setPilihanTanggal(daftar)
    setTanggal(daftar[0])
  }, [])

  const { data: ringkasan = [], isLoading } = useRingkasanNota(supplierId || null, tanggal || null)

  // Periode mulai/akhir dihitung di klien (periodeTagihan mirror SQL, Task 1)
  // hanya untuk memberi useDaftarCatatanNota rentang tanggal -- bukan sumber
  // kebenaran, RPC sahkan_nota_vendor menghitung ulang di DB.
  const periode = tanggal ? periodeTagihan(tanggal) : null
  const { data: catatanList = [] } = useDaftarCatatanNota(
    supplierId || null,
    periode?.mulai ?? null,
    periode?.akhir ?? null
  )

  const [totalKg, setTotalKg] = useState('')
  const [totalRupiah, setTotalRupiah] = useState('')
  const [catatanSelisih, setCatatanSelisih] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  // outlet_id -> kg dari catatan Pak Aziz (opsional, spec §5.2 langkah 3).
  const [rincian, setRincian] = useState<Record<string, string>>({})
  const sahkan = useSahkanNota()
  const tolak = useTolakTerimaVendor()

  const totalCrew = useMemo(
    () => ringkasan.reduce((s, r) => s + Number(r.total_qty), 0),
    [ringkasan]
  )
  const kg = Number(totalKg)
  const selisih = kg > 0 ? hitungSelisihNota(totalCrew, kg) : null

  const resetSetelahSahkan = () => {
    setTotalKg('')
    setTotalRupiah('')
    setCatatanSelisih('')
    setFoto(null)
    setRincian({})
  }

  const submit = async () => {
    if (!supplierId || !tanggal || !(kg > 0) || !(Number(totalRupiah) > 0) || !foto) {
      toast.error('Isi total kg, total rupiah, dan foto nota')
      return
    }
    if (selisih?.perluCatatan && !catatanSelisih.trim()) {
      toast.error(`Selisih ${selisih.selisih} kg (> ${BATAS_SELISIH_PERSEN}%) wajib dijelaskan`)
      return
    }
    try {
      // Foto nota WAJIB sebelum sahkan -- beda dengan foto bukti crew
      // (TerimaVendorForm), yang opsional dan boleh gagal unggah tanpa
      // membatalkan pencatatan. Di sini gagal unggah = batal sahkan.
      const supabase = createClient()
      const ext = foto.name.split('.').pop()
      const path = `nota/${supplierId}/${tanggal}-${Date.now()}.${ext}`
      const up = await supabase.storage.from('drop-ship').upload(path, foto)
      if (up.error) throw new Error('Gagal mengunggah foto nota: ' + up.error.message)
      const fotoNotaUrl = supabase.storage.from('drop-ship').getPublicUrl(up.data.path).data.publicUrl

      const daftarRincian: RincianNotaVendor[] = Object.entries(rincian)
        .filter(([, v]) => Number(v) > 0)
        .map(([outlet_id, v]) => ({ outlet_id, tanggal_kirim: null, qty_kg: Number(v) }))

      await sahkan.mutateAsync({
        supplierId,
        tanggalTagihan: tanggal,
        totalKg: kg,
        totalRupiah: Number(totalRupiah),
        fotoNotaUrl,
        catatanSelisih: catatanSelisih || undefined,
        rincian: daftarRincian,
      })
      toast.success('Nota disahkan — utang vendor tercatat')
      resetSetelahSahkan()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const tolakCatatan = async (id: string) => {
    const alasan = window.prompt('Alasan menolak catatan ini:')
    if (alasan == null) return
    if (!alasan.trim()) {
      toast.error('Alasan wajib diisi')
      return
    }
    try {
      await tolak.mutateAsync({ id, alasan: alasan.trim() })
      toast.success('Ditolak — stok outlet dikembalikan')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="flex-1 flex h-10 border border-[#d9c2b2]/60 bg-white px-3 py-2 text-xs text-[#1e1b15] font-semibold rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
        >
          <option value="">Pilih vendor…</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.nama}</option>
          ))}
        </select>
        <select
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
          disabled={!tanggal}
          className="flex h-10 border border-[#d9c2b2]/60 bg-white px-3 py-2 text-xs text-[#1e1b15] font-semibold rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744]"
        >
          {pilihanTanggal.map((t) => (
            <option key={t} value={t}>Tagihan {t}</option>
          ))}
        </select>
      </div>

      {supplierId && tanggal && (
        <div className="bg-white rounded-xl overflow-hidden border border-[#d9c2b2]/40">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f0ea] text-[10px] uppercase text-[#544437]">
              <tr>
                <th className="p-2 text-left">Outlet</th>
                <th className="p-2 text-right">Catatan</th>
                <th className="p-2 text-right">Kg (crew)</th>
                <th className="p-2 text-right">Kg (catatan Pak Aziz)</th>
              </tr>
            </thead>
            <tbody>
              {ringkasan.map((r) => {
                const v = Number(rincian[r.outlet_id] ?? '')
                const beda = v > 0 && Math.abs(v - Number(r.total_qty)) > 0.001
                return (
                  <tr key={`${r.outlet_id}-${r.bahan_baku_id}`} className={beda ? 'bg-red-50' : ''}>
                    <td className="p-2">{r.outlet_nama}</td>
                    <td className="p-2 text-right">{r.jumlah_catatan}</td>
                    <td className="p-2 text-right">{Number(r.total_qty).toLocaleString('id-ID')}</td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="w-24 rounded border border-[#d9c2b2] p-1 text-right text-xs"
                        value={rincian[r.outlet_id] ?? ''}
                        onChange={(e) => setRincian({ ...rincian, [r.outlet_id]: e.target.value })}
                      />
                    </td>
                  </tr>
                )
              })}
              {!isLoading && ringkasan.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-3 text-xs text-gray-500">Tidak ada catatan crew di periode ini.</td>
                </tr>
              )}
            </tbody>
            {ringkasan.length > 0 && (
              <tfoot>
                <tr className="font-bold border-t border-[#d9c2b2]/40">
                  <td className="p-2">Total</td>
                  <td />
                  <td className="p-2 text-right">{totalCrew.toLocaleString('id-ID')}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {bolehSahkan && supplierId && tanggal && ringkasan.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/50 space-y-4">
          <h3 className="text-xs font-bold uppercase text-[#544437]">Sahkan nota vendor</h3>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="Total kg di nota"
              value={totalKg}
              onChange={(e) => setTotalKg(e.target.value)}
            />
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="Total rupiah di nota"
              value={totalRupiah}
              onChange={(e) => setTotalRupiah(e.target.value)}
            />
          </div>
          {kg > 0 && Number(totalRupiah) > 0 && (
            <p className="text-xs text-[#544437]">
              Harga per kg dari nota: <b>{rupiah(Number(totalRupiah) / kg)}</b>
            </p>
          )}
          {selisih && (
            <p className={`text-sm font-semibold ${selisih.perluCatatan ? 'text-red-700' : 'text-green-700'}`}>
              Crew {totalCrew.toLocaleString('id-ID')} kg vs nota {kg.toLocaleString('id-ID')} kg — selisih{' '}
              {selisih.selisih.toLocaleString('id-ID')} kg ({selisih.persen.toFixed(2)}%)
            </p>
          )}
          {selisih?.perluCatatan && (
            <Input
              placeholder="Jelaskan selisihnya (wajib)"
              value={catatanSelisih}
              onChange={(e) => setCatatanSelisih(e.target.value)}
            />
          )}
          <label className="block text-xs font-bold text-[#544437] uppercase tracking-wide">
            Foto nota (dari WhatsApp Pak Aziz) — wajib
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              className="mt-1"
            />
          </label>
          <Button
            onClick={submit}
            disabled={sahkan.isPending || !(kg > 0) || !(Number(totalRupiah) > 0) || !foto}
            className="w-full bg-[#701604] hover:bg-[#571003] text-white rounded-xl font-bold text-xs shadow-sm"
          >
            {sahkan.isPending ? 'Mengesahkan…' : 'Sahkan Nota'}
          </Button>
        </div>
      )}

      {bolehSahkan && supplierId && tanggal && catatanList.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-[#d9c2b2]/40 space-y-2">
          <p className="text-xs font-bold uppercase text-[#544437]">Tolak satu catatan</p>
          <p className="text-[10px] text-[#544437]/70">
            Hanya untuk baris yang keliru dicatat crew (mis. salah bahan/jumlah). Stok outlet
            dikembalikan otomatis; catatan lain di periode ini tidak terpengaruh.
          </p>
          <ul className="divide-y divide-[#d9c2b2]/30">
            {catatanList.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate">
                  {c.tanggal_terima} · {c.outlet_nama} · {c.bahan_nama} · {c.qty.toLocaleString('id-ID')} {c.satuan}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-red-700 underline disabled:opacity-50"
                  disabled={tolak.isPending}
                  onClick={() => tolakCatatan(c.id)}
                >
                  Tolak
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
