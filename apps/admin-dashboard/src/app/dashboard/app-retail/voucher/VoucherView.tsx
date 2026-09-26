'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import PanelEditVoucher from './PanelEditVoucher'
import { ubahAktifVoucher, hapusVoucher } from '../voucherActions'
import { kalimatSyarat, statusVoucher, rp, LABEL_JENIS, LABEL_STATUS, type Voucher } from '@/lib/appRetail/voucher'

type Opsi = { id: string; name: string }
type Ringkas = { voucher_id: string; terpakai: number; total_potongan: number | string }

const WARNA_STATUS: Record<string, string> = {
  aktif: 'bg-emerald-50 text-emerald-700',
  terjadwal: 'bg-sky-50 text-sky-700',
  berakhir: 'bg-slate-100 text-slate-500',
  nonaktif: 'bg-slate-100 text-slate-500',
  kuota_habis: 'bg-amber-50 text-amber-700',
}

export default function VoucherView(props: {
  vouchers: Record<string, unknown>[]
  ringkasan: Ringkas[]
  menu: Opsi[]
  kategori: Opsi[]
  outlet: Opsi[]
  galat: string[]
}) {
  const [edit, setEdit] = useState<Voucher | 'baru' | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [sibuk, mulai] = useTransition()
  const namaMenu = Object.fromEntries(props.menu.map((m) => [m.id, m.name]))
  const peta = new Map(props.ringkasan.map((r) => [r.voucher_id, r]))
  const vouchers = props.vouchers as unknown as Voucher[]
  const sekarang = new Date()

  const jalankan = (f: () => Promise<void>) =>
    mulai(async () => {
      setPesan(null)
      try {
        await f()
      } catch (e) {
        setPesan(e instanceof Error ? e.message : String(e))
      }
    })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Voucher Aplikasi</h1>
          <p className="text-sm text-slate-500">
            Voucher untuk pelanggan aplikasi. Potongan masuk baris &quot;Potongan&quot; outlet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEdit('baru')}
          className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-amber-100 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Voucher baru
        </button>
      </div>

      {[...props.galat, ...(pesan ? [pesan] : [])].map((g) => (
        <div key={g} className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{g}</span>
        </div>
      ))}

      {vouchers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-8 text-center text-sm text-slate-400">
          Belum ada voucher.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-3 font-semibold">Voucher</th>
                <th className="p-3 font-semibold">Jenis</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Terpakai</th>
                <th className="p-3 font-semibold">Total potongan</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => {
                const r = peta.get(v.id)
                const terpakai = r?.terpakai ?? 0
                const status = statusVoucher(v, terpakai, sekarang)
                return (
                  <tr key={v.id} className="border-t border-slate-100 align-top">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{v.nama}</div>
                      <div className="text-xs text-slate-500">
                        {v.kode ? `Kode ${v.kode}` : 'Publik'} · {kalimatSyarat(v, namaMenu)}
                      </div>
                    </td>
                    <td className="p-3 text-slate-700">{LABEL_JENIS[v.jenis]}</td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${WARNA_STATUS[status] ?? ''}`}>
                        {LABEL_STATUS[status]}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700">
                      {terpakai}
                      {v.kuota_total != null ? ` / ${v.kuota_total}` : ''}
                    </td>
                    <td className="p-3 text-slate-700">{rp(Number(r?.total_potongan ?? 0))}</td>
                    <td className="space-x-2 whitespace-nowrap p-3 text-right">
                      <button
                        type="button"
                        className="text-amber-700 underline cursor-pointer"
                        onClick={() => setEdit(v)}
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        disabled={sibuk}
                        className="underline cursor-pointer disabled:opacity-60"
                        onClick={() => jalankan(() => ubahAktifVoucher(v.id, !v.is_active))}
                      >
                        {v.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      {terpakai === 0 && (
                        <button
                          type="button"
                          disabled={sibuk}
                          className="text-red-600 underline cursor-pointer disabled:opacity-60"
                          onClick={() => {
                            if (window.confirm(`Hapus voucher "${v.nama}"?`)) jalankan(() => hapusVoucher(v.id))
                          }}
                        >
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <PanelEditVoucher
          awal={edit === 'baru' ? null : edit}
          menu={props.menu}
          kategori={props.kategori}
          outlet={props.outlet}
          onTutup={() => setEdit(null)}
        />
      )}
    </div>
  )
}
