'use client'
import { turunkanFaktorSatuan } from '@/lib/satuanBahan'
import { keDataSatuan, satuanInvalid, type NilaiSatuan } from '@/lib/masterBahan/isianSatuan'

// Re-export supaya import lama `from './IsianSatuanFields'` tetap jalan — fungsi
// murninya sendiri kini hidup di lib/masterBahan/isianSatuan.ts (ber-test terpisah).
export { nilaiSatuanDari, keDataSatuan, faktorTampilanDari, satuanInvalid } from '@/lib/masterBahan/isianSatuan'
export type { NilaiSatuan } from '@/lib/masterBahan/isianSatuan'

export function IsianSatuanFields({
  nilai, onUbah, nonaktif = false,
}: { nilai: NilaiSatuan; onUbah: (v: NilaiSatuan) => void; nonaktif?: boolean }) {
  const set = (k: keyof NilaiSatuan) => (e: React.ChangeEvent<HTMLInputElement>) => onUbah({ ...nilai, [k]: e.target.value })
  const d = keDataSatuan(nilai)
  const pratinjau = turunkanFaktorSatuan({
    satuan: d.satuan ?? '', satuan_tengah: d.satuan_tengah ?? null, faktor_tengah: d.faktor_tengah ?? null,
    satuan_kecil: d.satuan_kecil ?? null, isiKecilPerTengah: d.isi_kecil_per_tengah ?? null,
  })
  const invalid = satuanInvalid(nilai)
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
      {invalid && <p className="text-xs text-red-600">Isian satuan belum lengkap atau angkanya tidak dikenali</p>}
    </div>
  )
}
