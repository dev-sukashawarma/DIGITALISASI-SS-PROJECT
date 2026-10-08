'use client'

import { Sliders, RotateCcw, EyeOff, Sparkles, Check } from 'lucide-react'
import {
  LANGKAH_TINGGI,
  TINGGI_MIN,
  type SetelanNayra,
} from './setelan'

interface PanelSetelanNayraProps {
  setelan: SetelanNayra
  tinggiTerpakai: number
  tinggiMaks: number
  ubah: (perubahan: Partial<SetelanNayra>) => void
  kembalikanPosisi: () => void
  sembunyikan: () => void
  onKembali: () => void
}

export default function PanelSetelanNayra({
  setelan,
  tinggiTerpakai,
  tinggiMaks,
  ubah,
  kembalikanPosisi,
  sembunyikan,
  onKembali,
}: PanelSetelanNayraProps) {
  const isOtomatis = setelan.tinggiNayra === null

  const presets = [
    { label: 'Kecil', val: 100 },
    { label: 'Sedang', val: 145 },
    { label: 'Besar', val: 220 },
    { label: 'Jumbo', val: 300 },
  ]

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-5 bg-[#FAF8F5]/60 text-stone-800">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EFE8DE]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#D9480F]/10 flex items-center justify-center text-[#D9480F]">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900">Pengaturan Nayra Bot</h4>
            <p className="text-[10px] text-stone-500">Sesuaikan ukuran avatar & tampilan</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onKembali}
          className="px-2.5 py-1 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
        >
          Selesai
        </button>
      </div>

      {/* 1. Pengaturan Ukuran Avatar */}
      <div className="bg-white rounded-2xl p-3.5 border border-[#EFE8DE] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="slider-tinggi-nayra" className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <span>Tinggi Avatar</span>
            <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-[#FAF8F5] text-stone-600 border border-[#EFE8DE]">
              {tinggiTerpakai} px {isOtomatis && '(Otomatis)'}
            </span>
          </label>
          <button
            type="button"
            onClick={() => ubah({ tinggiNayra: null })}
            disabled={isOtomatis}
            className="text-[11px] font-semibold text-[#D9480F] disabled:text-stone-300 hover:underline cursor-pointer"
          >
            Reset Otomatis
          </button>
        </div>

        {/* Range Slider */}
        <input
          id="slider-tinggi-nayra"
          type="range"
          min={TINGGI_MIN}
          max={tinggiMaks}
          step={LANGKAH_TINGGI}
          value={tinggiTerpakai}
          onChange={(e) => ubah({ tinggiNayra: Number(e.target.value) })}
          className="w-full accent-[#D9480F] cursor-pointer"
        />

        {/* Preset Buttons */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {presets.map((p) => {
            const active = !isOtomatis && Math.abs(tinggiTerpakai - p.val) <= 5
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => ubah({ tinggiNayra: p.val })}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-all border ${
                  active
                    ? 'bg-[#D9480F] text-white border-[#D9480F] shadow-xs'
                    : 'bg-[#FAF8F5] text-stone-700 border-[#EFE8DE] hover:border-stone-400'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Pengaturan Animasi */}
      <div className="bg-white rounded-2xl p-3.5 border border-[#EFE8DE] shadow-xs space-y-2.5">
        <p className="text-xs font-bold text-stone-900">Animasi Gerak Karakter</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => ubah({ animasi: true })}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              setelan.animasi
                ? 'bg-[#1A1715] text-white border-[#1A1715] shadow-xs'
                : 'bg-[#FAF8F5] text-stone-600 border-[#EFE8DE] hover:bg-stone-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Bergerak (3D)</span>
            {setelan.animasi && <Check className="w-3.5 h-3.5 ml-auto" />}
          </button>
          <button
            type="button"
            onClick={() => ubah({ animasi: false })}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
              !setelan.animasi
                ? 'bg-[#1A1715] text-white border-[#1A1715] shadow-xs'
                : 'bg-[#FAF8F5] text-stone-600 border-[#EFE8DE] hover:bg-stone-100'
            }`}
          >
            <span>Diam (Hemat)</span>
            {!setelan.animasi && <Check className="w-3.5 h-3.5 ml-auto" />}
          </button>
        </div>
      </div>

      {/* 3. Aksi Cepat */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={kembalikanPosisi}
          className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#EFE8DE] hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
          <span>Kembalikan Posisi Nayra ke Pojok Layar</span>
        </button>

        <button
          type="button"
          onClick={sembunyikan}
          className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#EFE8DE] hover:bg-amber-50/50 text-[#D9480F] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Sembunyikan ke Tepi Layar (Tab)</span>
        </button>
      </div>
    </div>
  )
}
