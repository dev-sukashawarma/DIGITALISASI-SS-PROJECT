'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { tertahan, urutkanPesanan, type PesananApp } from '@/lib/appRetail/pesananTertahan'
import { tandaiRefundSelesai } from '../pengamanActions'

type Outlet = { id: string; name: string; phone?: string | null }
type RefundPerlu = { id: string; order_id: string; outlet_id: string; customer_id: string; nominal: number; dibuat_pada: string }
type RefundSudah = { id: string; order_id: string; outlet_id: string; nominal: number; catatan: string | null; diproses_pada: string | null }
type Pelanggan = { id: string; name: string | null; phone: string | null }

const rp = (n: number) => `Rp ${Number(n).toLocaleString('id-ID')}`
const jamWib = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })

/** Normalisasi nomor telepon ke digit murni berawalan 62 (untuk link wa.me).
 *  Menerima '08...', '+62...', atau '62...'. */
function nomorWa(phone: string): string {
  const digit = phone.replace(/[^0-9]/g, '')
  return digit.startsWith('0') ? `62${digit.slice(1)}` : digit
}

export default function PesananAppView(props: {
  pesanan: PesananApp[]; outlets: Outlet[]; refundPerlu: RefundPerlu[]; refundSudah: RefundSudah[]
  pelanggan: Pelanggan[]; menitTertahan: number; galat: string[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'hari' | 'perlu' | 'sudah'>(props.refundPerlu.length > 0 ? 'perlu' : 'hari')
  const [sekarang, setSekarang] = useState(() => new Date())
  const [catatan, setCatatan] = useState<Record<string, string>>({})
  const [galat, setGalat] = useState('')
  const [bekerja, mulai] = useTransition()

  // Segarkan tiap 60 dtk: status "tertahan" bergantung waktu, dan pesanan baru masuk.
  useEffect(() => {
    const t = setInterval(() => { setSekarang(new Date()); router.refresh() }, 60_000)
    return () => clearInterval(t)
  }, [router])

  const namaOutlet = (id: string) => props.outlets.find((o) => o.id === id)?.name ?? '—'
  const urut = urutkanPesanan(props.pesanan, sekarang, props.menitTertahan)
  const jumlahTertahan = urut.filter((p) => tertahan(p, sekarang, props.menitTertahan)).length

  function selesai(id: string) {
    setGalat('')
    mulai(async () => {
      try { await tandaiRefundSelesai(id, catatan[id] ?? '') }
      catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan') }
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pesanan Aplikasi</h1>
        <p className="text-sm text-slate-500">Merah = sudah dibayar tapi belum ditekan &quot;Mulai Masak&quot; lebih dari {props.menitTertahan} menit. Telepon outlet.</p>
      </div>
      {[...props.galat, galat].filter(Boolean).map((g) => <p key={g} className="text-sm text-red-600">{g}</p>)}
      <div className="flex gap-2">
        {([['hari', `Hari ini${jumlahTertahan ? ` · ${jumlahTertahan} tertahan` : ''}`], ['perlu', `Perlu dikembalikan (${props.refundPerlu.length})`], ['sudah', 'Selesai dikembalikan']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`text-sm font-bold px-3 py-1.5 rounded-full cursor-pointer ${tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>
        ))}
      </div>

      {tab === 'hari' && (
        <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
          <thead><tr className="bg-slate-50 text-left text-slate-500">
            <th className="p-3">Jam</th><th className="p-3">No.</th><th className="p-3">Outlet</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th>
          </tr></thead>
          <tbody>
            {urut.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Belum ada pesanan aplikasi hari ini.</td></tr>}
            {urut.map((p) => {
              const merah = tertahan(p, sekarang, props.menitTertahan)
              const outlet = props.outlets.find((o) => o.id === p.outlet_id)
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${merah ? 'bg-red-50' : ''}`}>
                  <td className="p-3">{jamWib(p.created_at)}</td>
                  <td className="p-3">#{p.order_number ?? '—'}</td>
                  <td className="p-3">{namaOutlet(p.outlet_id)}{merah && outlet?.phone && <a className="block text-[11px] text-red-700 font-bold" href={`tel:${outlet.phone}`}>Telepon {outlet.phone}</a>}</td>
                  <td className={`p-3 font-bold ${merah ? 'text-red-700' : 'text-slate-600'}`}>{merah ? 'TERTAHAN' : p.status}</td>
                  <td className="p-3 text-right">{rp(p.total_amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {tab === 'perlu' && (
        <div className="space-y-2">
          {props.refundPerlu.length === 0 && <p className="text-sm text-slate-400">Tidak ada dana yang perlu dikembalikan.</p>}
          {props.refundPerlu.map((r) => {
            const pl = props.pelanggan.find((x) => x.id === r.customer_id)
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between"><p className="font-bold">{rp(r.nominal)} · {namaOutlet(r.outlet_id)}</p><p className="text-xs text-slate-400">dibatalkan {new Date(r.dibuat_pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p></div>
                <p className="text-sm">{pl?.name ?? 'Pelanggan'} {pl?.phone && <a className="text-emerald-700 font-bold" href={`https://wa.me/${nomorWa(pl.phone)}`} target="_blank" rel="noreferrer">WhatsApp {pl.phone}</a>}</p>
                <div className="flex gap-2">
                  <input value={catatan[r.id] ?? ''} onChange={(e) => setCatatan({ ...catatan, [r.id]: e.target.value })}
                    placeholder="Catatan / no. referensi transfer (wajib)" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  <button type="button" disabled={bekerja || !(catatan[r.id] ?? '').trim()} onClick={() => selesai(r.id)}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">Sudah dikembalikan</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'sudah' && (
        <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
          <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="p-3">Diproses</th><th className="p-3">Outlet</th><th className="p-3 text-right">Nominal</th><th className="p-3">Catatan</th></tr></thead>
          <tbody>{props.refundSudah.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="p-3">{r.diproses_pada ? new Date(r.diproses_pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}</td>
              <td className="p-3">{namaOutlet(r.outlet_id)}</td><td className="p-3 text-right">{rp(r.nominal)}</td><td className="p-3">{r.catatan}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
