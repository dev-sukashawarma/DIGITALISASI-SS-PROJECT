'use client'
import type { Ukuran } from './avatar/posisi'
import { LANGKAH_PANEL, LANGKAH_TINGGI, LEBAR_PANEL, TINGGI_MIN, TINGGI_PANEL, type Setelan } from './avatar/setelan'

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

function Penggeser({ id, label, nilai, min, maks, langkah, onUbah, mengikuti }: {
  /** Diisi bila layar terlalu kecil untuk diatur (slider diganti keterangan ini). */
  mengikuti?: string
  id: string
  label: string
  nilai: number
  min: number
  maks: number
  langkah: number
  onUbah: (nilai: number) => void
}) {
  if (maks <= min && mengikuti) {
    return (
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{mengikuti} · {nilai} px</span>
      </div>
    )
  }
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <label htmlFor={id}>{label}</label>
        <span>{nilai} px</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={maks}
        step={langkah}
        value={nilai}
        onChange={(e) => onUbah(Number(e.target.value))}
        className="w-full accent-suka-orange"
      />
    </div>
  )
}

function JudulOtomatis({ judul, otomatis, onOtomatis }: { judul: string; otomatis: boolean; onOtomatis: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-gray-500">{judul}{otomatis ? ' · Otomatis' : ''}</p>
      <button type="button" onClick={onOtomatis} disabled={otomatis} className="text-xs font-semibold text-suka-orange disabled:text-gray-300">
        Otomatis
      </button>
    </div>
  )
}

const GAYA_AKSI = 'w-full rounded-xl border border-suka-orange/30 px-4 py-2.5 text-left text-sm font-semibold text-suka-ink hover:bg-amber-50'

export default function PanelSetelan({ setelan, ubah, kembalikanPosisi, sembunyikan, tinggiTerpakai, tinggiMaks, panelTerpakai, batasPanel, onKembali }: {
  setelan: Setelan
  /** Tinggi chef yang sedang dipakai (sudah dibatasi layar). */
  tinggiTerpakai: number
  /** Batas atas slider tinggi chef untuk layar ini. */
  tinggiMaks: number
  /** Ukuran kotak chat yang sedang dipakai (sudah dijepit layar). */
  panelTerpakai: Ukuran
  /** Batas atas slider kotak chat untuk layar ini. */
  batasPanel: { lebarMaks: number; tinggiMaks: number }
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
        <JudulOtomatis judul="Ukuran chef" otomatis={setelan.tinggiChef === null} onOtomatis={() => ubah({ tinggiChef: null })} />
        <Penggeser
          id="sukabot-tinggi-chef"
          label="Tinggi"
          nilai={tinggiTerpakai}
          min={TINGGI_MIN}
          maks={tinggiMaks}
          langkah={LANGKAH_TINGGI}
          onUbah={(v) => ubah({ tinggiChef: v })}
        />
      </div>
      <div className="space-y-1.5">
        <JudulOtomatis
          judul="Ukuran kotak chat"
          otomatis={setelan.lebarPanel === null && setelan.tinggiPanel === null}
          onOtomatis={() => ubah({ lebarPanel: null, tinggiPanel: null })}
        />
        <Penggeser
          id="sukabot-lebar-panel"
          label="Lebar"
          nilai={panelTerpakai.w}
          min={LEBAR_PANEL.min}
          maks={batasPanel.lebarMaks}
          langkah={LANGKAH_PANEL}
          onUbah={(v) => ubah({ lebarPanel: v })}
          mengikuti="Mengikuti lebar layar"
        />
        <Penggeser
          id="sukabot-tinggi-panel"
          label="Tinggi"
          nilai={panelTerpakai.h}
          min={TINGGI_PANEL.min}
          maks={batasPanel.tinggiMaks}
          langkah={LANGKAH_PANEL}
          onUbah={(v) => ubah({ tinggiPanel: v })}
          mengikuti="Mengikuti tinggi layar"
        />
      </div>
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
