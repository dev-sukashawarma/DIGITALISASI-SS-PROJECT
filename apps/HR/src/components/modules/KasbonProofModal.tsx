'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  MessageCircle,
  Send,
  X,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import type { CashAdvanceRow } from '@/hooks/useCashAdvances'
import { formatDate, formatRupiah } from '@/lib/format'
import { nomorWa } from '@/lib/whatsapp'
import { isPdfProof, tautanWaKasbon } from '@/lib/whatsappKasbon'
import { sendKasbonProofWaha } from '@/app/actions/kasbonProof'

interface KasbonProofModalProps {
  row: CashAdvanceRow
  proofUrl: string | null
  loadingUrl?: boolean
  urlError?: string | null
  onClose: () => void
}

async function copyImageUrlToClipboard(url: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal memuat gambar bukti')
  const blob = await res.blob()
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Browser tidak mendukung salin gambar otomatis')
  }

  let pngBlob = blob
  if (blob.type !== 'image/png') {
    const imgUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.crossOrigin = 'anonymous'
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('Gagal memproses gambar'))
        el.src = imgUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas tidak tersedia')
      ctx.drawImage(img, 0, 0)
      pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal konversi PNG'))), 'image/png')
      })
    } finally {
      URL.revokeObjectURL(imgUrl)
    }
  }

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
}

export function KasbonProofModal({
  row,
  proofUrl,
  loadingUrl = false,
  urlError = null,
  onClose,
}: KasbonProofModalProps) {
  const [copiedImg, setCopiedImg] = useState(false)
  const [sendingWaha, setSendingWaha] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const staffName = row.outlet_staff?.name || 'Staf'
  const outletName = row.outlet_staff?.outlets?.name || null
  const isPdf = isPdfProof(row.bukti_cair || proofUrl)
  const validPhone = nomorWa(row.staff_phone)
  const waHref = tautanWaKasbon({
    phone: row.staff_phone,
    staffName,
    amount: row.amount,
    metodeCair: row.metode_cair,
    dicairkanAt: row.dicairkan_at,
    proofUrl,
  })

  const handleDownload = async () => {
    if (!proofUrl) return
    setDownloading(true)
    try {
      const res = await fetch(proofUrl)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const ext = isPdf ? 'pdf' : (row.bukti_cair?.split('.').pop()?.split('?')[0] || 'jpg')
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `bukti-kasbon-${staffName.toLowerCase().replace(/\s+/g, '-')}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(proofUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloading(false)
    }
  }

  const handleCopyImage = async () => {
    if (!proofUrl || isPdf) return
    try {
      await copyImageUrlToClipboard(proofUrl)
      setCopiedImg(true)
      toast.success('Gambar bukti transfer disalin — tinggal tempel (Ctrl+V) di WhatsApp')
      setTimeout(() => setCopiedImg(false), 2500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyalin gambar; silakan gunakan Unduh')
    }
  }

  const handleSendWaha = async () => {
    if (!validPhone) {
      toast.error('Nomor WhatsApp staf belum terdaftar di data karyawan')
      return
    }
    setSendingWaha(true)
    try {
      const res = await sendKasbonProofWaha(row.id)
      if (res.ok) {
        toast.success(`Bukti pencairan kasbon berhasil dikirim ke WhatsApp ${staffName}!`)
      } else {
        toast.error(res.error || 'Gagal mengirim bukti via WAHA')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghubungi server WAHA')
    } finally {
      setSendingWaha(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Bukti Transfer Finance"
    >
      <div className="w-full max-w-lg rounded-3xl border border-suka-gray-200 bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 my-6 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-suka-gray-100 pb-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-suka-orange">
              Approval by Finance
            </span>
            <h3 className="text-lg font-black text-suka-brown mt-0.5">{staffName}</h3>
            <p className="text-xs text-suka-gray-500 font-medium">
              {outletName ? `${outletName} · ` : ''}
              <strong className="text-suka-ink">{formatRupiah(row.amount)}</strong>
              {row.dicairkan_at ? ` · Dicairkan ${formatDate(row.dicairkan_at)}` : ''}
              {row.metode_cair ? ` (${row.metode_cair === 'tunai' ? 'Tunai' : 'Transfer'})` : ''}
            </p>
            {row.dicairkan_oleh_name && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Disetujui Finance oleh {row.dicairkan_oleh_name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-suka-gray-400 hover:bg-stone-100 hover:text-suka-ink transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Proof Preview */}
        <div className="rounded-2xl border border-suka-gray-200 bg-stone-50 overflow-hidden">
          {loadingUrl ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-suka-gray-500">
              <Spinner />
              <span>Memuat bukti transfer...</span>
            </div>
          ) : urlError ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-red-600 gap-2">
              <AlertCircle size={22} />
              <p className="text-xs font-semibold">{urlError}</p>
            </div>
          ) : !proofUrl ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-suka-gray-400 gap-2">
              <FileText size={24} />
              <p className="text-xs font-medium">Bukti transfer belum tersedia.</p>
            </div>
          ) : isPdf ? (
            <div className="space-y-2 p-3">
              <iframe
                src={proofUrl}
                title={`Bukti transfer ${staffName}`}
                className="w-full h-72 rounded-xl border border-suka-gray-200 bg-white"
              />
            </div>
          ) : (
            <div className="relative bg-stone-900/5 flex items-center justify-center p-2">
              <img
                src={proofUrl}
                alt={`Bukti transfer kasbon ${staffName}`}
                className="max-h-80 w-auto rounded-xl object-contain shadow-xs"
              />
            </div>
          )}
        </div>

        {/* Utility Actions (Open / Download / Copy Image) */}
        {proofUrl && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-suka-ink hover:bg-suka-gray-50 transition-colors"
            >
              <ExternalLink size={13} />
              <span>Buka Tab Baru</span>
            </a>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-suka-ink hover:bg-suka-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              <span>{downloading ? 'Mengunduh...' : 'Unduh Bukti'}</span>
            </button>
            {!isPdf && (
              <button
                type="button"
                onClick={handleCopyImage}
                className="inline-flex items-center gap-1.5 rounded-xl border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-suka-ink hover:bg-suka-gray-50 transition-colors cursor-pointer"
              >
                {copiedImg ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedImg ? 'Tersalin!' : 'Salin Gambar'}</span>
              </button>
            )}
          </div>
        )}

        {/* WhatsApp Phone Notice */}
        {!validPhone && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>
              Nomor WhatsApp <strong>{staffName}</strong> belum terdaftar di data karyawan. Lengkapi di menu Data Staf agar bisa kirim langsung ke WhatsApp.
            </span>
          </div>
        )}

        {/* Footer WhatsApp Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-suka-gray-100">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold">
            Tutup
          </Button>

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle size={14} />
              <span>Buka WhatsApp (wa.me)</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => toast.error('Nomor WhatsApp staf belum terdaftar di data karyawan')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-suka-gray-200 bg-suka-gray-100 px-4 py-2 text-xs font-bold text-suka-gray-400 cursor-not-allowed"
            >
              <MessageCircle size={14} />
              <span>Buka WhatsApp (wa.me)</span>
            </button>
          )}

          <Button
            type="button"
            onClick={handleSendWaha}
            disabled={!validPhone || sendingWaha || !row.bukti_cair}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 px-4 py-2 cursor-pointer disabled:opacity-50"
          >
            <Send size={14} />
            <span>{sendingWaha ? 'Mengirim...' : 'Kirim Bukti via WAHA'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
