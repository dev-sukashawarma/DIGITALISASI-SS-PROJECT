'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { AlertTriangle, ImageOff, Plus, Trash2 } from 'lucide-react'
import { toggleBannerAktif, hapusBanner } from '../actions'
import type { InputBanner, SlotBanner, AksiBanner } from '@/lib/appRetail/bannerForm'
import PanelEditBanner from './PanelEditBanner'

export type BannerRow = {
  id: string
  slot: SlotBanner
  urutan: number
  badge: string | null
  judul: string
  subjudul: string | null
  teks_tombol: string | null
  gambar_url: string | null
  aksi: AksiBanner
  target_menu_item_id: string | null
  aktif: boolean
}

const LABEL_AKSI: Record<AksiBanner, string> = {
  tidak_ada: 'Tanpa aksi',
  menu: 'Buka menu',
  menu_item: 'Buka menu tertentu',
}

function barisKeInput(row: BannerRow): InputBanner {
  return {
    slot: row.slot,
    urutan: row.urutan,
    badge: row.badge ?? '',
    judul: row.judul,
    subjudul: row.subjudul ?? '',
    teksTombol: row.teks_tombol ?? '',
    gambarUrl: row.gambar_url ?? '',
    aksi: row.aksi,
    targetMenuItemId: row.target_menu_item_id,
  }
}

function bannerBaru(slot: SlotBanner, urutan: number): InputBanner {
  return {
    slot,
    urutan,
    badge: '',
    judul: '',
    subjudul: '',
    teksTombol: '',
    gambarUrl: '',
    aksi: 'tidak_ada',
    targetMenuItemId: null,
  }
}

function Bagian({
  judul,
  banners,
  onTambah,
  onEdit,
  onToggle,
  onHapus,
  sedangProses,
}: {
  judul: string
  banners: BannerRow[]
  onTambah: () => void
  onEdit: (b: BannerRow) => void
  onToggle: (b: BannerRow) => void
  onHapus: (b: BannerRow) => void
  sedangProses: string | null
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">{judul}</h2>
        <button
          type="button"
          onClick={onTambah}
          className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-amber-100"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah banner
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {banners.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Belum ada banner di bagian ini.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {banners.map((b) => (
              <li key={b.id} className="flex items-center gap-3 p-3">
                {b.gambar_url ? (
                  <Image
                    src={b.gambar_url}
                    alt=""
                    width={64}
                    height={40}
                    className="w-16 h-10 rounded-lg object-cover shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-16 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                    <ImageOff className="w-4 h-4" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onEdit(b)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {b.judul}
                    {b.badge && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 align-middle">
                        {b.badge}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Urutan {b.urutan} · {LABEL_AKSI[b.aksi]}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onToggle(b)}
                  disabled={sedangProses === b.id}
                  className={`w-11 h-6 rounded-full relative shrink-0 disabled:opacity-60 cursor-pointer ${
                    b.aktif ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                  title={b.aktif ? 'Aktif — matikan' : 'Nonaktif — aktifkan'}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${b.aktif ? 'left-6' : 'left-1'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onHapus(b)}
                  disabled={sedangProses === b.id}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-60 cursor-pointer shrink-0"
                  title="Hapus banner"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function BannerView({
  banners,
  menuPilihan,
  galat,
  galatMenu,
}: {
  banners: BannerRow[]
  menuPilihan: { id: string; name: string }[]
  galat: string | null
  galatMenu: string | null
}) {
  const [panel, setPanel] = useState<{ id: string | null; awal: InputBanner } | null>(null)
  const [sedangProses, setSedangProses] = useState<string | null>(null)
  const [galatAksi, setGalatAksi] = useState<string | null>(null)

  const carousel = useMemo(() => banners.filter((b) => b.slot === 'carousel'), [banners])
  const popup = useMemo(() => banners.filter((b) => b.slot === 'popup'), [banners])

  async function toggle(b: BannerRow) {
    setGalatAksi(null)
    setSedangProses(b.id)
    try {
      await toggleBannerAktif(b.id, b.aktif)
    } catch (e) {
      setGalatAksi(e instanceof Error ? e.message : 'Gagal mengubah status banner.')
    } finally {
      setSedangProses(null)
    }
  }

  async function hapus(b: BannerRow) {
    if (!window.confirm(`Hapus banner "${b.judul}"?`)) return
    setGalatAksi(null)
    setSedangProses(b.id)
    try {
      await hapusBanner(b.id)
    } catch (e) {
      setGalatAksi(e instanceof Error ? e.message : 'Gagal menghapus banner.')
    } finally {
      setSedangProses(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Banner Aplikasi</h1>
        <p className="text-sm text-slate-500">
          Atur banner carousel di beranda dan popup yang muncul saat aplikasi dibuka.
        </p>
      </div>

      {galat && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{galat}</span>
        </div>
      )}

      {galatAksi && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{galatAksi}</span>
        </div>
      )}

      {/* Daftar kosong karena galat tidak boleh terlihat sama dengan "belum ada banner" —
          jadi seluruh daftar disembunyikan saat query gagal, bukan dirender kosong. */}
      {!galat && (
        <>
          <Bagian
            judul="Carousel Beranda"
            banners={carousel}
            onTambah={() => setPanel({ id: null, awal: bannerBaru('carousel', carousel.length) })}
            onEdit={(b) => setPanel({ id: b.id, awal: barisKeInput(b) })}
            onToggle={toggle}
            onHapus={hapus}
            sedangProses={sedangProses}
          />

          <Bagian
            judul="Popup Beranda"
            banners={popup}
            onTambah={() => setPanel({ id: null, awal: bannerBaru('popup', popup.length) })}
            onEdit={(b) => setPanel({ id: b.id, awal: barisKeInput(b) })}
            onToggle={toggle}
            onHapus={hapus}
            sedangProses={sedangProses}
          />

          <p className="text-xs text-slate-500">
            Kalau lebih dari satu popup aktif, yang tampil adalah urutan terkecil.
          </p>
        </>
      )}

      {panel && (
        <PanelEditBanner
          id={panel.id}
          awal={panel.awal}
          menuPilihan={menuPilihan}
          galatMenu={galatMenu}
          onSelesai={() => setPanel(null)}
        />
      )}
    </div>
  )
}
