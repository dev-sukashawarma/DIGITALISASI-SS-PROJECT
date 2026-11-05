'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { X, Edit2, Plus, ChevronDown } from 'lucide-react'
import { useCashMutations } from '@/hooks/useCashMutations'
import { rupiah } from '@/lib/format'
import { GRUP_LABEL, URUTAN_GRUP, type GrupKas } from '@/lib/kas/grupKas'
import type { CashKind, LocationWithBalance } from '@/lib/types'

const inputCls =
  'mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

type Form = { id: string | null; grup: GrupKas | ''; kind: CashKind; label: string; bank: string; noRek: string; holder: string }
const KOSONG: Form = { id: null, grup: '', kind: 'bank', label: '', bank: '', noRek: '', holder: '' }

/** Tambah/edit rekening pusat. Rekening baru wajib masuk salah satu dari 3 kelompok kas. */
export function KelolaRekeningModal({ locations, onClose }: { locations: LocationWithBalance[]; onClose: () => void }) {
  const { createLocation, updateLocation } = useCashMutations()
  const [form, setForm] = useState<Form | null>(null)
  const [lainTerbuka, setLainTerbuka] = useState(false)

  const pusat = locations.filter(l => l.grup && l.is_active)
  const lain = locations.filter(l => !(l.grup && l.is_active))
  const sibuk = createLocation.isPending || updateLocation.isPending

  function simpan() {
    if (!form) return
    if (!form.label.trim()) { toast.error('Nama rekening wajib diisi'); return }
    if (!form.id && !form.grup) { toast.error('Pilih kelompok rekening'); return }
    const payload = {
      label: form.label.trim(),
      kind: form.kind,
      bank_name: form.kind === 'bank' ? form.bank.trim() || null : null,
      account_no: form.kind === 'bank' ? form.noRek.trim() || null : null,
      holder_name: form.holder.trim() || null,
    }
    const selesai = {
      onSuccess: () => { toast.success(form.id ? 'Rekening diperbarui' : 'Rekening ditambahkan'); setForm(null) },
      onError: (e: unknown) => toast.error((e as Error).message),
    }
    if (form.id) updateLocation.mutate({ id: form.id, ...payload }, selesai)
    else createLocation.mutate({ ...payload, grup: form.grup as GrupKas }, selesai)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-suka-gray-100 pb-3">
          <h3 className="text-lg font-bold text-suka-ink">Kelola Rekening</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-suka-gray-400 hover:bg-suka-gray-100 hover:text-suka-ink"><X size={20} /></button>
        </div>

        {URUTAN_GRUP.map(g => {
          const isi = pusat.filter(l => l.grup === g)
          return (
            <div key={g} className="mb-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-suka-orange">{GRUP_LABEL[g]}</p>
              {isi.length === 0 ? <p className="text-sm text-suka-gray-400">Belum ada.</p> : isi.map(l => (
                <div key={l.id} className="flex items-center justify-between border-b border-suka-gray-50 py-2 text-sm">
                  <div>
                    <span className="font-semibold text-suka-ink">{l.label}</span>
                    <span className="ml-2 text-xs text-suka-gray-400">
                      {l.kind === 'bank' ? `Bank${l.bank_name ? ` ${l.bank_name}` : ''}${l.account_no ? ` · ${l.account_no}` : ''}` : 'Tunai'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${l.saldo < 0 ? 'text-red-600' : 'text-suka-ink'}`}>{rupiah(l.saldo)}</span>
                    <button
                      title="Edit"
                      onClick={() => setForm({ id: l.id, grup: l.grup as GrupKas, kind: l.kind, label: l.label, bank: l.bank_name ?? '', noRek: l.account_no ?? '', holder: l.holder_name ?? '' })}
                      className="rounded-lg p-1.5 text-suka-gray-400 hover:bg-suka-orange/10 hover:text-suka-orange"
                    ><Edit2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {form ? (
          <div className="mt-2 rounded-xl border border-suka-gray-200 p-4">
            <p className="mb-3 font-bold text-suka-ink">{form.id ? 'Edit rekening' : 'Rekening baru'}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-suka-gray-600">
                Kelompok
                <select className={inputCls} value={form.grup} disabled={Boolean(form.id)}
                  onChange={e => setForm({ ...form, grup: e.target.value as GrupKas })}>
                  <option value="">— pilih —</option>
                  {URUTAN_GRUP.map(g => <option key={g} value={g}>{GRUP_LABEL[g]}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-suka-gray-600">
                Jenis
                <select className={inputCls} value={form.kind} disabled={Boolean(form.id)}
                  onChange={e => setForm({ ...form, kind: e.target.value as CashKind })}>
                  <option value="bank">Bank</option>
                  <option value="cash">Tunai</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-suka-gray-600 sm:col-span-2">
                Nama rekening
                <input className={inputCls} value={form.label} placeholder="mis. Rekening Petty Cash 0955381004"
                  onChange={e => setForm({ ...form, label: e.target.value })} />
              </label>
              {form.kind === 'bank' && (
                <>
                  <label className="text-sm font-semibold text-suka-gray-600">
                    Nama bank
                    <input className={inputCls} value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} />
                  </label>
                  <label className="text-sm font-semibold text-suka-gray-600">
                    No. rekening
                    <input className={inputCls} value={form.noRek} onChange={e => setForm({ ...form, noRek: e.target.value })} />
                  </label>
                </>
              )}
              <label className="text-sm font-semibold text-suka-gray-600 sm:col-span-2">
                Atas nama
                <input className={inputCls} value={form.holder} onChange={e => setForm({ ...form, holder: e.target.value })} />
              </label>
            </div>
            {form.id && <p className="mt-2 text-xs text-suka-gray-400">Kelompok dan jenis tidak bisa diubah setelah rekening dibuat.</p>}
            <div className="mt-4 flex gap-2">
              <Button onClick={simpan} disabled={sibuk}>{sibuk ? <Spinner size={16} /> : 'Simpan'}</Button>
              <Button onClick={() => setForm(null)} className="border-suka-gray-200 bg-white text-suka-ink hover:bg-suka-gray-50">Batal</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setForm(KOSONG)}
            className="inline-flex items-center gap-2 rounded-full bg-suka-orange px-4 py-2 text-sm font-bold text-white hover:bg-suka-orange/90">
            <Plus size={16} /> Tambah rekening
          </button>
        )}

        {lain.length > 0 && (
          <div className="mt-6 border-t border-suka-gray-100 pt-3">
            <button onClick={() => setLainTerbuka(v => !v)} className="flex items-center gap-1 text-sm font-semibold text-suka-gray-500">
              <ChevronDown size={16} className={lainTerbuka ? 'rotate-180' : ''} />
              Kas kecil outlet & rekening nonaktif ({lain.length})
            </button>
            {lainTerbuka && (
              <div className="mt-2">
                <p className="mb-2 text-xs text-suka-gray-400">Tidak dihitung dalam saldo kas pusat.</p>
                {lain.map(l => (
                  <div key={l.id} className="flex items-center justify-between py-1.5 text-sm text-suka-gray-500">
                    <span>{l.label}{l.is_active ? '' : ' (nonaktif)'}</span>
                    <span>{rupiah(l.saldo)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
