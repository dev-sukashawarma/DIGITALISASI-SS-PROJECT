'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Info,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Calculator,
} from 'lucide-react';

export type SupportedPlatform = 'gofood' | 'grabfood' | 'shopeefood' | 'tiktokgo' | 'food_apps';

interface PlatformMeta {
  id: SupportedPlatform;
  label: string;
  badge: string;
  color: string;
  bgLight: string;
  borderLight: string;
  textDark: string;
  fileName: string;
  sheetName: string;
  format: string;
  sourceDesc: string;
  potonganList: {
    title: string;
    colName: string;
    type: 'deduction' | 'commission' | 'subsidy';
    desc: string;
  }[];
  formula: string;
}

const PLATFORM_DETAILS: Record<SupportedPlatform, PlatformMeta> = {
  gofood: {
    id: 'gofood',
    label: 'GoFood',
    badge: '🔴 GoFood (GoBiz)',
    color: 'rose',
    bgLight: 'bg-rose-50',
    borderLight: 'border-rose-200',
    textDark: 'text-rose-900',
    fileName: 'GOFOOD TEMPLATE.xlsx / Laporan GoBiz',
    sheetName: 'Midtrans Payments / Transactions',
    format: 'Excel (.xlsx) / CSV',
    sourceDesc: 'Laporan pembayaran GoBiz Midtrans per order',
    potonganList: [
      {
        title: 'Diskon Promo Merchant',
        colName: 'GoFood discount / Merchant Promo Contribution',
        type: 'deduction',
        desc: 'Potongan harga promo resto yang dibebankan kepada merchant restoran SS.',
      },
      {
        title: 'Komisi Platform Gojek',
        colName: 'Total Fee (Biaya Layanan + PPN 11%)',
        type: 'commission',
        desc: 'Biaya komisi resmi platform Gojek termasuk PPN (Value added tax).',
      },
      {
        title: 'Subsidi Gopay / GoFood',
        colName: 'Gopay promo',
        type: 'subsidy',
        desc: 'Promo subsidi dari pihak Gojek/GoPay. BUKAN beban resto (diganti penuh ke rekening merchant).',
      },
    ],
    formula: 'Net Cair = Amount (Omzet Kotor) - GoFood discount - Total Fee',
  },
  grabfood: {
    id: 'grabfood',
    label: 'GrabFood',
    badge: '🟢 GrabFood',
    color: 'emerald',
    bgLight: 'bg-emerald-50',
    borderLight: 'border-emerald-200',
    textDark: 'text-emerald-900',
    fileName: 'Laporan Penyelesaian GrabMerchant',
    sheetName: 'Filter baris: Status = "Transferred"',
    format: 'CSV (.csv) ~68 Kolom',
    sourceDesc: 'Laporan settlement GrabMerchant per pesanan lunas',
    potonganList: [
      {
        title: 'Diskon Promo Resto',
        colName: 'Amount - Net Sales',
        type: 'deduction',
        desc: 'Selisih harga menu kotor (Amount) dengan Net Sales (promo yang ditanggung restoran).',
      },
      {
        title: 'Komisi Platform Grab',
        colName: 'Net Sales - Total',
        type: 'commission',
        desc: 'Biaya komisi layanan GrabFood (Order Commission + Grab Fee + PPN).',
      },
      {
        title: 'Status Transferred',
        colName: 'Status = "Transferred"',
        type: 'subsidy',
        desc: 'Hanya pesanan yang berhasil dicairkan (Transferred) yang dihitung sebagai kas masuk riil.',
      },
    ],
    formula: 'Net Cair = Amount (Omzet Kotor) - Diskon Resto - Komisi Grab',
  },
  shopeefood: {
    id: 'shopeefood',
    label: 'ShopeeFood',
    badge: '🟠 ShopeeFood (Shopee Partner)',
    color: 'amber',
    bgLight: 'bg-amber-50',
    borderLight: 'border-amber-200',
    textDark: 'text-amber-900',
    fileName: 'sf-transaction.xlsx / sf-settlment.xlsx',
    sheetName: 'Order_Payment_Details / Shopeefood_Income_Details',
    format: 'Excel (.xlsx)',
    sourceDesc: 'Laporan rincian pembayaran per nomor transaksi Shopee Partner',
    potonganList: [
      {
        title: 'Voucher Toko / Diskon Menu',
        colName: 'Merchant Food Voucher Subsidy',
        type: 'deduction',
        desc: 'Voucher diskon menu makanan yang dibebankan kepada pihak restoran SS.',
      },
      {
        title: 'Beban Gratis Ongkir Toko',
        colName: 'Merchant Shipping Fee Voucher Subsidy',
        type: 'deduction',
        desc: 'Subsidi gratis ongkir yang ditanggung oleh pihak restoran SS.',
      },
      {
        title: 'Komisi Platform ShopeeFood',
        colName: 'Commission',
        type: 'commission',
        desc: 'Biaya komisi resmi platform ShopeeFood atas pesanan selesai.',
      },
      {
        title: 'Penyesuaian Saldo / Komplain Pelanggan',
        colName: 'Shopeefood_Adjustment_Details',
        type: 'deduction',
        desc: 'Pemotongan saldo wallet bila ada komplain pembeli, menu kurang, atau refund makanan.',
      },
      {
        title: 'Subsidi Flash Sale Platform',
        colName: 'Platform Flash Sale Subsidy',
        type: 'subsidy',
        desc: 'Subsidi promo dari pihak Shopee. BUKAN beban resto (ditanggung 100% oleh Shopee).',
      },
    ],
    formula: 'Net Cair = Order Amount - Voucher Toko - Beban Ongkir - Komisi Shopee - Penyesuaian Saldo',
  },
  tiktokgo: {
    id: 'tiktokgo',
    label: 'TikTok Go',
    badge: '⚫ TikTok Go (TikTok Shop Local)',
    color: 'slate',
    bgLight: 'bg-slate-100',
    borderLight: 'border-slate-300',
    textDark: 'text-slate-900',
    fileName: 'ttgo orders.xlsx / ttgo earning report.xlsx',
    sheetName: 'order detail / Sheet1 (Earnings)',
    format: 'Excel (.xlsx)',
    sourceDesc: 'Laporan penukaran voucher pesanan layanan lokal TikTok Shop',
    potonganList: [
      {
        title: 'Biaya Platform TikTok (Platform Fee)',
        colName: 'Total platform fees (8% flat)',
        type: 'commission',
        desc: 'Biaya komisi layanan platform resmi TikTok Shop (8,00% dari Commission Base).',
      },
      {
        title: 'Komisi Afiliasi Kreator (Creator Commission)',
        colName: 'Creator commission (5%)',
        type: 'commission',
        desc: 'Komisi bagi hasil kreator/influencer TikTok (5,00%) jika voucher dibeli melalui tautan konten video kreator.',
      },
      {
        title: 'Diskon Beban Merchant (Toko)',
        colName: 'Merchant incentive',
        type: 'deduction',
        desc: 'Diskon murni beban toko restoran SS (di TikTok Go biasanya Rp 0 karena promo berbentuk voucher harga dasar).',
      },
      {
        title: 'Subsidi Voucher TikTok Platform',
        colName: 'Platform incentive',
        type: 'subsidy',
        desc: 'Subsidi voucher promosi dari TikTok. Menjadi hak penuh restoran (dibayar utuh ke merchant).',
      },
    ],
    formula: 'Net Cair = Base Hak Resto (Payment + Platform incentive) - Biaya Platform (8%) - Komisi Kreator (5%)',
  },
  food_apps: {
    id: 'food_apps',
    label: 'Semua Food Apps',
    badge: '🍔 Semua Food Apps',
    color: 'rose',
    bgLight: 'bg-rose-50',
    borderLight: 'border-rose-200',
    textDark: 'text-rose-950',
    fileName: 'Gabungan File Settlement 4 Platform',
    sheetName: 'GoFood + GrabFood + ShopeeFood + TikTok Go',
    format: 'Multi-file Excel & CSV',
    sourceDesc: 'Konsolidasi Single Source of Truth seluruh platform pesan-antar',
    potonganList: [
      {
        title: 'Diskon Promo Merchant',
        colName: 'Total Promo Resto dari 4 Platform',
        type: 'deduction',
        desc: 'Akumulasi diskon promo yang menjadi beban toko dari GoFood, Grab, Shopee, dan TikTok.',
      },
      {
        title: 'Komisi Platform Resmi',
        colName: 'Total Commission dari 4 Platform',
        type: 'commission',
        desc: 'Akumulasi potongan biaya komisi bagi hasil aplikasi yang diunggah ke sistem.',
      },
    ],
    formula: 'Total Admin Fee = Total Diskon Promo Resto + Total Komisi Platform',
  },
};

interface AdminFeeBreakdownTooltipProps {
  selectedChannels: string[];
  analytics?: {
    totalAdminFee?: number;
    totalDeductions?: number;
    totalCommission?: number;
    estimatedCommission?: number;
    totalRealAdmin?: number;
    settlementDateRange?: string;
    grossRevenue?: number;
  };
  isPosKasirOnly?: boolean;
}

export default function AdminFeeBreakdownTooltip({
  selectedChannels,
  analytics,
  isPosKasirOnly,
}: AdminFeeBreakdownTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Tentukan platform default berdasarkan filter channel yang sedang aktif
  const detectedPlatform: SupportedPlatform = useMemo(() => {
    if (selectedChannels.some((c) => c === 'gofood' || c === 'gojek')) return 'gofood';
    if (selectedChannels.some((c) => c === 'grabfood' || c === 'grab')) return 'grabfood';
    if (selectedChannels.some((c) => c === 'shopeefood' || c === 'shopee')) return 'shopeefood';
    if (selectedChannels.some((c) => c === 'tiktokgo' || c === 'tiktok')) return 'tiktokgo';
    return 'gofood';
  }, [selectedChannels]);

  const [activeTab, setActiveTab] = useState<SupportedPlatform>(detectedPlatform);

  // Perbarui activeTab saat filter berubah
  useEffect(() => {
    setActiveTab(detectedPlatform);
  }, [detectedPlatform]);

  // Tutup jika klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentMeta = PLATFORM_DETAILS[activeTab] || PLATFORM_DETAILS.gofood;
  const isSettled = (analytics?.totalRealAdmin ?? 0) > 0;

  if (isPosKasirOnly) {
    return null;
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Tombol Pemicu Info Tooltip */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/15 hover:bg-white/30 text-[10px] font-semibold text-white/90 hover:text-white transition-all cursor-pointer backdrop-blur-xs shadow-2xs group"
        title="Klik untuk melihat rincian potongan sesuai file asli platform"
      >
        <Info className="w-3 h-3 text-white/90 group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline">Rincian File</span>
      </button>

      {/* Floating Popover / Tooltip Modal */}
      {isOpen && (
        <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-20 sm:top-full left-auto sm:-left-32 md:-left-44 mt-2 sm:w-[420px] max-h-[85vh] sm:max-h-[560px] overflow-y-auto bg-slate-900/95 text-slate-100 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-50 p-4 sm:p-5 text-left animate-fade-in">
          {/* Header Popover */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-rose-400 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Format Kolom & Potongan File Asli
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Pemilihan Food App */}
          <div className="flex items-center gap-1 my-3 p-1 bg-slate-950/70 rounded-xl border border-slate-800/80 overflow-x-auto text-[11px] font-semibold">
            {(['gofood', 'grabfood', 'shopeefood', 'tiktokgo'] as SupportedPlatform[]).map((pId) => {
              const tabMeta = PLATFORM_DETAILS[pId];
              const isSelected = activeTab === pId;
              return (
                <button
                  key={pId}
                  type="button"
                  onClick={() => setActiveTab(pId)}
                  className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer flex-1 text-center ${
                    isSelected
                      ? 'bg-rose-600 text-white font-bold shadow-sm shadow-rose-900/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {tabMeta.label}
                </button>
              );
            })}
          </div>

          {/* Informasi File & Sheet Asli */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 mb-3 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 font-medium">Sumber Laporan:</span>
              <span className="font-bold text-slate-100">{currentMeta.badge}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 font-medium">Nama File Template:</span>
              <span className="font-mono text-slate-200 font-bold text-[10.5px]">
                {currentMeta.fileName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 font-medium">Sheet / Format:</span>
              <span className="text-slate-300 font-medium">{currentMeta.sheetName}</span>
            </div>
          </div>

          {/* Status Sinkronisasi Settlement */}
          <div className="mb-3.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              {isSettled ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="text-slate-300 font-medium">
                Status:{' '}
                <strong className={isSettled ? 'text-emerald-300' : 'text-amber-300'}>
                  {isSettled ? '✓ Data Settlement Riil Terpasang' : 'Estimasi Catatan Kasir'}
                </strong>
              </span>
            </div>
            <Link
              href="/dashboard/platform-settlement"
              className="text-[10px] text-rose-400 hover:text-rose-300 underline font-semibold flex items-center gap-0.5"
            >
              Upload ↗
            </Link>
          </div>

          {/* Rincian Kolom Potongan Sesuai File Asli */}
          <div className="space-y-2 mb-3.5">
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
              Keterangan Kolom di File Asli:
            </p>
            {currentMeta.potonganList.map((pot, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-750 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    {pot.type === 'deduction' && <span className="text-rose-400">🔻</span>}
                    {pot.type === 'commission' && <span className="text-amber-400">🏛️</span>}
                    {pot.type === 'subsidy' && <span className="text-emerald-400">🛡️</span>}
                    {pot.title}
                  </span>
                  <span
                    className={`text-[9.5px] px-2 py-0.5 rounded-md font-mono font-bold ${
                      pot.type === 'deduction'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                        : pot.type === 'commission'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                    }`}
                  >
                    {pot.type === 'deduction'
                      ? 'Beban Toko'
                      : pot.type === 'commission'
                      ? 'Beban Platform'
                      : 'Subsidi Aplikasi'}
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-slate-300 bg-slate-900/90 px-2 py-1 rounded border border-slate-800 mb-1">
                  Kolom: <strong className="text-amber-300">{pot.colName}</strong>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{pot.desc}</p>
              </div>
            ))}
          </div>

          {/* Rumus Aritmatika File Asli */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold mb-1">
              <Calculator className="w-3.5 h-3.5 text-rose-400" />
              <span>Rumus Pencairan Kas (Net Disbursement):</span>
            </div>
            <p className="font-mono text-[10.5px] text-rose-300 font-bold bg-slate-950/90 p-2 rounded-lg border border-slate-800">
              {currentMeta.formula}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
