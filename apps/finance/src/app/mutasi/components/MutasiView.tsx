'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@suka/design-system'
import { FileSpreadsheet, FileText, Wallet, ArrowDownLeft, ArrowUpRight, Landmark, Paperclip, Settings2, ArrowLeftRight, PlusCircle } from 'lucide-react'
import { useCashOverview } from '@/hooks/useCashData'
import { useMutasiRekening } from '@/hooks/useMutasiRekening'
import { rupiah, tanggalWaktu } from '@/lib/format'
import { StatCard, SectionCard } from '@/components/ui'
import { GRUP_LABEL, URUTAN_GRUP } from '@/lib/kas/grupKas'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { KelolaRekeningModal } from './KelolaRekeningModal'
import { TransferModal } from './TransferModal'
import { TopUpModal } from './TopUpModal'
import { BuktiModal } from './BuktiModal'
import { useTopUpSaldo } from '@/hooks/useTopUpSaldo'
import { eksporMutasiExcel, eksporMutasiPdf } from '@/lib/kas/eksporMutasi'
import { JENIS_LABEL, catatanTambahan, totalBaris, type JenisMutasi } from '@/lib/kas/mutasiRekening'

const WARNA_JENIS: Record<JenisMutasi, string> = {
  setoran: 'bg-blue-50 text-blue-700',
  pencairan_pc: 'bg-orange-50 text-suka-orange',
  belanja_pusat: 'bg-red-50 text-red-700',
  setor_bank: 'bg-indigo-50 text-indigo-700',
  income_lain: 'bg-emerald-50 text-emerald-700',
  penyesuaian: 'bg-suka-gray-100 text-suka-gray-600',
  transfer: 'bg-purple-50 text-purple-700',
  top_up: 'bg-teal-50 text-teal-700',
  lainnya: 'bg-suka-gray-100 text-suka-gray-600',
}

const inputCls =
  'mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

function hariIniWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

export function MutasiView({ rekeningAwal }: { rekeningAwal: string }) {
  const { locations } = useCashOverview()
  const { isChecker } = useFinanceRole()
  const [kelolaTerbuka, setKelolaTerbuka] = useState(false)
  const [transferTerbuka, setTransferTerbuka] = useState(false)
  const [topUpTerbuka, setTopUpTerbuka] = useState(false)
  const [bukti, setBukti] = useState<{ url: string; judul: string } | null>(null)
  const { batal: batalTopUp } = useTopUpSaldo()
  function batalkanTopUp(id: string) {
    const alasan = window.prompt('Alasan membatalkan top up ini:')?.trim()
    if (!alasan) return
    batalTopUp.mutate(
      { id, alasan },
      { onSuccess: () => toast.success('Top up dibatalkan'), onError: (e: unknown) => toast.error((e as Error).message) },
    )
  }
  // Kartu: rekening pusat aktif, urut Utama -> Bahan Baku -> Petty Cash, bank dulu.
  const rekeningPusat = useMemo(
    () =>
      locations
        .filter(l => l.grup && l.is_active)
        .sort((a, b) =>
          URUTAN_GRUP.indexOf(a.grup!) - URUTAN_GRUP.indexOf(b.grup!) || (a.kind === 'bank' ? -1 : 1) - (b.kind === 'bank' ? -1 : 1),
        ),
    [locations],
  )

  const hariIni = hariIniWib()
  const [rekening, setRekening] = useState(rekeningAwal)
  const [dari, setDari] = useState(`${hariIni.slice(0, 7)}-01`)
  const [sampai, setSampai] = useState(hariIni)
  const [mengekspor, setMengekspor] = useState<'xlsx' | 'pdf' | null>(null)
  const [jenis, setJenis] = useState<JenisMutasi | 'semua'>('semua')

  const rekeningId = rekening || rekeningPusat[0]?.id || ''
  const lokasi = rekeningPusat.find(l => l.id === rekeningId)
  const { data, isLoading, error } = useMutasiRekening(rekeningId, dari, sampai)
  const semuaBaris = data?.baris ?? []
  const ringkasan = data?.ringkasan
  const jumlahPerJenis = useMemo(() => {
    const m = new Map<JenisMutasi, number>()
    for (const b of semuaBaris) m.set(b.jenis, (m.get(b.jenis) ?? 0) + 1)
    return m
  }, [semuaBaris])
  const disaring = jenis !== 'semua'
  const baris = disaring ? semuaBaris.filter(b => b.jenis === jenis) : semuaBaris
  const totalSaringan = totalBaris(baris)

  const namaRekening = lokasi ? `${lokasi.label} (${lokasi.kind === 'bank' ? 'Bank' : 'Tunai'})` : ''

  async function ekspor(format: 'xlsx' | 'pdf') {
    if (!data || !lokasi) return
    setMengekspor(format)
    try {
      const info = { rekening: namaRekening, dari, sampai, jenis: disaring ? JENIS_LABEL[jenis as JenisMutasi] : null }
      if (format === 'xlsx') await eksporMutasiExcel(info, baris, data.ringkasan)
      else await eksporMutasiPdf(info, baris, data.ringkasan)
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
          <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide">Rekening &amp; Mutasi</h1>
          <p className="text-suka-ink/60 mt-2 font-medium">Uang masuk & keluar per rekening, untuk dicocokkan dengan rekening koran.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isChecker && (
            <button
              onClick={() => setTopUpTerbuka(true)}
              className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700"
            >
              <PlusCircle size={16} /> Top Up
            </button>
          )}
          {isChecker && (
            <button
              onClick={() => setTransferTerbuka(true)}
              className="inline-flex items-center gap-2 rounded-full bg-suka-orange px-4 py-2 text-sm font-bold text-white hover:bg-suka-orange/90"
            >
              <ArrowLeftRight size={16} /> Transfer
            </button>
          )}
          {isChecker && (
            <button
              onClick={() => setKelolaTerbuka(true)}
              className="inline-flex items-center gap-2 rounded-full border border-suka-gray-200 bg-white px-4 py-2 text-sm font-bold text-suka-ink hover:border-suka-orange"
            >
              <Settings2 size={16} /> Kelola rekening
            </button>
          )}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rekeningPusat.map(l => {
          const aktif = l.id === rekeningId
          return (
            <button
              key={l.id}
              onClick={() => { setRekening(l.id); setJenis('semua') }}
              className={`rounded-2xl border p-4 text-left transition-all ${
                aktif ? 'border-suka-orange bg-orange-50/60 shadow-sm' : 'border-suka-gray-200 bg-white hover:border-suka-orange/60'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-suka-orange">{GRUP_LABEL[l.grup!]}</p>
              <p className="mt-0.5 text-sm font-semibold text-suka-ink">
                {l.kind === 'bank' ? 'Bank' : 'Tunai'}{l.account_no ? ` · ${l.account_no}` : ''}
              </p>
              <p className={`mt-2 text-lg font-bold ${l.saldo < 0 ? 'text-red-600' : 'text-suka-ink'}`}>{rupiah(l.saldo)}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
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
        {semuaBaris.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-4 sm:px-6">
            {(['semua', ...Object.keys(JENIS_LABEL)] as (JenisMutasi | 'semua')[])
              .filter(j => j === 'semua' || jumlahPerJenis.has(j))
              .map(j => (
                <button
                  key={j}
                  onClick={() => setJenis(j)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                    jenis === j ? 'border-suka-orange bg-suka-orange text-white' : 'border-suka-gray-200 bg-white text-suka-gray-600 hover:border-suka-orange'
                  }`}
                >
                  {j === 'semua' ? 'Semua' : JENIS_LABEL[j]} ({j === 'semua' ? semuaBaris.length : jumlahPerJenis.get(j)})
                </button>
              ))}
          </div>
        )}
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
                  <th className="py-2 px-3">Jenis</th>
                  <th className="py-2 px-3">Outlet / Pihak</th>
                  <th className="py-2 px-3">Keterangan</th>
                  <th className="py-2 px-3">Dicatat oleh</th>
                  <th className="py-2 px-3 text-center">Bukti</th>
                  <th className="py-2 px-3 text-right">Masuk</th>
                  <th className="py-2 px-3 text-right">Keluar</th>
                  {!disaring && <th className="py-2 px-3 text-right">Saldo</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {baris.map(b => {
                  const catatan = catatanTambahan(b)
                  return (
                    <tr key={b.id} className={b.dihitung ? '' : 'opacity-50'}>
                      <td className="py-2.5 px-3 whitespace-nowrap text-suka-gray-500">{tanggalWaktu(b.occurred_at)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${WARNA_JENIS[b.jenis]}`}>{JENIS_LABEL[b.jenis]}</span>
                      </td>
                      <td className="py-2.5 px-3 text-suka-ink">{b.pihak}</td>
                      <td className="py-2.5 px-3 text-suka-ink max-w-[360px]">
                        <span className={b.dihitung ? '' : 'line-through'}>{b.keterangan}</span>
                        {!b.dihitung && <span className="ml-2 rounded bg-suka-gray-100 px-1.5 py-0.5 text-[10px] font-bold">DIBATALKAN</span>}
                        {isChecker && b.dihitung && b.jenis === 'top_up' && (
                          <button onClick={() => batalkanTopUp(b.id)} disabled={batalTopUp.isPending}
                            className="ml-2 text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50">
                            Batalkan
                          </button>
                        )}
                        {catatan && <span className="block truncate text-xs text-suka-gray-400" title={catatan}>{catatan}</span>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-suka-gray-500">{b.dicatat_oleh ?? '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        {b.proof_url ? (
                          <button
                            onClick={() => setBukti({ url: b.proof_url!, judul: `${JENIS_LABEL[b.jenis]} · ${b.keterangan}` })}
                            title="Lihat bukti"
                            className="inline-flex rounded-lg p-1.5 text-suka-orange hover:bg-suka-orange/10">
                            <Paperclip size={15} />
                          </button>
                        ) : <span className="text-suka-gray-300">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 whitespace-nowrap">{b.masuk ? rupiah(b.masuk) : ''}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-red-600 whitespace-nowrap">{b.keluar ? rupiah(b.keluar) : ''}</td>
                      {!disaring && (
                        <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${b.saldo < 0 ? 'text-red-600' : 'text-suka-ink'}`}>
                          {b.dihitung ? rupiah(b.saldo) : ''}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {disaring && (
                <tfoot>
                  <tr className="border-t-2 border-suka-gray-200 font-bold">
                    <td colSpan={6} className="py-2.5 px-3 text-suka-ink">Total {JENIS_LABEL[jenis as JenisMutasi]}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 whitespace-nowrap">{totalSaringan.masuk ? rupiah(totalSaringan.masuk) : ''}</td>
                    <td className="py-2.5 px-3 text-right text-red-600 whitespace-nowrap">{totalSaringan.keluar ? rupiah(totalSaringan.keluar) : ''}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </SectionCard>

      {kelolaTerbuka && <KelolaRekeningModal locations={locations} onClose={() => setKelolaTerbuka(false)} />}
      {transferTerbuka && <TransferModal rekening={rekeningPusat} dariAwal={rekeningId} onClose={() => setTransferTerbuka(false)} />}
      {bukti && <BuktiModal url={bukti.url} judul={bukti.judul} onClose={() => setBukti(null)} />}
      {topUpTerbuka && <TopUpModal rekening={rekeningPusat} rekeningAwal={rekeningId} onClose={() => setTopUpTerbuka(false)} />}
    </div>
  )
}
