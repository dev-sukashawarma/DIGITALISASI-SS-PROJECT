'use client'

import { useEffect, useState } from 'react'
import { mainkanSuaraHud } from '@/lib/audioHud'
import { bicaraJarvis, hentiBicaraJarvis } from '@/lib/voiceHud'
import type { DailyReportPayload, JarvisActionItem } from '@/app/api/jarvis/daily-report/route'
import type { SaranStrategisDivisi } from '@/lib/server/devSimulasi'
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
  Printer,
  Lightbulb,
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
  const [tabWaktu, setTabWaktu] = useState<'hari_ini' | 'kemarin'>('kemarin')
  const [mengirimTg, setMengirimTg] = useState(false)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)
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
        omzetBersihTotal: t?.ringkasanHariIni?.omzetBersihTotal ?? t?.omzetTotal ?? 0,
        potonganTotal: t?.ringkasanHariIni?.potonganTotal ?? 0,
        totalHpp: t?.ringkasanHariIni?.totalHpp ?? 0,
        labaKotorTotal: t?.ringkasanHariIni?.labaKotorTotal ?? 0,
        totalPorsi: t?.ringkasanHariIni?.totalPorsi ?? 0,
        totalOrder: t?.totalOrder ?? 0,
        aov: t?.aov ?? 0,
        outletsAktifTransaksi: t?.outletsAktifTransaksi ?? [],
        outletsNolTransaksi: t?.outletsNolTransaksi ?? [],
        menuTersepi: t?.ringkasanHariIni?.menuTersepi ?? [],
      }

  const omzetBersihAktif = salesAktif.omzetBersihTotal ?? salesAktif.omzetTotal
  const hppAktif = salesAktif.totalHpp ?? 0
  const labaKotorAktif = salesAktif.labaKotorTotal ?? Math.max(0, omzetBersihAktif - hppAktif)
  const marginPersenAktif =
    omzetBersihAktif > 0 && labaKotorAktif > 0 ? Math.round((labaKotorAktif / omzetBersihAktif) * 1000) / 10 : 0
  const menuTersepiAktif = salesAktif.menuTersepi ?? []
  const trenAktif = isKemarin ? t?.trenHarian : undefined

  const menuAktif = isKemarin
    ? (t?.topMenuKemarin ?? t?.ringkasanKemarin?.topMenu ?? [])
    : (t?.topMenu ?? [])

  const opexNominalAktif = isKemarin
    ? (t?.finance?.pengeluaranKemarin?.totalNominal ?? 0)
    : (t?.finance?.pengeluaranHariIni?.totalNominal ?? 0)
  const opexTxCountAktif = isKemarin
    ? (t?.finance?.pengeluaranKemarin?.jumlahTransaksi ?? 0)
    : (t?.finance?.pengeluaranHariIni?.jumlahTransaksi ?? 0)

  const voidCountAktif = isKemarin
    ? (t?.voidOrder?.totalVoidKemarin ?? 0)
    : (t?.voidOrder?.totalVoidHariIni ?? 0)
  const voidRpAktif = isKemarin
    ? (t?.voidOrder?.totalNilaiVoidKemarin ?? 0)
    : (t?.voidOrder?.totalNilaiVoidHariIni ?? 0)

  const hrdOnTimeAktif = isKemarin ? (t?.hrdKemarin?.persenOnTime ?? 100) : (t?.persenOnTime ?? 100)
  const hrdTotalAktif = isKemarin ? (t?.hrdKemarin?.kehadiranTotal ?? 0) : (t?.kehadiranTotal ?? 0)
  const hrdTelatAktif = isKemarin ? (t?.hrdKemarin?.kehadiranTelat ?? 0) : (t?.kehadiranTelat ?? 0)
  const hrdCutiAktif = isKemarin ? (t?.hrdKemarin?.stafCutiIzin ?? []) : (t?.stafCutiIzin ?? [])
  const hrdStafTelatAktif = isKemarin ? (t?.hrdKemarin?.stafTelat ?? []) : (t?.stafTelat ?? [])

  const actionItemsAktif = isKemarin
    ? (data?.actionItemsKemarin ?? data?.actionItems ?? [])
    : (data?.actionItemsHariIni ?? data?.actionItems ?? [])

  const saranStrategisAktif: SaranStrategisDivisi[] = isKemarin
    ? (data?.saranStrategisKemarin ?? [])
    : (data?.saranStrategisHariIni ?? [])

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

  const handleDispatchSaran = async (saranId: string | null, targetBot: string) => {
    const key = saranId || 'all'
    if (dispatchingId) return
    mainkanSuaraHud('transmit')
    setDispatchingId(key)
    setStatusTg(null)
    try {
      const r = await fetch('/api/jarvis/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dispatch',
          mode: tabWaktu,
          saranId,
          targetBot,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) {
        throw new Error(j.galat || 'Gagal meneruskan instruksi ke bot divisi.')
      }
      mainkanSuaraHud('blip')
      const pesanSukses = j.ringkasanSuara || `Instruksi berhasil dikirim ke ${j.terkirimKe} kontak divisi.`
      setStatusTg({ ok: true, pesan: pesanSukses })
      onStatusBicaraChange(true)
      bicaraJarvis(pesanSukses, () => onStatusBicaraChange(false), { gunakanTeksPenuh: true })
    } catch (e) {
      mainkanSuaraHud('alert')
      setStatusTg({ ok: false, pesan: (e as Error).message || 'Gagal dispatch instruksi.' })
    } finally {
      setDispatchingId(null)
    }
  }

  const handleCetakPdf = () => {
    mainkanSuaraHud('engage')
    if (typeof window === 'undefined' || !t) return
    const win = window.open('', '_blank', 'width=980,height=820')
    if (!win) return

    const topOutletsRows = salesAktif.outletsAktifTransaksi
      .slice(0, 10)
      .map(
        (o, idx) =>
          `<tr><td>#${idx + 1}</td><td><strong>${o.nama}</strong></td><td>${fmtRp(o.omzet)}</td><td>${o.orderCount} struk</td><td>${fmtRp(o.orderCount > 0 ? Math.round(o.omzet / o.orderCount) : 0)}</td></tr>`
      )
      .join('')

    const saranHtml = saranStrategisAktif
      .map(
        (s, idx) =>
          `<div class="card">
            <div class="card-head"><strong>${idx + 1}. [${s.divisi}] ${s.judul}</strong> <span class="badge">${s.labelBot} &bull; ${s.prioritas.toUpperCase()}</span></div>
            <ul>${s.poinSaran.map((p) => `<li>${p}</li>`).join('')}</ul>
            <div class="target">🎯 Target Dampak: ${s.dampakTarget}</div>
          </div>`
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Laporan Evaluasi Eksekutif Suka Shawarma - ${salesAktif.tanggalLabel}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 28px; line-height: 1.45; }
    h1 { font-size: 20px; margin: 0 0 4px 0; color: #0f172a; }
    h2 { font-size: 14px; margin: 20px 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #0284c7; color: #0369a1; text-transform: uppercase; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 16px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
    .kpi .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .kpi .val { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .kpi .sub { font-size: 11px; color: #0284c7; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #e0f2fe; color: #0369a1; font-weight: 700; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
    .card-head { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .badge { font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; }
    ul { margin: 4px 0 6px 18px; padding: 0; font-size: 12px; }
    .target { font-size: 11px; color: #047857; font-weight: 600; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>LAPORAN EVALUASI OPERASIONAL &amp; EKSEKUTIF KOMPREHENSIF</h1>
  <div class="meta">PT Sukaroups Indonesia (Suka Shawarma) &bull; Periode Evaluasi: <strong>${salesAktif.tanggalLabel}</strong> &bull; Dicetak dari J.A.R.V.I.S. Command Centre</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="lbl">Omzet Bersih (Net)</div><div class="val">${fmtRp(omzetBersihAktif)}</div><div class="sub">${salesAktif.totalOrder} struk (AOV ${fmtRp(salesAktif.aov)})</div></div>
    <div class="kpi"><div class="lbl">Laba Kotor (Gross Profit)</div><div class="val">${fmtRp(labaKotorAktif)}</div><div class="sub">Margin ${marginPersenAktif}% | HPP ${fmtRp(hppAktif)}</div></div>
    <div class="kpi"><div class="lbl">OPEX &amp; Kas Closing</div><div class="val">${fmtRp(opexNominalAktif)}</div><div class="sub">Kas Fisik: ${fmtRp(t.finance?.setoranKas?.tutupShiftKemarin?.totalFisikKas ?? 0)}</div></div>
    <div class="kpi"><div class="lbl">Presensi &amp; Sidak AM</div><div class="val">${hrdOnTimeAktif}% On-Time</div><div class="sub">${hrdTotalAktif} clock-in | Rating ${t.review?.ratingRataRata ?? 4.8}⭐</div></div>
  </div>
  <h2>I. Peringkat Penjualan Cabang (Top 10)</h2>
  <table>
    <thead><tr><th>Rank</th><th>Cabang</th><th>Omzet</th><th>Transaksi</th><th>AOV</th></tr></thead>
    <tbody>${topOutletsRows || '<tr><td colspan="5">Belum ada transaksi</td></tr>'}</tbody>
  </table>
  <h2>II. Rekomendasi &amp; Saran Strategis Agent Lintas Divisi</h2>
  ${saranHtml}
  <script>window.onload = () => { setTimeout(() => window.print(), 250); };</script>
</body>
</html>`
    win.document.open()
    win.document.write(html)
    win.document.close()
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
              onClick={handleCetakPdf}
              disabled={!t}
              className="px-3 py-1.5 rounded-lg border border-cyan-400/50 bg-zinc-900/90 hover:bg-cyan-950/80 disabled:opacity-50 text-cyan-200 font-hud text-[10px] tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Cetak / Simpan PDF Laporan Evaluasi"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-300" />
              <span>CETAK / PDF</span>
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

        {/* Subheader: Smart Time Tabs (Evaluasi Full Kemarin H-1 sebagai Default Utama vs Live Hari Ini) */}
        <div className="px-4 py-2.5 border-b border-cyan-500/20 bg-zinc-900/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
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
                        INTISARI LISAN J.A.R.V.I.S. ({tabWaktu === 'kemarin' ? 'CLOSING FULL KEMARIN H-1' : 'PROGRES LIVE HARI INI'})
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

              {/* AI Executive Action Items (Prioritas Tindak Lanjut mengikuti tab waktu) */}
              {actionItemsAktif.length > 0 && (
                <div className="rounded-xl bg-zinc-900/80 border border-cyan-500/30 p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="font-hud text-xs font-bold tracking-wider uppercase text-cyan-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>
                        AI EXECUTIVE ACTION ITEMS &amp; ANOMALY RADAR ({isKemarin ? 'EVALUASI KEMARIN H-1' : 'LIVE HARI INI'})
                      </span>
                    </h3>
                    <span className="text-[10px] text-zinc-400">Klik kartu untuk instruksikan Jarvis</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {actionItemsAktif.map((item) => {
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
                          1. SALES &amp; OUTLET LEADERBOARD ({isKemarin ? 'KEMARIN H-1' : 'HARI INI'})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onTutup()
                          onTanyaJarvis(
                            isKemarin
                              ? 'Tampilkan tabel peringkat lengkap omzet seluruh cabang kemarin beserta menu terlaris kemarin.'
                              : 'Tampilkan tabel peringkat lengkap omzet seluruh cabang hari ini.'
                          )
                        }}
                        className="text-[10px] text-cyan-300 hover:underline cursor-pointer"
                      >
                        Lihat Semua ({t?.totalOutletAktif ?? 0}) &rarr;
                      </button>
                    </div>

                    {/* Top KPI Boxes (4 Cols: Omzet, Laba Kotor, Transaksi, AOV) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[10px] text-zinc-400">OMZET BERSIH</div>
                        <div className="text-xs sm:text-sm font-bold text-emerald-300 mt-0.5">
                          {fmtRp(omzetBersihAktif)}
                        </div>
                        {trenAktif?.deltaOmzetPersen !== null && trenAktif?.deltaOmzetPersen !== undefined && (
                          <div
                            className={`text-[9px] font-bold mt-0.5 ${
                              trenAktif.deltaOmzetPersen >= 0 ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {trenAktif.deltaOmzetPersen >= 0 ? '📈 +' : '📉 '}
                            {trenAktif.deltaOmzetPersen}% vs H-2
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[10px] text-zinc-400">LABA KOTOR</div>
                        <div className="text-xs sm:text-sm font-bold text-cyan-200 mt-0.5">
                          {fmtRp(labaKotorAktif)}
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-0.5">
                          Margin {marginPersenAktif}% &bull; HPP {fmtRp(hppAktif)}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[10px] text-zinc-400">TRANSAKSI</div>
                        <div className="text-xs sm:text-sm font-bold text-cyan-200 mt-0.5">
                          {salesAktif.totalOrder} struk
                        </div>
                        {trenAktif?.deltaOrderPersen !== null && trenAktif?.deltaOrderPersen !== undefined && (
                          <div
                            className={`text-[9px] font-bold mt-0.5 ${
                              trenAktif.deltaOrderPersen >= 0 ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {trenAktif.deltaOrderPersen >= 0 ? '📈 +' : '📉 '}
                            {trenAktif.deltaOrderPersen}% vs H-2
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[10px] text-zinc-400">RATA-RATA (AOV)</div>
                        <div className="text-xs sm:text-sm font-bold text-cyan-200 mt-0.5">
                          {fmtRp(salesAktif.aov)}
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-0.5">
                          {salesAktif.totalPorsi ? `${salesAktif.totalPorsi} porsi` : 'Gross ' + fmtRp(salesAktif.omzetTotal)}
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

                  {/* Top 3 Menu Terlaris & Menu Tersepi (Kemarin vs Hari Ini) */}
                  {menuAktif.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-cyan-500/15 space-y-1.5">
                      <div>
                        <div className="text-[10px] text-cyan-400 font-bold uppercase mb-1">
                          🌯 TOP 3 MENU TERLARIS ({isKemarin ? 'KEMARIN H-1' : 'HARI INI'})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {menuAktif.slice(0, 3).map((m, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-200"
                            >
                              {idx + 1}. {m.nama} ({m.qty} porsi)
                            </span>
                          ))}
                        </div>
                      </div>
                      {menuTersepiAktif.length > 0 && (
                        <div>
                          <div className="text-[10px] text-amber-300 font-bold uppercase mb-1">
                            📉 MENU PALING SEPI (SLOW-MOVING)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {menuTersepiAktif.slice(0, 2).map((m, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-200"
                              >
                                {m.nama} ({m.qty} porsi)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
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
                          2. TREASURY, OPEX &amp; SUPPLIER PO ({isKemarin ? 'KEMARIN H-1' : 'HARI INI'})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onTutup()
                          onTanyaJarvis(
                            isKemarin
                              ? 'Berikan rincian lengkap keuangan kemarin: OPEX kemarin, rekonsiliasi kas tutup shift kemarin, selisih kasir, dan utang PO supplier.'
                              : 'Berikan rincian lengkap keuangan hari ini: OPEX, setoran kas, dan utang PO supplier.'
                          )
                        }}
                        className="text-[10px] text-cyan-300 hover:underline cursor-pointer"
                      >
                        Bedah Finance &rarr;
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[9px] text-zinc-400">
                          OPEX {isKemarin ? 'KEMARIN' : 'HARI INI'}
                        </div>
                        <div className="text-xs font-bold text-amber-300 mt-0.5">
                          {fmtRp(opexNominalAktif)}
                        </div>
                        <div className="text-[9px] text-zinc-500">{opexTxCountAktif} transaksi</div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[9px] text-zinc-400">
                          {isKemarin ? 'KAS TUTUP SHIFT' : 'SETORAN DIREKAP'}
                        </div>
                        <div className="text-xs font-bold text-emerald-300 mt-0.5">
                          {fmtRp(
                            isKemarin
                              ? (t?.finance?.setoranKas?.tutupShiftKemarin?.totalFisikKas ?? 0)
                              : (t?.finance?.setoranKas?.inputHariIni?.totalNominal ?? 0)
                          )}
                        </div>
                        <div className="text-[9px] text-zinc-500">
                          {isKemarin
                            ? `${t?.finance?.setoranKas?.tutupShiftKemarin?.jumlahOutletClosed ?? 0} shift closed`
                            : `${t?.finance?.setoranKas?.inputHariIni?.jumlahTransaksi ?? 0} setoran`}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                        <div className="text-[9px] text-zinc-400">UTANG PO SUPPLIER</div>
                        <div className="text-xs font-bold text-cyan-200 mt-0.5">
                          {fmtRp(t?.finance?.utangPo?.totalUtang ?? 0)}
                        </div>
                        <div className="text-[9px] text-zinc-500">{t?.finance?.utangPo?.jumlahPo ?? 0} PO aktif</div>
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
                        <div className="text-[9px] text-zinc-500">Jatuh tempo</div>
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
                      <span>Rekonsiliasi Setoran Shift Kemarin:</span>
                      <span className="text-cyan-200 font-bold">
                        {t.finance.setoranKas.tutupShiftKemarin.sudahDirekap} direkap /{' '}
                        <span
                          className={
                            t.finance.setoranKas.tutupShiftKemarin.belumDirekap > 0
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }
                        >
                          {t.finance.setoranKas.tutupShiftKemarin.belumDirekap} belum setor
                        </span>
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
                        3. OPS, VOID &amp; WASTE ({isKemarin ? 'H-1' : 'TODAY'})
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">
                        {isKemarin ? 'Shift Closed Kemarin:' : 'Shift Kasir Buka:'}
                      </span>
                      <span className="font-bold text-emerald-300">
                        {isKemarin
                          ? `${t?.statusBuka?.shiftKemarinClosedCount ?? 0} Cabang Closed`
                          : `${t?.statusBuka?.totalBuka ?? 0} Buka / ${t?.statusBuka?.totalBelumBuka ?? 0} Belum`}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Sidak &amp; Ceklist AM:</span>
                      <span className="font-bold text-cyan-200">
                        {isKemarin
                          ? `${t?.ceklistHarian?.totalSudahDicekKemarin ?? t?.totalOutletAktif ?? 0}/${t?.ceklistHarian?.totalOutletWajib ?? t?.totalOutletAktif ?? 0} Cabang`
                          : `${t?.ceklistHarian?.totalSudahDicekHariIni ?? 0}/${t?.ceklistHarian?.totalOutletWajib ?? t?.totalOutletAktif ?? 0} Cabang`}
                        {(t?.ceklistHarian?.totalPerluPerhatianKemarin ?? 0) > 0 && (
                          <span className="text-amber-300 ml-1">
                            ({t?.ceklistHarian?.totalPerluPerhatianKemarin} temuan)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">
                        Void POS {isKemarin ? 'Kemarin:' : 'Hari Ini:'}
                      </span>
                      <span
                        className={`font-bold ${
                          voidCountAktif > 0 ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                      >
                        {voidCountAktif} tx ({fmtRp(voidRpAktif)})
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
                        4. WORKFORCE &amp; HRD ({isKemarin ? 'H-1' : 'TODAY'})
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Tingkat On-Time:</span>
                      <span className="font-bold text-emerald-300">
                        {hrdOnTimeAktif}% ({hrdTotalAktif} clock-in)
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Kru Terlambat:</span>
                      <span className={`font-bold ${hrdTelatAktif > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {hrdTelatAktif} orang
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Kru Izin / Cuti:</span>
                      <span className="font-bold text-cyan-200">{hrdCutiAktif.length} orang</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400">Kasbon Kru (App HR):</span>
                      <span
                        className={`font-bold ${
                          (t?.kasbonHrd?.totalPendingCount ?? 0) > 0 ? 'text-amber-300' : 'text-cyan-200'
                        }`}
                      >
                        {t?.kasbonHrd?.totalPendingCount ?? 0} pending / {t?.kasbonHrd?.totalAktifCount ?? 0} aktif
                      </span>
                    </div>

                    {hrdStafTelatAktif.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[10px] text-amber-300 font-bold uppercase mb-1">
                          Catatan Keterlambatan ({isKemarin ? 'Kemarin' : 'Hari Ini'}):
                        </div>
                        {hrdStafTelatAktif.slice(0, 2).map((s, i) => (
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

              {/* 💡 AGENT STRATEGIC SUGGESTIONS & ONE-CLICK DISPATCH LINTAS DIVISI */}
              {saranStrategisAktif.length > 0 && (
                <div className="rounded-xl bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-cyan-950/30 border border-cyan-400/40 p-3.5 shadow-[0_0_25px_rgba(6,182,212,0.12)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/25 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-300 animate-pulse" />
                      <h3 className="font-hud text-xs font-bold tracking-wider uppercase text-cyan-200">
                        💡 REKOMENDASI &amp; SARAN STRATEGIS AGENT LINTAS DIVISI ({isKemarin ? 'EVALUASI H-1' : 'LIVE HARI INI'})
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDispatchSaran(null, 'all')}
                      disabled={Boolean(dispatchingId)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-50 border border-cyan-300/60 text-white font-hud text-[9px] sm:text-[10px] tracking-wider uppercase font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    >
                      <Send className="w-3 h-3" />
                      <span>
                        {dispatchingId === 'all' ? 'MENGIRIM KE SEMUA DIVISI...' : '🚀 DISPATCH SEMUA INSTRUKSI KE DIVISI'}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {saranStrategisAktif.map((saran) => {
                      const warnaKartu =
                        saran.prioritas === 'critical'
                          ? 'border-red-500/50 bg-red-950/20'
                          : saran.prioritas === 'warning'
                            ? 'border-amber-500/40 bg-amber-950/15'
                            : 'border-cyan-500/30 bg-black/50'

                      const sedangKirimIni = dispatchingId === saran.id

                      return (
                        <div
                          key={saran.id}
                          className={`p-3 rounded-lg border flex flex-col justify-between gap-2 ${warnaKartu}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/40 text-cyan-200 font-bold uppercase">
                                {saran.divisi} &bull; {saran.labelBot}
                              </span>
                              <span
                                className={`text-[9px] font-bold uppercase ${
                                  saran.prioritas === 'critical'
                                    ? 'text-red-300'
                                    : saran.prioritas === 'warning'
                                      ? 'text-amber-300'
                                      : 'text-emerald-300'
                                }`}
                              >
                                {saran.prioritas.toUpperCase()}
                              </span>
                            </div>
                            <div className="font-bold text-xs text-white mb-1">{saran.judul}</div>
                            <ul className="space-y-1 text-[11px] text-zinc-300 list-disc pl-4">
                              {saran.poinSaran.map((p, idx) => (
                                <li key={idx} className="leading-snug">
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] text-emerald-300/90 truncate">
                              🎯 {saran.dampakTarget}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDispatchSaran(saran.id, saran.targetBot)}
                              disabled={Boolean(dispatchingId)}
                              className="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-800 border border-cyan-400/50 text-cyan-200 text-[9px] font-hud uppercase tracking-wider font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                            >
                              <Send className="w-2.5 h-2.5" />
                              <span>{sedangKirimIni ? 'MENGIRIM...' : `DISPATCH KE ${saran.labelBot.toUpperCase()}`}</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
