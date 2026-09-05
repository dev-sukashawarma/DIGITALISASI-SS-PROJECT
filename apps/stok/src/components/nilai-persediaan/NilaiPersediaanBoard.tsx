'use client'

import React, { useState } from 'react'
import {
  Wallet,
  Warehouse,
  Store,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  HelpCircle,
} from 'lucide-react'
import {
  useNilaiPersediaan,
  type NilaiPersediaanOutlet,
  type NilaiPersediaanRow,
} from '@/hooks/useNilaiPersediaan'

const rupiah = (n: number) =>
  'Rp' + Math.round(n).toLocaleString('id-ID')

const rupiahRingkas = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return 'Rp' + (n / 1_000_000_000).toFixed(2) + ' M'
  if (abs >= 1_000_000) return 'Rp' + (n / 1_000_000).toFixed(1) + ' jt'
  return rupiah(n)
}

const angka = (n: number, desimal = 1) =>
  n.toLocaleString('id-ID', { maximumFractionDigits: desimal })

export function NilaiPersediaanBoard() {
  const { outlets, total, loading, error, refresh } = useNilaiPersediaan()
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setTerbuka((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const gudang = outlets.filter((o) => o.outlet_type === 'office')
  const cabang = outlets.filter((o) => o.outlet_type !== 'office')
  const jumlah = (list: NilaiPersediaanOutlet[]) =>
    list.reduce((s, o) => s + o.nilai_pasti + o.nilai_belum_pasti, 0)

  if (loading) {
    return (
      <div className="rounded-xl border border-[#d9c2b2]/50 bg-white p-8 text-center text-[#8b6f5c]">
        Menghitung nilai persediaan…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p className="font-semibold">Gagal memuat nilai persediaan</p>
        <p className="mt-1 text-sm">{String((error as Error).message ?? error)}</p>
      </div>
    )
  }

  if (outlets.length === 0) {
    return (
      <div className="rounded-xl border border-[#d9c2b2]/50 bg-[#faf2e9] p-6">
        <p className="font-semibold text-[#701604]">Tidak ada data nilai persediaan</p>
        <p className="mt-2 text-sm text-[#8b6f5c]">
          Halaman ini menampilkan harga beli, jadi hanya bisa dibuka oleh role yang
          berhak melihatnya — admin, owner, kitchen, purchasing, dan admin&nbsp;finance.
          Kalau Anda salah satu di antaranya dan tetap kosong, kemungkinan stok
          memang nol atau harga bahan belum diisi.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#701604]">Nilai Persediaan</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#8b6f5c]">
            Uang yang sedang berbentuk barang — bahan baku yang sudah dibayar tapi
            belum terjual, di gudang maupun di outlet.
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-[#d9c2b2] bg-white px-3 py-2 text-sm text-[#701604] hover:bg-[#faf2e9]"
        >
          <RefreshCw className="h-4 w-4" />
          Muat ulang
        </button>
      </div>

      {/* Kartu ringkasan.
          Nilai pasti dan belum-pasti sengaja TIDAK digabung jadi satu angka
          besar: bagian belum-pasti saat ini bisa melebihi yang pasti, jadi
          menjumlahkannya akan menyiratkan kepastian yang tidak ada. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kartu
          icon={Wallet}
          label="Nilai Pasti"
          nilai={rupiahRingkas(total.nilai_pasti)}
          desc="Angka ini bisa dipegang"
          aksen="text-[#701604]"
          latar="bg-[#faf2e9]"
        />
        <Kartu
          icon={AlertTriangle}
          label="Belum Pasti"
          nilai={total.jml_belum_pasti === 0 ? '—' : rupiahRingkas(total.nilai_belum_pasti)}
          desc={
            total.jml_belum_pasti === 0
              ? 'Semua satuan sudah pasti'
              : `${total.jml_belum_pasti} baris · antara ${rupiahRingkas(total.batas_bawah)} – ${rupiahRingkas(total.batas_atas)}`
          }
          aksen={total.jml_belum_pasti === 0 ? 'text-emerald-700' : 'text-amber-700'}
          latar={total.jml_belum_pasti === 0 ? 'bg-emerald-50/80' : 'bg-amber-50/80'}
        />
        <Kartu
          icon={Warehouse}
          label="Gudang Pusat"
          nilai={rupiahRingkas(jumlah(gudang))}
          desc={`${gudang.length} lokasi · pasti + tafsir terbaik`}
          aksen="text-emerald-700"
          latar="bg-emerald-50/80"
        />
        <Kartu
          icon={Store}
          label="Outlet"
          nilai={rupiahRingkas(jumlah(cabang))}
          desc={`${cabang.length} outlet · pasti + tafsir terbaik`}
          aksen="text-sky-700"
          latar="bg-sky-50/80"
        />
      </div>

      {/* Master data belum lengkap — muncul hanya kalau ada */}
      {total.jml_data_kurang > 0 && (
        <div className="rounded-xl border border-[#d9c2b2]/60 bg-white p-4">
          <div className="flex gap-3">
            <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#8b6f5c]" />
            <div className="space-y-1 text-sm text-[#5a4638]">
              <p className="font-semibold text-[#701604]">
                {total.jml_data_kurang} baris belum bisa dinilai
              </p>
              <p>
                Harga beli atau isi kemasannya belum diisi di master bahan baku,
                jadi nilainya tercatat nol — <strong>bukan</strong> berarti stoknya
                tak bernilai. Lengkapi di Master Harga Bahan Baku, lalu angkanya
                muncul sendiri di sini.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Penjelasan ketidakpastian — hanya muncul kalau memang ada */}
      {total.jml_belum_pasti > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="space-y-2 text-sm text-amber-900">
              <p className="font-semibold">
                {total.jml_belum_pasti} baris satuannya belum dipastikan
              </p>
              <p>
                Sistem sedang di tengah penyeragaman satuan. Untuk baris yang belum
                pernah di-opname, isinya bisa satuan besar (Kg/Roll/Dus) atau satuan
                kecil (gram/cm/lembar) — dan bedanya bisa ribuan kali. Baris seperti
                itu ditandai di tabel bawah, dan totalnya disajikan sebagai rentang{' '}
                <strong>{rupiahRingkas(total.batas_bawah)}</strong> –{' '}
                <strong>{rupiahRingkas(total.batas_atas)}</strong>.
              </p>
              <p>
                Ketidakpastian ini <strong>hilang sendiri</strong> begitu outlet
                melakukan opname pada bahan tersebut. Tidak perlu diperbaiki manual.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabel per outlet */}
      <div className="overflow-hidden rounded-xl border border-[#d9c2b2]/50 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#faf2e9] text-xs uppercase tracking-wide text-[#8b6f5c]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Lokasi</th>
              <th className="px-4 py-3 text-right font-semibold">Bahan</th>
              <th className="px-4 py-3 text-right font-semibold">Nilai</th>
              <th className="px-4 py-3 text-right font-semibold">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => {
              const buka = terbuka.has(o.outlet_id)
              return (
                <React.Fragment key={o.outlet_id}>
                  <tr
                    onClick={() => toggle(o.outlet_id)}
                    className="cursor-pointer border-t border-[#d9c2b2]/30 hover:bg-[#faf2e9]/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {buka ? (
                          <ChevronDown className="h-4 w-4 text-[#8b6f5c]" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-[#8b6f5c]" />
                        )}
                        <span className="font-medium text-[#701604]">{o.outlet}</span>
                        {o.outlet_type === 'office' && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            GUDANG
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[#8b6f5c]">{o.jml_bahan}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#701604]">
                      {rupiah(o.nilai_pasti + o.nilai_belum_pasti)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {o.jml_belum_pasti > 0 && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            {o.jml_belum_pasti} belum pasti
                          </span>
                        )}
                        {o.jml_data_kurang > 0 && (
                          <span className="rounded-full bg-[#faf2e9] px-2 py-0.5 text-xs font-semibold text-[#8b6f5c]">
                            {o.jml_data_kurang} tanpa harga
                          </span>
                        )}
                        {o.jml_belum_pasti === 0 && o.jml_data_kurang === 0 && (
                          <span className="text-[#c4ab97]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {buka &&
                    o.items.map((it) => (
                      <BarisBahan key={it.bahan_baku_id} item={it} />
                    ))}
                </React.Fragment>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-[#d9c2b2] bg-[#faf2e9]">
            <tr>
              <td className="px-4 py-3 font-bold text-[#701604]">TOTAL PASTI</td>
              <td />
              <td className="px-4 py-3 text-right font-bold text-[#701604]">
                {rupiah(total.nilai_pasti)}
              </td>
              <td className="px-4 py-3 text-right text-xs text-[#8b6f5c]">
                {total.jml_belum_pasti === 0 && total.jml_data_kurang === 0
                  ? 'seluruh baris pasti'
                  : ''}
              </td>
            </tr>
            {total.jml_belum_pasti > 0 && (
              <tr className="border-t border-[#d9c2b2]/40">
                <td className="px-4 py-3 text-sm text-amber-800">
                  + belum pasti ({total.jml_belum_pasti} baris)
                </td>
                <td />
                <td className="px-4 py-3 text-right text-sm font-semibold text-amber-800">
                  {rupiah(total.nilai_belum_pasti)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-amber-700">
                  antara {rupiahRingkas(total.batas_bawah)} – {rupiahRingkas(total.batas_atas)}
                </td>
              </tr>
            )}
            {total.jml_data_kurang > 0 && (
              <tr className="border-t border-[#d9c2b2]/40">
                <td className="px-4 py-3 text-sm text-[#8b6f5c]">
                  + belum bisa dinilai ({total.jml_data_kurang} baris)
                </td>
                <td />
                <td className="px-4 py-3 text-right text-sm text-[#c4ab97]">—</td>
                <td className="px-4 py-3 text-right text-xs text-[#8b6f5c]">
                  harga / isi kemasan belum diisi
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function Kartu({
  icon: Icon,
  label,
  nilai,
  desc,
  aksen,
  latar,
}: {
  icon: React.ElementType
  label: string
  nilai: string
  desc: string
  aksen: string
  latar: string
}) {
  return (
    <div className={`rounded-xl border border-[#d9c2b2]/50 ${latar} p-4`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${aksen}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-[#8b6f5c]">
          {label}
        </span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${aksen}`}>{nilai}</p>
      <p className="mt-1 text-xs text-[#8b6f5c]">{desc}</p>
    </div>
  )
}

function BarisBahan({ item }: { item: NilaiPersediaanRow }) {
  const pasti = item.status === 'pasti'
  const dataKurang = item.status === 'data_belum_lengkap'

  return (
    <tr className="border-t border-[#d9c2b2]/20 bg-[#fffdfa]">
      <td className="px-4 py-2 pl-10">
        <span className="text-[#5a4638]">{item.bahan}</span>
        {item.status === 'skala_belum_pasti' && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            satuan belum pasti
          </span>
        )}
        {dataKurang && (
          <span className="ml-2 rounded bg-[#faf2e9] px-1.5 py-0.5 text-[10px] font-semibold text-[#8b6f5c]">
            {item.harga_beli == null ? 'harga belum diisi' : 'isi kemasan belum diisi'}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-right text-xs text-[#8b6f5c]">
        {pasti
          ? `${angka(item.jumlah_satuan_besar)} ${item.satuan ?? ''}`
          : `${angka(item.saldo)} (satuan belum pasti)`}
      </td>
      <td className="px-4 py-2 text-right text-[#5a4638]">
        {dataKurang ? <span className="text-[#c4ab97]">belum bisa dinilai</span> : rupiah(item.nilai)}
      </td>
      <td className="px-4 py-2 text-right text-xs text-[#8b6f5c]">
        {item.status === 'skala_belum_pasti'
          ? `${rupiahRingkas(item.nilai_min)} – ${rupiahRingkas(item.nilai_max)}`
          : ''}
      </td>
    </tr>
  )
}
