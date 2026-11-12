'use client'
import { turunkanFaktorSatuan } from '../../lib/satuanBahan'
import { keDataSatuan, satuanInvalid, type NilaiSatuan } from '../../lib/masterBahan/isianSatuan'
import { SATUAN_BAKU, opsiPilihan } from '../../lib/masterBahan/daftarPilihan'
import { CustomSelect } from '../ui/CustomSelect'

// Re-export supaya import lama `from './IsianSatuanFields'` tetap jalan — fungsi
// murninya sendiri kini hidup di lib/masterBahan/isianSatuan.ts (ber-test terpisah).
export { nilaiSatuanDari, keDataSatuan, faktorTampilanDari, satuanInvalid } from '../../lib/masterBahan/isianSatuan'
export type { NilaiSatuan } from '../../lib/masterBahan/isianSatuan'

/** Dropdown satuan custom dari daftar baku; nilai lama di luar daftar tetap tampil bertanda "(lama)". */
function PilihSatuan({
  nilai,
  onChange,
  nonaktif,
  kosong,
}: {
  nilai: string
  onChange: (value: string) => void
  nonaktif: boolean
  kosong: string
}) {
  const daftar = [
    { value: '', label: kosong },
    ...opsiPilihan(SATUAN_BAKU, nilai).map((o) => ({ value: o.nilai, label: o.label })),
  ]
  return (
    <CustomSelect
      value={nilai}
      onChange={onChange}
      disabled={nonaktif}
      placeholder={kosong}
      options={daftar}
    />
  )
}

export function IsianSatuanFields({
  nilai,
  onUbah,
  nonaktif = false,
}: {
  nilai: NilaiSatuan
  onUbah: (v: NilaiSatuan) => void
  nonaktif?: boolean
}) {
  const setVal = (k: keyof NilaiSatuan) => (v: string) => onUbah({ ...nilai, [k]: v })
  const setInput =
    (k: keyof NilaiSatuan) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onUbah({ ...nilai, [k]: e.target.value })

  const d = keDataSatuan(nilai)
  const pratinjau = turunkanFaktorSatuan({
    satuan: d.satuan ?? '',
    satuan_tengah: d.satuan_tengah ?? null,
    faktor_tengah: d.faktor_tengah ?? null,
    satuan_kecil: d.satuan_kecil ?? null,
    isiKecilPerTengah: d.isi_kecil_per_tengah ?? null,
  })
  const invalid = satuanInvalid(nilai)
  const kelasInput =
    'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-suka-orange focus:outline-none disabled:bg-gray-50'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="text-xs font-semibold text-gray-600">
          <span>Satuan besar</span>
          <PilihSatuan
            nilai={nilai.satuan}
            onChange={setVal('satuan')}
            nonaktif={nonaktif}
            kosong="Pilih satuan"
          />
        </div>
        <div className="text-xs font-semibold text-gray-600">
          <span>Satuan kecil</span>
          <PilihSatuan
            nilai={nilai.satuan_kecil}
            onChange={setVal('satuan_kecil')}
            nonaktif={nonaktif}
            kosong="Tidak ada (satu tingkat)"
          />
        </div>
        <div className="text-xs font-semibold text-gray-600">
          <span>Satuan tengah (opsional)</span>
          <PilihSatuan
            nilai={nilai.satuan_tengah}
            onChange={setVal('satuan_tengah')}
            nonaktif={nonaktif}
            kosong="Tidak ada"
          />
        </div>
        <label className="text-xs font-semibold text-gray-600">
          1 besar = ... tengah
          <input
            value={nilai.faktor_tengah}
            onChange={setInput('faktor_tengah')}
            disabled={nonaktif || !nilai.satuan_tengah.trim()}
            className={kelasInput}
            inputMode="decimal"
          />
        </label>
        <label className="col-span-2 text-xs font-semibold text-gray-600">
          1 {nilai.satuan_tengah.trim() || nilai.satuan.trim() || 'satuan'} = ...{' '}
          {nilai.satuan_kecil.trim() || 'satuan kecil'}
          <input
            value={nilai.isi_kecil_per_tengah}
            onChange={setInput('isi_kecil_per_tengah')}
            disabled={nonaktif || !nilai.satuan_kecil.trim()}
            className={kelasInput}
            inputMode="decimal"
          />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        {pratinjau.satuan_kecil
          ? pratinjau.faktor_tampilan
            ? `Hasil: 1 ${pratinjau.satuan} = ${Number(pratinjau.faktor_tampilan).toLocaleString('id-ID')} ${pratinjau.satuan_kecil}`
            : 'Isi belum lengkap.'
          : `Hasil: satu tingkat (${pratinjau.satuan || '-'}).`}
      </p>
      {invalid && (
        <p className="text-xs text-red-600">
          Isian satuan belum lengkap atau angkanya tidak dikenali
        </p>
      )}
    </div>
  )
}
