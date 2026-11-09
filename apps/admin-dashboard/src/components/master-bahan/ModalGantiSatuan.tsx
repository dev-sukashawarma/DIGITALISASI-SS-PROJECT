'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { bacaIsian } from '@/lib/masterBahan/angka'
import { pilihanSatuanBeli } from '@/lib/masterBahan/satuanBeli'
import { faktorTampilanDari } from '@/lib/masterBahan/isianSatuan'
import {
  kalimatJembatan, labelPenghalang, type PratinjauGantiSatuan, type SatuanRingkas,
} from '@/lib/masterBahan/gantiSatuan'
import { formatTriUnitSaldoAdaptive } from '@/lib/format/compositeUnit'
import { rupiah } from '@/lib/format'
import { IsianSatuanFields, keDataSatuan, nilaiSatuanDari, satuanInvalid, type NilaiSatuan } from './IsianSatuanFields'
import { FormHargaVendor } from './FormHargaVendor'

const LABEL_JUMLAH: Record<string, string> = {
  ledger: 'baris riwayat stok', opname_item: 'baris opname', resep_item: 'baris resep', katalog: 'harga vendor',
  sj_item: 'baris surat jalan', po_item: 'baris PO', permintaan_item: 'baris permintaan', waste: 'laporan waste',
  terima_vendor: 'terima vendor', retur_item: 'baris retur', mutasi_item: 'baris mutasi', reorder_point: 'batas minimum outlet',
}

function formatSaldo(qty: number, kecil: boolean, s: SatuanRingkas): string {
  return formatTriUnitSaldoAdaptive(qty, kecil, s.satuan, s.satuan_tengah, s.faktor_tengah, s.satuan_kecil, s.faktor_tampilan)
}

export function ModalGantiSatuan({ bahan, onTutup }: { bahan: BahanBakuWithHarga; onTutup: () => void }) {
  const { pratinjauGantiSatuan, gantiSatuan } = useMutasiMasterBahan()
  const [nilai, setNilai] = useState<NilaiSatuan>(() => nilaiSatuanDari(bahan))
  const [satuanPo, setSatuanPo] = useState('')
  const [satuanDist, setSatuanDist] = useState('')
  const [jembatan, setJembatan] = useState('')
  const [alasan, setAlasan] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [pratinjau, setPratinjau] = useState<PratinjauGantiSatuan | null>(null)
  const [galat, setGalat] = useState<GalatRpc | null>(null)
  const [selesai, setSelesai] = useState<SatuanRingkas | null>(null)
  const [bukaVendor, setBukaVendor] = useState(false)

  const data = keDataSatuan(nilai)
  const tingkatBaru = {
    satuan: data.satuan, satuan_tengah: data.satuan_tengah, faktor_tengah: data.faktor_tengah,
    satuan_kecil: data.satuan_kecil, faktor_tampilan: faktorTampilanDari(data),
  }
  const pilihan = pilihanSatuanBeli(tingkatBaru).map((p) => p.label)
  const pilihanPo = pilihan.filter(
    (l) => l.toLowerCase() !== 'kg' || [data.satuan, data.satuan_tengah, data.satuan_kecil].some((t) => t?.toLowerCase() === 'kg'),
  )
  const { nilai: nilaiJembatan, invalid: jembatanInvalid } = bacaIsian(jembatan, null)
  const jembatanOk = nilaiJembatan !== null && Number.isFinite(nilaiJembatan) && nilaiJembatan > 0
  const kecilBaru = data.satuan_kecil ?? ''
  const isianLengkap = !satuanInvalid(nilai) && kecilBaru !== '' && jembatanOk && satuanPo !== '' && satuanDist !== ''
    && alasan.trim() !== ''

  // Isian apa pun berubah → pratinjau lama tidak berlaku lagi.
  function ubah<T>(set: (v: T) => void) {
    return (v: T) => { set(v); setPratinjau(null); setGalat(null); setKonfirmasi('') }
  }

  const baru = { ...data, satuan_po: satuanPo || null, satuan_distribusi: satuanDist || null }

  async function lihatPratinjau() {
    if (!jembatanOk || nilaiJembatan === null) return
    setGalat(null)
    try {
      setPratinjau(await pratinjauGantiSatuan.mutateAsync({ bahanId: bahan.id, baru, jembatan: nilaiJembatan }))
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  async function jalankan() {
    if (!pratinjau || nilaiJembatan === null) return
    setGalat(null)
    try {
      await gantiSatuan.mutateAsync({ bahanId: bahan.id, baru, jembatan: nilaiJembatan, alasan: alasan.trim() })
      toast.success('Satuan diganti')
      setSelesai(pratinjau.satuan_baru)
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  const bisaLanjut = pratinjau !== null && pratinjau.penghalang.length === 0 && pratinjau.peringatan_label.length === 0
  const namaCocok = konfirmasi.trim().toLowerCase() === bahan.nama.trim().toLowerCase()
  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'

  if (selesai) {
    return (
      <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
          <h3 className="text-base font-extrabold text-suka-brown">Satuan {bahan.nama} sudah diganti</h3>
          <p className="text-sm text-gray-600">
            Sekarang 1 {selesai.satuan} = {Number(selesai.faktor_tampilan).toLocaleString('id-ID')} {selesai.satuan_kecil}.
            Stok, riwayat, dan dokumen lama sudah ikut dikonversi. Kalau vendornya berganti, nonaktifkan harga vendor lama
            dan isi harga vendor baru.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onTutup} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Tutup</button>
            <button onClick={() => setBukaVendor(true)} className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white">
              Tambah harga vendor baru
            </button>
          </div>
        </div>
        {bukaVendor && (
          <FormHargaVendor
            bahan={{ id: bahan.id, nama: bahan.nama, satuan: selesai.satuan, satuan_tengah: selesai.satuan_tengah,
              faktor_tengah: selesai.faktor_tengah, satuan_kecil: selesai.satuan_kecil, faktor_tampilan: selesai.faktor_tampilan }}
            onBatal={() => setBukaVendor(false)}
            onSelesai={onTutup}
          />
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div>
          <h3 className="text-base font-extrabold text-suka-brown">Ganti satuan — {bahan.nama}</h3>
          <p className="text-xs text-gray-500">
            Sekarang: {bahan.satuan}{bahan.satuan_tengah ? ` / ${bahan.satuan_tengah}` : ''} / {bahan.satuan_kecil ?? '—'}
            {bahan.faktor_tampilan ? ` (1 ${bahan.satuan} = ${Number(bahan.faktor_tampilan).toLocaleString('id-ID')} ${bahan.satuan_kecil})` : ''}.
            Stok semua outlet, riwayat, opname, resep, harga, dan dokumen lama akan ikut diubah ke satuan baru.
          </p>
        </div>

        <IsianSatuanFields nilai={nilai} onUbah={ubah(setNilai)} />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-gray-600">Satuan PO
            <select value={satuanPo} onChange={(e) => ubah(setSatuanPo)(e.target.value)} className={kelas}>
              <option value="">— pilih —</option>
              {pilihanPo.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600">Satuan kirim ke outlet
            <select value={satuanDist} onChange={(e) => ubah(setSatuanDist)(e.target.value)} className={kelas}>
              <option value="">— pilih —</option>
              {pilihan.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-xs font-semibold text-gray-600">
          1 {bahan.satuan_kecil ?? bahan.satuan} lama = berapa {kecilBaru || 'satuan kecil baru'}?
          <input value={jembatan} onChange={(e) => ubah(setJembatan)(e.target.value)} className={kelas} inputMode="decimal"
            placeholder="Mis. 6" />
          {jembatanInvalid && <span className="mt-1 block text-xs text-red-600">Format angka tidak dikenali</span>}
          {jembatanOk && nilaiJembatan !== null && kecilBaru && (
            <span className="mt-1 block text-xs text-gray-500">{kalimatJembatan(bahan.satuan_kecil ?? bahan.satuan, kecilBaru, nilaiJembatan)}</span>
          )}
        </label>

        <label className="block text-xs font-semibold text-gray-600">Alasan
          <input value={alasan} onChange={(e) => ubah(setAlasan)(e.target.value)} className={kelas}
            placeholder="Mis. ganti vendor, sekarang dibeli kiloan" />
        </label>

        {!pratinjau && (
          <div className="flex justify-end gap-2">
            <button onClick={onTutup} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Batal</button>
            <button onClick={() => void lihatPratinjau()} disabled={!isianLengkap || pratinjauGantiSatuan.isPending}
              className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
              {pratinjauGantiSatuan.isPending ? 'Menghitung…' : 'Lihat pratinjau'}
            </button>
          </div>
        )}

        {pratinjau && pratinjau.penghalang.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-bold">Belum bisa diganti. Selesaikan atau batalkan dulu:</p>
            <ul className="mt-1 list-disc pl-5">
              {pratinjau.penghalang.map((p, i) => <li key={`${p.jenis}-${p.id ?? i}`}>{labelPenghalang(p)}</li>)}
            </ul>
          </div>
        )}
        {pratinjau && pratinjau.peringatan_label.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {pratinjau.peringatan_label.map((p) => <p key={p}>{p}</p>)}
          </div>
        )}

        {bisaLanjut && pratinjau && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr><th className="px-3 py-2">Lokasi</th><th className="px-3 py-2">Sekarang</th><th className="px-3 py-2">Sesudah</th></tr>
                </thead>
                <tbody>
                  {pratinjau.saldo.map((s) => (
                    <tr key={s.outlet_id} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 text-gray-700">{s.outlet}</td>
                      <td className="px-3 py-1.5 text-gray-600">{formatSaldo(Number(s.saldo_lama), s.skala === 'kecil', pratinjau.satuan_lama)}</td>
                      <td className="px-3 py-1.5 font-semibold text-gray-800">{formatSaldo(Number(s.saldo_baru), s.skala === 'kecil', pratinjau.satuan_baru)}</td>
                    </tr>
                  ))}
                  {pratinjau.saldo.length === 0 && <tr><td colSpan={3} className="px-3 py-2 text-gray-500">Belum ada stok di lokasi mana pun.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-600">
              Ikut diubah:{' '}
              {Object.entries(pratinjau.jumlah).filter(([k, n]) => n > 0 && LABEL_JUMLAH[k])
                .map(([k, n]) => `${Number(n).toLocaleString('id-ID')} ${LABEL_JUMLAH[k]}`).join(', ') || 'tidak ada'}.
            </p>
            {pratinjau.harga_master_lama !== null && pratinjau.harga_master_baru !== null && (
              <p className="text-xs text-gray-600">
                Harga master: {rupiah(Number(pratinjau.harga_master_lama))} per {pratinjau.satuan_lama.satuan} →{' '}
                <span className="font-semibold">{rupiah(Number(pratinjau.harga_master_baru))} per {pratinjau.satuan_baru.satuan}</span> (nilai sama).
              </p>
            )}
            <label className="block text-xs font-semibold text-gray-600">
              Ketik nama bahan untuk konfirmasi (tidak bisa dibatalkan otomatis)
              <input value={konfirmasi} onChange={(e) => setKonfirmasi(e.target.value)} className={kelas} placeholder={bahan.nama} />
            </label>
          </div>
        )}

        {galat && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{galat.pesan}</div>}

        {pratinjau && (
          <div className="flex justify-end gap-2">
            <button onClick={onTutup} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Batal</button>
            <button onClick={() => void jalankan()} disabled={!bisaLanjut || !namaCocok || gantiSatuan.isPending}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
              {gantiSatuan.isPending ? 'Mengganti…' : 'Ganti satuan'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
