'use client'

import { useState, useTransition } from 'react'
import { buatKunciHermes, cabutKunciHermes, ubahIpKunciHermes } from './actions'

const DOMAIN = ['penjualan', 'gudang', 'absensi', 'finance', 'hr_rinci'] as const
const LABEL_DOMAIN: Record<string, string> = { hr_rinci: 'HR rinci (gaji & kasbon per orang)' }

type Kunci = { id: string; nama: string; prefix: string; scope: string[]; ip_diizinkan: string[]; aktif: boolean; dibuat_at: string; dicabut_at: string | null; terakhir_dipakai_at: string | null }
type Log = { id: number; prefix: string | null; alat: string | null; status: string; alasan: string | null; ip: string | null; durasi_ms: number | null; at: string }

const waktu = (s: string | null) => (s ? new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—')
const pecahIp = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)

export default function KunciHermesPanel({ kunci, log }: { kunci: Kunci[]; log: Log[] }) {
  const [nama, setNama] = useState('')
  const [scope, setScope] = useState<string[]>(['penjualan'])
  const [ip, setIp] = useState('')
  const [kunciBaru, setKunciBaru] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [sibuk, mulai] = useTransition()

  const buat = () =>
    mulai(async () => {
      setPesan(null)
      const r = await buatKunciHermes({ nama, scope, ip: pecahIp(ip) })
      if (r.ok) { setKunciBaru(r.kunci); setNama(''); setIp('') } else setPesan(r.pesan)
    })

  const cabut = (k: Kunci) =>
    mulai(async () => {
      if (!confirm(`Cabut kunci "${k.nama}"? Bot yang memakainya langsung berhenti.`)) return
      const r = await cabutKunciHermes(k.id)
      if (!r.ok) setPesan(r.pesan ?? 'Gagal mencabut')
    })

  const ubahIp = (k: Kunci) =>
    mulai(async () => {
      const isian = prompt('IP diizinkan (pisahkan dengan koma). Kosong = tolak semua.', k.ip_diizinkan.join(', '))
      if (isian === null) return
      const r = await ubahIpKunciHermes(k.id, pecahIp(isian))
      if (!r.ok) setPesan(r.pesan ?? 'Gagal mengubah IP')
    })

  return (
    <div className="space-y-6">
      {kunciBaru && (
        <div className="rounded border border-amber-400 bg-amber-50 p-4">
          <p className="font-semibold">Salin kunci ini sekarang — tidak akan ditampilkan lagi.</p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-sm">{kunciBaru}</code>
          <div className="mt-2 flex gap-2">
            <button className="rounded bg-gray-900 px-3 py-1 text-sm text-white" onClick={() => navigator.clipboard.writeText(kunciBaru)}>Salin</button>
            <button className="rounded border px-3 py-1 text-sm" onClick={() => setKunciBaru(null)}>Sudah disalin</button>
          </div>
        </div>
      )}
      {pesan && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{pesan}</p>}

      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">Buat kunci</h2>
        <input className="w-full rounded border px-3 py-2" placeholder="Nama, mis. Bot CEO" value={nama} onChange={(e) => setNama(e.target.value)} />
        <div className="flex flex-wrap gap-3 text-sm">
          {DOMAIN.map((d) => (
            <label key={d} className="flex items-center gap-1">
              <input type="checkbox" checked={scope.includes(d)} onChange={(e) => setScope((s) => (e.target.checked ? [...s, d] : s.filter((x) => x !== d)))} />
              {LABEL_DOMAIN[d] ?? d}
            </label>
          ))}
        </div>
        <input className="w-full rounded border px-3 py-2" placeholder="IP diizinkan, pisahkan koma (boleh kosong dulu)" value={ip} onChange={(e) => setIp(e.target.value)} />
        <p className="text-xs text-gray-500">IP kosong = semua panggilan ditolak. Lihat kolom IP pada log "ditolak" untuk tahu IP VPS yang sebenarnya.</p>
        <button disabled={sibuk} onClick={buat} className="rounded bg-orange-500 px-4 py-2 text-white disabled:opacity-50">Buat kunci</button>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-semibold">Daftar kunci</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Nama</th><th>Prefix</th><th>Domain</th><th>IP</th><th>Terakhir dipakai</th><th>Status</th><th /></tr></thead>
            <tbody>
              {kunci.map((k) => (
                <tr key={k.id} className="border-t align-top">
                  <td className="py-2">{k.nama}</td>
                  <td><code>{k.prefix}</code></td>
                  <td>{k.scope.join(', ')}</td>
                  <td>{k.ip_diizinkan.length ? k.ip_diizinkan.join(', ') : <span className="text-red-600">(kosong)</span>}</td>
                  <td>{waktu(k.terakhir_dipakai_at)}</td>
                  <td>{k.aktif ? 'aktif' : `dicabut ${waktu(k.dicabut_at)}`}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    {k.aktif && (
                      <>
                        <button disabled={sibuk} className="text-blue-600" onClick={() => ubahIp(k)}>IP</button>
                        <button disabled={sibuk} className="text-red-600" onClick={() => cabut(k)}>Cabut</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {kunci.length === 0 && <tr><td colSpan={7} className="py-3 text-gray-500">Belum ada kunci.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-semibold">50 panggilan terakhir</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Waktu</th><th>Prefix</th><th>Alat</th><th>Status</th><th>IP</th><th>Alasan</th><th>ms</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-1">{waktu(l.at)}</td>
                  <td><code>{l.prefix ?? '—'}</code></td>
                  <td>{l.alat ?? '—'}</td>
                  <td className={l.status === 'ok' ? 'text-green-700' : 'text-red-700'}>{l.status}</td>
                  <td>{l.ip ?? '—'}</td>
                  <td className="max-w-xs truncate" title={l.alasan ?? ''}>{l.alasan ?? ''}</td>
                  <td>{l.durasi_ms ?? '—'}</td>
                </tr>
              ))}
              {log.length === 0 && <tr><td colSpan={7} className="py-3 text-gray-500">Belum ada panggilan.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
