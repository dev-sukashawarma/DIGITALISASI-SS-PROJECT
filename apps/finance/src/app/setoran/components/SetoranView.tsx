'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, Spinner, CurrencyInput } from '@suka/design-system'
import { Banknote, Landmark, Pencil, Trash2, X } from 'lucide-react'
import { useCashOverview, useCashTransactions } from '@/hooks/useCashData'
import { useOutlets, useCashDeposit, useUpdateCashDepositMethod, useDeleteCashDeposit } from '@/hooks/useCashDeposit'
import { useExpectedCash } from '@/hooks/useExpectedCash'
import { rupiah, tanggalWaktu } from '@/lib/format'
import { StatCard, SectionCard, TxStatusBadge } from '@/components/ui'
import { summarizeBalances } from '@/lib/cashSummary'
import { isExcludedOutlet } from '@/lib/outletFilters'
import type { CashLocation, CashBalance, CashTransaction } from '@/lib/types'

type DepositMethod = 'transfer' | 'langsung'

export function SetoranView({
  initialLocations,
  initialBalances,
  initialTxs,
}: {
  initialLocations?: CashLocation[];
  initialBalances?: CashBalance[];
  initialTxs?: CashTransaction[];
}) {
  const { locations } = useCashOverview(initialLocations, initialBalances)
  const { data: outlets = [] } = useOutlets()
  const { data: txs = [] } = useCashTransactions(100, initialTxs)
  const deposit = useCashDeposit()
  const updateDepositMethod = useUpdateCashDepositMethod()
  const deleteDeposit = useDeleteCashDeposit()

  const [depositMethod, setDepositMethod] = useState<DepositMethod>('transfer')
  const [location, setLocation] = useState('')
  const [outletId, setOutletId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [salesDate, setSalesDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // State untuk modal Action (Edit Metode Setoran / Hapus Transaksi)
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null)
  const [editMethod, setEditMethod] = useState<DepositMethod>('transfer')
  const [editLocation, setEditLocation] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Setoran hanya boleh masuk ke rekening/kas PUSAT (bukan kas kecil outlet);
  // record_cash_deposit menolak lokasi lain. Transfer -> bank pusat, langsung -> kas pusat.
  const targetKind = depositMethod === 'transfer' ? 'bank' : 'cash'
  const destinationOptions = locations.filter(
    (l) => l.scope === 'pusat' && l.is_active !== false && l.kind === targetKind
  )

  const editTargetKind = editMethod === 'transfer' ? 'bank' : 'cash'
  const editDestinationOptions = locations.filter(
    (l) => l.scope === 'pusat' && l.is_active !== false && l.kind === editTargetKind
  )

  useEffect(() => {
    setLocation(destinationOptions[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositMethod, locations])

  const selectedLocation = locations.find((l) => l.id === location)
  const { data: expectedCash = 0, isLoading: isLoadingExpected } = useExpectedCash(outletId || null, salesDate)

  const summary = summarizeBalances(locations)
  const deposits = txs.filter((t) => t.source_type === 'cash_deposit')

  const openActionModal = (tx: CashTransaction) => {
    const initialMethod: DepositMethod = tx.cash_location?.kind === 'bank' ? 'transfer' : 'langsung'
    setEditingTx(tx)
    setEditMethod(initialMethod)
    setEditLocation(tx.cash_location_id)
    setConfirmDelete(false)
  }

  const closeActionModal = () => {
    if (updateDepositMethod.isPending || deleteDeposit.isPending) return
    setEditingTx(null)
    setConfirmDelete(false)
  }

  const handleSelectEditMethod = (method: DepositMethod) => {
    setEditMethod(method)
    const kind = method === 'transfer' ? 'bank' : 'cash'
    const opts = locations.filter((l) => l.scope === 'pusat' && l.is_active !== false && l.kind === kind)
    if (editingTx && editingTx.cash_location?.kind === kind) {
      setEditLocation(editingTx.cash_location_id)
    } else {
      setEditLocation(opts[0]?.id ?? '')
    }
  }

  const handleUpdateMethod = () => {
    if (!editingTx) return
    if (!editLocation) {
      toast.error('Pilih rekening atau kas tujuan terlebih dahulu')
      return
    }
    updateDepositMethod.mutate(
      { id: editingTx.id, newLocationId: editLocation },
      {
        onSuccess: (res) => {
          toast.success(`Metode setoran berhasil diubah ke ${res.locationLabel}!`)
          setEditingTx(null)
          setConfirmDelete(false)
        },
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  const handleDeleteTx = () => {
    if (!editingTx) return
    deleteDeposit.mutate(editingTx.id, {
      onSuccess: () => {
        toast.success('Data transaksi setoran berhasil dihapus!')
        setEditingTx(null)
        setConfirmDelete(false)
      },
      onError: (e: unknown) => toast.error((e as Error).message),
    })
  }

  const reset = () => {
    setOutletId('')
    setAmount('')
    setNote('')
    setProofFile(null)
  }

  const handleSubmit = () => {
    const amt = Number(amount)
    if (!outletId) {
      toast.error('Pilih outlet asal setoran')
      return
    }
    if (!location) {
      toast.error('Pilih rekening atau kas tujuan')
      return
    }
    if (!amt || amt <= 0) {
      toast.error('Nominal harus lebih dari 0')
      return
    }
    
    if (outletId && amt !== expectedCash && !note.trim()) {
      toast.error('Nominal fisik berbeda dengan estimasi POS. Wajib mengisi kolom Catatan!')
      return
    }

    setShowConfirmModal(true)
  }

  const executeDeposit = () => {
    const amt = Number(amount)
    deposit.mutate(
      { location, amount: amt, outletId: outletId || null, note: note.trim() || null, proofFile, salesDate },
      {
        onSuccess: () => { 
          const destinationLabel = selectedLocation?.label ?? (depositMethod === 'transfer' ? 'rekening bank pusat' : 'kas pusat')
          toast.success(`Setoran berhasil dicatat & masuk ${destinationLabel}!`)
          setShowConfirmModal(false)
          reset() 
        },
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-suka-orange font-bold uppercase tracking-wider text-sm mb-1">Arus Kas</p>
          <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide">Setoran Penjualan</h1>
          <p className="text-suka-ink/60 mt-2 font-medium">
            Pencatatan setoran dari outlet: <b>Transfer Bank</b> (ATM CDM / M-Banking) atau <b>Setor Langsung</b> (Uang Tunai).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total Rekening Bank" value={rupiah(summary.totalBank)} icon={<Landmark size={22} />} tone="blue" hint="Saldo rekening bank aktif" />
        <StatCard label="Total Kas Fisik Kantor" value={rupiah(summary.totalCash)} icon={<Banknote size={22} />} tone="orange" hint="Saldo kas fisik tunai" />
      </div>

      <SectionCard title="Catat Setoran Baru">
        {locations.length === 0 ? (
          <p className="py-4 text-center text-amber-600">
            Belum ada rekening atau lokasi kas. Buat dulu di <Link href="/lokasi" className="underline">Rekening &amp; Kas</Link>.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Pilihan Metode: Transfer vs Setor Langsung */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-suka-gray-500 mb-2 block">
                Metode Setoran
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDepositMethod('transfer')}
                  className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    depositMethod === 'transfer'
                      ? 'border-suka-orange bg-orange-50/60 shadow-sm ring-1 ring-suka-orange/20'
                      : 'border-suka-gray-200 bg-white hover:border-suka-gray-300 hover:bg-suka-gray-50'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    depositMethod === 'transfer' ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-500'
                  }`}>
                    <Landmark size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold text-sm ${depositMethod === 'transfer' ? 'text-suka-brown' : 'text-suka-ink'}`}>
                      Transfer Bank / ATM CDM
                    </p>
                    <p className="text-xs text-suka-gray-500 truncate mt-0.5">
                      Disetor via transfer atau mesin ATM setor tunai
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositMethod('langsung')}
                  className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    depositMethod === 'langsung'
                      ? 'border-suka-orange bg-orange-50/60 shadow-sm ring-1 ring-suka-orange/20'
                      : 'border-suka-gray-200 bg-white hover:border-suka-gray-300 hover:bg-suka-gray-50'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    depositMethod === 'langsung' ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-500'
                  }`}>
                    <Banknote size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold text-sm ${depositMethod === 'langsung' ? 'text-suka-brown' : 'text-suka-ink'}`}>
                      Setor Langsung (Tunai Fisik)
                    </p>
                    <p className="text-xs text-suka-gray-500 truncate mt-0.5">
                      Uang tunai diserahkan langsung ke kasir kantor
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Input Form */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-suka-gray-600">
                Outlet Asal <span className="text-red-500">*</span>
                <select value={outletId} onChange={(e) => setOutletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange bg-white">
                  <option value="">— pilih outlet asal —</option>
                  {outlets.filter((o) => !isExcludedOutlet(o.name)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>

              <label className="text-sm font-semibold text-suka-gray-600">
                {depositMethod === 'transfer' ? 'Rekening Bank Tujuan' : 'Kas Fisik Penerima'}
                <select 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange bg-white"
                >
                  {destinationOptions.length === 0 && (
                    <option value="">— belum ada {depositMethod === 'transfer' ? 'rekening bank' : 'kas'} pusat aktif —</option>
                  )}
                  {destinationOptions.map((l) => (
                    <option key={l.id} value={l.id}>{l.label} · Saldo: {rupiah(l.saldo)}</option>
                  ))}
                </select>
              </label>
              
              {outletId && (
                <div className="sm:col-span-2 rounded-xl bg-amber-50 p-4 border border-amber-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-amber-800 font-medium">Estimasi Penjualan Tunai POS</p>
                      <div className="text-2xl font-bold text-amber-900 mt-1">
                        {isLoadingExpected ? <Spinner size={20} /> : rupiah(expectedCash)}
                      </div>
                    </div>
                    <label className="text-sm font-semibold text-amber-800 shrink-0">
                      Tanggal Penjualan
                      <input type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)}
                        className="ml-2 rounded-lg border border-amber-300 px-2 py-1 outline-none focus:border-amber-500 bg-white" />
                    </label>
                  </div>
                  {amount && Number(amount) !== expectedCash && (
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      ⚠️ Terdapat selisih antara nominal setoran dengan estimasi POS. Harap jelaskan alasannya di kolom Catatan.
                    </p>
                  )}
                </div>
              )}

              <div className="text-sm font-semibold text-suka-gray-600">
                <CurrencyInput
                  label="Nominal Setoran (Rp)"
                  value={amount}
                  onChange={(v) => setAmount(String(v || ''))}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
                />
              </div>

              <label className="text-sm font-semibold text-suka-gray-600">
                {depositMethod === 'transfer' ? 'Bukti Transfer / Struk ATM (opsional)' : 'Bukti Serah Terima Tunai (opsional)'}
                <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-suka-cream file:px-3 file:py-1 file:text-suka-brown" />
              </label>

              <label className="text-sm font-semibold text-suka-gray-600 sm:col-span-2">
                Catatan
                <input 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  placeholder={depositMethod === 'transfer' ? 'mis. Transfer m-banking closing shift malam' : 'mis. Uang tunai diserahkan langsung ke kasir kantor'}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" 
                />
              </label>
            </div>

            <div className="mt-4">
              <Button onClick={handleSubmit} disabled={deposit.isPending}>
                {deposit.isPending ? <Spinner size={16} /> : 'Catat Setoran'}
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Setoran Terbaru" action={<Link href="/setoran/history" className="text-sm font-medium text-suka-orange hover:underline">Lihat Riwayat Lengkap &rarr;</Link>}>
        {deposits.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">Belum ada setoran.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  <th className="py-2 px-3">Waktu</th>
                  <th className="py-2 px-3">Metode &amp; Akun</th>
                  <th className="py-2 px-3">Outlet Asal</th>
                  <th className="py-2 px-3 text-right">Nominal</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {deposits.map((t) => (
                  <tr key={t.id} className="hover:bg-suka-gray-50/50 transition-colors">
                    <td className="py-3 px-3 text-suka-gray-500">{tanggalWaktu(t.occurred_at)}</td>
                    <td className="py-3 px-3">
                      {t.cash_location?.kind === 'bank' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Landmark size={12} /> Transfer Bank
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Banknote size={12} /> Setor Langsung
                        </span>
                      )}
                      <p className="text-[11px] text-suka-gray-500 mt-1 truncate font-medium">
                        {t.cash_location?.label ?? '—'}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-suka-gray-500 font-medium">{t.outlet?.name ?? '—'}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600">+{rupiah(t.amount)}</td>
                    <td className="py-3 px-3"><TxStatusBadge status={t.status} /></td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => openActionModal(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream/70 hover:bg-suka-orange hover:text-white border border-suka-brown/10 transition-colors cursor-pointer"
                      >
                        <Pencil size={13} /> Action
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Modal Action: Edit Metode Setoran & Hapus Transaksi */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-suka-gray-100">
              <div>
                <h3 className="text-lg font-bold text-suka-brown">Kelola Transaksi Setoran</h3>
                <p className="text-xs text-suka-gray-500">Edit metode setoran atau hapus data transaksi</p>
              </div>
              <button
                type="button"
                onClick={closeActionModal}
                className="p-1.5 rounded-lg text-suka-gray-400 hover:text-suka-ink hover:bg-suka-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Info Transaksi */}
              <div className="bg-suka-cream/50 rounded-xl p-3.5 border border-suka-brown/10 text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-suka-gray-500">Outlet Asal:</span>
                  <span className="font-bold text-suka-ink text-right">{editingTx.outlet?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-suka-gray-500">Waktu:</span>
                  <span className="font-semibold text-suka-gray-700">{tanggalWaktu(editingTx.occurred_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-suka-gray-500">Nominal Setoran:</span>
                  <span className="font-bold text-emerald-600 text-sm">+{rupiah(editingTx.amount)}</span>
                </div>
                <div className="flex justify-between gap-2 pt-1 border-t border-suka-brown/10">
                  <span className="text-suka-gray-500">Metode &amp; Akun Saat Ini:</span>
                  <span className="font-bold text-suka-brown text-right">
                    {editingTx.cash_location?.kind === 'bank' ? '🏦 Transfer Bank' : '💵 Setor Langsung'} ({editingTx.cash_location?.label ?? '—'})
                  </span>
                </div>
              </div>

              {/* Bagian Edit Metode Setoran */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-suka-gray-500 block">
                  Edit Metode Setoran
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectEditMethod('transfer')}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      editMethod === 'transfer'
                        ? 'border-suka-orange bg-orange-50/60 shadow-sm'
                        : 'border-suka-gray-200 bg-white hover:border-suka-gray-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      editMethod === 'transfer' ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-500'
                    }`}>
                      <Landmark size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-bold text-xs ${editMethod === 'transfer' ? 'text-suka-brown' : 'text-suka-ink'}`}>
                        Transfer Bank
                      </p>
                      <p className="text-[11px] text-suka-gray-500 truncate">ATM CDM / M-Banking</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectEditMethod('langsung')}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      editMethod === 'langsung'
                        ? 'border-suka-orange bg-orange-50/60 shadow-sm'
                        : 'border-suka-gray-200 bg-white hover:border-suka-gray-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      editMethod === 'langsung' ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-gray-500'
                    }`}>
                      <Banknote size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-bold text-xs ${editMethod === 'langsung' ? 'text-suka-brown' : 'text-suka-ink'}`}>
                        Setor Langsung
                      </p>
                      <p className="text-[11px] text-suka-gray-500 truncate">Tunai Fisik Kantor</p>
                    </div>
                  </button>
                </div>

                <label className="text-xs font-semibold text-suka-gray-600 block">
                  {editMethod === 'transfer' ? 'Rekening Bank Tujuan' : 'Kas Fisik Penerima'}
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white"
                  >
                    {editDestinationOptions.length === 0 && (
                      <option value="">— belum ada {editMethod === 'transfer' ? 'rekening bank' : 'kas'} pusat aktif —</option>
                    )}
                    {editDestinationOptions.map((l) => (
                      <option key={l.id} value={l.id}>{l.label} · Saldo: {rupiah(l.saldo)}</option>
                    ))}
                  </select>
                </label>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleUpdateMethod}
                    disabled={
                      updateDepositMethod.isPending ||
                      deleteDeposit.isPending ||
                      !editLocation ||
                      editLocation === editingTx.cash_location_id
                    }
                  >
                    {updateDepositMethod.isPending ? <Spinner size={16} /> : 'Simpan Metode Setoran'}
                  </Button>
                </div>
              </div>

              {/* Bagian Hapus Data Transaksi */}
              <div className="pt-4 border-t border-suka-gray-100">
                <label className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2 block">
                  Hapus Data Transaksi
                </label>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={updateDepositMethod.isPending || deleteDeposit.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} /> Hapus Data Transaksi Ini
                  </button>
                ) : (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 space-y-3">
                    <p className="text-xs text-red-800 leading-relaxed">
                      Anda yakin ingin menghapus transaksi setoran dari <b>{editingTx.outlet?.name ?? 'Outlet'}</b> sebesar <b>{rupiah(editingTx.amount)}</b>? Saldo pada <b>{editingTx.cash_location?.label ?? 'akun tujuan'}</b> akan otomatis dikurangi kembali.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleteDeposit.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-suka-gray-600 bg-white border border-suka-gray-200 hover:bg-suka-gray-50 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteTx}
                        disabled={deleteDeposit.isPending}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        {deleteDeposit.isPending ? <Spinner size={14} /> : <Trash2 size={14} />}
                        Ya, Hapus Permanen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-suka-brown mb-2">Konfirmasi Setoran</h3>
              <p className="text-suka-gray-600 mb-3">
                Anda yakin ingin mencatat setoran sebesar <span className="font-bold text-suka-ink">{rupiah(Number(amount))}</span>?
              </p>
              
              <div className="bg-suka-cream/50 rounded-xl p-3 border border-suka-brown/10 text-xs space-y-1.5 mb-4">
                <div className="flex justify-between">
                  <span className="text-suka-gray-500">Metode:</span>
                  <span className="font-bold text-suka-brown">
                    {depositMethod === 'transfer' ? '💳 Transfer Bank / ATM CDM' : '💵 Setor Langsung (Tunai)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-suka-gray-500">Tujuan:</span>
                  <span className="font-bold text-suka-ink">{selectedLocation?.label}</span>
                </div>
              </div>

              <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-xs border border-amber-100">
                ⚠️ Pastikan dana sudah valid (cek mutasi bank jika transfer/ATM CDM, atau hitung fisik jika diserahkan tunai).
              </div>
            </div>
            <div className="bg-suka-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-suka-gray-100">
              <Button 
                variant="secondary" 
                onClick={() => setShowConfirmModal(false)}
                className="bg-white border-suka-gray-200 text-suka-gray-600 hover:bg-suka-gray-100"
              >
                Batal
              </Button>
              <Button onClick={executeDeposit} disabled={deposit.isPending}>
                {deposit.isPending ? <Spinner size={16} /> : 'Ya, Catat Setoran'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
