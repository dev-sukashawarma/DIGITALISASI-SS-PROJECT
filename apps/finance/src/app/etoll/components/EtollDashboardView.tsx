'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Button, CurrencyInput, Spinner } from '@suka/design-system'
import { SectionCard, StatCard } from '@/components/ui'
import { rupiah, tanggal, tanggalWaktu } from '@/lib/format'
import {
  ETOLL_CATEGORY_LABELS,
  ETOLL_ISSUER_BADGE_COLORS,
  ETOLL_ISSUER_LABELS,
  ETOLL_TOPUP_STATUS_LABELS,
  type EtollCard,
  type EtollCategory,
  type EtollIssuer,
  type EtollTopupStatus,
  type EtollTransaction,
} from '@/lib/etoll/types'
import { formatCardNumber } from '@/lib/etoll/reconcile'
import {
  useCreateEtollTopup,
  useDeleteDictionaryEntry,
  useEtollCards,
  useEtollDictionary,
  useEtollReference,
  useEtollTopups,
  useEtollTransactions,
  useSaveDictionaryEntry,
  useUpdateEtollTopupStatus,
} from '@/hooks/useEtoll'
import { exportEtollExcel, exportEtollPdf } from '@/utils/etollExporter'
import {
  CardDetailHandoverModal,
  RegisterCardModal,
  TagTransactionModal,
} from './EtollModals'
import { useFinanceRole } from '@/hooks/useFinanceRole'

function hariIniWib(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

type TabKey = 'transactions' | 'cards' | 'topups' | 'dictionary'

const CATEGORY_BADGE: Record<EtollCategory, string> = {
  tol: 'bg-emerald-100 text-emerald-800',
  parkir: 'bg-sky-100 text-sky-800',
  bbm_merchant: 'bg-purple-100 text-purple-800',
  operasional_lain: 'bg-stone-100 text-stone-700',
  pribadi_anomali: 'bg-rose-100 text-rose-800 font-bold',
  topup: 'bg-teal-100 text-teal-800',
  belum_dikategorikan: 'bg-amber-100 text-amber-800',
  untracked_gap: 'bg-red-100 text-red-800 font-bold',
}

const TOPUP_BADGE: Record<EtollTopupStatus, string> = {
  waiting_scan: 'bg-amber-100 text-amber-800',
  matched: 'bg-emerald-100 text-emerald-800',
  mismatch: 'bg-red-100 text-red-800',
  void: 'bg-stone-100 text-stone-500 line-through',
}

const inputCls =
  'w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2 text-sm text-suka-brown outline-none focus:border-suka-orange'

export function EtollDashboardView() {
  const { role } = useFinanceRole()
  const canRegisterCard = role === 'admin_finance' || role === 'developer'
  const hariIni = hariIniWib()
  const [tab, setTab] = useState<TabKey>('transactions')

  // Filters
  const [from, setFrom] = useState(`${hariIni.slice(0, 7)}-01`)
  const [to, setTo] = useState(hariIni)
  const [cardId, setCardId] = useState('all')
  const [holderId, setHolderId] = useState('all')
  const [category, setCategory] = useState('all')
  const [source, setSource] = useState('all')
  const [search, setSearch] = useState('')

  // Modals
  const [registerOpen, setRegisterOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<EtollCard | null>(null)
  const [taggingTx, setTaggingTx] = useState<EtollTransaction | null>(null)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  // Queries
  const cardsQ = useEtollCards()
  const txQ = useEtollTransactions({ from, to, cardId, holderId, category, source, search })
  const topupsQ = useEtollTopups(cardId)
  const dictQ = useEtollDictionary()
  const refQ = useEtollReference()

  // Top-Up form state
  const createTopup = useCreateEtollTopup()
  const updateTopupStatus = useUpdateEtollTopupStatus()
  const [tuCardId, setTuCardId] = useState('')
  const [tuDate, setTuDate] = useState(hariIni)
  const [tuAmount, setTuAmount] = useState(0)
  const [tuSource, setTuSource] = useState('Transfer Bank Pusat')
  const [tuRef, setTuRef] = useState('')
  const [tuNote, setTuNote] = useState('')

  // Dictionary form state
  const saveDict = useSaveDictionaryEntry()
  const deleteDict = useDeleteDictionaryEntry()
  const [dictIssuer, setDictIssuer] = useState<EtollIssuer | 'all'>('all')
  const [dictCode, setDictCode] = useState('')
  const [dictMerchant, setDictMerchant] = useState('')
  const [dictCategory, setDictCategory] = useState('tol')

  const cards = cardsQ.data?.cards ?? []
  const activeCards = useMemo(() => cards.filter((c) => c.status === 'active'), [cards])
  const totalBalanceAllCards = useMemo(
    () => activeCards.reduce((s, c) => s + Number(c.last_balance || 0), 0),
    [activeCards],
  )
  const transactions = txQ.data?.transactions ?? []
  const txSummary = txQ.data?.summary ?? {
    totalDebit: 0,
    totalTopup: 0,
    totalUntrackedGap: 0,
    uncategorizedCount: 0,
    count: 0,
  }
  const topups = topupsQ.data?.topups ?? []
  const waitingTopupCount = topups.filter((t) => t.status === 'waiting_scan').length
  const matchedTopupCount = topups.filter((t) => t.status === 'matched').length

  const handleExport = async (kind: 'excel' | 'pdf') => {
    try {
      setExporting(kind)
      const cardName = cardId !== 'all' ? cards.find((c) => c.id === cardId)?.label : undefined
      const opts = {
        from,
        to,
        cards,
        transactions,
        filterSummary: cardName ? `Kartu: ${cardName}` : 'Semua Kartu',
      }
      if (kind === 'excel') await exportEtollExcel(opts)
      else await exportEtollPdf(opts)
      toast.success(`Laporan ${kind.toUpperCase()} berhasil diunduh`)
    } catch (e) {
      toast.error((e as Error).message || 'Gagal export laporan')
    } finally {
      setExporting(null)
    }
  }

  const handleAddTopup = () => {
    if (!tuCardId || tuAmount <= 0) {
      toast.error('Pilih kartu dan isi nominal top-up')
      return
    }
    createTopup.mutate(
      {
        card_id: tuCardId,
        topup_date: tuDate,
        amount: tuAmount,
        funding_source: tuSource,
        reference_no: tuRef,
        note: tuNote,
      },
      {
        onSuccess: (res) => {
          toast.success(
            res.auto_matched
              ? 'Top-up tercatat & langsung COCOK dengan data chip!'
              : 'Top-up tercatat (Menunggu Scan NFC untuk pencocokan)',
          )
          setTuAmount(0)
          setTuRef('')
          setTuNote('')
        },
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  const handleSaveDict = () => {
    if (!dictCode.trim() || !dictMerchant.trim()) {
      toast.error('Isi kode terminal dan nama gerbang tol / merchant')
      return
    }
    saveDict.mutate(
      {
        issuer: dictIssuer,
        terminal_code: dictCode,
        merchant_name: dictMerchant,
        default_category: dictCategory,
      },
      {
        onSuccess: () => {
          toast.success('Kamus kode terminal disimpan & transaksi lama ikut terlabel')
          setDictCode('')
          setDictMerchant('')
        },
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-bold uppercase tracking-wider text-suka-orange">
            Monitoring &amp; Audit Operasional
          </p>
          <h1 className="font-display text-4xl tracking-wide text-suka-brown md:text-5xl">
            Kartu e-Toll
          </h1>
          <p className="mt-1.5 text-sm font-medium text-suka-ink/60">
            Pelacakan saldo, histori transaksi chip NFC (e-Money, Flazz, TapCash, Brizzi), deteksi
            selisih saldo, dan rekonsiliasi top-up — terpisah dari pembukuan Laba Rugi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport('excel')}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            {exporting === 'excel' ? 'Mengekspor...' : 'Export Excel'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport('pdf')}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            {exporting === 'pdf' ? 'Mengekspor...' : 'Export PDF'}
          </Button>
          {canRegisterCard && (
            <Button size="sm" onClick={() => setRegisterOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Daftarkan Kartu
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Saldo Aktif"
          value={rupiah(totalBalanceAllCards)}
          hint={`${activeCards.length} kartu aktif terdaftar`}
          tone="blue"
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatCard
          label="Total Pemakaian (Periode)"
          value={rupiah(txSummary.totalDebit)}
          hint={`${txSummary.count} transaksi · ${txSummary.uncategorizedCount} belum dilabeli`}
          tone="orange"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Selisih Saldo Tak Terlacak"
          value={rupiah(txSummary.totalUntrackedGap)}
          hint={
            txSummary.totalUntrackedGap > 0
              ? 'Ada dana keluar di luar log chip — perlu audit!'
              : 'Semua saldo cocok dengan log chip'
          }
          tone={txSummary.totalUntrackedGap > 0 ? 'red' : 'green'}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Rekonsiliasi Top-Up"
          value={`${matchedTopupCount} Cocok`}
          hint={`${waitingTopupCount} top-up menunggu scan NFC`}
          tone={waitingTopupCount > 0 ? 'orange' : 'green'}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-suka-brown/10 pb-2">
        {(
          [
            ['transactions', 'Histori & Audit Transaksi', Download],
            ['cards', `Daftar Kartu (${cards.length})`, CreditCard],
            ['topups', `Rekonsiliasi Top-Up (${waitingTopupCount} tunggu)`, RefreshCw],
            ['dictionary', `Kamus Kode Terminal (${dictQ.data?.entries.length ?? 0})`, BookOpen],
          ] as const
        ).map(([key, label, Icon]) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
                active
                  ? 'bg-suka-orange text-white shadow-sm'
                  : 'bg-white/80 text-suka-gray-600 hover:bg-suka-cream hover:text-suka-brown'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          )
        })}
      </div>

      {/* TAB 1: HISTORI TRANSAKSI */}
      {tab === 'transactions' && (
        <SectionCard title="Histori Transaksi Chip & Audit Pemakaian">
          <div className="space-y-4 p-4">
            {/* Filter bar */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-suka-gray-500">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-suka-gray-500">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-suka-gray-500">
                  Kartu
                </label>
                <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={inputCls}>
                  <option value="all">Semua Kartu</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-suka-gray-500">
                  Pemegang
                </label>
                <select
                  value={holderId}
                  onChange={(e) => setHolderId(e.target.value)}
                  className={inputCls}
                >
                  <option value="all">Semua Pemegang</option>
                  {(refQ.data?.staff ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-suka-gray-500">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputCls}
                >
                  <option value="all">Semua Kategori</option>
                  {(Object.keys(ETOLL_CATEGORY_LABELS) as EtollCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {ETOLL_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-suka-gray-500">
                  Sumber
                </label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
                  <option value="all">Semua Sumber</option>
                  <option value="chip">Chip NFC</option>
                  <option value="untracked_gap">Selisih Tak Terlacak</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-suka-gray-400" />
              <input
                type="text"
                placeholder="Cari lokasi / gerbang tol, kode terminal, catatan, atau nomor kartu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>

            {txQ.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-suka-brown/20 py-10 text-center text-sm text-suka-gray-500">
                Belum ada transaksi e-Toll pada periode &amp; filter ini. Tap kartu e-Toll di
                aplikasi Android SuperApp untuk mulai menyinkronkan data chip.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-suka-brown/10 text-[11px] font-black uppercase text-suka-gray-500">
                      <th className="py-2.5 pr-3">Waktu (WIB)</th>
                      <th className="py-2.5 pr-3">Kartu &amp; Pemegang</th>
                      <th className="py-2.5 pr-3">Lokasi / Terminal</th>
                      <th className="py-2.5 pr-3">Kategori</th>
                      <th className="py-2.5 pr-3 text-right">Nominal</th>
                      <th className="py-2.5 pr-3 text-right">Saldo Setelah</th>
                      <th className="py-2.5 pr-3">Catatan</th>
                      <th className="py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-brown/5">
                    {transactions.map((tx) => {
                      const isGap = tx.category === 'untracked_gap' && tx.tx_type === 'debit'
                      return (
                        <tr
                          key={tx.id}
                          className={
                            isGap
                              ? 'bg-red-50/70 hover:bg-red-50'
                              : 'hover:bg-suka-cream/40'
                          }
                        >
                          <td className="whitespace-nowrap py-2.5 pr-3 font-medium text-suka-brown">
                            {tanggalWaktu(tx.occurred_at)}
                            <div className="text-[10px] text-suka-gray-400">
                              {tx.source === 'chip' ? 'Chip NFC' : 'Perubahan Saldo'}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="font-bold text-suka-brown">{tx.card?.label ?? '-'}</div>
                            <div className="text-[11px] text-suka-gray-500">
                              {tx.holder?.name ?? 'Tanpa Pemegang'}
                              {tx.card?.vehicle_plate ? ` · ${tx.card.vehicle_plate}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold text-suka-brown">
                              {tx.merchant_label || '-'}
                            </div>
                            {tx.terminal_code && (
                              <div className="font-mono text-[10px] text-suka-gray-400">
                                Kode: {tx.terminal_code}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] ${CATEGORY_BADGE[tx.category]}`}
                            >
                              {ETOLL_CATEGORY_LABELS[tx.category] ?? tx.category}
                            </span>
                          </td>
                          <td
                            className={`whitespace-nowrap py-2.5 pr-3 text-right font-mono font-bold ${
                              tx.tx_type === 'topup' ? 'text-emerald-700' : 'text-suka-brown'
                            }`}
                          >
                            {tx.tx_type === 'topup' ? '+' : '-'}
                            {rupiah(tx.amount)}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-right font-mono text-suka-gray-600">
                            {tx.balance_after != null ? rupiah(tx.balance_after) : '-'}
                          </td>
                          <td className="max-w-[200px] truncate py-2.5 pr-3 text-suka-gray-600" title={tx.note ?? ''}>
                            {tx.note || '-'}
                          </td>
                          <td className="whitespace-nowrap py-2.5 text-right">
                            <button
                              onClick={() => setTaggingTx(tx)}
                              className="inline-flex items-center gap-1 rounded-lg border border-suka-brown/15 bg-white px-2.5 py-1 text-[11px] font-bold text-suka-brown hover:border-suka-orange hover:text-suka-orange"
                            >
                              <Tag className="h-3 w-3" />
                              Label
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* TAB 2: DAFTAR KARTU */}
      {tab === 'cards' && (
        <SectionCard title="Master Kartu e-Toll Perusahaan">
          <div className="p-4">
            {cardsQ.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : cards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-suka-brown/20 py-10 text-center text-sm text-suka-gray-500">
                Belum ada kartu e-Toll terdaftar. Klik <strong>Daftarkan Kartu</strong> di kanan atas
                untuk menambahkan kartu operasional pertama.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCard(c)}
                    className="cursor-pointer rounded-2xl border border-suka-brown/10 bg-white p-4 shadow-xs transition-all hover:border-suka-orange hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black ${ETOLL_ISSUER_BADGE_COLORS[c.issuer]}`}
                        >
                          {ETOLL_ISSUER_LABELS[c.issuer]}
                        </span>
                        <h3 className="mt-1.5 text-sm font-black text-suka-brown">{c.label}</h3>
                        <p className="font-mono text-xs text-suka-gray-500">
                          {formatCardNumber(c.card_number)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          c.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'lost'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-end justify-between border-t border-suka-brown/5 pt-3">
                      <div className="text-xs text-suka-gray-600">
                        <div>
                          Pemegang: <strong className="text-suka-brown">{c.holder?.name ?? 'Pool'}</strong>
                        </div>
                        <div className="text-[11px] text-suka-gray-400">
                          {c.vehicle_plate ? `Plat ${c.vehicle_plate}` : c.division || 'Operasional'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-suka-gray-400">
                          Saldo Chip
                        </div>
                        <div className="font-mono text-base font-black text-suka-brown">
                          {rupiah(c.last_balance)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-suka-gray-400">
                      {c.last_scanned_at
                        ? `Scan terakhir: ${tanggalWaktu(c.last_scanned_at)} (${c.last_scanner?.name ?? '-'})`
                        : 'Belum pernah di-scan NFC'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* TAB 3: REKONSILIASI TOP-UP */}
      {tab === 'topups' && (
        <div className="space-y-4">
          <SectionCard title="Catat Pemberian Top-Up (Finance)">
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold text-suka-gray-600">
                Kartu e-Toll *
                <select value={tuCardId} onChange={(e) => setTuCardId(e.target.value)} className={`${inputCls} mt-1`}>
                  <option value="">-- Pilih Kartu --</option>
                  {activeCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.holder?.name ?? 'Pool'})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Tanggal Top-Up *
                <input
                  type="date"
                  value={tuDate}
                  onChange={(e) => setTuDate(e.target.value)}
                  className={`${inputCls} mt-1`}
                />
              </label>
              <div className="text-xs font-bold text-suka-gray-600">
                Nominal Top-Up *
                <div className="mt-1">
                  <CurrencyInput value={tuAmount} onChange={setTuAmount} />
                </div>
              </div>
              <label className="text-xs font-bold text-suka-gray-600">
                Sumber Dana
                <input
                  value={tuSource}
                  onChange={(e) => setTuSource(e.target.value)}
                  placeholder="Transfer BCA Pusat / Petty Cash"
                  className={`${inputCls} mt-1`}
                />
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                No. Referensi (Opsional)
                <input
                  value={tuRef}
                  onChange={(e) => setTuRef(e.target.value)}
                  placeholder="Ref transfer / voucher"
                  className={`${inputCls} mt-1`}
                />
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Catatan
                <input
                  value={tuNote}
                  onChange={(e) => setTuNote(e.target.value)}
                  placeholder="Keterangan top-up..."
                  className={`${inputCls} mt-1`}
                />
              </label>
            </div>
            <div className="flex items-center justify-between border-t border-suka-brown/5 px-4 py-3">
              <p className="text-xs text-suka-gray-500">
                Otomatis berstatus <strong>Cocok di Chip</strong> begitu kartu di-scan dan top-up
                bernominal sama terdeteksi (tidak memotong saldo CashLocation).
              </p>
              <Button size="sm" disabled={createTopup.isPending} onClick={handleAddTopup}>
                {createTopup.isPending ? 'Menyimpan...' : 'Catat Top-Up'}
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Daftar Rekonsiliasi Top-Up">
            <div className="overflow-x-auto p-4">
              {topups.length === 0 ? (
                <p className="py-6 text-center text-sm text-suka-gray-500">
                  Belum ada catatan top-up e-Toll.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-suka-brown/10 text-[11px] font-black uppercase text-suka-gray-500">
                      <th className="py-2 pr-3">Tanggal</th>
                      <th className="py-2 pr-3">Kartu</th>
                      <th className="py-2 pr-3 text-right">Nominal</th>
                      <th className="py-2 pr-3">Sumber Dana / Ref</th>
                      <th className="py-2 pr-3">Status Rekonsiliasi</th>
                      <th className="py-2 pr-3">Dicatat Oleh</th>
                      <th className="py-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-brown/5">
                    {topups.map((t) => (
                      <tr key={t.id} className="hover:bg-suka-cream/40">
                        <td className="whitespace-nowrap py-2.5 pr-3 font-medium text-suka-brown">
                          {tanggal(t.topup_date)}
                        </td>
                        <td className="py-2.5 pr-3 font-bold text-suka-brown">
                          {t.card?.label ?? '-'}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right font-mono font-bold text-suka-brown">
                          {rupiah(t.amount)}
                        </td>
                        <td className="py-2.5 pr-3 text-suka-gray-600">
                          {t.funding_source || '-'}
                          {t.reference_no ? ` · ${t.reference_no}` : ''}
                          {t.mismatch_note && (
                            <div className="text-[11px] font-semibold text-red-600">
                              Catatan selisih: {t.mismatch_note}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TOPUP_BADGE[t.status]}`}>
                            {ETOLL_TOPUP_STATUS_LABELS[t.status]}
                          </span>
                          {t.matched_at && (
                            <div className="mt-0.5 text-[10px] text-suka-gray-400">
                              Cocok: {tanggalWaktu(t.matched_at)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-suka-gray-500">{t.creator?.name ?? '-'}</td>
                        <td className="whitespace-nowrap py-2.5 text-right">
                          {t.status === 'waiting_scan' && (
                            <div className="inline-flex gap-1.5">
                              <button
                                onClick={() => {
                                  const reason = window.prompt('Catatan selisih / tidak masuk ke chip:')
                                  if (!reason?.trim()) return
                                  updateTopupStatus.mutate(
                                    { id: t.id, status: 'mismatch', mismatch_note: reason },
                                    { onSuccess: () => toast.success('Ditandai sebagai Selisih') },
                                  )
                                }}
                                className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50"
                              >
                                Tandai Selisih
                              </button>
                              <button
                                onClick={() => {
                                  if (!window.confirm('Batalkan catatan top-up ini?')) return
                                  updateTopupStatus.mutate(
                                    { id: t.id, status: 'void' },
                                    { onSuccess: () => toast.success('Catatan top-up dibatalkan') },
                                  )
                                }}
                                className="rounded-lg border border-suka-gray-200 px-2 py-1 text-[11px] font-bold text-suka-gray-600 hover:bg-suka-gray-50"
                              >
                                Batal
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* TAB 4: KAMUS KODE TERMINAL */}
      {tab === 'dictionary' && (
        <div className="space-y-4">
          <SectionCard title="Tambah / Ajari Kode Terminal Baru">
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold text-suka-gray-600">
                Bank
                <select
                  value={dictIssuer}
                  onChange={(e) => setDictIssuer(e.target.value as EtollIssuer | 'all')}
                  className={`${inputCls} mt-1`}
                >
                  <option value="all">Semua Bank</option>
                  {(Object.keys(ETOLL_ISSUER_LABELS) as EtollIssuer[]).map((k) => (
                    <option key={k} value={k}>
                      {ETOLL_ISSUER_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Kode Terminal (Hex / ID Chip) *
                <input
                  value={dictCode}
                  onChange={(e) => setDictCode(e.target.value)}
                  placeholder="Misal: 0102A4B5"
                  className={`${inputCls} mt-1 font-mono`}
                />
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Nama Gerbang Tol / Merchant *
                <input
                  value={dictMerchant}
                  onChange={(e) => setDictMerchant(e.target.value)}
                  placeholder="Misal: GT Cikarang Barat"
                  className={`${inputCls} mt-1`}
                />
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Kategori Default
                <select
                  value={dictCategory}
                  onChange={(e) => setDictCategory(e.target.value)}
                  className={`${inputCls} mt-1`}
                >
                  <option value="tol">Tol</option>
                  <option value="parkir">Parkir</option>
                  <option value="bbm_merchant">BBM / Merchant</option>
                  <option value="operasional_lain">Operasional Lain</option>
                  <option value="pribadi_anomali">Pribadi / Anomali</option>
                  <option value="topup">Top-Up</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end border-t border-suka-brown/5 px-4 py-3">
              <Button size="sm" disabled={saveDict.isPending} onClick={handleSaveDict}>
                {saveDict.isPending ? 'Menyimpan...' : 'Simpan ke Kamus'}
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Daftar Kamus Kode Terminal">
            <div className="overflow-x-auto p-4">
              {(dictQ.data?.entries.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-suka-gray-500">
                  Belum ada kamus kode terminal. Anda juga bisa mengajari kode langsung dari tombol{' '}
                  <strong>Label</strong> di tabel Histori Transaksi.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-suka-brown/10 text-[11px] font-black uppercase text-suka-gray-500">
                      <th className="py-2 pr-3">Bank</th>
                      <th className="py-2 pr-3">Kode Terminal</th>
                      <th className="py-2 pr-3">Nama Gerbang Tol / Merchant</th>
                      <th className="py-2 pr-3">Kategori Default</th>
                      <th className="py-2 text-right">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-brown/5">
                    {dictQ.data?.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-suka-cream/40">
                        <td className="py-2.5 pr-3 text-suka-gray-600">
                          {entry.issuer === 'all' ? 'Semua Bank' : ETOLL_ISSUER_LABELS[entry.issuer]}
                        </td>
                        <td className="py-2.5 pr-3 font-mono font-bold text-suka-brown">
                          {entry.terminal_code}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-suka-brown">
                          {entry.merchant_name}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${CATEGORY_BADGE[entry.default_category]}`}>
                            {ETOLL_CATEGORY_LABELS[entry.default_category]}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              if (!window.confirm(`Hapus kode ${entry.terminal_code} dari kamus?`)) return
                              deleteDict.mutate(entry.id, {
                                onSuccess: () => toast.success('Entri kamus dihapus'),
                              })
                            }}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Modals */}
      <RegisterCardModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        refData={refQ.data}
      />
      <CardDetailHandoverModal
        key={`card-${selectedCard?.id ?? 'none'}`}
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        refData={refQ.data}
        canEdit={canRegisterCard}
      />
      <TagTransactionModal
        key={`tx-${taggingTx?.id ?? 'none'}`}
        tx={taggingTx}
        onClose={() => setTaggingTx(null)}
      />
    </div>
  )
}
