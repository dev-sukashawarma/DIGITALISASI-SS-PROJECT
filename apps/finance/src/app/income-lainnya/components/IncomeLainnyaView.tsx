'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, CurrencyInput, Spinner } from '@suka/design-system'
import { SectionCard, StatCard } from '@/components/ui'
import { Coins } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useCashOverview } from '@/hooks/useCashData'
import { useOutlets } from '@/hooks/useCashDeposit'
import { useBatalIncome, useCatatIncome, useIncomeLainnya } from '@/hooks/useIncomeLainnya'
import { lokasiGrup } from '@/lib/kas/grupKas'
import { INCOME_KATEGORI, labelKategoriIncome, validasiIncome, type IncomeKategori } from '@/lib/kas/incomeLainnya'
import { rupiah, tanggal, tanggalWaktu } from '@/lib/format'

function hariIniWib(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

export function IncomeLainnyaView() {
  const supabase = useMemo(() => createClient(), [])
  const { locations } = useCashOverview()
  const { data: outlets = [] } = useOutlets()
  const kasOffice = lokasiGrup(locations, 'office')

  const hariIni = hariIniWib()
  const [from, setFrom] = useState(`${hariIni.slice(0, 7)}-01`)
  const [to, setTo] = useState(hariIni)
  const [page, setPage] = useState(0)
  const daftar = useIncomeLainnya({ from, to, page })
  const catat = useCatatIncome()
  const batal = useBatalIncome()

  const [tgl, setTgl] = useState(hariIni)
  const [kategori, setKategori] = useState<IncomeKategori>('minyak_jelantah')
  const [keterangan, setKeterangan] = useState('')
  const [pembeli, setPembeli] = useState('')
  const [asalOutlet, setAsalOutlet] = useState('')
  const [amount, setAmount] = useState(0)
  const [lokasi, setLokasi] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const lokasiDipilih = lokasi || kasOffice[0]?.id || ''
  const galat =
    validasiIncome({ kategori, keterangan, pembeli, amount, adaBukti: !!proofFile }) ??
    (lokasiDipilih ? null : 'Belum ada lokasi Kas Office aktif')

  const simpan = () => {
    if (galat || !proofFile) return
    catat.mutate(
      { tanggal: tgl, kategori, keterangan, pembeli, asalOutletId: asalOutlet || null, amount,
        cashLocationId: lokasiDipilih, proofFile },
      {
        onSuccess: () => {
          toast.success('Income lainnya tercatat')
          setKeterangan(''); setPembeli(''); setAmount(0); setProofFile(null); setAsalOutlet('')
        },
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  const batalkan = (id: string) => {
    const alasan = window.prompt('Alasan pembatalan?')
    if (!alasan?.trim()) return
    batal.mutate({ id, alasan }, {
      onSuccess: () => toast.success('Income lainnya dibatalkan'),
      onError: (e) => toast.error((e as Error).message),
    })
  }

  const lihatBukti = async (path: string) => {
    const { data, error } = await supabase.storage.from('finance-proofs').createSignedUrl(path, 300)
    if (error || !data) { toast.error('Bukti tidak bisa dibuka'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const rows = daftar.data?.rows ?? []
  const totalAktif = rows.filter((r) => r.status === 'aktif').reduce((s, r) => s + Number(r.amount), 0)
  const jumlahHalaman = Math.max(1, Math.ceil((daftar.data?.total ?? 0) / (daftar.data?.halaman ?? 50)))

  const input = 'mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-suka-orange font-bold uppercase tracking-wider text-sm mb-1">Kas Office</p>
        <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide">Income Lainnya</h1>
        <p className="text-suka-ink/60 mt-2 font-medium">
          Penjualan minyak jelantah, kardus, kompan, dan equipment bekas. Masuk Kas Office sebagai pendapatan pusat.
        </p>
      </div>

      <SectionCard title="Catat Income Lainnya">
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-suka-gray-600">Tanggal
            <input type="date" value={tgl} max={hariIni} onChange={(e) => setTgl(e.target.value)} className={input} />
          </label>
          <label className="text-sm font-semibold text-suka-gray-600">Kategori
            <select value={kategori} onChange={(e) => setKategori(e.target.value as IncomeKategori)} className={input}>
              {INCOME_KATEGORI.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-suka-gray-600">Pembeli
            <input value={pembeli} onChange={(e) => setPembeli(e.target.value)} className={input} />
          </label>
          <div className="text-sm font-semibold text-suka-gray-600">
            <CurrencyInput label="Nominal" value={amount || ''} onChange={(v) => setAmount(Number(v) || 0)} className={input} />
          </div>
          <label className="text-sm font-semibold text-suka-gray-600">Masuk ke
            <select value={lokasiDipilih} onChange={(e) => setLokasi(e.target.value)} className={input}>
              {kasOffice.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-suka-gray-600">Asal outlet (opsional, keterangan saja)
            <select value={asalOutlet} onChange={(e) => setAsalOutlet(e.target.value)} className={input}>
              <option value="">— Tidak ada —</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-suka-gray-600 sm:col-span-2">
            Keterangan {kategori === 'lainnya' ? '(wajib)' : '(opsional)'}
            <input value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className={input} />
          </label>
          <label className="text-sm font-semibold text-suka-gray-600 sm:col-span-2">Bukti nota / transfer (wajib)
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} className={input} />
          </label>
          {galat && <p className="text-sm font-medium text-red-600 sm:col-span-2">{galat}</p>}
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={simpan} disabled={!!galat || catat.isPending}>
              {catat.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Riwayat Income Lainnya"
        action={
          <div className="flex items-center gap-2 text-xs">
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }} className="rounded-lg border px-2 py-1" />
            <span>s/d</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }} className="rounded-lg border px-2 py-1" />
          </div>
        }
      >
        <div className="p-4 space-y-3">
          <StatCard label="Total aktif (halaman ini)" value={rupiah(totalAktif)} icon={<Coins size={22} />} tone="orange" />
          {daftar.isLoading ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : daftar.error ? (
            <p className="text-sm text-red-600">Gagal memuat: {(daftar.error as Error).message}</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-suka-gray-400">Belum ada income lainnya pada periode ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-suka-gray-500">
                  <tr><th className="py-2">Tanggal</th><th>Kategori</th><th>Pembeli</th><th>Asal outlet</th><th>Masuk ke</th><th className="text-right">Nominal</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const dibatal = r.status === 'batal'
                    return (
                      <tr key={r.id} className={`border-t ${dibatal ? 'text-suka-gray-400' : ''}`}>
                        <td className="py-2">{tanggal(r.occurred_at)}</td>
                        <td className={dibatal ? 'line-through' : ''}>
                          {labelKategoriIncome(r.kategori)}{r.keterangan ? ` · ${r.keterangan}` : ''}
                        </td>
                        <td>{r.pembeli}</td>
                        <td>{r.asal_outlet?.name ?? '—'}</td>
                        <td>{r.cash_location?.label ?? '—'}</td>
                        <td className={`text-right tabular-nums ${dibatal ? 'line-through' : ''}`}>{rupiah(Number(r.amount))}</td>
                        <td className="text-right whitespace-nowrap space-x-2">
                          <button type="button" onClick={() => lihatBukti(r.proof_url)} className="text-xs text-blue-600 underline">Bukti</button>
                          {dibatal ? (
                            <span className="text-xs" title={r.batal_alasan ?? ''}>Batal {tanggalWaktu(r.batal_at)}: {r.batal_alasan}</span>
                          ) : (
                            <button type="button" onClick={() => batalkan(r.id)} disabled={batal.isPending} className="text-xs text-red-600 underline">Batal</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {jumlahHalaman > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
              <span>Hal {page + 1} / {jumlahHalaman}</span>
              <Button variant="secondary" disabled={page + 1 >= jumlahHalaman} onClick={() => setPage(page + 1)}>Berikutnya</Button>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
