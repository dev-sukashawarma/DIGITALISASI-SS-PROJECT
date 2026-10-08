'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  CalendarDays,
  BarChart3,
  TrendingUp,
  Settings2,
  UploadCloud,
  Link2,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  RefreshCw,
  Search,
  Flame,
  Award,
  ChevronRight,
  ShieldCheck,
  FileVideo,
  Eye,
  Check,
  Zap,
  Info,
  ExternalLink,
  Sliders,
  X,
  Volume2,
  Utensils,
  Share2,
} from 'lucide-react'
import {
  SerializedVideoAnalysis,
  analyzeVideoAction,
  deleteVideoAnalysisAction,
  updateContentStatusFromAnalysis,
} from '@/app/actions/video-analysis'

interface InternalContentItem {
  id: string
  title: string
  platform: string
  status: string
  pillar: string
  postDate: string
}

interface VideoAnalysisClientProps {
  initialAnalyses: SerializedVideoAnalysis[]
  internalContents: InternalContentItem[]
  userRole: string
}

export default function VideoAnalysisClient({
  initialAnalyses,
  internalContents,
  userRole,
}: VideoAnalysisClientProps) {
  const [analyses, setAnalyses] = useState<SerializedVideoAnalysis[]>(initialAnalyses)
  const [selectedAnalysis, setSelectedAnalysis] = useState<SerializedVideoAnalysis | null>(
    initialAnalyses.length > 0 ? initialAnalyses[0] : null
  )

  // Form State
  const [inputMode, setInputMode] = useState<'FILE' | 'URL'>('FILE')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>('')
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const [selectedContentId, setSelectedContentId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Upload & Analysis Progress State
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [analysisStep, setAnalysisStep] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Riwayat search filter
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  // Ref untuk file input
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setVideoFile(file)
      if (!title) {
        // Otomatis isi judul dari nama file tanpa ekstensi
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        setTitle(nameWithoutExt)
      }
      const localUrl = URL.createObjectURL(file)
      setFilePreviewUrl(localUrl)
    }
  }

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setVideoFile(file)
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        setTitle(nameWithoutExt)
      }
      const localUrl = URL.createObjectURL(file)
      setFilePreviewUrl(localUrl)
    }
  }

  // Trigger video analysis
  const handleStartAnalysis = async () => {
    if (!title.trim()) {
      setErrorMessage('Harap masukkan judul video terlebih dahulu.')
      return
    }

    if (inputMode === 'FILE' && !videoFile && !filePreviewUrl) {
      setErrorMessage('Harap pilih file video yang ingin dianalisis.')
      return
    }

    if (inputMode === 'URL' && !videoUrl.trim()) {
      setErrorMessage('Harap masukkan tautan (URL) video.')
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)

    let finalVideoUrl = videoUrl

    // 1. Upload file jika mode FILE
    if (inputMode === 'FILE' && videoFile) {
      setIsUploading(true)
      setAnalysisStep('Mengunggah file video ke server...')
      try {
        const formData = new FormData()
        formData.append('file', videoFile)

        const uploadRes = await fetch('/api/upload-video', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const errJson = await uploadRes.json()
          throw new Error(errJson.error || 'Gagal mengunggah file video')
        }

        const uploadData = await uploadRes.json()
        finalVideoUrl = uploadData.url
      } catch (err: any) {
        setIsUploading(false)
        setErrorMessage(err.message || 'Gagal mengunggah file video.')
        return
      } finally {
        setIsUploading(false)
      }
    }

    // 2. Jalankan Analisis AI
    setIsAnalyzing(true)
    setAnalysisStep('Menghubungkan ke 9router AI & mengevaluasi video...')

    try {
      const res = await analyzeVideoAction({
        title: title.trim(),
        videoUrl: finalVideoUrl,
        videoSource: inputMode,
        internalContentId: selectedContentId || null,
        notes: notes.trim(),
      })

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Gagal menganalisis video.')
      }

      const newAnalysis = res.data
      setAnalyses((prev) => [newAnalysis, ...prev])
      setSelectedAnalysis(newAnalysis)
      setSuccessMessage('Analisis video berhasil diselesaikan!')

      // Reset form input video file
      setVideoFile(null)
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses analisis video.')
    } finally {
      setIsAnalyzing(false)
      setAnalysisStep('')
    }
  }

  // Handle hapus riwayat
  const handleDeleteAnalysis = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Apakah Anda yakin ingin menghapus hasil analisis video ini dari riwayat?')) return

    startTransition(async () => {
      const res = await deleteVideoAnalysisAction(id)
      if (res.success) {
        setAnalyses((prev) => prev.filter((a) => a.id !== id))
        if (selectedAnalysis?.id === id) {
          const remaining = analyses.filter((a) => a.id !== id)
          setSelectedAnalysis(remaining.length > 0 ? remaining[0] : null)
        }
      } else {
        setErrorMessage(res.error || 'Gagal menghapus riwayat.')
      }
    })
  }

  // Handle 1-klik update status konten
  const handleUpdateContentStatus = (status: string) => {
    if (!selectedAnalysis?.internalContentId) return

    startTransition(async () => {
      const res = await updateContentStatusFromAnalysis(selectedAnalysis.internalContentId!, status)
      if (res.success) {
        setSuccessMessage(`Status agenda berhasil diperbarui menjadi "${status}"!`)
        // Update local state
        setAnalyses((prev) =>
          prev.map((a) =>
            a.id === selectedAnalysis.id && a.internalContent
              ? { ...a, internalContent: { ...a.internalContent, status } }
              : a
          )
        )
        if (selectedAnalysis.internalContent) {
          setSelectedAnalysis({
            ...selectedAnalysis,
            internalContent: {
              ...selectedAnalysis.internalContent,
              status,
            },
          })
        }
      } else {
        setErrorMessage(res.error || 'Gagal memperbarui status agenda.')
      }
    })
  }

  // Filter riwayat
  const filteredAnalyses = useMemo(() => {
    if (!searchQuery.trim()) return analyses
    const q = searchQuery.toLowerCase()
    return analyses.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.internalContent?.title.toLowerCase().includes(q) ||
        a.verdict.toLowerCase().includes(q)
    )
  }, [analyses, searchQuery])

  // Helper score color
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
    if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-200'
    return 'text-red-700 bg-red-50 border-red-200'
  }

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'READY':
        return {
          label: 'SIAP POSTING',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        }
      case 'BOOSTER':
        return {
          label: 'POTENSIAL BOOSTER ADS',
          className: 'bg-blue-100 text-blue-800 border-blue-300',
        }
      case 'REVISION':
        return {
          label: 'PERLU REVISI',
          className: 'bg-amber-100 text-amber-800 border-amber-300',
        }
      default:
        return {
          label: 'DALAM REVIEW',
          className: 'bg-stone-100 text-stone-800 border-stone-300',
        }
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-600 mb-1">
            <span>Konten Planner</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#D9480F]">Analisis Video AI</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A1715] tracking-tight flex items-center gap-3">
            <span>Analisis Video AI</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#D9480F]/10 text-[#D9480F] font-bold border border-[#D9480F]/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              9router Engine
            </span>
          </h1>
          <p className="text-stone-600 text-xs sm:text-sm mt-1">
            Audit mendalam draf video internal Suka Shawarma: evaluasi hook 3 detik, visual food appeal, audio, pro/cons, dan rekomendasi perbaikan sebelum tayang.
          </p>
        </div>
      </div>

      {/* Top Tab Switcher (Konten Planner navigation) */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FAF8F5] border border-[#EFE8DE] rounded-2xl w-fit flex-wrap shadow-2xs">
        <Link
          href="/dashboard/content-planner"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <CalendarDays className="w-4 h-4 text-stone-400" />
          <span>Rencana Konten</span>
        </Link>

        <Link
          href="/dashboard/content-planner/metrik-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <BarChart3 className="w-4 h-4 text-stone-400" />
          <span>Metrik Data</span>
        </Link>

        {/* Active Tab */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-[#D9480F] text-white shadow-xs">
          <Sparkles className="w-4 h-4" />
          <span>Analisis Video</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-bold">
            AI
          </span>
        </div>

        <Link
          href="/dashboard/content-planner/referensi-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <TrendingUp className="w-4 h-4 text-stone-400" />
          <span>Referensi Data</span>
        </Link>

        <Link
          href="/dashboard/content-planner/pengaturan"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <Settings2 className="w-4 h-4 text-stone-400" />
          <span>Pengaturan Konten</span>
        </Link>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-700 hover:text-red-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Split-Screen 2 Kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================
            KOLOM KIRI: Input Video & Riwayat Analisis
            ========================================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Form Input Video */}
          <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EFE8DE] pb-3">
              <h2 className="text-sm font-extrabold text-[#1A1715] flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-[#D9480F]" />
                <span>Upload & Sumber Video</span>
              </h2>
              {/* Mode Switcher */}
              <div className="flex items-center p-1 bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setInputMode('FILE')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    inputMode === 'FILE' ? 'bg-[#D9480F] text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('URL')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    inputMode === 'URL' ? 'bg-[#D9480F] text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Link URL
                </button>
              </div>
            </div>

            {/* Upload Area jika FILE */}
            {inputMode === 'FILE' ? (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                />
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#EFE8DE] hover:border-[#D9480F]/50 rounded-2xl p-5 text-center bg-[#FAF8F5] hover:bg-[#FAF8F5]/80 transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-white border border-[#EFE8DE] flex items-center justify-center text-[#D9480F] group-hover:scale-105 transition-transform shadow-2xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="mt-2.5 text-xs font-bold text-stone-800">
                    {videoFile ? videoFile.name : 'Tarik & lepas file video ke sini'}
                  </p>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    {videoFile
                      ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB - Klik untuk ganti file`
                      : 'Atau klik untuk memilih file (MP4, MOV, WebM maks. 150MB)'}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tautan Video (TikTok / IG Reel / Shorts / Drive)
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@... atau https://instagram.com/reel/..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F] font-medium"
                  />
                </div>
              </div>
            )}

            {/* Video Player Preview jika ada */}
            {(filePreviewUrl || (inputMode === 'URL' && videoUrl.includes('.mp4'))) && (
              <div className="rounded-2xl overflow-hidden border border-[#EFE8DE] bg-black">
                <video
                  src={filePreviewUrl || videoUrl}
                  controls
                  className="w-full max-h-56 object-contain"
                />
              </div>
            )}

            {/* Judul Video */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Judul / Topik Video <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Draf Reel Promo Shawarma Jumbo 25k"
                className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F] font-medium"
              />
            </div>

            {/* Tautkan ke Rencana Konten (Opsional) */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center justify-between">
                <span>Tautkan ke Agenda Konten (Opsional)</span>
                <span className="text-[10px] text-stone-600 font-normal">Internal Content</span>
              </label>
              <select
                value={selectedContentId}
                onChange={(e) => setSelectedContentId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F] font-medium text-stone-700"
              >
                <option value="">-- Berdiri Sendiri (Tanpa Agenda) --</option>
                {internalContents.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.platform}] {c.title} ({c.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Catatan Khusus */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Catatan Tambahan untuk AI (Opsional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Misal: Perhatikan apakah audio di intro terdengar jelas dan apakah harga 25rb tersorot tajam..."
                className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F] font-medium"
              />
            </div>

            {/* Tombol Jalankan Analisis */}
            <button
              type="button"
              onClick={handleStartAnalysis}
              disabled={isUploading || isAnalyzing}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#D9480F] to-[#EA580C] hover:from-[#C03E0B] hover:to-[#D9480F] text-white font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading || isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{analysisStep || 'Memproses Analisis...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Mulai Analisis Video dengan AI</span>
                </>
              )}
            </button>
          </div>

          {/* Card Riwayat Analisis */}
          <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EFE8DE] pb-3">
              <h2 className="text-sm font-extrabold text-[#1A1715] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D9480F]" />
                <span>Riwayat Analisis</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
                  {analyses.length}
                </span>
              </h2>
            </div>

            {/* Search Riwayat */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari riwayat video..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:border-[#D9480F]"
              />
            </div>

            {/* List Riwayat */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredAnalyses.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  Belum ada riwayat analisis video yang tersimpan.
                </div>
              ) : (
                filteredAnalyses.map((item) => {
                  const isSelected = selectedAnalysis?.id === item.id
                  const verdictBadge = getVerdictBadge(item.verdict)
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAnalysis(item)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#FFF4ED] border-[#D9480F] shadow-xs'
                          : 'bg-[#FAF8F5] border-[#EFE8DE] hover:border-stone-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold border ${verdictBadge.className}`}>
                            {verdictBadge.label}
                          </span>
                          <span className="text-[10px] text-stone-600 font-mono">
                            {new Date(item.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-[#1A1715] truncate mt-1">
                          {item.title}
                        </h3>
                        {item.internalContent && (
                          <p className="text-[10px] text-stone-600 truncate mt-0.5">
                            Terkait: {item.internalContent.title}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`w-9 h-9 rounded-xl border flex flex-col items-center justify-center font-mono font-black text-xs ${getScoreColor(item.overallScore)}`}>
                          <span>{item.overallScore}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAnalysis(item.id, e)}
                          className="w-7 h-7 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Hapus dari riwayat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* =========================================
            KOLOM KANAN: Dashboard Hasil Analisis AI
            ========================================= */}
        <div className="lg:col-span-7">
          {selectedAnalysis ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Top Banner Executive Result */}
              <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs p-6 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFE8DE] pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-black border ${getVerdictBadge(selectedAnalysis.verdict).className}`}>
                        {getVerdictBadge(selectedAnalysis.verdict).label}
                      </span>
                      <span className="text-xs text-stone-600 font-mono">
                        ID #{selectedAnalysis.id}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-[#1A1715] mt-2">
                      {selectedAnalysis.title}
                    </h2>
                    {selectedAnalysis.internalContent && (
                      <div className="mt-1 text-xs text-stone-600 flex items-center gap-2">
                        <span>Agenda: <strong>{selectedAnalysis.internalContent.title}</strong></span>
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold text-[10px]">
                          Status saat ini: {selectedAnalysis.internalContent.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Circular Score Highlight */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center min-w-[100px] ${getScoreColor(selectedAnalysis.overallScore)}`}>
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Skor Total</span>
                      <span className="text-3xl sm:text-4xl font-black font-mono leading-none mt-1">
                        {selectedAnalysis.overallScore}
                      </span>
                      <span className="text-[9px] font-bold opacity-75 mt-0.5">/ 100</span>
                    </div>
                  </div>
                </div>

                {/* 1-Klik Action Update Status Konten jika ada internalContentId */}
                {selectedAnalysis.internalContentId && (
                  <div className="mt-4 pt-3 border-t border-[#EFE8DE]/60 flex items-center justify-between gap-3 flex-wrap bg-[#FAF8F5] -mx-6 -mb-6 p-4 rounded-b-3xl">
                    <div className="text-xs font-semibold text-stone-700">
                      Update status Rencana Konten:
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateContentStatus('Sudah Siap Posting')}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Set Siap Posting</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateContentStatus('Perlu Revisi')}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Set Perlu Revisi</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Matriks 5 Aspek Penilaian */}
              <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#D9480F]" />
                  <span>Matriks 5 Aspek Penilaian Konten F&B</span>
                </h3>

                <div className="space-y-3.5">
                  {/* 1. Hook 3 Detik */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-stone-700 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        Hook 3 Detik (Scroll-Stopping Power)
                      </span>
                      <span className="font-mono text-[#1A1715]">{selectedAnalysis.hookScore}/100</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-[#D9480F] rounded-full transition-all duration-500"
                        style={{ width: `${selectedAnalysis.hookScore}%` }}
                      />
                    </div>
                  </div>

                  {/* 2. Food Appeal */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-stone-700 flex items-center gap-1.5">
                        <Utensils className="w-3.5 h-3.5 text-amber-600" />
                        Visual Food Appeal (Tekstur Daging, Saus & Plating)
                      </span>
                      <span className="font-mono text-[#1A1715]">{selectedAnalysis.foodAppealScore}/100</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500"
                        style={{ width: `${selectedAnalysis.foodAppealScore}%` }}
                      />
                    </div>
                  </div>

                  {/* 3. Audio & Voiceover */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-stone-700 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                        Kualitas Audio, Voiceover & BGM
                      </span>
                      <span className="font-mono text-[#1A1715]">{selectedAnalysis.audioScore}/100</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${selectedAnalysis.audioScore}%` }}
                      />
                    </div>
                  </div>

                  {/* 4. Pacing Editing */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-stone-700 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-500" />
                        Pacing Editing & Ritme Retensi Penonton
                      </span>
                      <span className="font-mono text-[#1A1715]">{selectedAnalysis.pacingScore}/100</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${selectedAnalysis.pacingScore}%` }}
                      />
                    </div>
                  </div>

                  {/* 5. Branding & CTA */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-stone-700 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-purple-500" />
                        Branding Suka Shawarma & Kejelasan CTA (Call to Action)
                      </span>
                      <span className="font-mono text-[#1A1715]">{selectedAnalysis.ctaScore}/100</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${selectedAnalysis.ctaScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Cards: Pro & Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kelebihan (Pros) */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-3xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Kelebihan Video (Pros)</span>
                  </div>
                  <ul className="space-y-2 text-xs text-emerald-950 font-medium">
                    {selectedAnalysis.pros && selectedAnalysis.pros.length > 0 ? (
                      selectedAnalysis.pros.map((pro, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>{pro}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-stone-400">Tidak ada poin kelebihan spesifik.</li>
                    )}
                  </ul>
                </div>

                {/* Kekurangan (Cons) */}
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-3xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-rose-900 font-extrabold text-sm">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Kekurangan Video (Cons)</span>
                  </div>
                  <ul className="space-y-2 text-xs text-rose-950 font-medium">
                    {selectedAnalysis.cons && selectedAnalysis.cons.length > 0 ? (
                      selectedAnalysis.cons.map((con, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                          <span>{con}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-stone-400">Tidak ada kekurangan signifikan yang terdeteksi.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Actionable Checklist Saran Perbaikan Internal */}
              <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs p-6 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D9480F]" />
                  <span>Checklist Rekomendasi Revisi untuk Video Editor / Kreator</span>
                </h3>
                <div className="space-y-2.5">
                  {selectedAnalysis.improvements && selectedAnalysis.improvements.length > 0 ? (
                    selectedAnalysis.improvements.map((imp, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] text-xs text-stone-800 flex items-start gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-lg bg-[#D9480F]/10 text-[#D9480F] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="font-medium leading-relaxed">{imp}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400">Belum ada saran perbaikan yang dicatat.</p>
                  )}
                </div>
              </div>

              {/* Prediksi Data Performa & Insight Platform */}
              {selectedAnalysis.metricsData && (
                <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs p-6 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#D9480F]" />
                    <span>Prediksi Performa & Rekomendasi Algoritma</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                      <span className="text-[10px] font-bold text-stone-600 uppercase block">Potensi Virality</span>
                      <span className="text-sm font-black text-[#D9480F] mt-1 block">
                        {selectedAnalysis.metricsData.viralityPotential || 'SEDANG'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                      <span className="text-[10px] font-bold text-stone-600 uppercase block">Risiko Drop-Off</span>
                      <span className="text-sm font-black text-stone-800 mt-1 block">
                        {selectedAnalysis.metricsData.retentionRisk || 'SEDANG'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                      <span className="text-[10px] font-bold text-stone-600 uppercase block">Titik Rawan Skip</span>
                      <span className="text-sm font-black text-stone-800 mt-1 block truncate">
                        {selectedAnalysis.metricsData.dropoffRiskTimestamp || 'Detik ke-5'}
                      </span>
                    </div>
                  </div>

                  {selectedAnalysis.metricsData.recommendedCaption && (
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase text-stone-600 tracking-wider">
                        Saran Teks Caption & Hashtag
                      </span>
                      <p className="text-xs text-stone-700 italic">
                        &quot;{selectedAnalysis.metricsData.recommendedCaption}&quot;
                      </p>
                    </div>
                  )}

                  {selectedAnalysis.metricsData.notice && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>{selectedAnalysis.metricsData.notice}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs p-10 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-black text-[#1A1715]">
                  Belum Ada Video yang Dipilih
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Unggah file video baru di sisi kiri atau pilih salah satu riwayat evaluasi untuk melihat ringkasan skor, pro/cons, dan rekomendasi revisi.
                </p>
              </div>

              {/* 5 Panduan Singkat */}
              <div className="pt-4 border-t border-[#EFE8DE] grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    Hook 3 Detik
                  </span>
                  <p className="text-[11px] text-stone-600 mt-1">
                    Pastikan tampilan daging shawarma berputar atau aksi memotong daging langsung muncul di 3 detik awal.
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-amber-600" />
                    Food Appeal
                  </span>
                  <p className="text-[11px] text-stone-600 mt-1">
                    Sorot kilau saus garlic toum dan keju meleleh dengan pencahayaan warm natural.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
