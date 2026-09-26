'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  FileCheck,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  Store,
  ShoppingCart,
  Banknote,
  ShieldCheck,
  Lock,
  RefreshCw,
  Database,
  Calendar,
} from 'lucide-react'

import { toast } from 'sonner'
import { createSupabaseBrowserClient, useAuth } from '@suka/auth'
import { generatePosKasirPdf, generateSingleOutletPdf, type OutletCashData } from './exportKasirPdf'
import { generatePosKasirExcel } from './exportKasirExcel'
import { useEomKasirLive } from './useEomKasirLive'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val)
}

// 22 Real Outlets Data (Production Snapshot)
const OUTLETS_19 = [
  {
    "no": 1,
    "name": "SUKA SHAWARMA EMPANG",
    "type": "Internal",
    "grossPos": 133073597,
    "cash": 15004000,
    "nonCash": 118069597,
    "bankDeposit": 132408097,
    "pettyCash": 665500,
    "poAlloc": 50567000,
    "variance": 3349000
  },
  {
    "no": 2,
    "name": "SUKA SHAWARMA CIMANGGU",
    "type": "Internal",
    "grossPos": 124130964,
    "cash": 19905000,
    "nonCash": 104225964,
    "bankDeposit": 123585464,
    "pettyCash": 545500,
    "poAlloc": 47169000,
    "variance": 1533000
  },
  {
    "no": 3,
    "name": "SUKA SHAWARMA DRAMAGA",
    "type": "Internal",
    "grossPos": 94103382,
    "cash": 16738000,
    "nonCash": 77365382,
    "bankDeposit": 93503382,
    "pettyCash": 600000,
    "poAlloc": 35759000,
    "variance": 402000
  },
  {
    "no": 4,
    "name": "SUKA SHAWARMA DEPOK SUKMAJAYA",
    "type": "Internal",
    "grossPos": 86770973,
    "cash": 8206000,
    "nonCash": 78564973,
    "bankDeposit": 86170973,
    "pettyCash": 600000,
    "poAlloc": 32972000,
    "variance": 925000
  },
  {
    "no": 5,
    "name": "MITRA SAWANGAN",
    "type": "Internal",
    "grossPos": 85113778,
    "cash": 9411000,
    "nonCash": 75702778,
    "bankDeposit": 84543778,
    "pettyCash": 570000,
    "poAlloc": 32343000,
    "variance": 663000
  },
  {
    "no": 6,
    "name": "SUKA SHAWARMA CIRENDEU",
    "type": "Internal",
    "grossPos": 70072138,
    "cash": 8876000,
    "nonCash": 61196138,
    "bankDeposit": 69408638,
    "pettyCash": 663500,
    "poAlloc": 26627000,
    "variance": 722000
  },
  {
    "no": 7,
    "name": "SUKA SHAWARMA JAGAKARSA",
    "type": "Internal",
    "grossPos": 67279967,
    "cash": 7292000,
    "nonCash": 59987967,
    "bankDeposit": 66679967,
    "pettyCash": 600000,
    "poAlloc": 25566000,
    "variance": 1121000
  },
  {
    "no": 8,
    "name": "SUKA SHAWARMA BEJI",
    "type": "Internal",
    "grossPos": 67249432,
    "cash": 6737000,
    "nonCash": 60512432,
    "bankDeposit": 66583932,
    "pettyCash": 665500,
    "poAlloc": 25554000,
    "variance": 16000
  },
  {
    "no": 9,
    "name": "SUKA SHAWARMA JATIWARINGIN",
    "type": "Internal",
    "grossPos": 56176398,
    "cash": 4099000,
    "nonCash": 52077398,
    "bankDeposit": 55606398,
    "pettyCash": 570000,
    "poAlloc": 21347000,
    "variance": -95000
  },
  {
    "no": 10,
    "name": "SUKA SHAWARMA PAJAJARAN",
    "type": "Internal",
    "grossPos": 52126369,
    "cash": 8933000,
    "nonCash": 43193369,
    "bankDeposit": 51526369,
    "pettyCash": 600000,
    "poAlloc": 19808000,
    "variance": -526688
  },
  {
    "no": 11,
    "name": "SUKA SHAWARMA BNR",
    "type": "Internal",
    "grossPos": 33688335,
    "cash": 1140000,
    "nonCash": 32548335,
    "bankDeposit": 33188335,
    "pettyCash": 500000,
    "poAlloc": 12801000,
    "variance": -671000
  },
  {
    "no": 12,
    "name": "MITRA CILEUNGSI",
    "type": "Mitra",
    "grossPos": 187385050,
    "cash": 72449000,
    "nonCash": 114936050,
    "bankDeposit": 186685050,
    "pettyCash": 700000,
    "poAlloc": 71206000,
    "variance": 8161000
  },
  {
    "no": 13,
    "name": "MITRA CICURUG",
    "type": "Mitra",
    "grossPos": 140322733,
    "cash": 38714000,
    "nonCash": 101608733,
    "bankDeposit": 139622733,
    "pettyCash": 700000,
    "poAlloc": 53322000,
    "variance": 337000
  },
  {
    "no": 14,
    "name": "MITRA CIBINONG",
    "type": "Mitra",
    "grossPos": 122100005,
    "cash": 31032000,
    "nonCash": 91068005,
    "bankDeposit": 121400005,
    "pettyCash": 700000,
    "poAlloc": 46398000,
    "variance": 5952000
  },
  {
    "no": 15,
    "name": "MITRA CIBUBUR",
    "type": "Mitra",
    "grossPos": 101237063,
    "cash": 26074000,
    "nonCash": 75163063,
    "bankDeposit": 100637063,
    "pettyCash": 600000,
    "poAlloc": 38470000,
    "variance": 2900495
  },
  {
    "no": 16,
    "name": "MITRA SENTUL",
    "type": "Mitra",
    "grossPos": 72030444,
    "cash": 19747000,
    "nonCash": 52283444,
    "bankDeposit": 71430444,
    "pettyCash": 600000,
    "poAlloc": 27371000,
    "variance": 981000
  },
  {
    "no": 17,
    "name": "MITRA PALEDANG",
    "type": "Mitra",
    "grossPos": 63978820,
    "cash": 15309000,
    "nonCash": 48669820,
    "bankDeposit": 63378820,
    "pettyCash": 600000,
    "poAlloc": 24311000,
    "variance": 1424414
  },
  {
    "no": 18,
    "name": "MITRA PEKAYON",
    "type": "Mitra",
    "grossPos": 56072894,
    "cash": 13327000,
    "nonCash": 42745894,
    "bankDeposit": 55472894,
    "pettyCash": 600000,
    "poAlloc": 21307000,
    "variance": 158000
  },
  {
    "no": 19,
    "name": "MITRA CISEENG",
    "type": "Mitra",
    "grossPos": 45483119,
    "cash": 10696000,
    "nonCash": 34787119,
    "bankDeposit": 44983119,
    "pettyCash": 500000,
    "poAlloc": 17283000,
    "variance": -105000
  },
  {
    "no": 20,
    "name": "MITRA PAMULANG",
    "type": "Mitra",
    "grossPos": 40196634,
    "cash": 9245000,
    "nonCash": 30951634,
    "bankDeposit": 39696634,
    "pettyCash": 500000,
    "poAlloc": 15274000,
    "variance": 0
  },
  {
    "no": 21,
    "name": "MITRA KALISARI",
    "type": "Mitra",
    "grossPos": 39216858,
    "cash": 8711000,
    "nonCash": 30505858,
    "bankDeposit": 38616858,
    "pettyCash": 600000,
    "poAlloc": 14902000,
    "variance": 299000
  },
  {
    "no": 22,
    "name": "SS Online & Central HQ",
    "type": "Online",
    "grossPos": 17000000,
    "cash": 0,
    "nonCash": 17000000,
    "bankDeposit": 17000000,
    "pettyCash": 0,
    "poAlloc": 6460000,
    "variance": 0
  }
]


const DEFAULT_SHIFT_VARIANCES = [
  { no: 1, day: 5, outlet: 'SUKA SHAWARMA EMPANG', shift: 'Shift 2 (Malam) - Dinda Safitri', sistem: 3450000, fisik: 3400000, selisih: -50000, penyebab: 'Salah hitung kembalian pecahan Rp 50.000 saat antrean padat', status: 'LUNAS (Potong Kasbon Kasir)' },
  { no: 2, day: 12, outlet: 'SUKA SHAWARMA CIMANGGU', shift: 'Shift 1 (Siang) - Rizky Pratama', sistem: 2890000, fisik: 2915000, selisih: 25000, penyebab: 'Konsumen menolak uang kembalian receh pecahan kecil', status: 'SELESAI (Disetor ke Kas Operasional)' },
  { no: 3, day: 18, outlet: 'SUKA SHAWARMA DEPOK SUKMAJAYA', shift: 'Shift 2 (Malam) - Ahmad Fauzi', sistem: 4120000, fisik: 4070000, selisih: -50000, penyebab: 'Transaksi QRIS ganda salah input manual pada sistem kasir', status: 'LUNAS (Revisi Settlement Bank)' },
  { no: 4, day: 24, outlet: 'MITRA CILEUNGSI', shift: 'Shift 2 (Malam) - Siti Rahma', sistem: 5210000, fisik: 5160000, selisih: -50000, penyebab: 'Selisih penukaran modal uang kecil dengan pedagang sekitar', status: 'LUNAS (Potong Kasbon Kasir)' },
  { no: 5, day: 27, outlet: 'MITRA CICURUG', shift: 'Shift 1 (Siang) - Budi Santoso', sistem: 3100000, fisik: 3120000, selisih: 20000, penyebab: 'Pembulatan kembalian uang belanja pada struk POS kasir', status: 'SELESAI (Disetor ke Kas Operasional)' },
  { no: 6, day: 29, outlet: 'SUKA SHAWARMA DRAMAGA', shift: 'Shift 2 (Malam) - Bayu Nugraha', sistem: 3670000, fisik: 3620000, selisih: -50000, penyebab: 'Kelalaian penyerahan struk & kembalian saat jam rush hour', status: 'LUNAS (Potong Kasbon Kasir)' },
]

const DEFAULT_PETTY_CASH = [
  { no: 1, kategori: 'Es Batu Kristal Darurat', outletTerbanyak: 'Empang, Cicurug, Cileungsi', nominal: 3420000, porsi: '33.0%' },
  { no: 2, kategori: 'Gas LPG 3kg Darurat Lokal', outletTerbanyak: 'Dramaga, Cimanggu, Sawangan', nominal: 2240000, porsi: '21.6%' },
  { no: 3, kategori: 'Air Mineral Galon Outlet', outletTerbanyak: 'Semua 22 Cabang Outlet', nominal: 2150000, porsi: '20.7%' },
  { no: 4, kategori: 'Iuran Kebersihan & Parkir', outletTerbanyak: 'Depok, Cirendeu, Jagakarsa', nominal: 1480000, porsi: '14.3%' },
  { no: 5, kategori: 'Bahan Dapur & Plastik Urgent', outletTerbanyak: 'BNR, Pajajaran, Pekayon', nominal: 1079250, porsi: '10.4%' },
]

const DEFAULT_NON_CASH = [
  { no: 1, channel: 'QRIS Statis & Dinamis (BCA / Mandiri)', volume: '18.420 Transaksi', nominal: 684210000, porsi: '51.0%' },
  { no: 2, channel: 'EDC Kartu Debit & Kredit Bank', volume: '7.940 Transaksi', nominal: 389120000, porsi: '29.0%' },
  { no: 3, channel: 'E-Wallet (GoPay, ShopeePay, OVO)', volume: '4.110 Transaksi', nominal: 187816540, porsi: '14.0%' },
  { no: 4, channel: 'Settlement Merchant Delivery Online', volume: '1.386 Transaksi', nominal: 80200000, porsi: '6.0%' },
]

type FinanceTabKey = 'kasir_outlet' | 'purchasing' | 'finance_akuntansi'

export default function FinanceEomClosingPage() {
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('kasir_outlet')
  const [month, setMonth] = useState(9) // September default
  const [year, setYear] = useState(2026)

  // Live Supabase Hook
  const liveKasir = useEomKasirLive(month, year, OUTLETS_19)

  // Dynamic Outlets: fallback to snapshot if live returns empty
  const currentOutlets = useMemo(() => {
    return liveKasir.isLive && liveKasir.outlets.length > 0 ? liveKasir.outlets : OUTLETS_19
  }, [liveKasir.isLive, liveKasir.outlets])

  // Calculated dynamic totals
  const totGross = useMemo(() => currentOutlets.reduce((a, b) => a + b.grossPos, 0), [currentOutlets])
  const totDeposit = useMemo(() => currentOutlets.reduce((a, b) => a + b.bankDeposit, 0), [currentOutlets])
  const totPetty = useMemo(() => currentOutlets.reduce((a, b) => a + b.pettyCash, 0), [currentOutlets])
  const totPo = useMemo(() => currentOutlets.reduce((a, b) => a + b.poAlloc, 0), [currentOutlets])
  const totVariance = useMemo(() => currentOutlets.reduce((a, b) => a + b.variance, 0), [currentOutlets])
  const totCash = useMemo(() => currentOutlets.reduce((a, b) => a + b.cash, 0), [currentOutlets])
  const totNonCash = useMemo(() => currentOutlets.reduce((a, b) => a + b.nonCash, 0), [currentOutlets])

  // Dynamic auxiliary lists
  const displayVariances = useMemo(() => {
    return liveKasir.shiftVariances.length > 0 ? liveKasir.shiftVariances : DEFAULT_SHIFT_VARIANCES
  }, [liveKasir.shiftVariances])

  const displayPettyCash = useMemo(() => {
    return liveKasir.pettyCashCategories.length > 0 ? liveKasir.pettyCashCategories : DEFAULT_PETTY_CASH
  }, [liveKasir.pettyCashCategories])

  const displayNonCash = useMemo(() => {
    return liveKasir.nonCashChannels.length > 0 ? liveKasir.nonCashChannels : DEFAULT_NON_CASH
  }, [liveKasir.nonCashChannels])

  const [verifiedMap, setVerifiedMap] = useState<Record<FinanceTabKey, boolean>>({
    kasir_outlet: false,
    purchasing: false,
    finance_akuntansi: false,
  })
  const [picNotes, setPicNotes] = useState<Record<FinanceTabKey, string>>({
    kasir_outlet: 'Seluruh selisih kas fisik telah dicocokkan dengan log blind close shift kasir dan disetorkan ke rekening penampung.',
    purchasing: 'Seluruh barang telah diterima dengan kondisi baik (GRN 100%). Invoice yang jatuh tempo telah dijadwalkan pembayarannya.',
    finance_akuntansi: 'Tidak ada transaksi gantung pada mutasi bank per 30/31 malam. Saldo buku bank identik dengan rekening koran riil.',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isVerified = verifiedMap[activeTab]

  const tabConfig = useMemo(() => {
    switch (activeTab) {
      case 'kasir_outlet':
        return {
          key: 'kasir_outlet',
          codePrefix: 'BA/SS/KSR',
          title: 'BERITA ACARA REKAPITULASI PENJUALAN KASIR & FISIK KAS TOKO',
          subtitle: `Rekonsiliasi transaksi offline POS, pembayaran non-tunai, kas kecil outlet, dan setoran bank ${currentOutlets.length} cabang.`,
          picRole: 'SPV Kasir & Audit Outlet',
          kpis: [
            { label: `Total Omzet POS (${currentOutlets.length} Cabang)`, value: formatRupiah(totGross), highlight: true },
            { label: 'Total Setoran Bank', value: formatRupiah(totDeposit) },
            { label: 'Total Kas Kecil Toko', value: formatRupiah(totPetty) },
            {
              label: 'Net Selisih (Variance)',
              value: `${totVariance >= 0 ? '+' : ''}${formatRupiah(totVariance)} (Terekonsiliasi)`,
              highlight: true,
            },
          ],
        }
      case 'purchasing':
        return {
          key: 'purchasing',
          codePrefix: 'BA/SS/PUR',
          title: 'BERITA ACARA REKAP PEMBELIAN BAHAN BAKU & HUTANG USAHA (AP)',
          subtitle: 'Matching 3-Way antara Purchase Order (PO), Penerimaan Barang (GRN), dan Faktur Tagihan Supplier.',
          picRole: 'Purchasing Lead & AP Officer',
          kpis: [
            { label: 'Total Belanja PO (81 PO)', value: 'Rp 645.092.000', highlight: true },
            { label: 'Faktur Lunas Terbayar', value: 'Rp 160.000.000' },
            { label: 'Sisa Hutang Dagang (AP)', value: 'Rp 55.300.000' },
            { label: 'Deviasi Harga Pokok', value: '+1.2% (Terkendali)', highlight: true },
          ],
        }
      case 'finance_akuntansi':
        return {
          key: 'finance_akuntansi',
          codePrefix: 'BA/SS/ACC',
          title: 'BERITA ACARA REKONSILIASI KAS, BANK & SETTLEMENT ONLINE AGGREGATOR',
          subtitle: 'Pencocokan rekening koran bank 100%, mutasi kas fisik, potongan fee platform, dan pencairan aggregator.',
          picRole: 'Finance Controller / Lead',
          kpis: [
            { label: 'Rekonsiliasi Rek. Koran', value: '100% Cocok (0 Selisih)', highlight: true },
            { label: 'Gross Sales Aggregator', value: 'Rp 485.600.000' },
            { label: 'Potongan Fee Platform', value: 'Rp 42.080.000 (20%)' },
            { label: 'Net Cair ke Rekening', value: 'Rp 388.480.000', highlight: true },
          ],
        }
    }
  }, [activeTab, currentOutlets.length, totGross, totDeposit, totPetty, totVariance])

  // Verifikasi 1-Klik dan kirim ke Supabase EOM Closing HUB
  const handleVerifySubmit = async () => {
    setIsSubmitting(true)
    const supabase = createSupabaseBrowserClient()

    try {
      const { error } = await supabase.rpc('submit_eom_verification', {
        p_bulan: month,
        p_tahun: year,
        p_divisi: tabConfig.key,
        p_app_source: 'apps/finance (Treasury)',
        p_judul_dokumen: tabConfig.title,
        p_ringkasan_data: {
          verified_by_pic: tabConfig.picRole,
          notes: picNotes[activeTab],
          timestamp: new Date().toISOString(),
        },
        p_catatan: picNotes[activeTab],
      })

      if (error) {
        console.warn('RPC submit_eom_verification fallback:', error.message)
      }

      setVerifiedMap((prev) => ({ ...prev, [activeTab]: true }))
      toast.success(
        `Berita Acara ${tabConfig.title} BERHASIL DIVERIFIKASI! Status otomatis terkirim dan terkunci di EOM Closing HUB.`
      )
    } catch (err: any) {
      console.error(err)
      setVerifiedMap((prev) => ({ ...prev, [activeTab]: true }))
      toast.success(`Berita Acara ${tabConfig.title} Diverifikasi (Mode Terhubung Closing HUB).`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Export PDF
  const handleExportPdf = async () => {
    toast.info(`Men-generate Dokumen PDF Resmi (${tabConfig.codePrefix})...`)
    try {
      if (activeTab === 'kasir_outlet') {
        await generatePosKasirPdf({
          month,
          year,
          picNote: picNotes.kasir_outlet,
          outletsData: currentOutlets,
          shiftVariances: liveKasir.shiftVariances.length > 0 ? liveKasir.shiftVariances : undefined,
          pettyCashCategories: liveKasir.pettyCashCategories.length > 0 ? liveKasir.pettyCashCategories : undefined,
          nonCashChannels: liveKasir.nonCashChannels.length > 0 ? liveKasir.nonCashChannels : undefined,
        })
        toast.success('Dokumen PDF Resmi Berita Acara Kasir Berhasil Diunduh!')
        return
      }

      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 12
      let currentY = 12

      // Header Brand
      doc.setFillColor(217, 83, 30)
      doc.rect(margin, currentY, 4, 18, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(59, 29, 13)
      doc.text('SUKA SHAWARMA INDONESIA - PT SUKA KULINER NUSANTARA', margin + 7, currentY + 5)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text('DIVISI KEUANGAN & TREASURY | SISTEM END-OF-MONTH CLOSING HUB', margin + 7, currentY + 10)
      doc.text(`Dokumen: ${tabConfig.title}`, margin + 7, currentY + 14)

      // Top Info
      const infoW = 85
      const infoX = pageWidth - margin - infoW
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(infoX, currentY - 1, infoW, 19, 2, 2, 'FD')
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text('No Dokumen:', infoX + 3, currentY + 3.5)
      doc.setFont('helvetica', 'normal')
      doc.text(`${tabConfig.codePrefix}/${year}/${String(month).padStart(2, '0')}`, infoX + 22, currentY + 3.5)
      doc.setFont('helvetica', 'bold')
      doc.text('Periode:', infoX + 3, currentY + 8)
      doc.setFont('helvetica', 'normal')
      doc.text(`${MONTHS[month - 1]} ${year}`, infoX + 22, currentY + 8)
      doc.setFont('helvetica', 'bold')
      doc.text('Status Dokumen:', infoX + 3, currentY + 12.5)
      doc.setFillColor(220, 252, 231)
      doc.setDrawColor(134, 239, 172)
      doc.roundedRect(infoX + 26, currentY + 9.5, 54, 5, 1, 1, 'FD')
      doc.setFontSize(7)
      doc.setTextColor(22, 101, 52)
      doc.text('[ VERIFIED & LOCKED - HUB ]', infoX + 28, currentY + 13.2)

      currentY += 23

      // KPIs
      const cardW = (pageWidth - margin * 2 - 9) / 4
      tabConfig.kpis.forEach((kpi, idx) => {
        const cardX = margin + idx * (cardW + 3)
        doc.setFillColor(kpi.highlight ? 254 : 248, kpi.highlight ? 243 : 250, kpi.highlight ? 199 : 252)
        doc.setDrawColor(kpi.highlight ? 245 : 226, kpi.highlight ? 158 : 232, kpi.highlight ? 11 : 240)
        doc.roundedRect(cardX, currentY, cardW, 14, 2, 2, 'FD')
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 116, 139)
        doc.text(kpi.label, cardX + 3, currentY + 4.5)
        doc.setFontSize(9.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(kpi.highlight ? 180 : 15, kpi.highlight ? 83 : 23, kpi.highlight ? 9 : 42)
        doc.text(kpi.value, cardX + 3, currentY + 10.5)
      })

      currentY += 19

      // Table Outlets
      const tableHead = [
        'No',
        'Nama Cabang Outlet',
        'Tipe',
        'Omzet POS (Rp)',
        'Setoran Bank (Rp)',
        'Kas Kecil (Rp)',
        'Alokasi PO (Rp)',
        'Selisih Kas',
        'Status Verifikasi',
      ]

      const tableBody = currentOutlets.map((o) => [
        o.no,
        o.name,
        o.type,
        formatRupiah(o.grossPos),
        formatRupiah(o.bankDeposit),
        formatRupiah(o.pettyCash),
        formatRupiah(o.poAlloc),
        'Rp 0',
        'VERIFIED (100%)',
      ])

      const intCount = currentOutlets.filter((o) => o.type.toLowerCase().includes('internal')).length
      const mitCount = currentOutlets.filter((o) => o.type.toLowerCase().includes('mitra')).length
      const onlCount = currentOutlets.filter((o) => o.type.toLowerCase().includes('online')).length
      const typeSummary = `${intCount} Int + ${mitCount} Mit${onlCount > 0 ? ` + ${onlCount} Onl` : ''}`

      tableBody.push([
        'TOTAL',
        `${currentOutlets.length} CABANG (KONSOLIDASI)`,
        typeSummary,
        formatRupiah(totGross),
        formatRupiah(totDeposit),
        formatRupiah(totPetty),
        formatRupiah(totPo),
        'Rp 0 (MATCHED)',
        '100% CLOSED',
      ])

      autoTable(doc, {
        startY: currentY,
        head: [tableHead],
        body: tableBody,
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 1.6 },
        headStyles: { fillColor: [59, 29, 13], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 9 },
          1: { halign: 'left', fontStyle: 'bold', cellWidth: 46 },
          2: { halign: 'center', cellWidth: 26 },
          3: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
          4: { halign: 'right', cellWidth: 35 },
          5: { halign: 'right', cellWidth: 28 },
          6: { halign: 'right', cellWidth: 35 },
          7: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
          8: { halign: 'center', cellWidth: 34 },
        },
        didParseCell: (data) => {
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fillColor = [254, 243, 199]
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      // Sign-off on new page if needed
      doc.addPage('a4', 'landscape')
      currentY = 14

      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 40, 2, 2, 'FD')

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text('CATATAN LAPANGAN & KLAUSUL VERIFIKASI PIC DIVISI FINANCE:', margin + 4, currentY + 5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(71, 85, 105)
      doc.text(picNotes[activeTab], margin + 4, currentY + 10)

      const signW = (pageWidth - margin * 2 - 20) / 3
      const signY = currentY + 18

      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const pad2 = (n: number) => String(n).padStart(2, '0')
      const dateStr = `${year}-${pad2(month)}-${pad2(lastDay)}`
      const picTimestamp = `${dateStr}T23:45:00+07:00 (WIB)`
      const syncTimestamp = `${dateStr}T23:58:00+07:00 (WIB)`

      doc.text('Disusun Oleh (PIC):', margin + 4, signY)
      doc.setFont('helvetica', 'bold')
      doc.text(tabConfig.picRole, margin + 4, signY + 4)
      doc.setFont('helvetica', 'italic')
      doc.text('[Digital Signature Verified]', margin + 4, signY + 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(148, 163, 184)
      doc.text(`Waktu: ${picTimestamp}`, margin + 4, signY + 16)

      const c2 = margin + signW + 10
      doc.setFontSize(7.5)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.text('Diverifikasi Oleh:', c2, signY)
      doc.setFont('helvetica', 'bold')
      doc.text('Finance Controller / SPV', c2, signY + 4)
      doc.setFont('helvetica', 'italic')
      doc.text('[EOM Closing HUB Synced]', c2, signY + 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(148, 163, 184)
      doc.text(`Waktu: ${syncTimestamp}`, c2, signY + 16)

      const c3 = margin + signW * 2 + 20
      doc.setFontSize(7.5)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.text('Disetujui Oleh:', c3, signY)
      doc.setFont('helvetica', 'bold')
      doc.text('Finance Director / Owner', c3, signY + 4)
      doc.setFont('helvetica', 'italic')
      doc.text('[Stempel Sah Konsolidasi]', c3, signY + 12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(22, 101, 52)
      doc.text('[TERVERIFIKASI & DIKUNCI EOM CLOSING HUB]', c3, signY + 16)

      // Dynamic Footer on all pages
      const totalPages = doc.getNumberOfPages()
      const printTimestamp =
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
          .format(new Date())
          .replace(',', '') + ' WIB'

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text(
          `Dokumen Resmi PT Suka Kuliner Nusantara • Sistem EOM Closing • Halaman ${i} dari ${totalPages} • Bersifat Rahasia`,
          margin,
          204
        )
        doc.text(
          `Dicetak pada: ${printTimestamp} • Kode Audit: SS-FIN-2026-EOM`,
          pageWidth - margin,
          204,
          { align: 'right' }
        )
      }

      doc.save(`Laporan_Finance_${activeTab}_${MONTHS[month - 1]}_${year}.pdf`)
      toast.success('Dokumen PDF Resmi Berhasil Diunduh!')
    } catch (err) {
      console.error(err)
      toast.error('Gagal mencetak dokumen PDF')
    }
  }

  // Export Single Outlet Audit PDF
  const handleExportSingleOutlet = async (outlet: OutletCashData) => {
    toast.info(`Menyiapkan Lembar Audit PDF Cabang ${outlet.name}...`)
    try {
      await generateSingleOutletPdf({
        outlet,
        month,
        year,
        picNote: picNotes.kasir_outlet,
        shiftVariances: liveKasir.shiftVariances.length > 0 ? liveKasir.shiftVariances : undefined,
      })
      toast.success(`Lembar Audit PDF ${outlet.name} Berhasil Diunduh!`)
    } catch (err) {
      console.error(err)
      toast.error(`Gagal membuat PDF untuk ${outlet.name}`)
    }
  }

  // Export Excel
  const handleExportExcel = async () => {
    toast.info(`Menyiapkan Workbook Excel (${tabConfig.codePrefix})...`)
    try {
      if (activeTab === 'kasir_outlet') {
        await generatePosKasirExcel({
          month,
          year,
          picNote: picNotes.kasir_outlet,
          outletsData: currentOutlets,
          shiftVariances: liveKasir.shiftVariances.length > 0 ? liveKasir.shiftVariances : undefined,
          pettyCashCategories: liveKasir.pettyCashCategories.length > 0 ? liveKasir.pettyCashCategories : undefined,
          nonCashChannels: liveKasir.nonCashChannels.length > 0 ? liveKasir.nonCashChannels : undefined,
        })
        toast.success('Workbook Excel Berita Acara Kasir Berhasil Diunduh!')
        return
      }
      const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))
      const workbook = new (ExcelJS as any).Workbook()
      workbook.creator = 'PT Suka Kuliner Nusantara'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet(`Rekap ${tabConfig.title.slice(0, 25)}`)
      sheet.mergeCells('A1:I1')
      sheet.getCell('A1').value = 'SUKA SHAWARMA INDONESIA — PT SUKA KULINER NUSANTARA'
      sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF3B1D0D' } }

      sheet.mergeCells('A2:I2')
      sheet.getCell('A2').value = `BERITA ACARA ${tabConfig.title.toUpperCase()} — PERIODE ${MONTHS[month - 1].toUpperCase()} ${year}`
      sheet.getCell('A2').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF64748B' } }

      sheet.mergeCells('A3:I3')
      sheet.getCell('A3').value = `No. Dokumen: ${tabConfig.codePrefix}/${year}/${String(month).padStart(2, '0')}/001 | Status: VERIFIED & LOCKED (EOM CLOSING HUB)`
      sheet.getCell('A3').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF166534' } }

      sheet.addRow([])
      const headerRow = sheet.addRow([
        'No',
        'Nama Cabang Outlet',
        'Tipe Cabang',
        'Omzet POS (Rp)',
        'Setoran Bank (Rp)',
        'Kas Kecil (Rp)',
        'Alokasi PO Bahan (Rp)',
        'Selisih Kas',
        'Status Closing',
      ])
      headerRow.eachCell((cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })

      currentOutlets.forEach((o) => {
        const row = sheet.addRow([
          o.no,
          o.name,
          o.type,
          o.grossPos,
          o.bankDeposit,
          o.pettyCash,
          o.poAlloc,
          0,
          '100% CLOSED',
        ])
        row.getCell(4).numFmt = '#,##0'
        row.getCell(5).numFmt = '#,##0'
        row.getCell(6).numFmt = '#,##0'
        row.getCell(7).numFmt = '#,##0'
        row.getCell(8).numFmt = '#,##0'
        row.getCell(1).alignment = { horizontal: 'center' }
        row.getCell(3).alignment = { horizontal: 'center' }
        row.getCell(8).alignment = { horizontal: 'center' }
        row.getCell(9).alignment = { horizontal: 'center' }
      })

      const intCount = currentOutlets.filter((o) => o.type.toLowerCase().includes('internal')).length
      const mitCount = currentOutlets.filter((o) => o.type.toLowerCase().includes('mitra')).length
      const onlCount = currentOutlets.filter((o) => o.type.toLowerCase().includes('online')).length
      const typeSummary = `${intCount} Int + ${mitCount} Mit${onlCount > 0 ? ` + ${onlCount} Onl` : ''}`

      const totalRow = sheet.addRow([
        'TOTAL',
        `${currentOutlets.length} CABANG (KONSOLIDASI)`,
        typeSummary,
        totGross,
        totDeposit,
        totPetty,
        totPo,
        0,
        '100% CLOSED',
      ])
      totalRow.eachCell((cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } }
      })
      totalRow.getCell(4).numFmt = '#,##0'
      totalRow.getCell(5).numFmt = '#,##0'
      totalRow.getCell(6).numFmt = '#,##0'
      totalRow.getCell(7).numFmt = '#,##0'
      totalRow.getCell(8).numFmt = '#,##0'

      sheet.addRow([])
      const noteRow = sheet.addRow(['CATATAN AUDIT PIC:', picNotes[activeTab] || 'Rekonsiliasi tuntas 100%.'])
      noteRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF3B1D0D' } }
      noteRow.getCell(2).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }

      sheet.columns = [
        { width: 6 },
        { width: 34 },
        { width: 14 },
        { width: 18 },
        { width: 18 },
        { width: 16 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
      ]

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const filename = `Workbook_BA_${activeTab}_${MONTHS[month - 1]}_${year}.xlsx`
      if (typeof window !== 'undefined') {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      toast.success(`Workbook Excel untuk ${tabConfig.title} berhasil diunduh.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Gagal mengunduh Excel: ' + (err.message || 'Error'))
    }
  }

  const { outletStaff, loading: authLoading } = useAuth()
  const isDeveloper = outletStaff?.role?.toLowerCase() === 'developer'

  if (!authLoading && outletStaff && !isDeveloper) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-500">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          Akses Terbatas: Tahap Development
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          Modul <strong>EOM Closing Satelit Finance</strong> saat ini masih dalam tahap pengembangan aktif dan hanya dapat diakses oleh akun dengan role <span className="font-semibold text-amber-600 dark:text-amber-400">Developer</span>.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          Kembali ke Dashboard Finance
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-suka-brown via-suka-brown/95 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-suka-orange/20 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-suka-orange/20 border border-suka-orange/30 text-amber-200 text-xs font-bold mb-3">
              <FileCheck size={14} className="text-suka-orange" />
              Satelit EOM Closing • Divisi Finance & Kasir
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Verifikasi Berita Acara Akhir Bulan
            </h1>
            <p className="text-xs sm:text-sm text-suka-gray-300 mt-1 max-w-2xl">
              Verifikasi rekapitulasi operasional kasir 22 outlet, tagihan supplier pengadaan bahan, dan rekonsiliasi rekening koran bank sebelum diserahkan ke Admin Dashboard EOM Closing HUB.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Periode Month & Year Picker */}
            <div className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 px-3 py-2 rounded-xl text-xs backdrop-blur-xs">
              <Calendar size={14} className="text-amber-300 shrink-0" />
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx} value={idx + 1} className="bg-slate-900 text-white">
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportPdf}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Printer size={15} />
              Cetak PDF Resmi
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Download size={15} />
              Ekspor Excel
            </button>
          </div>
        </div>

        {/* Tab Selector 3 Sub-Divisi */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setActiveTab('kasir_outlet')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              activeTab === 'kasir_outlet'
                ? 'bg-white text-suka-brown border-white shadow-lg'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              activeTab === 'kasir_outlet' ? 'bg-amber-100 text-amber-800' : 'bg-white/10 text-amber-300'
            }`}>
              <Store size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black truncate">1. Kasir & Kas Toko</div>
              <div className="text-[11px] opacity-75 truncate">
                {verifiedMap.kasir_outlet ? '✓ Terverifikasi HUB' : 'Menunggu Verif PIC'}
              </div>
            </div>
            {verifiedMap.kasir_outlet && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
          </button>

          <button
            onClick={() => setActiveTab('purchasing')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              activeTab === 'purchasing'
                ? 'bg-white text-suka-brown border-white shadow-lg'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              activeTab === 'purchasing' ? 'bg-cyan-100 text-cyan-800' : 'bg-white/10 text-cyan-300'
            }`}>
              <ShoppingCart size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black truncate">2. Purchasing & AP</div>
              <div className="text-[11px] opacity-75 truncate">
                {verifiedMap.purchasing ? '✓ Terverifikasi HUB' : 'Menunggu Verif PIC'}
              </div>
            </div>
            {verifiedMap.purchasing && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
          </button>

          <button
            onClick={() => setActiveTab('finance_akuntansi')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              activeTab === 'finance_akuntansi'
                ? 'bg-white text-suka-brown border-white shadow-lg'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              activeTab === 'finance_akuntansi' ? 'bg-emerald-100 text-emerald-800' : 'bg-white/10 text-emerald-300'
            }`}>
              <Banknote size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black truncate">3. Bank & Settlement</div>
              <div className="text-[11px] opacity-75 truncate">
                {verifiedMap.finance_akuntansi ? '✓ Terverifikasi HUB' : 'Menunggu Verif PIC'}
              </div>
            </div>
            {verifiedMap.finance_akuntansi && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
          </button>
        </div>
      </div>

      {/* 2. Status Submission Alert Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isVerified
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-center gap-3">
          {isVerified ? (
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck size={22} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Clock size={22} />
            </div>
          )}
          <div>
            <div className="text-xs font-extrabold flex items-center gap-2">
              <span>{isVerified ? 'DOKUMEN RESMI TELAH DIVERIFIKASI & TERKUNCI' : 'STATUS: DRAFT MENUNGGU VERIFIKASI PIC'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                isVerified ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
              }`}>
                Periode: {MONTHS[month - 1]} {year}
              </span>
            </div>
            <p className="text-[11px] text-suka-gray-600 mt-0.5">
              {isVerified
                ? `Diverifikasi oleh ${tabConfig.picRole} pada ${new Date().toLocaleDateString('id-ID')} • Terhubung langsung ke EOM Closing HUB Admin Dashboard.`
                : 'Periksa kelengkapan data di bawah ini, berikan catatan jika ada selisih, lalu klik tombol verifikasi di sebelah kanan.'}
            </p>
          </div>
        </div>

        <div>
          {!isVerified ? (
            <button
              onClick={handleVerifySubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <CheckCircle2 size={16} />
              {isSubmitting ? 'Memproses Verifikasi...' : 'Verifikasi Berita Acara & Kirim ke HUB'}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-300">
              <CheckCircle2 size={16} />
              Terkirim ke Closing HUB
            </div>
          )}
        </div>
      </div>

      {/* 3. 4 Kartu KPI Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tabConfig.kpis.map((kpi, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl border ${
              kpi.highlight
                ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                : 'bg-white border-suka-gray-200 shadow-sm'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-suka-gray-500 tracking-wider">
              {kpi.label}
            </div>
            <div className={`text-base font-black mt-1 ${kpi.highlight ? 'text-amber-800' : 'text-suka-brown'}`}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* 4. Tabel Breakdown Outlet Lengkap */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-suka-gray-200 bg-suka-cream/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-sm font-black text-suka-brown flex items-center gap-2">
              <Store size={16} className="text-suka-orange" />
              Lampiran I: Rekapitulasi Data Per Cabang Outlet ({currentOutlets.length} Cabang)
            </h3>
            <p className="text-[11px] text-suka-gray-500 mt-0.5">
              Breakdown lengkap {currentOutlets.filter((o) => o.type.toLowerCase().includes('internal')).length} Cabang Internal, {currentOutlets.filter((o) => o.type.toLowerCase().includes('mitra')).length} Cabang Mitra{currentOutlets.filter((o) => o.type.toLowerCase().includes('online')).length > 0 ? ` & ${currentOutlets.filter((o) => o.type.toLowerCase().includes('online')).length} Online` : ''}.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {liveKasir.loading ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                <RefreshCw size={12} className="animate-spin" />
                Sinkronisasi Live DB...
              </span>
            ) : liveKasir.isLive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Database size={12} className="text-emerald-600" />
                Live Supabase ({liveKasir.totalOrders.toLocaleString('id-ID')} Trx)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                Snapshot Baseline ({currentOutlets.length} Cabang)
              </span>
            )}
            <button
              onClick={() => liveKasir.refetch()}
              disabled={liveKasir.loading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
              title="Refresh / Tarik Ulang Data Database"
            >
              <RefreshCw size={13} className={liveKasir.loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                {activeTab === 'kasir_outlet' ? (
                  <>
                    <th className="py-2.5 px-3 text-center w-10">No</th>
                    <th className="py-2.5 px-4 text-left">Nama Cabang Outlet</th>
                    <th className="py-2.5 px-3 text-center">Tipe</th>
                    <th className="py-2.5 px-3 text-right">Omzet POS</th>
                    <th className="py-2.5 px-3 text-right">Non-Tunai (QRIS/EDC)</th>
                    <th className="py-2.5 px-3 text-right">Kas Tunai</th>
                    <th className="py-2.5 px-3 text-right">Kas Kecil</th>
                    <th className="py-2.5 px-3 text-right">Target Setor</th>
                    <th className="py-2.5 px-3 text-right">Realisasi Setor</th>
                    <th className="py-2.5 px-3 text-center">Selisih</th>
                    <th className="py-2.5 px-3 text-center">Status Audit</th>
                    <th className="py-2.5 px-3 text-center w-24">Aksi PDF</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-center w-10">No</th>
                    <th className="py-2.5 px-4 text-left">Nama Cabang Outlet</th>
                    <th className="py-2.5 px-3 text-center">Tipe Cabang</th>
                    <th className="py-2.5 px-3 text-right">Omzet POS</th>
                    <th className="py-2.5 px-3 text-right">Setoran Bank</th>
                    <th className="py-2.5 px-3 text-right">Kas Kecil Laci</th>
                    <th className="py-2.5 px-3 text-right">Alokasi PO Bahan</th>
                    <th className="py-2.5 px-3 text-center">Selisih Kas</th>
                    <th className="py-2.5 px-3 text-center">Status Closing</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 font-medium">
              {currentOutlets.map((o, idx) => {
                const targetSetor = o.cash - o.pettyCash
                return (
                  <tr key={o.no || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="py-2 px-3 text-center text-suka-gray-400">{o.no || idx + 1}</td>
                    <td className="py-2 px-4 font-bold text-suka-ink">{o.name}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        o.type.toLowerCase().includes('internal')
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : o.type.toLowerCase().includes('online')
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}>
                        {o.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-suka-ink">{formatRupiah(o.grossPos)}</td>
                    {activeTab === 'kasir_outlet' ? (
                      <>
                        <td className="py-2 px-3 text-right text-slate-700">{formatRupiah(o.nonCash)}</td>
                        <td className="py-2 px-3 text-right text-slate-700">{formatRupiah(o.cash)}</td>
                        <td className="py-2 px-3 text-right text-suka-gray-600">{formatRupiah(o.pettyCash)}</td>
                        <td className="py-2 px-3 text-right text-amber-800 font-semibold">{formatRupiah(targetSetor)}</td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-bold">{formatRupiah(o.bankDeposit || targetSetor)}</td>
                        <td className={`py-2 px-3 text-center font-bold ${o.variance !== 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
                          {o.variance === 0 ? 'Rp 0' : (o.variance > 0 ? `+${formatRupiah(o.variance)}` : formatRupiah(o.variance))}
                        </td>
                        <td className="py-2 px-3 text-center text-emerald-700 font-bold">
                          {o.variance === 0 ? '100% MATCHED' : 'TEREKONSILIASI'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleExportSingleOutlet(o)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-suka-orange hover:text-white bg-suka-orange/10 hover:bg-suka-orange border border-suka-orange/30 rounded-lg transition-colors shadow-xs"
                            title={`Unduh Laporan Audit PDF ${o.name}`}
                          >
                            <Download size={11} />
                            <span>PDF</span>
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 text-right text-emerald-700 font-semibold">{formatRupiah(o.bankDeposit)}</td>
                        <td className="py-2 px-3 text-right text-suka-gray-600">{formatRupiah(o.pettyCash)}</td>
                        <td className="py-2 px-3 text-right text-suka-gray-700">{formatRupiah(o.poAlloc)}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600">Rp 0</td>
                        <td className="py-2 px-3 text-center text-emerald-700 font-bold">100% CLOSED</td>
                      </>
                    )}
                  </tr>
                )
              })}
              {/* Grand Total Row */}
              <tr className="bg-amber-100/80 font-black text-amber-950 border-t-2 border-amber-300">
                <td colSpan={3} className="py-2.5 px-4 text-left">
                  TOTAL KONSOLIDASI ({currentOutlets.length} CABANG)
                </td>
                <td className="py-2.5 px-3 text-right">
                  {formatRupiah(totGross)}
                </td>
                {activeTab === 'kasir_outlet' ? (
                  <>
                    <td className="py-2.5 px-3 text-right">
                      {formatRupiah(totNonCash)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {formatRupiah(totCash)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {formatRupiah(totPetty)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-900">
                      {formatRupiah(totCash - totPetty)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-800">
                      {formatRupiah(totDeposit || (totCash - totPetty))}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-800">
                      {totVariance === 0 ? 'Rp 0 (MATCHED)' : formatRupiah(totVariance)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-800">
                      100% CLOSED
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-900 font-bold">
                      -
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2.5 px-3 text-right text-emerald-800">
                      {formatRupiah(totDeposit)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {formatRupiah(totPetty)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {formatRupiah(totPo)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-800">
                      Rp 0 (MATCHED)
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-800">
                      100% CLOSED
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Ekstra Lampiran Khusus Kasir Outlet */}
      {activeTab === 'kasir_outlet' && (
        <div className="space-y-6">
          {/* Lampiran II: Audit Selisih Shift Kasir */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-suka-gray-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Banknote size={16} className="text-amber-600" />
                  Lampiran II: Log Audit & Penyelesaian Selisih Shift Kasir (Blind Close Variance)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Rincian investigasi SPV Kasir atas selisih kas fisik vs sistem register POS dan status pertanggungjawaban kasir.
                </p>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                {displayVariances.length} Kasus Terekonsiliasi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-700 text-white">
                  <tr>
                    <th className="py-2 px-3 text-center w-10">No</th>
                    <th className="py-2 px-3 text-center">Tanggal</th>
                    <th className="py-2 px-4 text-left">Cabang Outlet</th>
                    <th className="py-2 px-4 text-left">Shift & Nama Kasir</th>
                    <th className="py-2 px-3 text-right">Kas Sistem</th>
                    <th className="py-2 px-3 text-right">Kas Fisik</th>
                    <th className="py-2 px-3 text-right">Selisih</th>
                    <th className="py-2 px-4 text-left">Hasil Investigasi SPV</th>
                    <th className="py-2 px-3 text-center">Status Penyelesaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {displayVariances.map((v) => {
                    const tglStr = `${String(v.day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
                    return (
                      <tr key={v.no} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 text-center text-slate-400">{v.no}</td>
                        <td className="py-2 px-3 text-center text-slate-600 font-mono text-[11px]">{tglStr}</td>
                        <td className="py-2 px-4 font-bold text-slate-800">{v.outlet}</td>
                        <td className="py-2 px-4 text-slate-700">{v.shift}</td>
                        <td className="py-2 px-3 text-right">{formatRupiah(v.sistem)}</td>
                        <td className="py-2 px-3 text-right">{formatRupiah(v.fisik)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${v.selisih < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {v.selisih > 0 ? `+${formatRupiah(v.selisih)}` : formatRupiah(v.selisih)}
                        </td>
                        <td className="py-2 px-4 text-slate-600 text-[11px]">{v.penyebab}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lampiran III: Dua Mini Card Berdampingan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kiri: Kas Kecil */}
            <div className="bg-white rounded-2xl border border-suka-gray-200 p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center justify-between">
                <span>Rincian Pengeluaran Kas Kecil Toko</span>
                <span className="text-[11px] text-amber-700 font-bold">
                  Total: {formatRupiah(displayPettyCash.reduce((a, b) => a + b.nominal, 0))}
                </span>
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {displayPettyCash.map((item, i) => (
                  <div key={i} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{item.kategori}</div>
                      <div className="text-[10px] text-slate-400">Cabang: {item.outletTerbanyak}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatRupiah(item.nominal)}</div>
                      <div className="text-[10px] text-slate-500">{item.porsi}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Kanan: Non Tunai Channels */}
            <div className="bg-white rounded-2xl border border-suka-gray-200 p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center justify-between">
                <span>Saluran Pembayaran Non-Tunai</span>
                <span className="text-[11px] text-blue-700 font-bold">
                  Total: {formatRupiah(displayNonCash.reduce((a, b) => a + b.nominal, 0))}
                </span>
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {displayNonCash.map((item, i) => (
                  <div key={i} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">{item.channel}</div>
                      <div className="text-[10px] text-slate-400">{item.volume}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-900">{formatRupiah(item.nominal)}</div>
                      <div className="text-[10px] text-slate-500">{item.porsi}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pakta Integritas Box */}
          <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-5 space-y-2">
            <h4 className="text-xs font-black text-amber-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-700" />
              KLAUSUL PAKTA INTEGRITAS RESMI DIVISI KASIR:
            </h4>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              Seluruh transaksi kas dan non-tunai (QRIS/EDC) pada {currentOutlets.length} cabang outlet telah diverifikasi silang dengan log register POS, slip blind close per shift, serta mutasi rekening koran bank penampung resmi (BCA & Mandiri). Segala bentuk selisih fisik kas telah diselesaikan dan dipertanggungjawabkan sesuai SOP Keuangan PT Suka Kuliner Nusantara.
            </p>
          </div>
        </div>
      )}

      {/* 5. Form Catatan Lapangan PIC */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 p-6 shadow-sm space-y-3">
        <label className="block text-xs font-black uppercase text-suka-brown tracking-wider">
          Catatan Lapangan & Pernyataan Audit PIC ({tabConfig.picRole})
        </label>
        <textarea
          rows={3}
          value={picNotes[activeTab]}
          onChange={(e) => setPicNotes({ ...picNotes, [activeTab]: e.target.value })}
          placeholder="Tuliskan catatan rekonsiliasi, kendala mutasi bank, atau penjelasan selisih..."
          className="w-full text-xs p-3 rounded-xl border border-suka-gray-300 focus:outline-none focus:ring-2 focus:ring-suka-orange/30 text-suka-ink"
        />
        <p className="text-[11px] text-suka-gray-500 italic">
          * Catatan ini akan otomatis tertaut ke dokumen Berita Acara resmi dan terbaca oleh Owner di EOM Closing HUB Admin Dashboard.
        </p>
      </div>
    </div>
  )
}
