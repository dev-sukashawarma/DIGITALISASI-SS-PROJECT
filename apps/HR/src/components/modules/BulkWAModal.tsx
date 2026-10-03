'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  FileText,
  ShieldCheck,
  Square,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import type { PayrollRecord } from '@/lib/types'
import { formatPhoneDisplay } from '@/lib/waha'
import { formatRupiah, formatBulanIndonesia } from '@/lib/format'
import { sendSingleWahaSalarySlip, getWahaStatus, type SingleWahaSendResult } from '@/app/actions/waha'

interface BulkWAModalProps {
  records: PayrollRecord[]
  month: number
  year: number
  onClose: () => void
}

interface ItemBroadcastState {
  status: 'pending' | 'sending' | 'success' | 'partial' | 'failed'
  message?: string
  warning?: string
  messageId?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const getRandomJitter = (minMs: number, maxMs: number) =>
  Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs

export function BulkWAModal({ records, month, year, onClose }: BulkWAModalProps) {
  // Selected IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(records.filter((r) => !!r.outlet_staff?.phone).map((r) => r.id))
  )

  // Custom Note & PDF Options
  const [customNote, setCustomNote] = useState('')
  const [sendPdfFile, setSendPdfFile] = useState(true)

  // Anti-Ban Engine Settings
  const [antiBanMode, setAntiBanMode] = useState<'safe' | 'standard'>('safe')

  // WAHA Settings (Advanced)
  const [showSettings, setShowSettings] = useState(false)
  const [wahaBaseUrl, setWahaBaseUrl] = useState('')
  const [wahaSession, setWahaSession] = useState('')
  const [wahaApiKey, setWahaApiKey] = useState('')
  const [wahaStatus, setWahaStatus] = useState<{ online: boolean; status: string; error?: string } | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Live Broadcast Progress State
  const [sending, setSending] = useState(false)
  const [activeStaffName, setActiveStaffName] = useState<string>('')
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [cooldownCountdown, setCooldownCountdown] = useState<number | null>(null)
  const [broadcastResults, setBroadcastResults] = useState<Record<string, ItemBroadcastState>>({})
  const abortBroadcastRef = useRef(false)

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

  // Start Client-Orchestrated Anti-Ban Progressive Broadcast
  const handleStartBroadcast = async () => {
    if (targetRecords.length === 0) {
      toast.error('Pilih minimal 1 karyawan untuk dikirimkan slip gaji.')
      return
    }

    const modeText =
      antiBanMode === 'safe'
        ? 'Mode Sangat Aman (Jeda 4-7s acak & Istirahat 15s tiap 6 staf)'
        : 'Mode Standar (Jeda 2.5-4.5s acak & Istirahat 10s tiap 10 staf)'

    if (
      !confirm(
        `Kirim slip gaji via WhatsApp ke ${targetRecords.length} karyawan terpilih untuk periode ${periodText}?\n\n🛡️ Proteksi Anti-Ban: ${modeText}`
      )
    ) {
      return
    }

    setSending(true)
    abortBroadcastRef.current = false
    const total = targetRecords.length
    setCurrentProgress({ current: 0, total })

    // Set target items to pending
    setBroadcastResults((prev) => {
      const next = { ...prev }
      targetRecords.forEach((r) => {
        next[r.id] = { status: 'pending' }
      })
      return next
    })

    const jitterMin = antiBanMode === 'safe' ? 4000 : 2500
    const jitterMax = antiBanMode === 'safe' ? 7000 : 4500
    const batchSize = antiBanMode === 'safe' ? 6 : 10
    const cooldownDuration = antiBanMode === 'safe' ? 15 : 10

    let successTotal = 0
    let failedTotal = 0
    let partialTotal = 0

    for (let i = 0; i < targetRecords.length; i++) {
      if (abortBroadcastRef.current) {
        toast.info(
          `Broadcast dihentikan oleh pengguna. ${successTotal} berhasil, ${targetRecords.length - i} staf dibatalkan.`
        )
        break
      }

      const slip = targetRecords[i]
      const staffName = slip.outlet_staff?.name || 'Karyawan'
      setActiveStaffName(staffName)
      setCurrentProgress({ current: i + 1, total })

      // Mark row as sending
      setBroadcastResults((prev) => ({
        ...prev,
        [slip.id]: { status: 'sending' },
      }))

      try {
        const res: SingleWahaSendResult = await sendSingleWahaSalarySlip(slip, {
          customHeaderNote: customNote || undefined,
          sendPdfFile,
          baseUrl: wahaBaseUrl || undefined,
          session: wahaSession || undefined,
          apiKey: wahaApiKey || undefined,
        })

        if (res.success) {
          successTotal++
          setBroadcastResults((prev) => ({
            ...prev,
            [slip.id]: { status: 'success', messageId: res.messageId },
          }))
          // Automatically uncheck successful recipient so only failed/unprocessed remain checked
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(slip.id)
            return next
          })
        } else if (res.textSuccess && !res.pdfSuccess) {
          partialTotal++
          setBroadcastResults((prev) => ({
            ...prev,
            [slip.id]: {
              status: 'partial',
              warning: res.warning || 'Pesan teks terkirim, namun PDF gagal dilampirkan',
              messageId: res.messageId,
            },
          }))
        } else {
          failedTotal++
          setBroadcastResults((prev) => ({
            ...prev,
            [slip.id]: { status: 'failed', message: res.error || 'Gagal mengirim pesan' },
          }))
        }
      } catch (err: any) {
        failedTotal++
        setBroadcastResults((prev) => ({
          ...prev,
          [slip.id]: { status: 'failed', message: err.message || 'Terjadi kesalahan sistem' },
        }))
      }

      // Check abort before delay
      if (abortBroadcastRef.current) {
        toast.info(`Broadcast dihentikan. ${successTotal} staf berhasil menerima slip gaji.`)
        break
      }

      // Layer Proteksi Anti-Ban WhatsApp: Cooldown istirahat & Jitter antar staf
      if (i < targetRecords.length - 1) {
        // Cooldown istirahat berkala tiap batch
        if ((i + 1) % batchSize === 0) {
          for (let c = cooldownDuration; c > 0; c--) {
            if (abortBroadcastRef.current) break
            setCooldownCountdown(c)
            await sleep(1000)
          }
          setCooldownCountdown(null)
        } else {
          // Jeda acak manusiawi (human jitter)
          const jitter = getRandomJitter(jitterMin, jitterMax)
          await sleep(jitter)
        }
      }
    }

    setSending(false)
    setActiveStaffName('')
    setCooldownCountdown(null)

    if (!abortBroadcastRef.current) {
      if (failedTotal === 0 && partialTotal === 0) {
        toast.success(`Selesai! Seluruh ${successTotal} slip gaji resmi berhasil dikirim via WhatsApp.`)
      } else {
        toast.warning(
          `Pengiriman selesai: ${successTotal} berhasil, ${partialTotal} teks saja (PDF gagal), ${failedTotal} gagal. Staf yang belum berhasil tetap terpilih untuk pengiriman ulang.`
        )
      }
    }
  }

  const handleAbort = () => {
    abortBroadcastRef.current = true
    toast.warning('Menghentikan broadcast... Harap tunggu proses karyawan saat ini selesai.')
  }

  // Summary counts from broadcastResults
  const resultsCount = useMemo(() => {
    const values = Object.values(broadcastResults)
    const success = values.filter((v) => v.status === 'success').length
    const partial = values.filter((v) => v.status === 'partial').length
    const failed = values.filter((v) => v.status === 'failed').length
    return { success, partial, failed, total: values.length }
  }, [broadcastResults])

  const progressPercent =
    currentProgress.total > 0
      ? Math.round((currentProgress.current / currentProgress.total) * 100)
      : 0

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
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-600" />
                  Anti-Ban Engine
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
            className="rounded-full p-1.5 text-suka-gray-400 hover:bg-stone-100 hover:text-suka-ink transition-colors cursor-pointer disabled:opacity-30"
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
              disabled={checkingStatus || sending}
              className="px-2.5 py-1 text-xs rounded-lg font-bold border border-suka-gray-200 hover:bg-white text-suka-brown flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={11} className={checkingStatus ? 'animate-spin' : ''} />
              <span>Tes Koneksi</span>
            </button>
            <button
              onClick={() => setShowSettings((v) => !v)}
              disabled={sending}
              className="px-2.5 py-1 text-xs rounded-lg font-bold border border-suka-gray-200 hover:bg-white text-suka-brown flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
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
                  disabled={sending}
                  onChange={(e) => setWahaBaseUrl(e.target.value)}
                  placeholder="https://blast.sukashawarma.com"
                  className="w-full rounded-xl border border-stone-300 p-2 text-xs font-mono bg-white outline-none focus:border-suka-orange"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-600 mb-1">Session Name</label>
                <input
                  type="text"
                  value={wahaSession}
                  disabled={sending}
                  onChange={(e) => setWahaSession(e.target.value)}
                  placeholder="HR"
                  className="w-full rounded-xl border border-stone-300 p-2 text-xs font-mono bg-white outline-none focus:border-suka-orange"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-600 mb-1">API Key (Optional)</label>
                <input
                  type="password"
                  value={wahaApiKey}
                  disabled={sending}
                  onChange={(e) => setWahaApiKey(e.target.value)}
                  placeholder="waha_sukashawarma_secret_2026"
                  className="w-full rounded-xl border border-stone-300 p-2 text-xs font-mono bg-white outline-none focus:border-suka-orange"
                />
              </div>
            </div>
            <p className="text-[10px] text-stone-500">
              *Default otomatis menggunakan endpoint resmi `https://blast.sukashawarma.com` dengan sesi `HR`.
            </p>
          </div>
        )}

        {/* Live Broadcast Progress Card (Visible during sending or when cooldown is active) */}
        {sending && (
          <div className="p-4 bg-emerald-950 text-white rounded-2xl shadow-lg border border-emerald-800 space-y-3 shrink-0 animate-in fade-in duration-200">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <Spinner size={14} className="text-emerald-400" />
                <span className="font-extrabold uppercase tracking-wider text-emerald-400 text-[11px]">
                  Sedang Mengirim via WAHA
                </span>
                <span className="text-stone-300 font-mono">
                  ({currentProgress.current} dari {currentProgress.total})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-emerald-300 text-xs">
                  {progressPercent}%
                </span>
                <Button
                  type="button"
                  onClick={handleAbort}
                  className="bg-red-600/90 hover:bg-red-600 text-white rounded-xl text-[11px] font-bold py-1 px-3 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Square size={11} fill="currentColor" />
                  <span>Hentikan Broadcast</span>
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-emerald-900/80 rounded-full h-2 overflow-hidden border border-emerald-700/50">
              <div
                className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Sub-status Indicator */}
            {cooldownCountdown !== null ? (
              <div className="p-2.5 bg-amber-500/20 border border-amber-400/40 rounded-xl flex items-center gap-2 text-xs text-amber-200 animate-pulse">
                <Clock size={14} className="text-amber-300 shrink-0" />
                <span>
                  <strong>Jeda Istirahat Anti-Ban:</strong> Menjeda selama <strong>{cooldownCountdown} detik</strong> untuk menjaga reputasi nomor WhatsApp HR agar tetap aman...
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-stone-300">
                <span className="truncate">
                  Memproses: <strong className="text-white">{activeStaffName}</strong>
                </span>
                <span className="text-emerald-300/80 flex items-center gap-1 font-medium text-[10px]">
                  <Sparkles size={11} /> Simulasi mengetik &amp; jeda acak aktif
                </span>
              </div>
            )}
          </div>
        )}

        {/* Anti-Ban Mode & PDF Options Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          {/* Toggle PDF Attachment */}
          <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendPdfFile}
                disabled={sending}
                onChange={(e) => setSendPdfFile(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer disabled:opacity-50"
              />
              <div>
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <FileText size={14} className="text-emerald-700" />
                  Sertakan Dokumen PDF Resmi (A5)
                </span>
                <p className="text-[10px] text-emerald-800/80 mt-0.5">
                  Karyawan menerima cover note diikuti lampiran PDF resmi.
                </p>
              </div>
            </label>
            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
              {sendPdfFile ? 'PDF AKTIF' : 'TEKS SAJA'}
            </span>
          </div>

          {/* Anti-Ban Pacing Preset */}
          <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-700 shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-950 block">Proteksi Anti-Ban WhatsApp</span>
                <span className="text-[10px] text-amber-800/80">
                  {antiBanMode === 'safe'
                    ? 'Jeda 4-7s acak + Istirahat 15s tiap 6 pesan'
                    : 'Jeda 2.5-4.5s + Istirahat 10s tiap 10 pesan'}
                </span>
              </div>
            </div>
            <select
              value={antiBanMode}
              disabled={sending}
              onChange={(e) => setAntiBanMode(e.target.value as 'safe' | 'standard')}
              className="bg-white border border-amber-300 text-amber-950 text-xs font-bold rounded-xl px-2 py-1 outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="safe">Sangat Aman (Rekomendasi)</option>
              <option value="standard">Standar (Lebih Cepat)</option>
            </select>
          </div>
        </div>

        {/* Optional Custom Note Header */}
        <div className="shrink-0">
          <label className="block text-xs font-bold text-suka-brown mb-1">
            Pesan Pembuka / Catatan Tambahan (Opsional)
          </label>
          <input
            type="text"
            value={customNote}
            disabled={sending}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Contoh: Selamat gajian! Gaji telah ditransfer per tanggal 28. Cek mutasi rekening Anda."
            className="w-full rounded-xl border border-suka-gray-200 px-3.5 py-2 text-xs sm:text-sm font-medium outline-none focus:border-suka-orange disabled:opacity-50"
          />
        </div>

        {/* Selection Bar */}
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-suka-gray-100 pb-2 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleSelectAllValid}
              disabled={sending}
              className="text-xs font-bold text-suka-orange hover:underline cursor-pointer disabled:opacity-50"
            >
              Pilih Semua ({records.filter((r) => !!r.outlet_staff?.phone).length})
            </button>
            <span className="text-gray-300">&bull;</span>
            <button
              onClick={handleDeselectAll}
              disabled={sending}
              className="text-xs font-bold text-gray-500 hover:underline cursor-pointer disabled:opacity-50"
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
                <th className="p-3 text-center">Status Broadcast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {records.map((r) => {
                const isSelected = selectedIds.has(r.id)
                const phone = r.outlet_staff?.phone
                const itemState = broadcastResults[r.id]

                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-amber-50/20 transition-colors ${
                      !phone ? 'opacity-60 bg-stone-50' : ''
                    } ${itemState?.status === 'sending' ? 'bg-amber-100/40' : ''}`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!phone || sending}
                        onChange={() => handleToggle(r.id)}
                        className="w-4 h-4 rounded text-suka-orange focus:ring-suka-orange cursor-pointer disabled:opacity-50"
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
                    <td className="p-3 text-center">
                      {itemState ? (
                        itemState.status === 'sending' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300 animate-pulse">
                            <Spinner size={10} className="text-amber-700" /> Mengirim...
                          </span>
                        ) : itemState.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} /> Terkirim {sendPdfFile ? '(+PDF)' : ''}
                          </span>
                        ) : itemState.status === 'partial' ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300"
                            title={itemState.warning}
                          >
                            <AlertTriangle size={11} /> Teks Saja (PDF Gagal)
                          </span>
                        ) : itemState.status === 'failed' ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200"
                            title={itemState.message}
                          >
                            <AlertCircle size={11} /> Gagal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-stone-400 font-medium">
                            <Clock size={10} /> Antrean
                          </span>
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Broadcast Summary Card if finished */}
        {resultsCount.total > 0 && !sending && (
          <div className="p-4 bg-stone-50 rounded-2xl border border-suka-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 animate-in fade-in">
            <div>
              <span className="font-extrabold text-suka-ink text-sm block">Laporan Hasil Broadcast:</span>
              <p className="text-stone-600 mt-0.5">
                Total <strong>{resultsCount.total}</strong> diproses &bull;{' '}
                <strong className="text-emerald-600">{resultsCount.success} Berhasil</strong> &bull;{' '}
                {resultsCount.partial > 0 && (
                  <>
                    <strong className="text-amber-600">{resultsCount.partial} Teks Saja</strong> &bull;{' '}
                  </>
                )}
                <strong className="text-red-600">{resultsCount.failed} Gagal</strong>
              </p>
            </div>
            {resultsCount.failed > 0 && (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1">
                <Info size={12} /> Staf yang gagal tetap terpilih. Anda dapat klik kirim ulang.
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
            className="rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 px-6 shadow-md cursor-pointer disabled:opacity-50"
          >
            {sending ? (
              <>
                <Spinner size={14} />
                <span>Memproses Broadcast...</span>
              </>
            ) : resultsCount.failed > 0 ? (
              <>
                <RefreshCw size={14} />
                <span>Kirim Ulang ({targetRecords.length} Staf Belum Berhasil)</span>
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
