'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'
import { useFormattedDate } from '@/hooks/useFormattedDate'
import { SignatureFlow } from './SignatureFlow'
import { useAuth } from '@suka/auth'
import { createSupabaseBrowserClient } from '@suka/auth'
import { generatePDFContent, generateSuratJalanPDF, downloadPDF, fetchFotoAsBase64 } from '@/utils/generatePDF'
import { downloadSuratJalanExcel } from '@/utils/generateSuratJalanExcel'
import {
  ArrowLeft,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Eye,
  X,
  ShieldCheck,
  Truck,
  Store,
  Calendar,
  Copy,
  Check,
  Package,
  Clock,
  QrCode,
  Layers,
  ArrowRight,
  Info,
  Building2,
  Phone,
  FileCheck,
  HelpCircle
} from 'lucide-react'
import { toast } from 'sonner'

function FormattedDate({ iso, extended }: { iso: string | null | undefined; extended?: boolean }) {
  const text = useFormattedDate(
    iso,
    extended
      ? {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }
      : {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }
  )
  return <>{text}</>
}

function SignatureBlock({ title, sigs }: { title: string; sigs: any[] }) {
  return (
    <div className="bg-white/85 backdrop-blur-md border border-suka-orange/15 rounded-3xl p-5 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center border-b border-suka-brown/10 pb-2.5">
        <p className="text-[10px] font-black text-suka-brown uppercase tracking-wider leading-none">
          {title}
        </p>
        <span className="text-[9px] font-black text-suka-orange bg-suka-orange/10 border border-suka-orange/20 px-2 py-0.5 rounded-full">
          {sigs.length} TTD Sah
        </span>
      </div>

      {sigs.length === 0 ? (
        <div className="py-5 text-center bg-[#fff8f1]/50 rounded-2xl border border-dashed border-suka-brown/15">
          <Clock size={16} className="mx-auto text-suka-gray-400 mb-1" />
          <p className="text-[10px] text-suka-gray-400 font-bold italic">
            Belum ada tanda tangan terverifikasi
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sigs.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 bg-[#fff8f1] rounded-2xl border border-suka-brown/10 shadow-xs"
            >
              {s.signature_image ? (
                <img
                  src={s.signature_image}
                  alt={s.role}
                  className="h-10 w-16 bg-white border border-suka-brown/15 rounded-xl p-1 object-contain shrink-0 shadow-xs"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-suka-ink uppercase tracking-wide truncate">
                  {s.signed_by}
                </p>
                <p className="text-[9px] text-suka-gray-500 font-bold mt-0.5 truncate">
                  {s.role} &bull;{' '}
                  {new Date(s.signed_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SuratJalanDetail({ id }: { id: string }) {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const { data, loading, error } = useSuratJalanDetail(id)
  const [signatures, setSignatures] = useState<any[]>([])
  const [verifying, setVerifying] = useState(false)
  const [pdfHtml, setPdfHtml] = useState<string | null>(null)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showLx310Guide, setShowLx310Guide] = useState(false)
  const [copiedDoc, setCopiedDoc] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    if (data?.signatures) {
      setSignatures(data.signatures)
    }
  }, [data?.signatures])

  const buildItemsWithFoto = async (items: any[]) => {
    return Promise.all(
      items.map(async (item: any) => {
        const foto_base64 = item.foto_path ? await fetchFotoAsBase64(item.foto_path) : null

        const b = item.bahan_baku
        const distUnit = b?.satuan_distribusi || b?.satuan
        let factor = 1

        if (b && b.satuan_distribusi && b.satuan_distribusi !== b.satuan) {
          const dist = b.satuan_distribusi.toLowerCase()
          if (dist === b.satuan_tengah?.toLowerCase() && b.faktor_tengah) factor = b.faktor_tengah
          else if (dist === b.satuan_kecil?.toLowerCase() && b.faktor_tampilan) factor = b.faktor_tampilan
          else if (dist === 'kg' && b.satuan_kecil?.toLowerCase() === 'gram' && b.faktor_tampilan)
            factor = b.faktor_tampilan / 1000
        }

        return {
          ...item,
          nama: b?.nama,
          satuan: distUnit,
          kategori: b?.kategori,
          qty_dikirim: Math.round(item.qty_dikirim * factor),
          qty_terima: item.qty_terima != null ? Math.round(item.qty_terima * factor) : null,
          foto_base64,
        }
      })
    )
  }

  useEffect(() => {
    const isPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(
      outletStaff?.role || ''
    )
    const hideQR = !isPusat

    const loadPdfHtml = async () => {
      if (data) {
        const items = await buildItemsWithFoto(data.surat_jalan_item)
        const htmlContent = await generatePDFContent(
          {
            id: data.id,
            document_number: data.document_number || `SJ-${data.id.substring(0, 8).toUpperCase()}`,
            outlet_name: data.outlets?.name || 'Unknown',
            sender_outlet: 'GUDANG PUSAT (HQ)',
            status: data.status,
            created_at: data.created_at,
            verification_url: `${window.location.origin}/distribusi/terima/${data.id}`,
            verification_code: data.verification_code,
            items,
            signatures: data.signatures || [],
            receipt_signatures: data.receipt_signatures || [],
          },
          { hideQR, copies: 3 }
        )
        setPdfHtml(htmlContent)
      }
    }
    loadPdfHtml()
  }, [data, outletStaff])

  const handleSignatureAdded = (newSignatures: any[]) => {
    setSignatures(newSignatures)
  }

  const handleSent = () => {
    toast.success('Surat Jalan berhasil dikirim!')
    router.push('/distribusi/surat-jalan')
  }

  const handleVerifyPusat = async () => {
    setVerifying(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase
        .from('surat_jalan')
        .update({ status: 'selesai', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      toast.success('Surat Jalan berhasil diverifikasi & diselesaikan oleh Pusat!')
      setShowConfirmModal(false)
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) {
      toast.error(`Gagal memverifikasi: ${err?.message || 'Error'}`)
    } finally {
      setVerifying(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!data) return
    const isPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(
      outletStaff?.role || ''
    )
    const hideQR = !isPusat

    try {
      toast.info('Menyiapkan file PDF Surat Jalan 3-Ply (14 x 12 cm)...')
      const items = await buildItemsWithFoto(data.surat_jalan_item)
      const pdfBlob = await generateSuratJalanPDF(
        {
          id: data.id,
          document_number: data.document_number || `SJ-${data.id.substring(0, 8).toUpperCase()}`,
          outlet_name: data.outlets?.name || 'Unknown',
          sender_outlet: 'GUDANG PUSAT (HQ)',
          status: data.status,
          created_at: data.created_at,
          verification_url: `${window.location.origin}/distribusi/terima/${data.id}`,
          verification_code: data.verification_code,
          items,
          signatures: data.signatures || [],
          receipt_signatures: data.receipt_signatures || [],
        },
        { hideQR, copies: 3 }
      )

      downloadPDF(`Surat-Jalan-3Ply-${data.document_number || data.id.substring(0, 8)}.pdf`, pdfBlob)
      toast.success('PDF 3-Ply (14x12 cm) berhasil diunduh!')
    } catch {
      toast.error('Gagal mengunduh file PDF')
    }
  }

  const handlePrintDotMatrix = async (copies = 1) => {
    if (!data) return
    const isPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(
      outletStaff?.role || ''
    )
    const hideQR = !isPusat
    try {
      toast.info(
        copies === 1
          ? 'Menyiapkan cetak langsung ke Epson LX-310 (1x Print Tembus NCR)...'
          : 'Menyiapkan cetak 3 rangkap...'
      )
      const items = await buildItemsWithFoto(data.surat_jalan_item)
      const htmlContent = await generatePDFContent(
        {
          id: data.id,
          document_number: data.document_number || `SJ-${data.id.substring(0, 8).toUpperCase()}`,
          outlet_name: data.outlets?.name || 'Unknown',
          sender_outlet: 'GUDANG PUSAT (HQ)',
          status: data.status,
          created_at: data.created_at,
          verification_url: `${window.location.origin}/distribusi/terima/${data.id}`,
          verification_code: data.verification_code,
          items,
          signatures: data.signatures || [],
          receipt_signatures: data.receipt_signatures || [],
        },
        { hideQR, copies: copies as any }
      )

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(htmlContent)
        doc.close()
        setTimeout(() => {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
          }, 1500)
        }, 300)
      }
    } catch {
      toast.error('Gagal mencetak ke printer')
    }
  }

  const handleDownloadExcel = async () => {
    if (!data) return
    try {
      toast.info('Membuat file Excel Surat Jalan...')
      await downloadSuratJalanExcel({
        documentNumber: data.document_number || `SJ-${data.id.substring(0, 8).toUpperCase()}`,
        outletName: data.outlets?.name || 'Unknown',
        createdAt: data.created_at,
        verificationCode: data.verification_code,
        items: data.surat_jalan_item,
      })
      toast.success('Excel berhasil diunduh!')
    } catch {
      toast.error('Gagal mengunduh file Excel')
    }
  }

  const handleCopyDoc = (docNum: string) => {
    navigator.clipboard.writeText(docNum)
    setCopiedDoc(true)
    toast.success(`No. SJ ${docNum} disalin ke clipboard!`)
    setTimeout(() => setCopiedDoc(false), 2000)
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    toast.success(`Kode Verifikasi ${code} disalin ke clipboard!`)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Summary Metrics
  const totalItemCount = data?.surat_jalan_item?.length || 0
  const totalQtyDikirim = useMemo(() => {
    if (!data?.surat_jalan_item) return 0
    return data.surat_jalan_item.reduce((sum: number, it: any) => sum + (it.qty_dikirim || 0), 0)
  }, [data?.surat_jalan_item])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-suka-brown font-medium bg-grain relative">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-suka-orange mb-4" />
        <p className="text-xs font-black uppercase tracking-wider text-suka-brown animate-pulse">
          Memuat Detail Dokumen Logistik...
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4 bg-grain">
        <div className="p-6 text-xs font-bold text-red-700 bg-white/90 border border-red-200 rounded-3xl max-w-md text-center shadow-lg space-y-3">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
            <AlertTriangle size={24} />
          </div>
          <h3 className="font-black text-sm text-suka-brown uppercase">Gagal Memuat Dokumen</h3>
          <p className="text-suka-gray-600">{error || 'Data surat jalan tidak ditemukan.'}</p>
          <button
            onClick={() => router.back()}
            className="mt-3 px-5 py-2.5 bg-suka-brown text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-suka-ink cursor-pointer"
          >
            Kembali ke Daftar
          </button>
        </div>
      </div>
    )
  }

  const isPusatSender = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(
    outletStaff?.role || ''
  )

  const hasProblem = data.surat_jalan_item?.some(
    (it) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
  )

  const docNumber = data.document_number || `SJ-${data.id.substring(0, 8).toUpperCase()}`

  // 4-Step Pipeline Status
  const getStepStatus = () => {
    if (data.status === 'draft') return 1
    if (data.status === 'dikirim' || data.status === 'dikirim_lengkap') return 2
    if (data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian') return 3
    if (data.status === 'selesai') return 4
    return 1
  }
  const currentStep = getStepStatus()

  const statusBadge: Record<string, { label: string; style: string; dot: string }> = {
    draft: { label: 'Draft (Siap TTD)', style: 'bg-amber-500/10 text-amber-700 border-amber-500/20', dot: 'bg-amber-500' },
    dikirim: { label: 'Dalam Transit', style: 'bg-blue-500/10 text-blue-700 border-blue-500/20', dot: 'bg-blue-500 animate-pulse' },
    dikirim_lengkap: { label: 'Dalam Transit', style: 'bg-blue-500/10 text-blue-700 border-blue-500/20', dot: 'bg-blue-500 animate-pulse' },
    diterima_sebagian: { label: 'Tiba (Ada Selisih)', style: 'bg-orange-500/10 text-orange-700 border-orange-500/20', dot: 'bg-orange-500' },
    diterima_lengkap: { label: 'Tiba di Outlet', style: 'bg-purple-500/10 text-purple-700 border-purple-500/20', dot: 'bg-purple-500' },
    selesai: { label: 'Selesai & Valid', style: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', dot: 'bg-emerald-500' },
  }

  const currentStatus = statusBadge[data.status] || {
    label: data.status,
    style: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
    dot: 'bg-gray-400',
  }

  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-32 relative overflow-hidden bg-grain select-none">
      {/* Ambient background glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-suka-orange/5 blur-[140px] pointer-events-none z-0 animate-blob-1" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-suka-brown/5 blur-[140px] pointer-events-none z-0 animate-blob-2" />

      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-8 py-3.5 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
            title="Kembali"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm sm:text-base text-suka-brown uppercase tracking-wider font-display leading-none truncate">
                Detail Surat Jalan
              </h1>
              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${currentStatus.style}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
                {currentStatus.label}
              </span>
            </div>
            <p className="text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
              {docNumber} &bull; {data.outlets?.name || 'Outlet'}
            </p>
          </div>
        </div>

        {/* Header Action Suite */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrintDotMatrix(1)}
            className="px-3.5 py-2 bg-suka-orange hover:bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Cetak langsung ke Epson LX-310 (1x Lembar Tembus NCR)"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Cetak</span> LX-310
          </button>
          <button
            onClick={() => setShowPdfModal(true)}
            className="px-3.5 py-2 bg-white border border-suka-brown/20 text-suka-brown hover:bg-suka-brown/5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Pratinjau Format Cetak 3-Ply 14x12 cm"
          >
            <Eye size={14} className="text-suka-orange" />
            <span className="hidden sm:inline">Pratinjau</span> 3-Ply
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-3.5 py-2 bg-suka-brown hover:bg-suka-ink text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Unduh File PDF 3 Rangkap"
          >
            <Download size={14} /> PDF
          </button>

          {!isPusatSender && (data.status === 'dikirim' || data.status === 'dikirim_lengkap') && (
            <button
              onClick={() => router.push(`/distribusi/terima/${id}`)}
              className="px-4 py-2 bg-gradient-to-r from-suka-orange to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-suka-orange/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              📝 Verifikasi Sekarang
            </button>
          )}
        </div>
      </header>

      {/* Main 2-Column Responsive Container */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* LEFT COLUMN: Main Manifest & Tracking Pipeline (Span 8) */}
        <div className="lg:col-span-8 space-y-6">

          {/* 1. Document Hero & Shipment Route Card */}
          <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-brown/10 p-6 shadow-sm space-y-5">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-suka-brown/10 pb-4">
              <div>
                <span className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest leading-none">
                  Nomor Surat Jalan Sah
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-xl font-mono font-black text-suka-ink tracking-tight">
                    {docNumber}
                  </h2>
                  <button
                    onClick={() => handleCopyDoc(docNumber)}
                    className="p-1 rounded-lg bg-[#fff8f1] border border-suka-brown/10 text-suka-gray-600 hover:text-suka-orange transition-colors cursor-pointer"
                    title="Salin Nomor SJ"
                  >
                    {copiedDoc ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${currentStatus.style}`}>
                  <span className={`w-2 h-2 rounded-full ${currentStatus.dot}`} />
                  {currentStatus.label}
                </span>
                {hasProblem && (
                  <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                    <AlertTriangle size={13} /> Selisih Terdeteksi
                  </span>
                )}
              </div>
            </div>

            {/* 4-Step Interactive Logistics Pipeline Tracker */}
            <div className="py-2">
              <p className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest mb-3 pl-0.5">
                Status Alur Logistik:
              </p>
              <div className="grid grid-cols-4 gap-2 sm:gap-4 relative">
                {[
                  { step: 1, label: '1. Draft & TTD', desc: 'Gudang & Supir' },
                  { step: 2, label: '2. Transit', desc: 'Armada Jalan' },
                  { step: 3, label: '3. Tiba Outlet', desc: 'Pengecekan Fisik' },
                  { step: 4, label: '4. Selesai', desc: 'Validasi Stok' },
                ].map((s) => {
                  const isDone = currentStep >= s.step
                  const isCurrent = currentStep === s.step
                  return (
                    <div key={s.step} className="flex flex-col items-center text-center space-y-1">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-all duration-300 shadow-xs ${
                          isDone
                            ? 'bg-suka-orange text-white ring-4 ring-suka-orange/20 scale-105'
                            : 'bg-gray-100 text-gray-400 border border-gray-200'
                        }`}
                      >
                        {isDone && currentStep > s.step ? <Check size={16} /> : s.step}
                      </div>
                      <p className={`text-[10px] font-black uppercase tracking-wider ${isCurrent ? 'text-suka-orange' : isDone ? 'text-suka-brown' : 'text-gray-400'}`}>
                        {s.label}
                      </p>
                      <p className="text-[8px] text-suka-gray-400 font-bold hidden sm:block">
                        {s.desc}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Origin & Destination Route Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-suka-brown/10">
              <div className="bg-[#fff8f1] p-4 rounded-2xl border border-suka-brown/10 space-y-1">
                <p className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Building2 size={13} className="text-suka-orange" /> Dikirim Dari
                </p>
                <p className="text-xs font-black text-suka-ink uppercase">GUDANG PUSAT (HQ)</p>
                <p className="text-[9px] text-suka-gray-500 font-medium truncate">Central Kitchen Logistics</p>
              </div>

              <div className="bg-[#fff8f1] p-4 rounded-2xl border border-suka-brown/10 space-y-1">
                <p className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Store size={13} className="text-suka-orange" /> Tujuan Outlet
                </p>
                <p className="text-xs font-black text-suka-ink uppercase truncate">
                  {data.outlets?.name || 'Unknown Outlet'}
                </p>
                <p className="text-[9px] text-suka-gray-500 font-medium">Cabang Penerima</p>
              </div>

              <div className="bg-[#fff8f1] p-4 rounded-2xl border border-suka-brown/10 space-y-1">
                <p className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar size={13} className="text-suka-orange" /> Waktu Dibuat
                </p>
                <p className="text-xs font-black text-suka-ink uppercase">
                  <FormattedDate iso={data.created_at} />
                </p>
                <p className="text-[9px] text-suka-gray-500 font-medium">
                  {new Date(data.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </p>
              </div>
            </div>
          </div>

          {/* 2. Manifest Items List (Dense, High-Density Table with Badges) */}
          <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden space-y-0">
            {/* Manifest Header */}
            <div className="px-6 py-4 border-b border-suka-brown/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#fff8f1]/80">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-suka-orange" />
                <h3 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none">
                  Manifes Muatan Barang
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-suka-brown bg-white border border-suka-brown/10 px-3 py-1 rounded-xl shadow-2xs">
                  {totalItemCount} Jenis Bahan
                </span>
              </div>
            </div>

            {/* Manifest Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#fff8f1]/40 border-b border-suka-brown/10 text-[9px] font-black uppercase text-suka-gray-500 tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Bahan Baku</th>
                    <th className="py-3 px-4 text-center">Satuan</th>
                    <th className="py-3 px-4 text-right">Qty Kirim</th>
                    {data.status !== 'draft' && data.status !== 'dikirim' && (
                      <th className="py-3 px-4 text-right">Qty Terima</th>
                    )}
                    <th className="py-3 px-4 text-center">Status Fisik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-brown/5">
                  {data.surat_jalan_item?.map((item: any, idx: number) => {
                    const b = item.bahan_baku
                    const distUnit = b?.satuan_distribusi || b?.satuan || 'Unit'
                    let factor = 1
                    if (b && b.satuan_distribusi && b.satuan_distribusi !== b.satuan) {
                      const dist = b.satuan_distribusi.toLowerCase()
                      if (dist === b.satuan_tengah?.toLowerCase() && b.faktor_tengah) factor = b.faktor_tengah
                      else if (dist === b.satuan_kecil?.toLowerCase() && b.faktor_tampilan) factor = b.faktor_tampilan
                      else if (dist === 'kg' && b.satuan_kecil?.toLowerCase() === 'gram' && b.faktor_tampilan) factor = b.faktor_tampilan / 1000
                    }

                    const qtyKirim = Math.round(item.qty_dikirim * factor)
                    const qtyTerima = item.qty_terima != null ? Math.round(item.qty_terima * factor) : null
                    const isKurang = qtyTerima != null && qtyTerima < qtyKirim
                    const isRusak = item.kondisi === 'rusak' || item.kondisi === 'tidak_sesuai'

                    return (
                      <tr key={item.id || idx} className="hover:bg-suka-orange/5 transition-colors">
                        {/* No */}
                        <td className="py-3.5 px-4 text-center font-bold text-suka-gray-400">
                          {idx + 1}
                        </td>

                        {/* Nama & Kategori */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-suka-ink uppercase text-xs">
                                {b?.nama || 'Item'}
                              </span>
                              {b?.kategori && (
                                <span className="text-[8px] font-black text-suka-brown bg-[#fff8f1] border border-suka-brown/10 px-2 py-0.2 rounded uppercase">
                                  {b.kategori}
                                </span>
                              )}
                            </div>
                            {item.catatan && (
                              <p className="text-[10px] text-red-600 font-bold italic">
                                * {item.catatan}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Satuan */}
                        <td className="py-3.5 px-4 text-center text-suka-gray-600 font-bold text-[11px]">
                          {distUnit}
                        </td>

                        {/* Qty Kirim */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-black text-suka-brown text-xs bg-[#fff8f1] border border-suka-brown/10 px-2.5 py-1 rounded-xl">
                            {qtyKirim}
                          </span>
                        </td>

                        {/* Qty Terima (jika sudah dicek) */}
                        {data.status !== 'draft' && data.status !== 'dikirim' && (
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`font-black text-xs px-2.5 py-1 rounded-xl border ${
                                isKurang
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {qtyTerima ?? '-'}
                            </span>
                          </td>
                        )}

                        {/* Status Fisik */}
                        <td className="py-3.5 px-4 text-center">
                          {item.verified_at ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                                isRusak || isKurang
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {isRusak ? 'Rusak' : isKurang ? 'Kurang Kirim' : 'Sesuai'}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-suka-gray-400 bg-gray-100 px-2.5 py-1 rounded-xl">
                              Belum Dicek
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Attachment Photo Gallery (Jika ada lampiran) */}
          {data.surat_jalan_item?.some((it: any) => it.foto_path) && (
            <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-brown/10 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-suka-brown/10 pb-3">
                <FileCheck size={16} className="text-suka-orange" />
                <h3 className="font-black text-xs text-suka-brown uppercase tracking-wider font-display">
                  Lampiran Foto Bukti Serah Terima
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {data.surat_jalan_item
                  ?.filter((it: any) => it.foto_path)
                  .map((it: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#fff8f1] rounded-2xl border border-suka-brown/10 space-y-2 shadow-2xs"
                    >
                      <p className="text-xs font-black text-suka-ink uppercase truncate">
                        {it.bahan_baku?.nama || 'Item'}
                      </p>
                      <p className="text-[10px] text-suka-gray-500 font-bold">
                        Kondisi: {(it.kondisi || 'baik').toUpperCase()}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Action Suite, TTD, QR, & Verification Hub (Span 4) */}
        <div className="lg:col-span-4 space-y-5">

          {/* 1. Epson LX-310 & 3-Ply Continuous Paper Print Hub Card */}
          <div className="bg-gradient-to-br from-white to-[#fff8f1] rounded-3xl border border-suka-orange/20 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-suka-orange/10 text-suka-orange flex items-center justify-center font-black">
                  🖨️
                </div>
                <div>
                  <h4 className="font-black text-xs text-suka-brown uppercase tracking-wider font-display leading-none">
                    Epson LX-310 (3-Ply)
                  </h4>
                  <p className="text-[9px] text-suka-gray-500 font-bold mt-0.5">
                    Continuous Form 14 x 12 cm
                  </p>
                </div>
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-suka-brown text-white">
                NCR 3-Ply
              </span>
            </div>

            <p className="text-xs text-suka-gray-600 font-medium leading-relaxed">
              Format cetak dot matrix continuous form (*Putih, Merah/Kuning, Hijau/Biru*).
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handlePrintDotMatrix(1)}
                className="w-full py-3 bg-suka-orange hover:bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-suka-orange/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Printer size={15} /> Cetak Langsung Epson LX-310
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="py-2.5 bg-white border border-suka-brown/20 hover:bg-suka-brown/5 text-suka-brown rounded-2xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-2xs"
                >
                  <Eye size={13} className="text-suka-orange" /> Pratinjau
                </button>

                <button
                  onClick={handleDownloadPDF}
                  className="py-2.5 bg-white border border-suka-brown/20 hover:bg-suka-brown/5 text-suka-brown rounded-2xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-2xs"
                >
                  <Download size={13} /> PDF
                </button>
              </div>

              <button
                onClick={() => setShowLx310Guide(true)}
                className="w-full py-1 text-center text-[10px] text-suka-gray-500 font-bold hover:text-suka-orange flex items-center justify-center gap-1 cursor-pointer"
              >
                <HelpCircle size={12} /> Panduan Setting Driver LX-310 (14x12cm)
              </button>
            </div>
          </div>

          {/* 2. Signature Center (Draft Flow or Verified Signatures) */}
          {data.status === 'draft' && isPusatSender ? (
            <SignatureFlow
              suratJalanId={id}
              signatures={signatures}
              onSignatureAdded={handleSignatureAdded}
              onSent={handleSent}
            />
          ) : (
            <div className="space-y-4">
              <SignatureBlock title="Tanda Tangan Pengirim (Pusat)" sigs={data.signatures || []} />
              <SignatureBlock title="Tanda Tangan Penerima (Outlet)" sigs={data.receipt_signatures || []} />
            </div>
          )}

          {/* 3. Verification QR Code & Code Box */}
          <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-brown/10 p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 border-b border-suka-brown/10 pb-2.5">
              <QrCode size={16} className="text-suka-orange" />
              <h4 className="font-black text-xs text-suka-brown uppercase tracking-wider font-display">
                Kode Verifikasi Pengiriman
              </h4>
            </div>

            <div className="p-3.5 bg-[#fff8f1] rounded-2xl border border-suka-orange/15 text-center space-y-1">
              <span className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest">
                Kode Validasi Serah Terima
              </span>
              <div className="flex items-center justify-center gap-2">
                <p className="text-lg font-mono font-black text-suka-orange tracking-widest">
                  {data.verification_code || docNumber.substring(docNumber.length - 6)}
                </p>
                <button
                  onClick={() =>
                    handleCopyCode(data.verification_code || docNumber.substring(docNumber.length - 6))
                  }
                  className="p-1 rounded-lg bg-white border border-suka-brown/10 text-suka-gray-600 hover:text-suka-orange transition-colors cursor-pointer"
                  title="Salin Kode"
                >
                  {copiedCode ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-suka-gray-500 font-medium leading-relaxed text-center">
              Petugas outlet dapat memindai QR pada formulir 3-ply atau memasukkan kode di atas untuk serah terima.
            </p>
          </div>

          {/* 4. Finalize Button by Pusat (If Received by Outlet) */}
          {isPusatSender && (data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian') && (
            <div className="bg-gradient-to-br from-white to-emerald-50/50 rounded-3xl border border-emerald-500/30 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <h4 className="font-black text-xs text-suka-ink uppercase tracking-wider font-display">
                  Verifikasi Akhir Gudang Pusat
                </h4>
              </div>
              <p className="text-xs text-suka-gray-600 font-medium leading-relaxed">
                Barang telah diterima oleh cabang outlet. Silakan tutup Surat Jalan ini untuk membukukan data stok secara permanen.
              </p>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black uppercase tracking-wider text-xs shadow-md shadow-emerald-600/20 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <CheckCircle2 size={16} /> Verifikasi & Selesaikan Dokumen
              </button>
            </div>
          )}

          {/* 5. SOP & Compliance Card */}
          <div className="p-4 bg-[#fff8f1]/60 rounded-3xl border border-suka-brown/10 space-y-2">
            <div className="flex items-center gap-1.5 text-suka-brown font-black text-[10px] uppercase tracking-wider">
              <Info size={13} className="text-suka-orange" />
              <span>SOP Distribusi Suka Shawarma</span>
            </div>
            <ul className="text-[10px] text-suka-gray-600 space-y-1 font-medium list-disc pl-4 leading-relaxed">
              <li>Pemeriksaan fisik bahan wajib disaksikan bersama kurir.</li>
              <li>Batas pelaporan selisih/kerusakan maksimal 1x24 jam.</li>
              <li>Simpan lembar fisik 3-ply sesuai peruntukan rangkap.</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Modal Panduan Setting Epson LX-310 di Windows */}
      {showLx310Guide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-suka-brown/10 space-y-4">
            <div className="flex items-center justify-between border-b border-suka-brown/10 pb-3">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-suka-orange" />
                <h4 className="font-black text-sm text-suka-brown uppercase tracking-wide font-display">
                  Setting Driver Epson LX-310 (Windows)
                </h4>
              </div>
              <button
                onClick={() => setShowLx310Guide(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-suka-gray-500 hover:bg-suka-brown/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-suka-gray-700 space-y-3">
              <p className="font-bold text-suka-brown">
                Agar printer Epson LX-310 berhenti tepat di garis lipatan (perforasi 12 cm) tanpa membuang kertas:
              </p>

              <ol className="list-decimal pl-5 space-y-2 text-xs leading-relaxed font-medium">
                <li>
                  Buka <b>Control Panel</b> ➔ <b>Devices and Printers</b> di Windows.
                </li>
                <li>
                  Klik printer <b>Epson LX-310</b>, lalu klik menu <b>Print Server Properties</b> di bilah atas.
                </li>
                <li>
                  Centang <i>"Create a new form"</i>, beri nama Form: <code className="bg-[#fff8f1] px-1 py-0.5 rounded font-bold text-suka-orange">3PLY_14X12</code>.
                </li>
                <li>
                  Atur ukuran:
                  <ul className="list-disc pl-4 mt-1">
                    <li><b>Width (Lebar):</b> 14.00 cm</li>
                    <li><b>Height (Tinggi):</b> 12.00 cm</li>
                    <li><b>Margin (Left/Right/Top/Bottom):</b> 0.00 cm</li>
                  </ul>
                </li>
                <li>Klik <b>Save Form</b> ➔ <b>OK</b>.</li>
                <li>
                  Klik kanan pada printer <b>Epson LX-310</b> ➔ <b>Printing Preferences</b> ➔ pilih Paper Size: <b>3PLY_14X12</b> dan Paper Source: <b>Tractor Feed</b>.
                </li>
              </ol>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                💡 <b>Kertas 3-Ply NCR:</b> Saat mencetak dengan kertas rangkap 3, jarum printer akan otomatis menembus 3 lembar sekaligus, sehingga cukup cetak 1 kali (1 pass).
              </div>
            </div>

            <button
              onClick={() => setShowLx310Guide(false)}
              className="w-full py-2.5 bg-suka-brown hover:bg-suka-ink text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer"
            >
              Mengerti & Tutup Panduan
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Finalize */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-suka-brown/10 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-suka-brown uppercase tracking-wide font-display">
                Konfirmasi Verifikasi Pusat
              </h4>
              <p className="text-xs text-suka-gray-600 font-medium leading-relaxed">
                Apakah Anda yakin ingin memvalidasi dan menyelesaikan Surat Jalan ini dari pihak Pusat?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={verifying}
                className="flex-1 py-2.5 border border-suka-brown/20 text-suka-brown rounded-xl text-xs font-bold uppercase hover:bg-suka-gray-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleVerifyPusat}
                disabled={verifying}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer disabled:opacity-50"
              >
                {verifying ? 'Memproses...' : 'Ya, Selesaikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen PDF 3-Ply Modal Preview */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-suka-brown/15">
            <div className="px-5 py-3 border-b border-suka-brown/10 flex justify-between items-center bg-[#fff8f1]">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-suka-orange" />
                <div>
                  <h3 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none">
                    Pratinjau Surat Jalan (3-Ply 14 x 12 cm)
                  </h3>
                  <p className="text-[9px] text-suka-gray-500 font-bold mt-0.5">
                    Format Kertas Continuous Form / NCR 3 Rangkap (Putih, Merah/Kuning, Hijau/Biru)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintDotMatrix(1)}
                  className="px-3 py-1.5 bg-suka-orange text-white text-[10px] font-bold uppercase rounded-xl flex items-center gap-1 shadow-xs hover:bg-orange-600 cursor-pointer active:scale-95 transition-all"
                  title="Cetak 1 pass ke LX-310"
                >
                  <Printer size={12} /> Cetak LX-310 (1x)
                </button>
                <button
                  onClick={() => handlePrintDotMatrix(3)}
                  className="px-3 py-1.5 bg-white border border-suka-brown/20 text-suka-brown text-[10px] font-bold uppercase rounded-xl flex items-center gap-1 shadow-xs hover:bg-suka-brown/5 cursor-pointer active:scale-95 transition-all"
                  title="Cetak 3 lembar terpisah"
                >
                  <Printer size={12} /> Cetak 3 Rangkap
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="px-3 py-1.5 bg-suka-brown text-white text-[10px] font-bold uppercase rounded-xl flex items-center gap-1 shadow-xs hover:bg-suka-ink cursor-pointer active:scale-95 transition-all"
                >
                  <Download size={12} /> Unduh PDF
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-suka-gray-500 hover:bg-suka-brown/10 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-900/90 p-4 overflow-auto flex justify-center">
              {pdfHtml ? (
                <iframe
                  id="preview-pdf-frame"
                  srcDoc={pdfHtml}
                  className="w-full max-w-[150mm] h-full border-0 bg-transparent rounded-xl"
                  title="Pratinjau PDF Surat Jalan 3-Ply"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs font-bold text-white/50">
                  Memuat dokumen PDF 3-Ply...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
