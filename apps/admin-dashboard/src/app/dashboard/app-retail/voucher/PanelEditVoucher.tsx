'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { simpanVoucher } from '../voucherActions'
import { kalimatSyarat, periksaVoucher, LABEL_JENIS, type InputVoucher, type JenisVoucher, type Voucher } from '@/lib/appRetail/voucher'

type Opsi = { id: string; name: string }
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const KOSONG: InputVoucher = {
  nama: '', deskripsi: null, kode: null, jenis: 'persen', nilai: null, maks_potongan: null, menu_item_id: null,
  beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null, kuota_total: null,
  batas_per_pelanggan: null, min_belanja: null, khusus_pesanan_pertama: false, outlet_ids: null, hari: null,
  jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null, is_active: true,
}

/**
 * '' -> null; selain itu angka. Kolom angka kosong berarti "tanpa batas",
 * bukan 0. Buang selain digit/titik/koma dulu (biar "Rp10.000" / "10%" tetap
 * kebaca), titik dianggap pemisah ribuan (dibuang), koma dianggap desimal
 * (jadi titik). Kalau tetap tak bisa diangkakan, kembalikan NaN dengan
 * sengaja -- JANGAN 0 -- supaya `periksaVoucher` yang menolaknya, bukan
 * diam-diam tersimpan sebagai "tanpa batas".
 */
const angka = (s: string): number | null => {
  const t = s.trim()
  if (t === '') return null
  const bersih = t.replace(/[^\d.,]/g, '')
  if (bersih === '') return NaN
  const dinormalkan = bersih.replace(/\./g, '').replace(',', '.')
  const n = Number(dinormalkan)
  return Number.isFinite(n) ? n : NaN
}
/** <input type="datetime-local"> dibaca sebagai WIB. */
const dariLokalWib = (s: string): string | null => (s ? new Date(`${s}:00+07:00`).toISOString() : null)
const keLokalWib = (iso: string | null): string =>
  iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16) : ''

function toggleId(daftar: string[] | null, id: string): string[] | null {
  const s = new Set(daftar ?? [])
  if (s.has(id)) s.delete(id)
  else s.add(id)
  return s.size > 0 ? [...s] : null
}

function toggleHari(daftar: number[] | null, h: number): number[] | null {
  const s = new Set(daftar ?? [])
  if (s.has(h)) s.delete(h)
  else s.add(h)
  return s.size > 0 ? [...s].sort((a, b) => a - b) : null
}

/**
 * Kolom InputVoucher yang boleh diambil dari baris `Voucher` (hasil
 * select('*')) saat membuka form edit -- persis 23 kunci `KOSONG`, bukan
 * `{id, ...sisa}`. Tanpa whitelist ini, kolom lain yang mungkin ikut
 * terbawa di baris server (mis. created_at/created_by/updated_at) akan
 * dikirim balik ke `simpanVoucher` dan diteruskan mentah ke DB.
 */
const KOLOM_INPUT = Object.keys(KOSONG) as (keyof InputVoucher)[]

function ambilInput(v: Voucher): InputVoucher {
  return Object.fromEntries(KOLOM_INPUT.map((k) => [k, v[k]])) as unknown as InputVoucher
}

/** Field yang wajib direset saat jenis voucher berganti, agar nilai lama yang
 * tersembunyi (mis. maks_potongan bekas jenis persen) tidak diam-diam ikut
 * tersimpan dan memblokir/ menyesatkan validasi jenis baru. */
function resetUntukJenis(x: InputVoucher, jenisBaru: JenisVoucher): InputVoucher {
  return {
    ...x,
    jenis: jenisBaru,
    nilai: null,
    maks_potongan: null,
    menu_item_id: null,
    beli_qty: null,
    gratis_qty: null,
    harga_spesial: null,
    menu_ids: x.jenis === 'beli_x_gratis_y' && jenisBaru !== 'beli_x_gratis_y' ? null : x.menu_ids,
  }
}

export default function PanelEditVoucher(props: {
  awal: Voucher | null
  menu: Opsi[]
  kategori: Opsi[]
  outlet: Opsi[]
  onTutup: () => void
}) {
  const [f, setF] = useState<InputVoucher>(() => (props.awal ? ambilInput(props.awal) : KOSONG))
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, mulai] = useTransition()
  const ubah = <K extends keyof InputVoucher>(k: K, v: InputVoucher[K]) => setF((x) => ({ ...x, [k]: v }))
  const namaMenu = Object.fromEntries(props.menu.map((m) => [m.id, m.name]))
  const galatForm = periksaVoucher(f)
  const pratinjau = galatForm === null ? kalimatSyarat({ id: 'pratinjau', ...f }, namaMenu) : null

  const simpan = () =>
    mulai(async () => {
      setGalat(null)
      try {
        await simpanVoucher(f, props.awal?.id ?? null)
        props.onTutup()
      } catch (e) {
        setGalat(e instanceof Error ? e.message : String(e))
      }
    })

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
          <p className="font-bold text-slate-900">{props.awal ? 'Ubah voucher' : 'Voucher baru'}</p>
          <button type="button" onClick={props.onTutup} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* 1. Jenis & nilai */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Jenis &amp; nilai</h2>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Jenis voucher</label>
              <select
                value={f.jenis}
                onChange={(e) => setF((x) => resetUntukJenis(x, e.target.value as JenisVoucher))}
                className="input w-full text-sm py-2 border border-slate-200 rounded-xl bg-white"
              >
                {(Object.keys(LABEL_JENIS) as JenisVoucher[]).map((j) => (
                  <option key={j} value={j}>{LABEL_JENIS[j]}</option>
                ))}
              </select>
            </div>

            {f.jenis === 'persen' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Persen (%)</label>
                  <input
                    inputMode="numeric"
                    value={f.nilai ?? ''}
                    onChange={(e) => ubah('nilai', angka(e.target.value))}
                    placeholder="Contoh: 10"
                    className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Maks potongan (Rp)</label>
                  <input
                    inputMode="numeric"
                    value={f.maks_potongan ?? ''}
                    onChange={(e) => ubah('maks_potongan', angka(e.target.value))}
                    placeholder="Kosong = tanpa batas"
                    className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            )}

            {f.jenis === 'nominal' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Potongan (Rp)</label>
                <input
                  inputMode="numeric"
                  value={f.nilai ?? ''}
                  onChange={(e) => ubah('nilai', angka(e.target.value))}
                  placeholder="Contoh: 5000"
                  className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                />
              </div>
            )}

            {f.jenis === 'gratis_item' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Menu gratis</label>
                  <select
                    value={f.menu_item_id ?? ''}
                    onChange={(e) => ubah('menu_item_id', e.target.value || null)}
                    className="input w-full text-sm py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">Pilih menu…</option>
                    {props.menu.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Jumlah gratis</label>
                  <input
                    inputMode="numeric"
                    value={f.gratis_qty ?? ''}
                    onChange={(e) => ubah('gratis_qty', angka(e.target.value))}
                    placeholder="1"
                    className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            )}

            {f.jenis === 'beli_x_gratis_y' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Menu yang harus dibeli</label>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                    {props.menu.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={(f.menu_ids ?? []).includes(m.id)}
                          onChange={() => ubah('menu_ids', toggleId(f.menu_ids, m.id))}
                        />
                        {m.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Jumlah beli</label>
                    <input
                      inputMode="numeric"
                      value={f.beli_qty ?? ''}
                      onChange={(e) => ubah('beli_qty', angka(e.target.value))}
                      placeholder="Contoh: 2"
                      className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Jumlah gratis</label>
                    <input
                      inputMode="numeric"
                      value={f.gratis_qty ?? ''}
                      onChange={(e) => ubah('gratis_qty', angka(e.target.value))}
                      placeholder="Contoh: 1"
                      className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Menu gratis</label>
                  <select
                    value={f.menu_item_id ?? ''}
                    onChange={(e) => ubah('menu_item_id', e.target.value || null)}
                    className="input w-full text-sm py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">Kosong — menu yang dibeli termurah</option>
                    {props.menu.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {f.jenis === 'harga_spesial' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Menu</label>
                  <select
                    value={f.menu_item_id ?? ''}
                    onChange={(e) => ubah('menu_item_id', e.target.value || null)}
                    className="input w-full text-sm py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">Pilih menu…</option>
                    {props.menu.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Harga spesial (Rp)</label>
                  <input
                    inputMode="numeric"
                    value={f.harga_spesial ?? ''}
                    onChange={(e) => ubah('harga_spesial', angka(e.target.value))}
                    placeholder="Contoh: 15000"
                    className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Umum */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Umum</h2>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Nama voucher</label>
              <input
                value={f.nama}
                onChange={(e) => ubah('nama', e.target.value)}
                placeholder="Contoh: Diskon Hari Kemerdekaan"
                className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Deskripsi</label>
              <input
                value={f.deskripsi ?? ''}
                onChange={(e) => ubah('deskripsi', e.target.value || null)}
                placeholder="Kalimat singkat untuk pelanggan"
                className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Kode voucher</label>
              <input
                value={f.kode ?? ''}
                onChange={(e) => ubah('kode', e.target.value.toUpperCase().replace(/\s/g, '') || null)}
                placeholder="Contoh: SUKA17"
                className="input w-full text-sm py-2 border border-slate-200 rounded-xl uppercase"
              />
              <p className="text-xs text-slate-500">Kosongkan untuk voucher publik yang tampil di aplikasi.</p>
            </div>
          </div>

          {/* 3. Syarat */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Syarat (opsional)</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Mulai</label>
                <input
                  type="datetime-local"
                  value={keLokalWib(f.mulai)}
                  onChange={(e) => ubah('mulai', dariLokalWib(e.target.value))}
                  className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Selesai</label>
                <input
                  type="datetime-local"
                  value={keLokalWib(f.selesai)}
                  onChange={(e) => ubah('selesai', dariLokalWib(e.target.value))}
                  className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Kuota total</label>
                <input
                  inputMode="numeric"
                  value={f.kuota_total ?? ''}
                  onChange={(e) => ubah('kuota_total', angka(e.target.value))}
                  placeholder="Kosong = tanpa batas"
                  className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Batas per pelanggan</label>
                <input
                  inputMode="numeric"
                  value={f.batas_per_pelanggan ?? ''}
                  onChange={(e) => ubah('batas_per_pelanggan', angka(e.target.value))}
                  placeholder="Kosong = tanpa batas"
                  className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Minimal belanja (Rp)</label>
              <input
                inputMode="numeric"
                value={f.min_belanja ?? ''}
                onChange={(e) => ubah('min_belanja', angka(e.target.value))}
                placeholder="Kosong = tanpa batas"
                className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={f.khusus_pesanan_pertama}
                onChange={(e) => ubah('khusus_pesanan_pertama', e.target.checked)}
              />
              Khusus pesanan pertama pelanggan
            </label>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Outlet (kosong = semua outlet)</label>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                {props.outlet.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={(f.outlet_ids ?? []).includes(o.id)}
                      onChange={() => ubah('outlet_ids', toggleId(f.outlet_ids, o.id))}
                    />
                    {o.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Hari berlaku (kosong = semua hari)</label>
              <div className="flex flex-wrap gap-2">
                {HARI.map((nama, idx) => {
                  const h = idx + 1
                  const aktif = (f.hari ?? []).includes(h)
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => ubah('hari', toggleHari(f.hari, h))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                        aktif ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {nama}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Jam mulai</label>
                <input
                  type="time"
                  value={f.jam_mulai ?? ''}
                  onChange={(e) => ubah('jam_mulai', e.target.value || null)}
                  className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Jam selesai</label>
                <input
                  type="time"
                  value={f.jam_selesai ?? ''}
                  onChange={(e) => ubah('jam_selesai', e.target.value || null)}
                  className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {f.jenis !== 'beli_x_gratis_y' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Berlaku hanya untuk menu tertentu</label>
                <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                  {props.menu.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={(f.menu_ids ?? []).includes(m.id)}
                        onChange={() => ubah('menu_ids', toggleId(f.menu_ids, m.id))}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Berlaku hanya untuk kategori tertentu</label>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                {props.kategori.map((k) => (
                  <label key={k.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={(f.kategori_ids ?? []).includes(k.id)}
                      onChange={() => ubah('kategori_ids', toggleId(f.kategori_ids, k.id))}
                    />
                    {k.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Pratinjau */}
          <div className={`rounded-xl border p-3 text-sm ${pratinjau ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {pratinjau ?? galatForm}
          </div>

          {galat && <p className="text-sm text-red-600">{galat}</p>}
        </div>

        {/* 5. Aksi */}
        <div className="p-4 border-t border-slate-200 sticky bottom-0 bg-white flex gap-2">
          <button type="button" onClick={props.onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={sibuk || galatForm !== null}
            className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm disabled:opacity-60 cursor-pointer"
          >
            {sibuk ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
