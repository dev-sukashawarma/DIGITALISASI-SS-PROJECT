'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@suka/design-system'
import { FileSpreadsheet, FileText, Wallet, ArrowDownLeft, ArrowUpRight, Landmark } from 'lucide-react'
import { useCashOverview } from '@/hooks/useCashData'
import { useMutasiRekening } from '@/hooks/useMutasiRekening'
import { rupiah, tanggalWaktu } from '@/lib/format'
import { StatCard, SectionCard } from '@/components/ui'
import { GRUP_LABEL } from '@/lib/kas/grupKas'
import { eksporMutasiExcel, eksporMutasiPdf } from '@/lib/kas/eksporMutasi'

const inputCls =
  'mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

function hariIniWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

export function MutasiView({ rekeningAwal }: { rekeningAwal: string }) {
  const { locations, isLoading: memuatRekening } = useCashOverview()
  const rekeningPusat = useMemo(
    () => locations.filter(l => l.grup).sort((a, b) => Number(b.is_active) - Number(a.is_active)),
    [locations],
  )

  const hariIni = hariIniWib()
  const [rekening, setRekening] = useState(rekeningAwal)
  const [dari, setDari] = useState(`${hariIni.slice(0, 7)}-01`)
  const [sampai, setSampai] = useState(hariIni)
  const [mengekspor, setMengekspor] = useState<'xlsx' | 'pdf' | null>(null)

  const rekeningId = rekening || rekeningPusat[0]?.id || ''
  const lokasi = rekeningPusat.find(l => l.id === rekeningId)
  const { data, isLoading, error } = useMutasiRekening(rekeningId, dari, sampai)
  const baris = data?.baris ?? []
  const ringkasan = data?.ringkasan

  const namaRekening = lokasi ? `${lokasi.label} (${lokasi.kind === 'bank' ? 'Bank' : 'Tunai'})` : ''

  async function ekspor(jenis: 'xlsx' | 'pdf') {
    if (!data || !lokasi) return
    setMengekspor(jenis)
    try {
      const info = { rekening: namaRekening, dari, sampai }
      if (jenis === 'xlsx') await eksporMutasiExcel(info, data.baris, data.ringkasan)
      else await eksporMutasiPdf(info, data.baris, data.ringkasan)
    } catch (e) {
      toast.error('Gagal mengekspor: ' + (e as Error).message)
    } finally {
      setMengekspor(null)
    }
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-suka-orange font-bold uppercase tracking-wider text-sm mb-1">Kas & Treasury</p>
          <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide">Mutasi Rekening</h1>
          <p className="text-suka-ink/60 mt-2 font-medium">Uang masuk & keluar per rekening, untuk dicocokkan dengan rekening koran.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => ekspor('xlsx')}
            disabled={!data || mengekspor !== null}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {mengekspor === 'xlsx' ? <Spinner size={14} /> : <FileSpreadsheet size={16} />} Excel
          </button>
          <button
            onClick={() => ekspor('pdf')}
            disabled={!data || mengekspor !== null}
            className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {mengekspor === 'pdf' ? <Spinner size={14} /> : <FileText size={16} />} PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-suka-gray-600">
          Rekening
          <select className={inputCls} value={rekeningId} onChange={e => setRekening(e.target.value)} disabled={memuatRekening}>
            {rekeningPusat.map(l => (
              <option key={l.id} value={l.id}>
                {l.grup ? `${GRUP_LABEL[l.grup]} · ` : ''}{l.kind === 'bank' ? 'Bank' : 'Tunai'}{l.account_no ? ` ${l.account_no}` : ''}
                {l.is_active ? '' : ' (nonaktif)'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-suka-gray-600">
          Dari
          <input type="date" className={inputCls} value={dari} max={sampai} onChange={e => setDari(e.target.value)} />
        </label>
        <label className="text-sm font-semibold text-suka-gray-600">
          Sampai
          <input type="date" className={inputCls} value={sampai} min={dari} onChange={e => setSampai(e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saldo awal" value={ringkasan ? rupiah(ringkasan.saldoAwal) : '-'} icon={<Wallet size={22} />} tone="default" />
        <StatCard label="Masuk" value={ringkasan ? rupiah(ringkasan.totalMasuk) : '-'} icon={<ArrowDownLeft size={22} />} tone="green" />
        <StatCard label="Keluar" value={ringkasan ? rupiah(ringkasan.totalKeluar) : '-'} icon={<ArrowUpRight size={22} />} tone="orange" />
        <StatCard label="Saldo akhir" value={ringkasan ? rupiah(ringkasan.saldoAkhir) : '-'} icon={<Landmark size={22} />} tone="blue" />
      </div>

      <SectionCard title={namaRekening || 'Mutasi'}>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : error ? (
          <p className="py-6 text-center text-red-600">Gagal memuat mutasi: {(error as Error).message}</p>
        ) : baris.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">Tidak ada transaksi pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Keterangan</th>
                  <th className="py-2 px-3 text-right">Masuk</th>
                  <th className="py-2 px-3 text-right">Keluar</th>
                  <th className="py-2 px-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {baris.map(b => (
                  <tr key={b.id} className={b.dihitung ? '' : 'opacity-50'}>
                    <td className="py-2.5 px-3 whitespace-nowrap text-suka-gray-500">{tanggalWaktu(b.occurred_at)}</td>
                    <td className={`py-2.5 px-3 text-suka-ink ${b.dihitung ? '' : 'line-through'}`}>
                      {b.keterangan}
                      {!b.dihitung && <span className="ml-2 rounded bg-suka-gray-100 px-1.5 py-0.5 text-[10px] font-bold no-underline">DIBATALKAN</span>}
                      {b.proof_url && (
                        <a href={b.proof_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-suka-orange hover:underline">bukti</a>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">{b.masuk ? rupiah(b.masuk) : ''}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-red-600">{b.keluar ? rupiah(b.keluar) : ''}</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${b.saldo < 0 ? 'text-red-600' : 'text-suka-ink'}`}>
                      {b.dihitung ? rupiah(b.saldo) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
