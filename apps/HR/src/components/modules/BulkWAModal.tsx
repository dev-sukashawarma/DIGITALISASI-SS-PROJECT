'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Send,
  Settings,
  RefreshCw,
  X,
  Phone,
  AlertTriangle,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import type { PayrollRecord } from '@/lib/types'
import { formatPhoneDisplay } from '@/lib/waha'
import { formatRupiah, formatBulanIndonesia } from '@/lib/format'
import { sendBulkWahaSalarySlips, getWahaStatus, type BulkSendSummary } from '@/app/actions/waha'

interface BulkWAModalProps {
  records: PayrollRecord[]
  month: number
  year: number
  onClose: () => void
}

export function BulkWAModal({ records, month, year, onClose }: BulkWAModalProps) {
  // Selected IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(records.filter((r) => !!r.outlet_staff?.phone).map((r) => r.id))
  )

  // Custom Note
  const [customNote, setCustomNote] = useState('')

  // WAHA Settings (Advanced)
  const [showSettings, setShowSettings] = useState(false)
  const [wahaBaseUrl, setWahaBaseUrl] = useState('')
  const [wahaSession, setWahaSession] = useState('default')
  const [wahaApiKey, setWahaApiKey] = useState('')
  const [wahaStatus, setWahaStatus] = useState<{ online: boolean; status: string; error?: string } | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Sending state
  const [sending, setSending] = useState(false)
  const [summary, setSummary] = useState<BulkSendSummary | null>(null)

  const periodText = `${formatBulanIndonesia(month)} ${year}`

  // Check WAHA status on mount
  const handleCheckWaha = async () => {
    setCheckingStatus(true)
    try {
      const res = await getWahaStatus({
        baseUrl: wahaBaseUrl || undefined,
        session: wahaSession || undefined,
        apiKey: wahaApiKey || undefined,
      })
      setWahaStatus(res)
      if (res.online) {
        toast.success(`Server WAHA Online (Status: ${res.status})`)
      } else {
        toast.warning(`WAHA merespons: ${res.status}. ${res.error || ''}`)
      }
    } catch (e: any) {
      setWahaStatus({ online: false, status: 'OFFLINE', error: e.message })
    } finally {
      setCheckingStatus(false)
    }
  }

  useEffect(() => {
    handleCheckWaha()
  }, [])

  // Toggle selection
  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllValid = () => {
    const validIds = records.filter((r) => !!r.outlet_staff?.phone).map((r) => r.id)
    setSelectedIds(new Set(validIds))
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  const targetRecords = useMemo(
    () => records.filter((r) => selectedIds.has(r.id)),
    [records, selectedIds]
  )

  const handleStartBroadcast = async () => {
    if (targetRecords.length === 0) {
      toast.error('Pilih minimal 1 karyawan untuk dikirimkan slip gaji.')
      return
    }

    if (
      !confirm(
        `Kirim slip gaji via WhatsApp ke ${targetRecords.length} karyawan terpilih untuk periode ${periodText}?`
      )
    ) {
      return
    }

    setSending(true)
    setSummary(null)

    try {
      const res = await sendBulkWahaSalarySlips(targetRecords, {
        customHeaderNote: customNote || undefined,
        baseUrl: wahaBaseUrl || undefined,
        session: wahaSession || undefined,
        apiKey: wahaApiKey || undefined,
        minDelayMs: 1500,
        maxDelayMs: 3500,
        batchSize: 10,
        batchCooldownMs: 5000,
      })

      setSummary(res)

      if (res.failedCount === 0) {
        toast.success(`Berhasil mengirim seluruh ${res.successCount} slip gaji via WhatsApp!`)
      } else {
        toast.warning(
          `Pengiriman selesai: ${res.successCount} berhasil, ${res.failedCount} gagal. Periksa laporan di bawah.`
        )
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat memproses broadcast WA')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl border border-suka-gray-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 my-8 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-suka-gray-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <MessageSquare size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-suka-brown">Kirim Slip Gaji Massal via WhatsApp</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  WAHA Integration
                </span>
              </div>
              <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                Kirim pesan rincian slip gaji resmi periode <strong>{periodText}</strong> langsung ke WhatsApp staf.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-full p-1.5 text-suka-gray-400 hover:bg-stone-100 hover:text-suka-ink transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* WAHA Server Connection Indicator */}
        <div className="p-3 bg-[#FDF9F3] rounded-2xl border border-suka-brown/10 flex flex-wrap justify-between items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                wahaStatus?.online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="font-bold text-suka-brown">Server WAHA:</span>
            <span
              className={`font-semibold ${
                wahaStatus?.online ? 'text-emerald-700' : 'text-amber-800'
              }`}
            >
              {wahaStatus
                ? `${wahaStatus.online ? 'Terhubung (Online)' : 'Belum Terhubung / Offline'} — ${wahaStatus.status}`
                : 'Mengecek koneksi...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCheckWaha}
              disabled={checkingStatus}
              className="px-2.5 py-1 text-xs rounded-lg font-bold border border-suka-gray-200 hover:bg-white text-suka-brown flex items-center gap-1 transition-all cursor-pointer"
            >
              <RefreshCw size={11} className={checkingStatus ? 'animate-spin' : ''} />
              <span>Tes Koneksi</span>
            </button>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="px-2.5 py-1 text-xs rounded-lg font-bold border border-suka-gray-200 hover:bg-white text-suka-brown flex items-center gap-1 transition-all cursor-pointer"
            >
              <Settings size={11} />
              <span>Konfigurasi WAHA</span>
            </button>
          </div>
        </div>

        {/* Collapsible WAHA Config Drawer */}
        {showSettings && (
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3 text-xs shrink-0 animate-in slide-in-from-top-2">
            <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Settings size={13} className="text-suka-orange" />
              <span>Pengaturan Endpoint WAHA (WhatsApp HTTP API)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-stone-600 mb-1">WAHA Base URL</label>
                <input
                  type="text"
                  value={wahaBaseUrl}
                  onChange={(e) => setWahaBaseUrl(e.target.value)}
                  placeholder="Default: .env / http://localhost:3008"
                  className="w-full rounded-xl border border-stone-300 p-2 text-xs font-mono bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-600 mb-1">Session Name</label>
                <input
                  type="text"
                  value={wahaSession}
                  onChange={(e) => setWahaSession(e.target.value)}
                  placeholder="default"
                  className="w-full rounded-xl border border-stone-300 p-2 text-xs font-mono bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-600 mb-1">API Key (Optional)</label>
                <input
                  type="password"
                  value={wahaApiKey}
                  onChange={(e) => setWahaApiKey(e.target.value)}
                  placeholder="Secret API Key"
                  className="w-full rounded-xl border border-stone-300 p-2 text-xs font-mono bg-white"
                />
              </div>
            </div>
            <p className="text-[10px] text-stone-500">
              *Jika dikosongkan, sistem otomatis menggunakan konfigurasi `WAHA_BASE_URL` dari environment variable server.
            </p>
          </div>
        )}

        {/* Optional Custom Note Header */}
        <div className="shrink-0">
          <label className="block text-xs font-bold text-suka-brown mb-1">
            Pesan Pembuka / Catatan Tambahan (Opsional)
          </label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Contoh: Selamat gajian! Gaji telah ditransfer per tanggal 28. Cek mutasi rekening Anda."
            className="w-full rounded-xl border border-suka-gray-200 px-3.5 py-2 text-xs sm:text-sm font-medium outline-none focus:border-suka-orange"
          />
        </div>

        {/* Selection Bar */}
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-suka-gray-100 pb-2 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleSelectAllValid}
              disabled={sending}
              className="text-xs font-bold text-suka-orange hover:underline cursor-pointer"
            >
              Pilih Semua ({records.filter((r) => !!r.outlet_staff?.phone).length})
            </button>
            <span className="text-gray-300">&bull;</span>
            <button
              onClick={handleDeselectAll}
              disabled={sending}
              className="text-xs font-bold text-gray-500 hover:underline cursor-pointer"
            >
              Hapus Pilihan
            </button>
          </div>
          <span className="text-xs text-suka-gray-500 font-medium">
            <strong>{targetRecords.length}</strong> dari {records.length} staf siap dikirim
          </span>
        </div>

        {/* Employee Table */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-suka-gray-200 min-h-[160px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#FDF9F3] border-b border-suka-gray-200 text-suka-brown font-bold uppercase tracking-wider z-10">
              <tr>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">Nama Karyawan</th>
                <th className="p-3">Outlet &amp; Role</th>
                <th className="p-3">Nomor WhatsApp</th>
                <th className="p-3 text-right">Take Home Pay</th>
                {summary && <th className="p-3 text-center">Status Broadcast</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {records.map((r) => {
                const isSelected = selectedIds.has(r.id)
                const phone = r.outlet_staff?.phone
                const itemResult = summary?.results.find((res) => res.recordId === r.id)

                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-amber-50/20 transition-colors ${
                      !phone ? 'opacity-60 bg-stone-50' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!phone || sending}
                        onChange={() => handleToggle(r.id)}
                        className="w-4 h-4 rounded text-suka-orange focus:ring-suka-orange cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-bold text-suka-ink">
                      {r.outlet_staff?.name || 'Staff'}
                    </td>
                    <td className="p-3 text-gray-600">
                      <div>{r.outlet_staff?.outlets?.name || 'Pusat'}</div>
                      <div className="text-[10px] text-suka-brown font-semibold uppercase">
                        {r.outlet_staff?.role}
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      {phone ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <Phone size={11} />
                          {formatPhoneDisplay(phone)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                          <AlertTriangle size={11} /> Belum ada No HP
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-suka-brown">
                      {formatRupiah(r.total_salary)}
                    </td>
                    {summary && (
                      <td className="p-3 text-center">
                        {itemResult ? (
                          itemResult.success ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={11} /> Terkirim
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200"
                              title={itemResult.error}
                            >
                              <AlertCircle size={11} /> Gagal
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Broadcast Summary Card if finished */}
        {summary && (
          <div className="p-4 bg-stone-50 rounded-2xl border border-suka-gray-200 flex items-center justify-between gap-3 text-xs shrink-0">
            <div>
              <span className="font-extrabold text-suka-ink text-sm block">Laporan Hasil Broadcast:</span>
              <p className="text-stone-600 mt-0.5">
                Total <strong>{summary.total}</strong> diproses &bull;{' '}
                <strong className="text-emerald-600">{summary.successCount} Berhasil</strong> &bull;{' '}
                <strong className="text-red-600">{summary.failedCount} Gagal</strong>
              </p>
            </div>
            {summary.failedCount > 0 && (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200">
                ⚠️ Cek nomor WA staf yang gagal di atas
              </span>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-suka-gray-100 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={sending}
            className="rounded-xl font-bold text-xs"
          >
            Tutup
          </Button>

          <Button
            type="button"
            disabled={sending || targetRecords.length === 0}
            onClick={handleStartBroadcast}
            className="rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 px-6 shadow-md"
          >
            {sending ? (
              <>
                <Spinner size={14} />
                <span>Sedang Mengirim via WAHA...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Kirim {targetRecords.length} Slip Gaji Sekarang</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
