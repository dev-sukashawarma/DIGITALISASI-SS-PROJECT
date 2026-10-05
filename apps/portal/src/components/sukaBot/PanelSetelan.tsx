'use client'
import { LANGKAH_TINGGI, PILIHAN_UKURAN, TINGGI_MIN, type PilihanUkuran, type Setelan } from './avatar/setelan'

const LABEL_UKURAN: Record<PilihanUkuran, string> = { kecil: 'Kecil', sedang: 'Sedang', besar: 'Besar' }
const OPSI_UKURAN = PILIHAN_UKURAN.map((u) => ({ nilai: u, label: LABEL_UKURAN[u] }))
const OPSI_ANIMASI = [{ nilai: 'gerak', label: 'Bergerak' }, { nilai: 'diam', label: 'Diam' }] as const

function Pilihan<T extends string>({ judul, nilai, opsi, onPilih }: {
  judul: string
  nilai: T
  opsi: readonly { nilai: T; label: string }[]
  onPilih: (nilai: T) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-500">{judul}</p>
      <div role="group" aria-label={judul} className="flex rounded-full border border-suka-orange/30 p-0.5">
        {opsi.map((o) => (
          <button
            key={o.nilai}
            type="button"
            aria-pressed={o.nilai === nilai}
            onClick={() => onPilih(o.nilai)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${o.nilai === nilai ? 'bg-suka-orange text-white' : 'text-suka-ink hover:bg-amber-50'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const GAYA_AKSI = 'w-full rounded-xl border border-suka-orange/30 px-4 py-2.5 text-left text-sm font-semibold text-suka-ink hover:bg-amber-50'

export default function PanelSetelan({ setelan, ubah, kembalikanPosisi, sembunyikan, tinggiTerpakai, tinggiMaks, onKembali }: {
  setelan: Setelan
  /** Tinggi chef yang sedang dipakai (sudah dibatasi layar). */
  tinggiTerpakai: number
  /** Batas atas slider untuk layar ini. */
  tinggiMaks: number
  ubah: (perubahan: Partial<Setelan>) => void
  kembalikanPosisi: () => void
  sembunyikan: () => void
  /** Kembali ke layar chat (perubahan sudah tersimpan saat diubah). */
  onKembali: () => void
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="sukabot-tinggi-chef" className="text-xs font-semibold text-gray-500">Ukuran chef</label>
          <span className="text-xs text-gray-500">{setelan.tinggiChef === null ? `Otomatis · ${tinggiTerpakai} px` : `${tinggiTerpakai} px`}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="sukabot-tinggi-chef"
            type="range"
            min={TINGGI_MIN}
            max={tinggiMaks}
            step={LANGKAH_TINGGI}
            value={tinggiTerpakai}
            onChange={(e) => ubah({ tinggiChef: Number(e.target.value) })}
            className="flex-1 accent-suka-orange"
          />
          <button
            type="button"
            onClick={() => ubah({ tinggiChef: null })}
            disabled={setelan.tinggiChef === null}
            className="text-xs font-semibold text-suka-orange disabled:text-gray-300"
          >
            Otomatis
          </button>
        </div>
      </div>
      <Pilihan judul="Ukuran kotak chat" nilai={setelan.ukuranPanel} opsi={OPSI_UKURAN} onPilih={(v) => ubah({ ukuranPanel: v })} />
      <Pilihan
        judul="Animasi chef"
        nilai={setelan.animasi ? 'gerak' : 'diam'}
        opsi={OPSI_ANIMASI}
        onPilih={(v) => ubah({ animasi: v === 'gerak' })}
      />
      <div className="space-y-2">
        <button type="button" onClick={kembalikanPosisi} className={GAYA_AKSI}>Kembalikan posisi chef</button>
        <button type="button" onClick={sembunyikan} className={GAYA_AKSI}>Sembunyikan chef</button>
        <p className="text-xs text-gray-500">Chef jadi tab kecil di tepi kanan layar. Klik tab untuk memunculkannya lagi.</p>
      </div>
      <p className="text-xs text-gray-400">Perubahan langsung diterapkan dan tersimpan di perangkat ini.</p>
    </div>
    <div className="border-t p-3">
      <button type="button" onClick={onKembali} className="w-full rounded-full bg-suka-orange py-2.5 text-sm font-semibold text-white hover:bg-suka-orange/90">
        Simpan &amp; kembali
      </button>
    </div>
    </div>
  )
}
