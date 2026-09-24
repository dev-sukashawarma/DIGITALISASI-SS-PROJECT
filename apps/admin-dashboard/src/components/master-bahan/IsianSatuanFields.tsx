'use client'
import { turunkanFaktorSatuan } from '@/lib/satuanBahan'
import type { TingkatSatuan } from '@/lib/masterBahan/satuanBeli'
import type { DataBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaAngka } from '@/lib/masterBahan/angka'

export type NilaiSatuan = {
  satuan: string
  satuan_tengah: string
  faktor_tengah: string
  satuan_kecil: string
  isi_kecil_per_tengah: string
}

/** Isian form dari data master: isi kecil per TENGAH (atau per besar bila tanpa tengah). */
export function nilaiSatuanDari(b: TingkatSatuan): NilaiSatuan {
  const isi =
    b.satuan_tengah && b.faktor_tengah && b.faktor_tampilan ? b.faktor_tampilan / b.faktor_tengah : b.faktor_tampilan
  return {
    satuan: b.satuan ?? '',
    satuan_tengah: b.satuan_tengah ?? '',
    faktor_tengah: b.faktor_tengah ? String(b.faktor_tengah) : '',
    satuan_kecil: b.satuan_kecil ?? '',
    isi_kecil_per_tengah: isi ? String(isi) : '',
  }
}

const angkaAtauNull = (s: string): number | null => bacaAngka(s)

type DataSatuan = Pick<DataBahan, 'satuan' | 'satuan_tengah' | 'faktor_tengah' | 'satuan_kecil' | 'isi_kecil_per_tengah'>

/** Kunci satuan untuk simpan_bahan_baku — dikirim sebagai satu set. */
export function keDataSatuan(v: NilaiSatuan): DataSatuan {
  return {
    satuan: v.satuan.trim(),
    satuan_tengah: v.satuan_tengah.trim() || null,
    faktor_tengah: angkaAtauNull(v.faktor_tengah),
    satuan_kecil: v.satuan_kecil.trim() || null,
    isi_kecil_per_tengah: angkaAtauNull(v.isi_kecil_per_tengah) ?? 1,
  }
}

/** Faktor tampilan hasil turunan (dipakai pratinjau & pilihan satuan beli di form bahan baru). */
export function faktorTampilanDari(d: DataSatuan): number | null {
  if (!d.satuan_kecil) return null
  const perTengah = d.isi_kecil_per_tengah ?? 1
  return d.satuan_tengah && d.faktor_tengah ? d.faktor_tengah * perTengah : perTengah
}

export function IsianSatuanFields({
  nilai, onUbah, nonaktif = false,
}: { nilai: NilaiSatuan; onUbah: (v: NilaiSatuan) => void; nonaktif?: boolean }) {
  const set = (k: keyof NilaiSatuan) => (e: React.ChangeEvent<HTMLInputElement>) => onUbah({ ...nilai, [k]: e.target.value })
  const d = keDataSatuan(nilai)
  const pratinjau = turunkanFaktorSatuan({
    satuan: d.satuan ?? '', satuan_tengah: d.satuan_tengah ?? null, faktor_tengah: d.faktor_tengah ?? null,
    satuan_kecil: d.satuan_kecil ?? null, isiKecilPerTengah: d.isi_kecil_per_tengah ?? null,
  })
  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-gray-600">Satuan besar
          <input value={nilai.satuan} onChange={set('satuan')} disabled={nonaktif} className={kelas} placeholder="Dus" />
        </label>
        <label className="text-xs font-semibold text-gray-600">Satuan kecil (kosongkan bila satu tingkat)
          <input value={nilai.satuan_kecil} onChange={set('satuan_kecil')} disabled={nonaktif} className={kelas} placeholder="gram" />
        </label>
        <label className="text-xs font-semibold text-gray-600">Satuan tengah (opsional)
          <input value={nilai.satuan_tengah} onChange={set('satuan_tengah')} disabled={nonaktif} className={kelas} placeholder="Roll" />
        </label>
        <label className="text-xs font-semibold text-gray-600">1 besar = … tengah
          <input value={nilai.faktor_tengah} onChange={set('faktor_tengah')} disabled={nonaktif || !nilai.satuan_tengah.trim()} className={kelas} inputMode="decimal" />
        </label>
        <label className="col-span-2 text-xs font-semibold text-gray-600">
          1 {nilai.satuan_tengah.trim() || nilai.satuan.trim() || 'satuan'} = … {nilai.satuan_kecil.trim() || 'satuan kecil'}
          <input value={nilai.isi_kecil_per_tengah} onChange={set('isi_kecil_per_tengah')} disabled={nonaktif || !nilai.satuan_kecil.trim()} className={kelas} inputMode="decimal" />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        {pratinjau.satuan_kecil
          ? pratinjau.faktor_tampilan
            ? `Hasil: 1 ${pratinjau.satuan} = ${Number(pratinjau.faktor_tampilan).toLocaleString('id-ID')} ${pratinjau.satuan_kecil}`
            : 'Isi belum lengkap.'
          : `Hasil: satu tingkat (${pratinjau.satuan || '—'}).`}
      </p>
    </div>
  )
}
