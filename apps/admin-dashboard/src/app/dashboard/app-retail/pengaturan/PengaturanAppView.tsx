'use client'
import { useState, useTransition, type ReactNode } from 'react'
import { periksaPengaturan, type InputPengaturan } from '@/lib/appRetail/pengaturanForm'
import { simpanPengaturan } from '../pengamanActions'

const LABEL_AKSI: Record<string, string> = {
  pengaturan_ubah: 'Ubah pengaturan', tutup_sementara: 'Tutup sementara', buka_sekarang: 'Buka sekarang',
  jam_ubah: 'Ubah jam buka', menu_habis_ubah: 'Ubah menu habis', refund_selesai: 'Refund selesai',
}

/** Field angka disimpan sebagai string mentah -- mengosongkan input tidak boleh
 * diam-diam jadi 0 (Number('') === 0), jadi kekosongan wajib terlihat &
 * ditolak sebelum dikirim ke `periksaPengaturan`/`simpanPengaturan` (M2). */
type FormAngkaString = {
  menitPesanTerakhir: string
  menitTertahan: string
  estimasiSiap: string
  waCs: string
  versiMinimumAndroid: string
  urlSyarat: string
  urlPrivasi: string
}

export default function PengaturanAppView({ awal, log, staf, galat, sisipan }: {
  awal: Record<string, unknown> | null
  log: { id: number; aksi: string; sasaran_id: string | null; pada: string; oleh: string }[]
  staf: { id: string; name: string | null }[]
  galat: string[]
  /** Bagian tambahan di bawah formulir, di atas riwayat (mis. Menu Terlaris). */
  sisipan?: ReactNode
}) {
  const [f, setF] = useState<FormAngkaString>({
    menitPesanTerakhir: String(awal?.menit_pesan_terakhir ?? 30),
    menitTertahan: String(awal?.menit_tertahan ?? 10),
    estimasiSiap: String(awal?.estimasi_siap ?? '15–20 menit'),
    waCs: String(awal?.wa_cs ?? ''),
    versiMinimumAndroid: String(awal?.versi_minimum_android ?? 1),
    urlSyarat: String(awal?.url_syarat ?? ''),
    urlPrivasi: String(awal?.url_privasi ?? ''),
  })
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const [bekerja, mulai] = useTransition()

  // Baris pengaturan gagal dimuat -- `awal === null` berarti kita tak tahu
  // nilai yang sedang berlaku (bukan "pakai default 30/10/dst"). Menyimpan
  // di keadaan ini akan MENIMPA baris id=1 yang sebenarnya dengan default
  // form, jadi Simpan wajib dikunci (M2).
  const gagalMuat = awal === null

  function simpan() {
    if (gagalMuat) {
      setPesan({ ok: false, teks: 'Pengaturan gagal dimuat — muat ulang halaman sebelum menyimpan.' })
      return
    }
    if (f.menitPesanTerakhir.trim() === '' || f.menitTertahan.trim() === '' || f.versiMinimumAndroid.trim() === '') {
      setPesan({ ok: false, teks: 'Kolom angka wajib diisi (tidak boleh kosong).' })
      return
    }
    const input: InputPengaturan = {
      menitPesanTerakhir: Number(f.menitPesanTerakhir),
      menitTertahan: Number(f.menitTertahan),
      estimasiSiap: f.estimasiSiap,
      waCs: f.waCs,
      versiMinimumAndroid: Number(f.versiMinimumAndroid),
      urlSyarat: f.urlSyarat,
      urlPrivasi: f.urlPrivasi,
    }
    const g = periksaPengaturan(input)
    if (g) { setPesan({ ok: false, teks: g }); return }
    mulai(async () => {
      try { await simpanPengaturan(input); setPesan({ ok: true, teks: 'Tersimpan. Berlaku di aplikasi paling lambat 1 menit.' }) }
      catch (e) { setPesan({ ok: false, teks: e instanceof Error ? e.message : 'Gagal menyimpan' }) }
    })
  }

  const baris = (label: string, bantuan: string, input: ReactNode) => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {input}
      <span className="block text-[11px] text-slate-500">{bantuan}</span>
    </label>
  )
  const kelas = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm'

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900">Pengaturan Aplikasi</h1>
      {galat.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
          {galat.map((g, i) => <p key={i}>{g}</p>)}
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        {gagalMuat && (
          <p className="text-sm text-red-600">Pengaturan gagal dimuat — muat ulang halaman sebelum menyimpan.</p>
        )}
        {baris('Batas pesan terakhir (menit sebelum tutup)', 'Mis. 30 = outlet tutup 22.00, pesanan terakhir 21.30.',
          <input type="number" className={kelas} value={f.menitPesanTerakhir} onChange={(e) => setF({ ...f, menitPesanTerakhir: e.target.value })} />)}
        {baris('Batas pesanan tertahan (menit)', 'Pesanan dibayar yang belum ditekan "Mulai Masak" selama ini ditandai merah.',
          <input type="number" className={kelas} value={f.menitTertahan} onChange={(e) => setF({ ...f, menitTertahan: e.target.value })} />)}
        {baris('Estimasi waktu siap', 'Tampil ke pelanggan setelah bayar. Maks 40 huruf.',
          <input className={kelas} maxLength={40} value={f.estimasiSiap} onChange={(e) => setF({ ...f, estimasiSiap: e.target.value })} />)}
        {baris('WhatsApp CS', 'Tempat pelanggan menghubungi soal pesanan/refund. Kosongkan untuk menyembunyikan tombol.',
          <input className={kelas} value={f.waCs} placeholder="08…" onChange={(e) => setF({ ...f, waCs: e.target.value })} />)}
        {baris('Versi minimum Android (versionCode)', 'Aplikasi di bawah versi ini dipaksa update. Naikkan hanya setelah versi baru tersedia di Play Store.',
          <input type="number" className={kelas} value={f.versiMinimumAndroid} onChange={(e) => setF({ ...f, versiMinimumAndroid: e.target.value })} />)}
        {baris('Link Syarat & Ketentuan', 'Wajib https://', <input className={kelas} value={f.urlSyarat} onChange={(e) => setF({ ...f, urlSyarat: e.target.value })} />)}
        {baris('Link Kebijakan Privasi', 'Wajib https:// — diminta Play Store karena aplikasi memakai izin lokasi.',
          <input className={kelas} value={f.urlPrivasi} onChange={(e) => setF({ ...f, urlPrivasi: e.target.value })} />)}
        {pesan && <p className={`text-sm ${pesan.ok ? 'text-emerald-700' : 'text-red-600'}`}>{pesan.teks}</p>}
        <button type="button" disabled={bekerja || gagalMuat} onClick={simpan} className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer disabled:opacity-60">Simpan</button>
      </div>

      {sisipan}

      <div className="space-y-2">
        <h2 className="font-bold text-slate-900">Riwayat perubahan</h2>
        <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
          <tbody>{log.map((l) => (
            <tr key={l.id} className="border-t border-slate-100 first:border-0">
              <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(l.pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
              <td className="p-3 font-semibold">{LABEL_AKSI[l.aksi] ?? l.aksi}</td>
              <td className="p-3">{staf.find((s) => s.id === l.oleh)?.name ?? l.oleh.slice(0, 8)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
