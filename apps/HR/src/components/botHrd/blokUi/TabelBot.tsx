'use client'

import { daftarChip, nadaStatus, type NadaStatus } from '@/lib/botHrd/uraiPesan'

type Sel = string | number | null

const angka = (v: Sel) => {
  if (typeof v === 'number') return true
  if (typeof v !== 'string') return false
  return /^-?[\d.,]+%?$/.test(v.trim()) && /\d/.test(v)
}

const tampil = (v: Sel) => {
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'number') return v.toLocaleString('id-ID')
  return v
}

// Warna lencana status: alpa merah, telat amber, toleransi amber muda, cuti/izin biru, hadir hijau.
const WARNA_STATUS: Record<NadaStatus, string> = {
  bahaya: 'bg-red-100 text-red-700 ring-red-200',
  peringatan: 'bg-amber-100 text-amber-800 ring-amber-200',
  toleransi: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
  info: 'bg-sky-100 text-sky-800 ring-sky-200',
  baik: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
}

function IsiSel({ v }: { v: Sel }) {
  const nada = nadaStatus(v)
  if (nada) {
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ring-1 ring-inset ${WARNA_STATUS[nada]}`}>
        {v}
      </span>
    )
  }
  const chip = daftarChip(v)
  if (chip) {
    return (
      <span className="flex flex-wrap gap-1">
        {chip.map((c, i) => (
          <span key={i} className="rounded-full bg-[#F6EDE1] px-2 py-0.5 text-[11px] leading-4 text-[#4A1713]">
            {c}
          </span>
        ))}
      </span>
    )
  }
  return <>{tampil(v)}</>
}

/**
 * Tabel jawaban bot. Responsif terhadap LEBAR PANEL (container query), bukan layar:
 * - panel sempit (< 34rem): tiap baris jadi kartu (kolom pertama = judul, sisanya label: nilai);
 * - panel lebar (diperbesar): tabel biasa yang membungkus teks, tanpa scroll horizontal.
 */
export function TabelBot({
  judul,
  kolom,
  baris,
  catatan,
}: {
  judul?: string
  kolom: string[]
  baris: Sel[][]
  catatan?: string
}) {
  // Kolom dianggap angka bila semua sel non-kosongnya angka.
  const kolomAngka = kolom.map((_, k) => {
    const isi = baris.map((r) => r[k]).filter((v) => v !== null && v !== undefined && v !== '')
    return isi.length > 0 && isi.every(angka)
  })
  const kosong = baris.length === 0

  return (
    <div className="@container w-full min-w-0 space-y-1">
      {judul && <p className="text-xs font-semibold text-[#4A1713]">{judul}</p>}

      {/* Panel sempit: kartu per baris */}
      <div className="max-h-96 space-y-1.5 overflow-y-auto @[34rem]:hidden">
        {baris.map((r, ri) => (
          <div key={ri} className="rounded-lg border border-[#E8DCCB] bg-white px-3 py-1.5 text-[13px] text-[#2B1B17]">
            <p className="break-words font-semibold text-[#4A1713]">
              <IsiSel v={r[0] ?? null} />
            </p>
            {kolom.length > 1 && kolom.length <= 3 && (
              // Tabel ringkas (≤3 kolom): sisa kolom satu baris kecil, mis. "KANTOR PUSAT · Alpa".
              <p className="mt-0.5 break-words text-[12px] text-[#6b5a50]">
                {kolom.slice(1).map((_, i) => (
                  <span key={i}>
                    {i > 0 && <span className="px-1 text-[#c4b5a8]">·</span>}
                    <IsiSel v={r[i + 1] ?? null} />
                  </span>
                ))}
              </p>
            )}
            {kolom.length > 3 && (
              <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                {kolom.slice(1).map((k, i) => {
                  const ci = i + 1
                  return (
                    <div key={ci} className="contents">
                      <dt className="text-[11px] leading-5 text-[#8a7a70]">{k}</dt>
                      <dd className={`min-w-0 break-words leading-5 ${kolomAngka[ci] ? 'tabular-nums' : ''}`}>
                        <IsiSel v={r[ci] ?? null} />
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </div>
        ))}
        {kosong && <p className="rounded-lg border border-[#E8DCCB] bg-white px-3 py-2 text-center text-[13px] text-[#8a7a70]">Tidak ada data</p>}
      </div>

      {/* Panel lebar: tabel biasa yang membungkus */}
      <div className="hidden max-h-[28rem] overflow-y-auto rounded-lg border border-[#E8DCCB] bg-white @[34rem]:block">
        <table className="w-full border-collapse text-[13px] text-[#2B1B17]">
          <thead>
            <tr>
              {kolom.map((k, i) => (
                <th
                  key={i}
                  className={`sticky top-0 z-10 border-b border-[#E8DCCB] bg-[#FDF9F3] px-3 py-2 font-semibold text-[#4A1713] ${
                    kolomAngka[i] ? 'whitespace-nowrap text-right' : 'text-left'
                  }`}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((r, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-[#FDF9F3]' : 'bg-white'}>
                {kolom.map((_, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-1.5 align-top ${
                      kolomAngka[ci] ? 'whitespace-nowrap text-right tabular-nums' : 'break-words text-left'
                    } ${ci === 0 ? 'font-medium' : ''}`}
                  >
                    <IsiSel v={r[ci] ?? null} />
                  </td>
                ))}
              </tr>
            ))}
            {kosong && (
              <tr>
                <td colSpan={kolom.length} className="px-3 py-2 text-center text-[#8a7a70]">
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-[#8a7a70]">{baris.length.toLocaleString('id-ID')} baris</p>
      {catatan && <p className="text-[11px] italic text-[#6b5a50]">{catatan}</p>}
    </div>
  )
}
