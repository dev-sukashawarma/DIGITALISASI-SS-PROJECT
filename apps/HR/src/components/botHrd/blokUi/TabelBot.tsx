'use client'

import { AMBANG_SEL_PANJANG, daftarChip } from '@/lib/botHrd/uraiPesan'

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

function Sel({ v }: { v: Sel }) {
  const chip = daftarChip(v)
  if (chip) {
    return (
      <div className="flex flex-wrap gap-1">
        {chip.map((c, i) => (
          <span key={i} className="whitespace-nowrap rounded-full bg-[#F6EDE1] px-2 py-0.5 text-[11px] text-[#4A1713]">
            {c}
          </span>
        ))}
      </div>
    )
  }
  return <>{tampil(v)}</>
}

const panjang = (v: Sel) => typeof v === 'string' && v.length > AMBANG_SEL_PANJANG

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
  return (
    <div className="w-full min-w-0 space-y-1">
      {judul && <p className="text-xs font-semibold text-[#4A1713]">{judul}</p>}
      <div className="max-h-80 w-full overflow-auto rounded-lg border border-[#E8DCCB] bg-white">
        <table className="w-max min-w-full border-collapse text-[13px] text-[#2B1B17]">
          <thead>
            <tr>
              {kolom.map((k, i) => (
                <th
                  key={i}
                  className={`sticky top-0 whitespace-nowrap border-b border-[#E8DCCB] bg-[#FDF9F3] px-2.5 py-1.5 font-semibold text-[#4A1713] ${
                    kolomAngka[i] ? 'text-right' : 'text-left'
                  } ${i === 0 ? 'left-0 z-20' : 'z-10'}`}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((r, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-[#FDF9F3]' : 'bg-white'}>
                {kolom.map((_, ci) => {
                  const v = r[ci] ?? null
                  const teksPanjang = !kolomAngka[ci] && (panjang(v) || daftarChip(v) !== null)
                  return (
                    <td
                      key={ci}
                      className={`px-2.5 py-1.5 align-top ${
                        kolomAngka[ci]
                          ? 'whitespace-nowrap text-right tabular-nums'
                          : teksPanjang
                            ? 'min-w-[9rem] max-w-[18rem] break-words text-left'
                            : 'whitespace-nowrap text-left'
                      } ${ci === 0 ? 'sticky left-0 z-[5] border-r border-[#E8DCCB]/60 bg-inherit font-medium' : ''}`}
                    >
                      <Sel v={v} />
                    </td>
                  )
                })}
              </tr>
            ))}
            {baris.length === 0 && (
              <tr>
                <td colSpan={kolom.length} className="px-2 py-2 text-center text-[#8a7a70]">
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
