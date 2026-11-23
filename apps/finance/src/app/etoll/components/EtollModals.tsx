'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, CreditCard, ArrowRightLeft, Tag, MapPin, Clock, CheckCircle2 } from 'lucide-react'
import { Button, CurrencyInput, Spinner } from '@suka/design-system'
import {
  ETOLL_CATEGORY_LABELS,
  ETOLL_ISSUER_LABELS,
  ETOLL_TAGGABLE_CATEGORIES,
  type EtollCard,
  type EtollCategory,
  type EtollIssuer,
  type EtollTransaction,
} from '@/lib/etoll/types'
import { formatCardNumber } from '@/lib/etoll/reconcile'
import { rupiah, tanggalWaktu } from '@/lib/format'
import {
  useCreateEtollCard,
  useEtollCardDetail,
  useTagEtollTransaction,
  useUpdateEtollCard,
} from '@/hooks/useEtoll'

const inputCls =
  'mt-1 w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2 text-sm text-suka-brown outline-none focus:border-suka-orange'

interface RefData {
  staff: { id: string; name: string; role: string }[]
  outlets: { id: string; name: string }[]
}

export function RegisterCardModal({
  open,
  onClose,
  refData,
}: {
  open: boolean
  onClose: () => void
  refData?: RefData
}) {
  const createCard = useCreateEtollCard()
  const [cardNumber, setCardNumber] = useState('')
  const [issuer, setIssuer] = useState<EtollIssuer>('mandiri_emoney')
  const [label, setLabel] = useState('')
  const [holderId, setHolderId] = useState('')
  const [outletId, setOutletId] = useState('')
  const [division, setDivision] = useState('Distribusi')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [initialBalance, setInitialBalance] = useState(0)
  const [notes, setNotes] = useState('')

  if (!open) return null

  const submit = () => {
    createCard.mutate(
      {
        card_number: cardNumber,
        issuer,
        label,
        holder_staff_id: holderId || null,
        outlet_id: outletId || null,
        division: division || null,
        vehicle_plate: vehiclePlate || null,
        initial_balance: initialBalance,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success('Kartu e-Toll berhasil didaftarkan')
          setCardNumber('')
          setLabel('')
          setHolderId('')
          setOutletId('')
          setVehiclePlate('')
          setInitialBalance(0)
          setNotes('')
          onClose()
        },
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-suka-brown/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-suka-brown/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-suka-orange" />
            <h2 className="text-base font-black text-suka-brown">Daftarkan Kartu e-Toll Baru</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-suka-gray-400 hover:bg-suka-gray-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-suka-gray-600">
              Bank Penerbit *
              <select
                value={issuer}
                onChange={(e) => setIssuer(e.target.value as EtollIssuer)}
                className={inputCls}
              >
                {(Object.keys(ETOLL_ISSUER_LABELS) as EtollIssuer[]).map((k) => (
                  <option key={k} value={k}>
                    {ETOLL_ISSUER_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-suka-gray-600">
              Nomor Kartu (16 digit) *
              <input
                type="text"
                placeholder="6032 9820 xxxx xxxx"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <label className="block text-xs font-bold text-suka-gray-600">
            Label / Nama Kartu *
            <input
              type="text"
              placeholder="Contoh: e-Money GrandMax 01 / Flazz Area Manager Barat"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-suka-gray-600">
              Pemegang Aktif (Staff)
              <select value={holderId} onChange={(e) => setHolderId(e.target.value)} className={inputCls}>
                <option value="">-- Belum Di-assign --</option>
                {(refData?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-suka-gray-600">
              Plat Kendaraan (Opsional)
              <input
                type="text"
                placeholder="B 1234 XYZ"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-suka-gray-600">
              Divisi
              <input
                type="text"
                placeholder="Distribusi / Operasional / Kantor"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="text-xs font-bold text-suka-gray-600">
              Cabang / Outlet (Opsional)
              <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className={inputCls}>
                <option value="">Kantor Pusat / Umum</option>
                {(refData?.outlets ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="text-xs font-bold text-suka-gray-600">
            Saldo Awal Estimasi (Opsional — akan terupdate otomatis saat scan NFC pertama)
            <div className="mt-1">
              <CurrencyInput value={initialBalance} onChange={setInitialBalance} />
            </div>
          </div>

          <label className="block text-xs font-bold text-suka-gray-600">
            Catatan
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan internal kartu..."
              className={inputCls}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-suka-brown/10 px-5 py-3.5">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            size="sm"
            disabled={createCard.isPending || !cardNumber.trim() || !label.trim()}
            onClick={submit}
          >
            {createCard.isPending ? 'Menyimpan...' : 'Simpan Kartu'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CardDetailHandoverModal({
  card,
  onClose,
  refData,
}: {
  card: EtollCard | null
  onClose: () => void
  refData?: RefData
}) {
  const detail = useEtollCardDetail(card?.id ?? null)
  const updateCard = useUpdateEtollCard()

  const [label, setLabel] = useState(card?.label ?? '')
  const [holderId, setHolderId] = useState(card?.holder_staff_id ?? '')
  const [outletId, setOutletId] = useState(card?.outlet_id ?? '')
  const [division, setDivision] = useState(card?.division ?? '')
  const [vehiclePlate, setVehiclePlate] = useState(card?.vehicle_plate ?? '')
  const [status, setStatus] = useState<'active' | 'inactive' | 'lost'>(card?.status ?? 'active')
  const [handoverNote, setHandoverNote] = useState('')

  if (!card) return null

  const saveChanges = () => {
    updateCard.mutate(
      {
        id: card.id,
        label,
        status,
        holder_staff_id: holderId || null,
        outlet_id: outletId || null,
        division: division || null,
        vehicle_plate: vehiclePlate || null,
        handover_note: handoverNote || null,
      },
      {
        onSuccess: (res) => {
          toast.success(
            res.handover_recorded
              ? 'Kartu diperbarui & riwayat serah-terima tercatat'
              : 'Info kartu berhasil diperbarui',
          )
          setHandoverNote('')
        },
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-suka-brown/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-suka-brown/10 px-5 py-4">
          <div>
            <h2 className="text-base font-black text-suka-brown">{card.label}</h2>
            <p className="font-mono text-xs text-suka-gray-500">
              {ETOLL_ISSUER_LABELS[card.issuer]} · {formatCardNumber(card.card_number)} · Saldo Terakhir:{' '}
              <span className="font-bold text-suka-brown">{rupiah(card.last_balance)}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-suka-gray-400 hover:bg-suka-gray-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[78vh] space-y-5 overflow-y-auto p-5">
          {/* Edit & Serah-Terima */}
          <div className="rounded-xl border border-suka-brown/10 bg-suka-cream/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-suka-brown">
              <ArrowRightLeft className="h-4 w-4 text-suka-orange" />
              Edit Info & Serah-Terima Pemegang
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-suka-gray-600">
                Label Kartu
                <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Status Kartu
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'lost')}
                  className={inputCls}
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                  <option value="lost">Hilang / Diblokir</option>
                </select>
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Pemegang Aktif
                <select value={holderId} onChange={(e) => setHolderId(e.target.value)} className={inputCls}>
                  <option value="">-- Tanpa Pemegang (Pool) --</option>
                  {(refData?.staff ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Plat Kendaraan
                <input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Divisi
                <input value={division} onChange={(e) => setDivision(e.target.value)} className={inputCls} />
              </label>
              <label className="text-xs font-bold text-suka-gray-600">
                Outlet / Cabang
                <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className={inputCls}>
                  <option value="">Kantor Pusat / Umum</option>
                  {(refData?.outlets ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs font-bold text-suka-gray-600">
              Catatan Serah-Terima (jika mengganti pemegang/plat)
              <input
                placeholder="Misal: Diserahkan ke driver pengganti shift sore"
                value={handoverNote}
                onChange={(e) => setHandoverNote(e.target.value)}
                className={inputCls}
              />
            </label>
            <div className="mt-3 flex justify-end">
              <Button size="sm" disabled={updateCard.isPending} onClick={saveChanges}>
                {updateCard.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </div>

          {detail.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Riwayat Serah-Terima */}
              <div>
                <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-suka-gray-500">
                  Riwayat Serah-Terima ({detail.data?.assignments.length ?? 0})
                </h3>
                {(detail.data?.assignments.length ?? 0) === 0 ? (
                  <p className="text-xs text-suka-gray-400">Belum ada riwayat serah-terima.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.data?.assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-suka-gray-100 bg-white px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-suka-brown">
                            {a.from_staff?.name ?? 'Awal/Pool'} → {a.to_staff?.name ?? 'Pool'}
                          </span>
                          {(a.from_vehicle_plate || a.to_vehicle_plate) && (
                            <span className="ml-2 text-suka-gray-500">
                              ({a.from_vehicle_plate ?? '-'} → {a.to_vehicle_plate ?? '-'})
                            </span>
                          )}
                          {a.note && <p className="text-suka-gray-500">{a.note}</p>}
                        </div>
                        <div className="text-right text-[11px] text-suka-gray-400">
                          <div>{tanggalWaktu(a.assigned_at)}</div>
                          {a.balance_at_handover != null && (
                            <div className="font-semibold text-suka-brown">
                              Saldo: {rupiah(a.balance_at_handover)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Log Scan NFC Terakhir */}
              <div>
                <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-suka-gray-500">
                  Log Scan NFC Terakhir ({detail.data?.scans.length ?? 0})
                </h3>
                {(detail.data?.scans.length ?? 0) === 0 ? (
                  <p className="text-xs text-suka-gray-400">Kartu ini belum pernah di-scan lewat NFC.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.data?.scans.slice(0, 10).map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-suka-gray-100 px-3 py-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-suka-brown">
                            <Clock className="h-3.5 w-3.5 text-suka-orange" />
                            {tanggalWaktu(s.scanned_at)} · oleh {s.scanner?.name ?? '-'}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-suka-gray-500">
                            <span>Chip: {s.chip_records_found} rec ({s.new_transactions_count} baru)</span>
                            {s.untracked_gap_amount !== 0 && (
                              <span className="font-bold text-red-600">
                                Selisih: {rupiah(s.untracked_gap_amount)}
                              </span>
                            )}
                            {s.gps_lat != null && s.gps_lng != null && (
                              <a
                                href={`https://maps.google.com/?q=${s.gps_lat},${s.gps_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                              >
                                <MapPin className="h-3 w-3" />
                                Lokasi GPS
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs font-bold text-suka-brown">
                          {s.balance_before != null ? `${rupiah(s.balance_before)} → ` : ''}
                          {rupiah(s.balance_after)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function TagTransactionModal({
  tx,
  onClose,
}: {
  tx: EtollTransaction | null
  onClose: () => void
}) {
  const tagTx = useTagEtollTransaction()
  const [category, setCategory] = useState<EtollCategory>(
    tx?.category && tx.category !== 'belum_dikategorikan' ? tx.category : 'tol',
  )
  const [merchantLabel, setMerchantLabel] = useState(tx?.merchant_label ?? '')
  const [note, setNote] = useState(tx?.note ?? '')
  const [saveToDictionary, setSaveToDictionary] = useState(Boolean(tx?.terminal_code))

  if (!tx) return null

  const submit = () => {
    tagTx.mutate(
      {
        id: tx.id,
        category,
        merchant_label: merchantLabel.trim() || undefined,
        note: note.trim(),
        save_to_dictionary: Boolean(tx.terminal_code) && saveToDictionary,
      },
      {
        onSuccess: (res) => {
          toast.success(
            res.dictionary_saved
              ? 'Label disimpan & kode terminal diajarkan ke Kamus!'
              : 'Label transaksi berhasil diperbarui',
          )
          onClose()
        },
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-suka-brown/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-suka-brown/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-suka-orange" />
            <h2 className="text-base font-black text-suka-brown">Beri Label & Audit Transaksi</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-suka-gray-400 hover:bg-suka-gray-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="rounded-xl bg-suka-cream/60 p-3 text-xs">
            <div className="flex justify-between font-bold text-suka-brown">
              <span>{tx.card?.label ?? 'Kartu e-Toll'}</span>
              <span>{rupiah(tx.amount)}</span>
            </div>
            <div className="mt-1 flex justify-between text-suka-gray-500">
              <span>{tanggalWaktu(tx.occurred_at)}</span>
              {tx.terminal_code && <span className="font-mono">Kode: {tx.terminal_code}</span>}
            </div>
          </div>

          <label className="block text-xs font-bold text-suka-gray-600">
            Kategori Pemakaian
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as EtollCategory)}
              className={inputCls}
            >
              {ETOLL_TAGGABLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ETOLL_CATEGORY_LABELS[c]}
                </option>
              ))}
              {tx.tx_type === 'topup' && <option value="topup">Top-Up</option>}
              {tx.source === 'untracked_gap' && (
                <option value="untracked_gap">Selisih Tak Terlacak</option>
              )}
            </select>
          </label>

          <label className="block text-xs font-bold text-suka-gray-600">
            Nama Gerbang Tol / Lokasi / Merchant
            <input
              type="text"
              placeholder="Contoh: GT Cikarang Barat / Parkir Mall Bekasi"
              value={merchantLabel}
              onChange={(e) => setMerchantLabel(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="block text-xs font-bold text-suka-gray-600">
            Catatan Operasional
            <textarea
              rows={2}
              placeholder="Misal: Pengiriman bahan baku ke Outlet Bekasi Timur"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
            />
          </label>

          {tx.terminal_code && (
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
              <input
                type="checkbox"
                checked={saveToDictionary}
                onChange={(e) => setSaveToDictionary(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span>
                <span className="inline-flex items-center gap-1 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ajarkan ke Kamus Kode Terminal
                </span>
                <span className="block text-[11px] text-emerald-800/80">
                  Simpan kode <span className="font-mono font-bold">{tx.terminal_code}</span> agar
                  scan berikutnya otomatis terlabel &amp; transaksi lama ikut terupdate.
                </span>
              </span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-suka-brown/10 px-5 py-3.5">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" disabled={tagTx.isPending} onClick={submit}>
            {tagTx.isPending ? 'Menyimpan...' : 'Simpan Label'}
          </Button>
        </div>
      </div>
    </div>
  )
}
