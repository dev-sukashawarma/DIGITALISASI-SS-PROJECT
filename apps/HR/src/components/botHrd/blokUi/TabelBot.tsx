'use client'

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
        <table className="w-full border-collapse text-xs text-[#2B1B17]">
          <thead>
            <tr>
              {kolom.map((k, i) => (
                <th
                  key={i}
                  className={`sticky top-0 whitespace-nowrap border-b border-[#E8DCCB] bg-[#FDF9F3] px-2 py-1.5 font-semibold text-[#4A1713] ${
                    kolomAngka[i] ? 'text-right' : 'text-left'
                  }`}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((r, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-[#FDF9F3]/70' : ''}>
                {kolom.map((_, ci) => (
                  <td
                    key={ci}
                    className={`px-2 py-1 align-top ${kolomAngka[ci] ? 'whitespace-nowrap text-right tabular-nums' : 'text-left'}`}
                  >
                    {tampil(r[ci] ?? null)}
                  </td>
                ))}
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
