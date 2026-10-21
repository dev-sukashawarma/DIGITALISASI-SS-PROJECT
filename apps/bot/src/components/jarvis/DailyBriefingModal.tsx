'use client'

import { useEffect, useState } from 'react'
import { mainkanSuaraHud } from '@/lib/audioHud'
import { bicaraJarvis, hentiBicaraJarvis } from '@/lib/voiceHud'
import type { DailyReportPayload, JarvisActionItem } from '@/app/api/jarvis/daily-report/route'
import {
  X,
  Volume2,
  VolumeX,
  Send,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Star,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Calendar,
  Zap,
} from 'lucide-react'

function fmtRp(angka: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(angka || 0)
}

interface DailyBriefingModalProps {
  data: DailyReportPayload | null
  memuat: boolean
  sedangBicaraBriefing: boolean
  onRefresh: () => void
  onTutup: () => void
  onTanyaJarvis: (perintah: string) => void
  onStatusBicaraChange: (bicara: boolean) => void
}

export default function DailyBriefingModal({
  data,
  memuat,
  sedangBicaraBriefing,
  onRefresh,
  onTutup,
  onTanyaJarvis,
  onStatusBicaraChange,
}: DailyBriefingModalProps) {
  const [tabWaktu, setTabWaktu] = useState<'hari_ini' | 'kemarin'>('hari_ini')
  const [mengirimTg, setMengirimTg] = useState(false)
  const [statusTg, setStatusTg] = useState<{ ok: boolean; pesan: string } | null>(null)

  useEffect(() => {
    if (data?.modeRekomendasi) {
      setTabWaktu(data.modeRekomendasi)
    }
  }, [data?.modeRekomendasi])

  const t = data?.telemetri
  const isKemarin = tabWaktu === 'kemarin' && Boolean(t?.ringkasanKemarin)
  const salesAktif = isKemarin
    ? t!.ringkasanKemarin!
    : {
        tanggalLabel: `Hari Ini (${t?.tanggalWIB || '-'})`,
        tglIso: t?.tanggalWIB || '',
        omzetTotal: t?.omzetTotal ?? 0,
        totalOrder: t?.totalOrder ?? 0,
        aov: t?.aov ?? 0,
        outletsAktifTransaksi: t?.outletsAktifTransaksi ?? [],
        outletsNolTransaksi: t?.outletsNolTransaksi ?? [],
      }

  const narasiAktif =
    tabWaktu === 'kemarin' ? data?.narasiSuaraKemarin || '' : data?.narasiSuaraHariIni || ''

  const handleToggleBicara = () => {
    if (sedangBicaraBriefing) {
      hentiBicaraJarvis()
      onStatusBicaraChange(false)
      mainkanSuaraHud('chirp')
    } else if (narasiAktif) {
      mainkanSuaraHud('engage')
      onStatusBicaraChange(true)
      bicaraJarvis(
        narasiAktif,
        () => onStatusBicaraChange(false),
        { gunakanTeksPenuh: true }
      )
    }
  }

  const handleKirimTelegram = async () => {
    if (mengirimTg) return
    mainkanSuaraHud('transmit')
    setMengirimTg(true)
    setStatusTg(null)
    try {
      const r = await fetch('/api/jarvis/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: tabWaktu }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) {
        throw new Error(j.galat || 'Gagal mengirim ke Telegram CEO.')
      }
      mainkanSuaraHud('blip')
      const pesanSukses = j.ringkasanSuara || `Berhasil dikirim ke ${j.terkirimKe} kontak Telegram CEO.`
      setStatusTg({ ok: true, pesan: pesanSukses })
      onStatusBicaraChange(true)
      bicaraJarvis(pesanSukses, () => onStatusBicaraChange(false), { gunakanTeksPenuh: true })
    } catch (e) {
      mainkanSuaraHud('alert')
      setStatusTg({ ok: false, pesan: (e as Error).message || 'Gagal mengirim ke Telegram.' })
    } finally {
      setMengirimTg(false)
    }
  }

  const handleKlikActionItem = (item: JarvisActionItem) => {
    mainkanSuaraHud('engage')
    hentiBicaraJarvis()
    onStatusBicaraChange(false)
    onTutup()
    onTanyaJarvis(item.perintahTindakLanjut)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-zinc-950/95 border border-cyan-400/50 shadow-[0_0_60px_rgba(6,182,212,0.3)] text-zinc-100 overflow-hidden">
        {/* Corner Reticles */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-300 pointer-events-none" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-300 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-300 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-300 pointer-events-none" />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-cyan-500/30 bg-black/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-400/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-hud text-sm sm:text-base font-black tracking-widest text-white uppercase text-glow-cyan">
                  J.A.R.V.I.S. // EXECUTIVE DAILY BRIEFING
                </h2>
                <span className="font-mono-hud text-[9px] px-2 py-0.5 rounded bg-cyan-900/70 border border-cyan-400/40 text-cyan-200 font-bold">
                  5-PILLAR MATRIX
                </span>
              </div>
              <p className="font-mono-hud text-[10px] text-cyan-400/80 tracking-wider">
                LAPORAN HARIAN TERPADU: SALES &bull; OPS/WASTE &bull; HRD &bull; FINANCE &bull; SUKAREVIEW
              </p>
            </div>
          </div>

          {/* Right Controls: Voice Briefing, Send Telegram, Refresh, Close */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleToggleBicara}
              disabled={!narasiAktif}
              className={`px-3 py-1.5 rounded-lg border font-hud text-[10px] tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                sedangBicaraBriefing
                  ? 'bg-red-950/80 border-red-400 text-red-200 animate-pulse'
                  : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-400/60 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              }`}
            >
              {sedangBicaraBriefing ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                  <span>STOP SUARA</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                  <span>BACAKAN LAPORAN</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleKirimTelegram}
              disabled={mengirimTg || memuat}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-hud text-[10px] tracking-wider uppercase font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.35)] flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{mengirimTg ? 'MENGIRIM...' : 'KIRIM KE TELEGRAM CEO'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('chirp')
                onRefresh()
              }}
              disabled={memuat}
              className="p-1.5 rounded-lg border border-cyan-500/30 bg-zinc-900 hover:border-cyan-400 text-cyan-300 cursor-pointer"
              title="Muat Ulang Data Live"
            >
              <RefreshCw className={`w-4 h-4 ${memuat ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('chirp')
                hentiBicaraJarvis()
                onStatusBicaraChange(false)
                onTutup()
              }}
              className="p-1.5 rounded-lg border border-red-500/40 bg-red-950/40 hover:bg-red-900/60 text-red-300 cursor-pointer"
              title="Tutup Daily Briefing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subheader: Smart Time Tabs (Live Hari Ini vs Evaluasi Penuh Kemarin) */}
        <div className="px-4 py-2.5 border-b border-cyan-500/20 bg-zinc-900/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('chirp')
                setTabWaktu('hari_ini')
              }}
              className={`px-3 py-1.5 rounded-lg font-hud text-[10px] sm:text-xs tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                tabWaktu === 'hari_ini'
                  ? 'bg-cyan-600/80 border-cyan-300 text-white shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                  : 'bg-zinc-950/70 border-cyan-500/25 text-zinc-400 hover:text-cyan-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>LIVE HARI INI ({t?.tanggalWIB || 'TODAY'})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                mainkanSuaraHud('chirp')
                setTabWaktu('kemarin')
              }}
              className={`px-3 py-1.5 rounded-lg font-hud text-[10px] sm:text-xs tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                tabWaktu === 'kemarin'
                  ? 'bg-cyan-600/80 border-cyan-300 text-white shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                  : 'bg-zinc-950/70 border-cyan-500/25 text-zinc-400 hover:text-cyan-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>EVALUASI FULL KEMARIN ({t?.ringkasanKemarin?.tglIso || 'H-1'})</span>
            </button>
          </div>

          {statusTg && (
            <div
              className={`px-3 py-1 rounded-lg border font-mono-hud text-xs flex items-center gap-1.5 ${
                statusTg.ok
                  ? 'bg-emerald-950/80 border-emerald-400/50 text-emerald-200'
                  : 'bg-red-950/80 border-red-400/50 text-red-200'
              }`}
            >
              {statusTg.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
              <span>{statusTg.pesan}</span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono-hud">
          {memuat && !t ? (
            <div className="py-16 flex flex-col items-center justify-center text-center gap-3 text-cyan-300">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="font-hud text-sm tracking-widest uppercase">
                MENYINKRONKAN 5 PILAR TELEMETRI DARI DATABASE SUPABASE...
              </p>
            </div>
          ) : (
            <>
              {/* Spoken Executive Summary Banner */}
              {narasiAktif && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/70 via-zinc-900/90 to-blue-950/70 border border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.15)] flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-hud text-[10px] tracking-widest uppercase text-cyan-300 font-bold">
                        INTISARI LISAN J.A.R.V.I.S. ({tabWaktu === 'kemarin' ? 'CLOSING KEMARIN + SIAGA HARI INI' : 'PROGRES HARI INI'})
                      </span>
                      {sedangBicaraBriefing && (
                        <span className="text-[10px] text-emerald-300 font-bold animate-pulse">
                          🔊 SEDANG DIBACAKAN...
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-cyan-100 leading-relaxed">{narasiAktif}</p>
                  </div>
                </div>
              )}

              {/* AI Executive Action Items (Prioritas Tindak Lanjut) */}
              {data?.actionItems && data.actionItems.length > 0 && (
                <div className="rounded-xl bg-zinc-900/80 border border-cyan-500/30 p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="font-hud text-xs font-bold tracking-wider uppercase text-cyan-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>AI EXECUTIVE ACTION ITEMS &amp; ANOMALY RADAR</span>
                    </h3>
                    <span className="text-[10px] text-zinc-400">Klik kartu untuk instruksikan Jarvis</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {data.actionItems.map((item) => {
                      const warnaBorder =
                        item.level === 'critical'
                          ? 'border-red-500/60 bg-red-950/30 hover:border-red-400'
                          : item.level === 'warning'
                            ? 'border-amber-500/50 bg-amber-950/25 hover:border-amber-400'
                            : 'border-emerald-500/40 bg-emerald-950/25 hover:border-emerald-400'

                      const badgeWarna =
                        item.level === 'critical'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : item.level === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleKlikActionItem(item)}
                          className={`text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${warnaBorder}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${badgeWarna}`}>
                              {item.divisi} &bull; {item.level.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-cyan-300 hover:underline">Bedah Detail &rarr;</span>
                          </div>
                          <div className="font-bold text-xs sm:text-sm text-white">{item.judul}</div>
                          <p className="text-[11px] text-zinc-300 leading-snug">{item.deskripsi}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 5 PILLARS TELEMETRY GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                {/* PILAR 1: SALES & POS LEADERBOARD (6 Cols) */}
                <div className="lg:col-span-6 rounded-xl bg-zinc-900/75 border border-cyan-500/25 p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        <h4 className="font-hud text-xs font-bold uppercase tracking-wider text-white">
                          1. SALES &amp; OUTLET LEADERBOARD ({isKemarin ? 'KEMARIN' : 'HARI INI'})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onTutup()
                          onTanyaJarvis(
                            isKemarin
                              ? 'Tampilkan tabel peringkat lengkap omzet seluruh cabang kemarin.'
                              : 'Tampilkan tabel peringkat lengkap omzet seluruh cabang hari ini.'
                          )
                        }}
                        className="text-[10px] text-cyan-300 hover:underline cursor-pointer"
                      >
                        Lihat Semua ({t?.totalOutletAktif ?? 0}) &rarr;
                      </button>
                    </div>

                    {/* Top KPI Boxes */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[10px] text-zinc-400">TOTAL OMZET</div>
                        <div className="text-xs sm:text-sm font-bold text-emerald-300 mt-0.5">
                          {fmtRp(salesAktif.omzetTotal)}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[10px] text-zinc-400">TRANSAKSI</div>
                        <div className="text-xs sm:text-sm font-bold text-cyan-200 mt-0.5">
                          {salesAktif.totalOrder} struk
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[10px] text-zinc-400">RATA-RATA (AOV)</div>
                        <div className="text-xs sm:text-sm font-bold text-cyan-200 mt-0.5">
                          {fmtRp(salesAktif.aov)}
                        </div>
                      </div>
                    </div>

                    {/* Top 5 Outlets */}
                    <div className="text-[10px] text-cyan-400 font-bold uppercase mb-1.5">
                      🏆 TOP 5 CABANG TERTINGGI ({salesAktif.outletsAktifTransaksi.length} Aktif / {salesAktif.outletsNolTransaksi.length} Nol Order)
                    </div>
                    <div className="space-y-1">
                      {salesAktif.outletsAktifTransaksi.slice(0, 5).map((o, idx) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded bg-black/40 border border-zinc-800"
                        >
                          <span className="truncate pr-2 text-zinc-200">
                            <strong className="text-cyan-400 mr-1.5">#{idx + 1}</strong>
                            {o.nama}
                          </span>
                          <span className="font-bold text-emerald-300 shrink-0">
                            {fmtRp(o.omzet)} <span className="text-[10px] text-zinc-400">({o.orderCount} tx)</span>
                          </span>
                        </div>
                      ))}
                      {salesAktif.outletsAktifTransaksi.length === 0 && (
                        <div className="text-xs text-zinc-500 py-2">Belum ada transaksi tercatat pada periode ini.</div>
                      )}
                    </div>
                  </div>

                  {/* Top 3 Menu Hari Ini */}
                  {t?.topMenu && t.topMenu.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-cyan-500/15">
                      <div className="text-[10px] text-cyan-400 font-bold uppercase mb-1">
                        🌯 TOP 3 MENU TERLARIS HARI INI
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.topMenu.slice(0, 3).map((m, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-200"
                          >
                            {idx + 1}. {m.nama} ({m.qty} porsi)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* PILAR 2: TREASURY & FINANCE (6 Cols) */}
                <div className="lg:col-span-6 rounded-xl bg-zinc-900/75 border border-cyan-500/25 p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <h4 className="font-hud text-xs font-bold uppercase tracking-wider text-white">
                          2. TREASURY, OPEX &amp; SUPPLIER PO
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onTutup()
                          onTanyaJarvis('Berikan rincian lengkap keuangan hari ini: OPEX, setoran kas, dan utang PO supplier.')
                        }}
                        className="text-[10px] text-cyan-300 hover:underline cursor-pointer"
                      >
                        Bedah Finance &rarr;
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[9px] text-zinc-400">OPEX HARI INI</div>
                        <div className="text-xs font-bold text-amber-300 mt-0.5">
                          {fmtRp(t?.finance?.pengeluaranHariIni?.totalNominal ?? 0)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[9px] text-zinc-400">SETORAN DIREKAP</div>
                        <div className="text-xs font-bold text-emerald-300 mt-0.5">
                          {fmtRp(t?.finance?.setoranKas?.inputHariIni?.totalNominal ?? 0)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[9px] text-zinc-400">UTANG PO SUPPLIER</div>
                        <div className="text-xs font-bold text-cyan-200 mt-0.5">
                          {fmtRp(t?.finance?.utangPo?.totalUtang ?? 0)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[9px] text-zinc-400">PO OVERDUE</div>
                        <div
                          className={`text-xs font-bold mt-0.5 ${
                            (t?.finance?.utangPo?.totalLewatJatuhTempo ?? 0) > 0 ? 'text-red-400' : 'text-emerald-300'
                          }`}
                        >
                          {fmtRp(t?.finance?.utangPo?.totalLewatJatuhTempo ?? 0)}
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-cyan-400 font-bold uppercase mb-1">
                      📑 TOP SUPPLIER UTANG PO BELUM LUNAS
                    </div>
                    <div className="space-y-1">
                      {(t?.finance?.utangPo?.topSupplier ?? []).slice(0, 3).map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded bg-black/40 border border-zinc-800"
                        >
                          <span className="truncate pr-2 text-zinc-200">
                            {idx + 1}. {s.supplier} ({s.jumlahPo} PO)
                          </span>
                          <span className="font-bold text-amber-300 shrink-0">{fmtRp(s.total)}</span>
                        </div>
                      ))}
                      {(t?.finance?.utangPo?.topSupplier?.length ?? 0) === 0 && (
                        <div className="text-xs text-zinc-500 py-1">Tidak ada utang PO supplier aktif.</div>
                      )}
                    </div>
                  </div>

                  {/* Rekonsiliasi Kas Tutup Shift Kemarin */}
                  {t?.finance?.setoranKas?.tutupShiftKemarin && (
                    <div className="mt-3 pt-2.5 border-t border-cyan-500/15 flex items-center justify-between text-[11px] text-zinc-300">
                      <span>Kas Fisik Closing Kemarin:</span>
                      <span className="text-cyan-200 font-bold">
                        {fmtRp(t.finance.setoranKas.tutupShiftKemarin.totalFisikKas)} (
                        {t.finance.setoranKas.tutupShiftKemarin.sudahDirekap} direkap /{' '}
                        {t.finance.setoranKas.tutupShiftKemarin.belumDirekap} antrean)
                      </span>
                    </div>
                  )}
                </div>

                {/* PILAR 3: OPERASIONAL, VOID & WASTE (4 Cols) */}
                <div className="lg:col-span-4 rounded-xl bg-zinc-900/75 border border-cyan-500/25 p-3.5">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-hud text-xs font-bold uppercase tracking-wider text-white">
                        3. OPS, VOID &amp; WASTE
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Shift Kasir Buka:</span>
                      <span className="font-bold text-emerald-300">
                        {t?.statusBuka?.totalBuka ?? 0} Buka / {t?.statusBuka?.totalBelumBuka ?? 0} Belum
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Void POS Hari Ini:</span>
                      <span
                        className={`font-bold ${
                          (t?.voidOrder?.totalVoidHariIni ?? 0) > 0 ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                      >
                        {t?.voidOrder?.totalVoidHariIni ?? 0} tx ({fmtRp(t?.voidOrder?.totalNilaiVoidHariIni ?? 0)})
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Est. Waste 30 Hari:</span>
                      <span className="font-bold text-amber-300">
                        {fmtRp(t?.waste?.totalEstKerugianRp ?? 0)} ({t?.waste?.totalLaporan30Hari ?? 0} lap)
                      </span>
                    </div>

                    {t?.waste?.topBahan && t.waste.topBahan.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Top Komoditas Waste:</div>
                        {t.waste.topBahan.slice(0, 2).map((b, i) => (
                          <div key={i} className="text-[11px] text-zinc-300 truncate">
                            • {b.nama}: {b.totalQty} {b.satuan} ({fmtRp(b.estKerugianRp)})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* PILAR 4: WORKFORCE / HRD (4 Cols) */}
                <div className="lg:col-span-4 rounded-xl bg-zinc-900/75 border border-cyan-500/25 p-3.5">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      <h4 className="font-hud text-xs font-bold uppercase tracking-wider text-white">
                        4. WORKFORCE &amp; HRD
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Tingkat On-Time:</span>
                      <span className="font-bold text-emerald-300">
                        {t?.persenOnTime ?? 100}% ({t?.kehadiranTotal ?? 0} clock-in)
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Kru Terlambat:</span>
                      <span className={`font-bold ${(t?.kehadiranTelat ?? 0) > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {t?.kehadiranTelat ?? 0} orang
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Kru Izin / Cuti:</span>
                      <span className="font-bold text-cyan-200">{t?.stafCutiIzin?.length ?? 0} orang</span>
                    </div>

                    {t?.stafTelat && t.stafTelat.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[10px] text-amber-300 font-bold uppercase mb-1">Catatan Keterlambatan:</div>
                        {t.stafTelat.slice(0, 2).map((s, i) => (
                          <div key={i} className="text-[11px] text-zinc-300 truncate">
                            • {s.nama} ({s.outlet}): {s.telatMenit} mnt
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* PILAR 5: CUSTOMER EXPERIENCE / SUKAREVIEW (4 Cols) */}
                <div className="lg:col-span-4 rounded-xl bg-zinc-900/75 border border-cyan-500/25 p-3.5">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <h4 className="font-hud text-xs font-bold uppercase tracking-wider text-white">
                        5. GOOGLE REVIEWS
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Rating Konsolidasi:</span>
                      <span className="font-bold text-yellow-300">
                        {t?.review?.ratingRataRata ?? 4.8} ⭐ ({t?.review?.totalUlasan ?? 0} ulasan)
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Ulasan Kritis (≤2⭐):</span>
                      <span
                        className={`font-bold ${
                          (t?.review?.ulasanNegatifTerbaru?.length ?? 0) > 0 ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                      >
                        {t?.review?.ulasanNegatifTerbaru?.length ?? 0} ulasan terbaru
                      </span>
                    </div>

                    {t?.review?.ulasanNegatifTerbaru && t.review.ulasanNegatifTerbaru.length > 0 ? (
                      <div className="pt-1">
                        <div className="text-[10px] text-amber-300 font-bold uppercase mb-1">Komplain Terbaru:</div>
                        {t.review.ulasanNegatifTerbaru.slice(0, 2).map((r, i) => (
                          <div key={i} className="text-[11px] text-zinc-300 line-clamp-2">
                            • ⭐{r.rating} <strong>{r.outlet}</strong>: &ldquo;{r.komentar}&rdquo;
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-300 pt-1">
                        ✅ Sentimen pelanggan terjaga positif tanpa komplain kritis baru.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
