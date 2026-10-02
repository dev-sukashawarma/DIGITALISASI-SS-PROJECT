'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  previewAllSettlementFiles,
  syncAllSettlementData,
  getSettlementDashboardStatus,
  saveStoreMapping,
  deleteSettlementBatch,
} from '@/app/actions/platformSettlement';
import type { MultiPlatformSummary, SettlementUploadStatus } from '@/app/actions/platformSettlement';
import { useOutlets } from '@/hooks/useOutlets';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Trash2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

const PLATFORMS = [
  {
    id: 'gofood',
    label: 'GoFood (GoBiz)',
    accept: '.xlsx,.xls,.csv',
    color: 'red',
    badge: '🔴 Prioritas 1',
    description: 'Single Source of Truth Card Biru. Auto-override potongan merchant & pisahkan subsidi Gojek.',
  },
  {
    id: 'grabfood',
    label: 'GrabFood',
    accept: '.csv',
    color: 'green',
    badge: '🟢 Prioritas 2',
    description: 'Laporan settlement Grab (.csv). Monitoring order matched & gap input kasir.',
  },
  {
    id: 'shopeefood',
    label: 'ShopeeFood',
    accept: '.xlsx,.xls',
    color: 'orange',
    badge: '🟠 Prioritas 3',
    description: 'Laporan Shopee (.xlsx). Akurasi 99.8%, rekapitulasi komisi & potongan.',
  },
  {
    id: 'tiktokgo',
    label: 'TikTok Go',
    accept: '.xlsx,.xls',
    color: 'gray',
    badge: '⚫ Tambahan',
    description: 'Settlement voucher TikTok Go (.xlsx).',
  },
];

const rp = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '-');

const PLATFORM_CONFIG: Record<
  string,
  {
    name: string;
    badge: string;
    color: string;
    bgCard: string;
    borderCard: string;
    textTitle: string;
    omzetLabel: string;
    omzetSub: string;
    promoLabel: string;
    promoSub: string;
    feeLabel: string;
    feeSub: string;
    posSub: string;
    tableOmzetHeader: string;
    tablePromoHeader: string;
    tableSubsidiHeader: string;
    tableFeeHeader: string;
    infoTitle: string;
    infoBadge: string;
    infoText: string;
  }
> = {
  shopeefood: {
    name: 'ShopeeFood',
    badge: '🟠 ShopeeFood',
    color: 'orange',
    bgCard: 'bg-orange-50/70',
    borderCard: 'border-orange-200',
    textTitle: 'text-orange-950',
    omzetLabel: 'Omzet ShopeeFood',
    omzetSub: 'Order Amount di file settlement Shopee',
    promoLabel: 'Diskon & Voucher Toko',
    promoSub: 'Voucher Toko & Subsidi Ongkir Resto',
    feeLabel: 'Komisi Shopee',
    feeSub: 'Potongan komisi merchant Shopee',
    posSub: 'Sales Channel ShopeeFood di POS',
    tableOmzetHeader: 'Omzet Shopee (Order Amount)',
    tablePromoHeader: 'Diskon Toko (Shopee)',
    tableSubsidiHeader: 'Selisih Promo',
    tableFeeHeader: 'Komisi Shopee',
    infoTitle: 'Settlement ShopeeFood Terverifikasi (Diskon Toko Murni)',
    infoBadge: 'Diskon Toko Murni',
    infoText:
      'Seluruh diskon yang tercatat di laporan settlement ShopeeFood adalah Diskon Toko murni (Voucher Merchant & Subsidi Ongkir Resto). Selisih komplain pelanggan / refund menu tercatat di sheet Adjustment terpisah.',
  },
  grabfood: {
    name: 'GrabFood',
    badge: '🟢 GrabFood',
    color: 'emerald',
    bgCard: 'bg-emerald-50/70',
    borderCard: 'border-emerald-200',
    textTitle: 'text-emerald-950',
    omzetLabel: 'Omzet GrabFood',
    omzetSub: 'Amount (Gross Sales) di file Grab',
    promoLabel: 'Diskon Merchant (Grab)',
    promoSub: 'Merchant-Funded Discount',
    feeLabel: 'Komisi Grab (20%)',
    feeSub: 'Flat 20.00% dari Net Sales (Gross - Diskon)',
    posSub: 'Sales Channel GrabFood di POS',
    tableOmzetHeader: 'Omzet Grab (Amount)',
    tablePromoHeader: 'Diskon Merchant (Grab)',
    tableSubsidiHeader: 'Selisih Promo',
    tableFeeHeader: 'Komisi Grab (20%)',
    infoTitle: 'Settlement GrabFood Terverifikasi (Komisi Flat 20% Net Sales)',
    infoBadge: 'Flat 20.00% Net Sales',
    infoText:
      'Komisi Grab dipotong flat 20.00% dari Penjualan Bersih (Net Sales = Amount - Discount). Tidak ada subsidi platform yang tercampur di bill resto. Jika terdapat selisih pencairan bank, periksa penyesuaian insiden / chargeback komplain pelanggan.',
  },
  gofood: {
    name: 'GoFood',
    badge: '🔴 GoFood (GoBiz)',
    color: 'rose',
    bgCard: 'bg-rose-50/70',
    borderCard: 'border-rose-200',
    textTitle: 'text-rose-950',
    omzetLabel: 'Omzet GoFood (GoBiz)',
    omzetSub: 'Penjualan kotor sebelum diskon',
    promoLabel: 'Promo Resto (GoBiz)',
    promoSub: 'Diskon yang ditanggung mitra usaha',
    feeLabel: 'Komisi GoBiz',
    feeSub: 'Biaya layanan komisi GoBiz',
    posSub: 'Sales Channel GoFood di POS',
    tableOmzetHeader: 'Omzet GoFood (GoBiz)',
    tablePromoHeader: 'Promo Resto (GoBiz)',
    tableSubsidiHeader: 'Subsidi Gojek',
    tableFeeHeader: 'Komisi GoBiz',
    infoTitle: 'Subsidi Gojek Terdeteksi (Bukan Beban Resto)',
    infoBadge: 'Bukan Beban Resto',
    infoText:
      'Kasir menginput promo di POS mencakup subsidi voucher Gojek. Settlement GoBiz menyatakan promo beban resto yang sebenarnya. Card Biru pada Laporan POS otomatis menggunakan angka promo resto murni dan memulihkan Gross Profit resto!',
  },
  tiktokgo: {
    name: 'TikTok Go',
    badge: '⚫ TikTok Go',
    color: 'gray',
    bgCard: 'bg-gray-50/70',
    borderCard: 'border-gray-200',
    textTitle: 'text-gray-950',
    omzetLabel: 'Omzet TikTok Go',
    omzetSub: 'Hak Penjualan Voucher (Payment Amount + Subsidi TikTok)',
    promoLabel: 'Diskon Merchant (TikTok)',
    promoSub: 'Beban promo toko murni (Merchant Incentive)',
    feeLabel: 'Komisi TikTok (~9.18%)',
    feeSub: 'Platform fee 8% + komisi affiliate creator',
    posSub: 'Voucher TikTok di POS',
    tableOmzetHeader: 'Omzet TikTok (Voucher Hak Resto)',
    tablePromoHeader: 'Diskon Merchant (TikTok)',
    tableSubsidiHeader: 'Selisih Promo',
    tableFeeHeader: 'Komisi TikTok',
    infoTitle: 'Settlement TikTok Go (Skema Voucher & Siklus Pencairan Bank T+4)',
    infoBadge: 'Skema Voucher T+4',
    infoText:
      'TikTok Go menggunakan sistem penukaran voucher di kasir outlet. Subsidi voucher (Platform Incentive) diganti 100% oleh TikTok ke rekening resto. Pencairan bank mengikuti siklus T+4 kerja (transaksi 29-30 September cair di awal Oktober).',
  },
  all: {
    name: 'Semua Platform',
    badge: '🌐 Semua Platform',
    color: 'blue',
    bgCard: 'bg-blue-50/70',
    borderCard: 'border-blue-200',
    textTitle: 'text-blue-950',
    omzetLabel: 'Total Omzet Settlement',
    omzetSub: 'Gabungan seluruh file settlement',
    promoLabel: 'Total Diskon Merchant',
    promoSub: 'Beban diskon toko gabungan',
    feeLabel: 'Total Komisi Platform',
    feeSub: 'Rata-rata potongan komisi',
    posSub: 'Total channel online di POS',
    tableOmzetHeader: 'Omzet Settlement',
    tablePromoHeader: 'Diskon Toko (Settlement)',
    tableSubsidiHeader: 'Subsidi / Selisih Promo',
    tableFeeHeader: 'Komisi Platform',
    infoTitle: 'Rekonsiliasi Gabungan Multi-Platform',
    infoBadge: 'Gabungan Multi-Platform',
    infoText:
      'Data mencakup beberapa platform sekaligus. Anda dapat mengklik tab platform di atas untuk melihat rincian serta istilah spesifik masing-masing food app.',
  },
};

function formatDateIndo(dateStr: string) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PlatformSettlementPage() {
  const { data: outlets = [] } = useOutlets();
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');

  // Form states
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<MultiPlatformSummary | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Status & History states
  const [uploadStatus, setUploadStatus] = useState<SettlementUploadStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Mapping in progress state
  const [mappingSelection, setMappingSelection] = useState<Record<string, string>>({});
  const [mappingLoading, setMappingLoading] = useState(false);

  // Load status on mount
  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await getSettlementDashboardStatus();
      if (res.success) {
        setUploadStatus(res.data);
      }
    } catch (e: any) {
      console.error('Gagal memuat status upload:', e);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Set default outlets when loaded
  useEffect(() => {
    if (outlets.length > 0 && selectedOutlets.length === 0) {
      setSelectedOutlets(outlets.filter((o) => o.is_active !== false).map((o) => o.id));
    }
  }, [outlets, selectedOutlets.length]);

  // Set default dates to last week (Senin - Minggu)
  useEffect(() => {
    if (!from && !to) {
      const today = new Date();
      // Pastikan rentang default mencakup minggu terakhir
      const day = today.getDay(); // 0 is Sun
      const diffToLastMonday = (day === 0 ? 6 : day - 1) + 7;
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - diffToLastMonday);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);

      setFrom(formatLocalDate(lastMonday));
      setTo(formatLocalDate(lastSunday));
    }
  }, [from, to]);

  const toggleOutlet = (id: string) => {
    setSelectedOutlets((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
    setSummary(null);
    setErrorMsg('');
    setSyncMsg('');
  };

  const selectAll = () => setSelectedOutlets(outlets.map((o) => o.id));
  const clearAll = () => setSelectedOutlets([]);

  const setDatePreset = (preset: 'last_week' | 'this_month' | 'last_month') => {
    const today = new Date();

    if (preset === 'last_week') {
      const day = today.getDay();
      const diff = (day === 0 ? 6 : day - 1) + 7;
      const lastMon = new Date(today);
      lastMon.setDate(today.getDate() - diff);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      setFrom(formatLocalDate(lastMon));
      setTo(formatLocalDate(lastSun));
    } else if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFrom(formatLocalDate(firstDay));
      setTo(formatLocalDate(today));
    } else if (preset === 'last_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setFrom(formatLocalDate(firstDay));
      setTo(formatLocalDate(lastDay));
    }
    setSummary(null);
    setErrorMsg('');
    setSyncMsg('');
  };

  const handleFile = (platformId: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [platformId]: file }));
    setSummary(null);
    setErrorMsg('');
    setSyncMsg('');
  };

  const filesUploaded = Object.values(files).filter(Boolean).length;

  const handlePreview = async () => {
    if (!from || !to) {
      setErrorMsg('Pilih rentang tanggal terlebih dahulu.');
      return;
    }
    if (filesUploaded === 0) {
      setErrorMsg('Upload minimal 1 file settlement untuk di-preview.');
      return;
    }
    if (selectedOutlets.length === 0) {
      setErrorMsg('Pilih minimal 1 outlet.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSyncMsg('');
    try {
      const fd = new FormData();
      fd.append('from', from);
      fd.append('to', to);
      fd.append('outletIds', JSON.stringify(selectedOutlets));
      for (const p of PLATFORMS) {
        if (files[p.id]) fd.append(`file_${p.id}`, files[p.id]!);
      }
      const res = await previewAllSettlementFiles(fd);
      if (res.success) {
        setSummary(res.summary);
        if (res.summary.primaryPlatform && res.summary.primaryPlatform !== 'all') {
          setActivePlatformTab(res.summary.primaryPlatform);
        } else {
          setActivePlatformTab('all');
        }
        // Otomatis selaraskan input tanggal dengan rentang transaksi aktual dari file settlement
        if (res.summary.periodeFrom && res.summary.periodeTo) {
          setFrom(res.summary.periodeFrom);
          setTo(res.summary.periodeTo);
        }
      } else {
        setErrorMsg(res.error || 'Gagal memproses file settlement.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!summary) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await syncAllSettlementData(summary.allDaily);
      if (res.success) {
        setSyncMsg(
          `✅ Berhasil menyimpan & menyinkronkan ${res.savedRows} baris settlement ke database. Card Biru pada Laporan POS kini telah menggunakan data settlement sebagai acuan!`
        );
        setSummary(null);
        setFiles({});
        PLATFORMS.forEach((p) => {
          if (fileRefs.current[p.id]) fileRefs.current[p.id]!.value = '';
        });
        refreshStatus();
      } else {
        setErrorMsg(res.error || 'Gagal menyimpan data.');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStoreMapping = async (platform: string, storeKey: string) => {
    const targetOutletId = mappingSelection[storeKey];
    if (!targetOutletId) {
      alert('Pilih outlet tujuan terlebih dahulu.');
      return;
    }
    setMappingLoading(true);
    try {
      const res = await saveStoreMapping({
        platform,
        storeKey,
        outletId: targetOutletId,
      });
      if (res.success) {
        // Otomatis refresh preview
        await handlePreview();
      } else {
        alert(res.error || 'Gagal menyimpan pemetaan.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setMappingLoading(false);
    }
  };

  const handleDeleteSettlement = async (platform: string, date: string, outletId: string, outletName: string) => {
    const confirm = window.confirm(
      `Apakah Anda yakin ingin menghapus data settlement ${platform.toUpperCase()} untuk outlet "${outletName}" pada tanggal ${date}?`
    );
    if (!confirm) return;

    try {
      const res = await deleteSettlementBatch({
        platform,
        from: date,
        to: date,
        outletId,
      });
      if (res.success) {
        alert('Data settlement berhasil dihapus.');
        refreshStatus();
      } else {
        alert(res.error || 'Gagal menghapus.');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const s = summary;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <UploadCloud className="w-6 h-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Upload Settlement Food Apps</h1>
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            Upload file settlement mingguan (GoBiz, Grab, Shopee) sebagai <b>Single Source of Truth</b>. Sistem otomatis
            meng-override Card Biru dan memisahkan Subsidi Gojek.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload Settlement
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              refreshStatus();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Riwayat di Database
          </button>
        </div>
      </div>

      {/* ── SCHEDULE & STATUS BANNER ── */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-amber-50 rounded-2xl border border-blue-100 p-5 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-blue-950 text-base">Jadwal Rutin: Upload Setiap Senin Pagi</h2>
              <p className="text-xs text-blue-800/80 mt-0.5">
                Download laporan settlement dari portal masing-masing platform untuk minggu sebelumnya, lalu upload ke
                halaman ini agar laporan mingguan & bulanan POS langsung akurat.
              </p>
            </div>
          </div>
          <button
            onClick={refreshStatus}
            disabled={statusLoading}
            className="flex items-center gap-1.5 text-xs text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>

        {/* Platform Status Cards */}
        {uploadStatus && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {PLATFORMS.map((p) => {
              const stat = uploadStatus.latestUploads[p.id];
              const isOverdue = p.id === 'gofood' && uploadStatus.gofoodStatus.isOverdue;
              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-xl p-3 border ${
                    isOverdue ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span>{p.label}</span>
                    {stat?.lastSettlementDate ? (
                      <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                        Belum Ada
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Settlement Terakhir:
                    <p className="font-semibold text-gray-800 text-sm">
                      {stat?.lastSettlementDate ? formatDateIndo(stat.lastSettlementDate) : '—'}
                    </p>
                  </div>
                  {isOverdue && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Perlu diupload!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeTab === 'upload' ? (
        <>
          {/* ── STEP 1: Periode & Outlet ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                Pilih Periode & Outlet
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Pintasan:</span>
                <button
                  onClick={() => setDatePreset('last_week')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-md font-medium text-gray-600 transition-colors"
                >
                  Minggu Lalu
                </button>
                <button
                  onClick={() => setDatePreset('this_month')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-md font-medium text-gray-600 transition-colors"
                >
                  Bulan Ini
                </button>
                <button
                  onClick={() => setDatePreset('last_month')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-md font-medium text-gray-600 transition-colors"
                >
                  Bulan Lalu
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Dari Tanggal</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setSummary(null);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Sampai Tanggal</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setSummary(null);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {from && to && (
                <div className="self-end pb-1 text-xs text-blue-700 font-semibold bg-blue-50 px-3 py-2 rounded-lg">
                  Rentang: {formatDateIndo(from)} — {formatDateIndo(to)}
                </div>
              )}
            </div>

            {/* Outlet selector */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500 font-medium">Pilih Outlet yang akan direkonsiliasi</label>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                    Pilih Semua ({outlets.length})
                  </button>
                  <span className="text-gray-300">|</span>
                  <button onClick={clearAll} className="text-xs text-red-500 hover:underline">
                    Hapus Semua
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-100">
                {outlets.map((o) => {
                  const isSelected = selectedOutlets.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggleOutlet(o.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {o.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1">{selectedOutlets.length} outlet dipilih</p>
            </div>
          </div>

          {/* ── STEP 2: Upload Files ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                2
              </span>
              Upload File Settlement Platform
            </h2>
            <p className="text-xs text-gray-500">
              Anda dapat mengunggah satu platform saja (misal GoFood saja setiap Senin) atau gabungan beberapa platform
              sekaligus.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLATFORMS.map((p) => {
                const uploaded = files[p.id];
                const isGoFood = p.id === 'gofood';
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border-2 p-4 transition-all relative ${
                      uploaded
                        ? 'border-green-400 bg-green-50/50 shadow-xs'
                        : isGoFood
                        ? 'border-red-200 bg-red-50/20 hover:border-red-300'
                        : 'border-gray-200 bg-gray-50/50 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-sm">{p.label}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700">
                          {p.badge}
                        </span>
                      </div>
                      {uploaded && (
                        <button
                          onClick={() => handleFile(p.id, null)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold"
                        >
                          ✕ Hapus
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mb-3 min-h-[32px]">{p.description}</p>

                    {uploaded ? (
                      <div className="flex items-center gap-2 text-xs text-green-700 bg-white p-2 rounded-xl border border-green-200">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="font-medium truncate">{uploaded.name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          ({(uploaded.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-white border border-dashed border-gray-300 rounded-xl hover:bg-blue-50/50 hover:border-blue-400 transition-all text-xs font-semibold text-gray-700">
                        <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                        <span>Pilih file ({p.accept})</span>
                        <input
                          type="file"
                          accept={p.accept}
                          className="hidden"
                          ref={(el) => {
                            fileRefs.current[p.id] = el;
                          }}
                          onChange={(e) => handleFile(p.id, e.target.files?.[0] ?? null)}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={handlePreview}
                disabled={loading || filesUploaded === 0 || !from || !to}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2 active:scale-95"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Memproses & Membandingkan...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Preview & Rekonsiliasi ({filesUploaded} Platform)
                  </>
                )}
              </button>
              {filesUploaded > 0 && (
                <span className="text-xs text-gray-500 font-medium">
                  {filesUploaded} file platform siap direkonsiliasikan dengan data POS Internal
                </span>
              )}
            </div>

            {errorMsg && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Terjadi Kesalahan</p>
                  <p className="text-xs mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {syncMsg && (
              <div className="p-4 bg-green-50 text-green-800 rounded-xl text-sm border border-green-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span>Sinkronisasi Berhasil!</span>
                </div>
                <p className="text-xs">{syncMsg}</p>
                <div className="pt-2">
                  <Link
                    href={`/dashboard/reports/pos?from=${from}&to=${to}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800 transition-colors"
                  >
                    Buka Laporan POS untuk Periode Ini
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── STEP 3: Preview Hasil Rekonsiliasi ── */}
          {s && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden space-y-6">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4 bg-gray-50/50">
                <div>
                  <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    Hasil Rekonsiliasi: Settlement vs POS Internal
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Periode: {formatDateIndo(s.periodeFrom)} — {formatDateIndo(s.periodeTo)} | Sumber Data Pembanding:{' '}
                    <b>POS Internal (`orders`)</b>
                  </p>
                </div>
                <button
                  onClick={handleSync}
                  disabled={loading}
                  className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-green-700 disabled:opacity-50 transition-all flex items-center gap-2 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {loading ? 'Menyimpan...' : `Simpan ${s.allDaily.reduce((sum, d) => sum + d.daily.length, 0)} Baris ke Database`}
                </button>
              </div>

              {s.isAutoAligned && (
                <div className="mx-6 mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Periode Otomatis Diselaraskan dengan File Settlement</p>
                    <p className="text-blue-700 mt-0.5">
                      File settlement yang diunggah berisi data transaksi dari <b>{formatDateIndo(s.periodeFrom)}</b> s/d{' '}
                      <b>{formatDateIndo(s.periodeTo)}</b>. Pembanding POS Internal otomatis dihitung untuk rentang tanggal yang persis sama.
                    </p>
                  </div>
                </div>
              )}

              {(() => {
                const activeCfg = PLATFORM_CONFIG[activePlatformTab] || PLATFORM_CONFIG.all;
                const pData =
                  activePlatformTab !== 'all'
                    ? s.perPlatform.find((p) => p.platform === activePlatformTab)
                    : null;

                const currentOmzet = pData ? pData.omzetKotor : s.totalOmzetKotor;
                const currentPromo = pData ? pData.promo : s.totalPromo;
                const currentAdminFee = pData ? pData.adminFee : s.totalAdminFee;
                const currentTrx = pData ? pData.trx : s.totalTrx;
                const currentPosOmzet = pData ? (pData.posOmzetKotor ?? 0) : s.posOmzetKotor;
                const currentPosTrx = pData ? (pData.posTrxCount ?? 0) : s.posTrxCount;
                const currentPosPromo = pData ? (pData.posPromoKasir ?? 0) : s.posPromoKasir;
                const currentSubsidi = pData ? (pData.subsidiPlatform ?? 0) : s.totalSubsidiPlatform;
                const currentOutlets =
                  pData?.perOutlet && pData.perOutlet.length > 0 ? pData.perOutlet : s.perOutlet;
                const selisihOmzet = currentOmzet - currentPosOmzet;

                return (
                  <>
                    {/* Platform Selector Tabs */}
                    {s.perPlatform.length > 1 ? (
                      <div className="px-6 flex items-center gap-2 overflow-x-auto pb-1">
                        <button
                          onClick={() => setActivePlatformTab('all')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activePlatformTab === 'all'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span>🌐 Semua Platform</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                            {s.perPlatform.length}
                          </span>
                        </button>
                        {s.perPlatform.map((p) => {
                          const cfg = PLATFORM_CONFIG[p.platform] || PLATFORM_CONFIG.all;
                          const isActive = activePlatformTab === p.platform;
                          return (
                            <button
                              key={p.platform}
                              onClick={() => setActivePlatformTab(p.platform)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isActive
                                  ? 'bg-gray-900 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <span>{cfg.badge}</span>
                              <span className="text-[10px] opacity-75">
                                ({p.trx.toLocaleString('id-ID')} trx)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-6 flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Platform Rekonsiliasi:</span>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1.5">
                          {activeCfg.badge}
                          <span className="text-gray-400 font-normal">| {s.perPlatform[0]?.fileName}</span>
                        </span>
                      </div>
                    )}

                    {/* KPI Cards Dinamis */}
                    <div className="px-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`${activeCfg.bgCard} border ${activeCfg.borderCard} rounded-xl p-4`}>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                            {activeCfg.omzetLabel}
                          </p>
                          <p className={`text-2xl font-bold ${activeCfg.textTitle} mt-1`}>
                            {rp(currentOmzet)}
                          </p>
                          <p className="text-xs text-blue-700 mt-1 font-medium">
                            {currentTrx.toLocaleString('id-ID')} transaksi ({activeCfg.omzetSub})
                          </p>
                        </div>

                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                          <p className="text-amber-800 text-[11px] font-bold uppercase tracking-wider">
                            {activeCfg.promoLabel}
                          </p>
                          <p className="text-2xl font-bold text-amber-950 mt-1">-{rp(currentPromo)}</p>
                          <p className="text-xs text-amber-700 mt-1 font-medium">
                            {pct(currentPromo, currentOmzet)} ({activeCfg.promoSub})
                          </p>
                          {currentPosPromo > 0 && (
                            <p className="text-[10px] text-amber-800/80 mt-1 font-medium">
                              POS: -{rp(currentPosPromo)} (Selisih:{' '}
                              <span className={Math.abs(currentPosPromo - currentPromo) > 50000 ? 'font-bold' : ''}>
                                {currentPosPromo - currentPromo >= 0 ? '+' : ''}
                                {rp(currentPosPromo - currentPromo)}
                              </span>
                              )
                            </p>
                          )}
                        </div>

                        <div className="bg-red-50/70 border border-red-200 rounded-xl p-4">
                          <p className="text-red-800 text-[11px] font-bold uppercase tracking-wider">
                            {activeCfg.feeLabel}
                          </p>
                          <p className="text-2xl font-bold text-red-950 mt-1">-{rp(currentAdminFee)}</p>
                          <p className="text-xs text-red-700 mt-1 font-medium">
                            {pct(currentAdminFee, currentOmzet)} ({activeCfg.feeSub})
                          </p>
                        </div>

                        <div
                          className={`rounded-xl p-4 border ${
                            Math.abs(selisihOmzet) < (currentOmzet || 1) * 0.02
                              ? 'bg-green-50/70 border-green-200'
                              : 'bg-orange-50/70 border-orange-200'
                          }`}
                        >
                          <p
                            className={`text-[11px] font-bold uppercase tracking-wider ${
                              Math.abs(selisihOmzet) < (currentOmzet || 1) * 0.02
                                ? 'text-green-700'
                                : 'text-orange-700'
                            }`}
                          >
                            Omzet POS Internal
                          </p>
                          <p
                            className={`text-2xl font-bold mt-1 ${
                              Math.abs(selisihOmzet) < (currentOmzet || 1) * 0.02
                                ? 'text-green-950'
                                : 'text-orange-950'
                            }`}
                          >
                            {rp(currentPosOmzet)}
                          </p>
                          <p
                            className={`text-xs mt-1 font-semibold ${
                              selisihOmzet >= 0 ? 'text-orange-700' : 'text-red-700'
                            }`}
                          >
                            Selisih: {selisihOmzet >= 0 ? '+' : ''}
                            {rp(selisihOmzet)}
                            {Math.abs(selisihOmzet) < (currentOmzet || 1) * 0.02
                              ? ' ✅ Akurat'
                              : ' ⚠️ Ada gap'}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {currentPosTrx.toLocaleString('id-ID')} order di POS ({activeCfg.posSub})
                          </p>
                        </div>
                      </div>

                      {/* ── BANNERS PENJELAS PER PLATFORM ── */}
                      {/* GoFood Subsidy Banner */}
                      {((activePlatformTab === 'gofood' && currentSubsidi > 0) ||
                        (activePlatformTab === 'all' && currentSubsidi > 0)) && (
                        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-start gap-3">
                          <div className="p-2 bg-emerald-600 text-white rounded-lg mt-0.5 shrink-0">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-emerald-950 text-sm">
                                Subsidi Gojek Terdeteksi: {rp(currentSubsidi)}
                              </h3>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                                {activeCfg.infoBadge}
                              </span>
                            </div>
                            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                              Kasir menginput promo di POS sebesar <b>{rp(currentPosPromo)}</b>, namun
                              laporan settlement GoBiz menyatakan diskon yang ditanggung resto hanya{' '}
                              <b>{rp(currentPromo)}</b>. Begitu disinkronkan,{' '}
                              <b>Card Biru pada Laporan POS akan otomatis menggunakan angka diskon toko murni</b>,
                              dan memulihkan Gross Profit restoran sebesar <b>{rp(currentSubsidi)}</b>!
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ShopeeFood Verified Banner */}
                      {activePlatformTab === 'shopeefood' && (
                        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 flex items-start gap-3">
                          <div className="p-2 bg-orange-600 text-white rounded-lg mt-0.5 shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-orange-950 text-sm">
                                {activeCfg.infoTitle}
                              </h3>
                              <span className="text-[10px] bg-orange-100 text-orange-800 font-semibold px-2 py-0.5 rounded-full">
                                {activeCfg.infoBadge}
                              </span>
                            </div>
                            <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                              {activeCfg.infoText}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* GrabFood Verified Banner */}
                      {activePlatformTab === 'grabfood' && (
                        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-start gap-3">
                          <div className="p-2 bg-emerald-600 text-white rounded-lg mt-0.5 shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-emerald-950 text-sm">
                                {activeCfg.infoTitle}
                              </h3>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                                {activeCfg.infoBadge}
                              </span>
                            </div>
                            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                              {activeCfg.infoText}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* TikTok Go Banner */}
                      {activePlatformTab === 'tiktokgo' && (
                        <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-start gap-3">
                          <div className="p-2 bg-gray-700 text-white rounded-lg mt-0.5 shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 text-sm">
                                {activeCfg.infoTitle}
                              </h3>
                              <span className="text-[10px] bg-gray-200 text-gray-800 font-semibold px-2 py-0.5 rounded-full">
                                {activeCfg.infoBadge}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                              {activeCfg.infoText}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Mini Platform Comparison Cards (Only on "all" tab with multi platforms) */}
                      {s.perPlatform.length > 1 && activePlatformTab === 'all' && (
                        <div className="mt-5 space-y-2">
                          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                            Ringkasan per Platform (Klik untuk Buka Rincian)
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            {s.perPlatform.map((p) => {
                              const cfg = PLATFORM_CONFIG[p.platform] || PLATFORM_CONFIG.all;
                              const pNet = p.omzetKotor - p.adminFee - p.promo;
                              return (
                                <div
                                  key={p.platform}
                                  onClick={() => setActivePlatformTab(p.platform)}
                                  className="p-3.5 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer bg-white"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-xs text-gray-800">{cfg.badge}</span>
                                    <span className="text-[10px] text-blue-600 font-semibold hover:underline">
                                      Lihat Detail →
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between text-gray-500">
                                      <span>Omzet:</span>
                                      <span className="font-bold text-gray-800">{rp(p.omzetKotor)}</span>
                                    </div>
                                    <div className="flex justify-between text-amber-700">
                                      <span>Diskon:</span>
                                      <span>-{rp(p.promo)}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600">
                                      <span>Komisi:</span>
                                      <span>-{rp(p.adminFee)}</span>
                                    </div>
                                    <div className="flex justify-between text-green-700 pt-1 border-t border-gray-100 font-bold">
                                      <span>Netto Cair:</span>
                                      <span>{rp(pNet)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── UNMAPPED STORES FIX ── */}
                    {s.unmappedStores.length > 0 && (
                      <div className="mx-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Terdapat {s.unmappedStores.length} Toko / Merchant ID yang Belum Dipetakan</span>
                        </div>
                        <p className="text-xs text-amber-800">
                          Sistem mendeteksi Merchant ID berikut di dalam file settlement. Pilih outlet sistem kita yang sesuai,
                          lalu klik <b>Simpan Pemetaan</b> agar data langsung tersambung dan dihitung:
                        </p>

                        <div className="space-y-2 pt-1">
                          {s.unmappedStores.map((u, i) => (
                            <div
                              key={i}
                              className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2 font-semibold text-gray-800">
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] uppercase">
                                    {u.platform}
                                  </span>
                                  <span>{u.storeName}</span>
                                  <span className="text-gray-400 font-normal">ID: {u.storeId}</span>
                                </div>
                                <p className="text-gray-500 mt-0.5">Omzet di file: {rp(u.omzetKotor)}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <select
                                  value={mappingSelection[u.storeId] || ''}
                                  onChange={(e) =>
                                    setMappingSelection((prev) => ({ ...prev, [u.storeId]: e.target.value }))
                                  }
                                  className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="">-- Pilih Outlet Sistem --</option>
                                  {outlets.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleSaveStoreMapping(u.platform, u.storeId)}
                                  disabled={mappingLoading || !mappingSelection[u.storeId]}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                  Simpan Pemetaan
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── PER OUTLET TABLE DINAMIS ── */}
                    <div className="px-6 pb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800 text-sm">
                          Rincian Perbandingan per Outlet — {activeCfg.name}
                        </h3>
                        <span className="text-xs text-gray-500 font-medium">
                          {currentOutlets.length} outlet terdaftar
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                              <th className="p-3 border-b">Outlet</th>
                              <th className="p-3 border-b text-right">{activeCfg.tableOmzetHeader}</th>
                              <th className="p-3 border-b text-right">Omzet POS</th>
                              <th className="p-3 border-b text-right">Selisih Omzet</th>
                              <th className="p-3 border-b text-right bg-amber-50/80 text-amber-900">
                                {activeCfg.tablePromoHeader}
                              </th>
                              <th className="p-3 border-b text-right">Promo Kasir (POS)</th>
                              <th className="p-3 border-b text-right bg-gray-50 text-gray-700">
                                {activeCfg.tableSubsidiHeader}
                              </th>
                              <th className="p-3 border-b text-right bg-red-50 text-red-800">
                                {activeCfg.tableFeeHeader}
                              </th>
                              <th className="p-3 border-b text-right bg-green-50 text-green-900 font-bold">
                                Netto Cair
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {currentOutlets.map((o) => {
                              const gap = o.omzetKotor - o.posOmzet;
                              const promoGap = (o.posPromo ?? 0) - o.promo;
                              const isPromoMatch = Math.abs(promoGap) < 1000;

                              return (
                                <tr key={o.outletId} className="hover:bg-gray-50 transition-colors">
                                  <td className="p-3 font-semibold text-gray-800">{o.outletName}</td>
                                  <td className="p-3 text-right font-medium">{rp(o.omzetKotor)}</td>
                                  <td className="p-3 text-right text-gray-600">{rp(o.posOmzet)}</td>
                                  <td
                                    className={`p-3 text-right font-semibold ${
                                      Math.abs(gap) > 100000 ? 'text-orange-600' : 'text-gray-500'
                                    }`}
                                  >
                                    {gap >= 0 ? '+' : ''}
                                    {rp(gap)}
                                  </td>
                                  <td className="p-3 text-right text-amber-700 bg-amber-50/40 font-medium">
                                    -{rp(o.promo)}
                                  </td>
                                  <td className="p-3 text-right text-gray-600">-{rp(o.posPromo)}</td>

                                  {/* Kolom Pembanding Diskon / Subsidi Dinamis */}
                                  <td className="p-3 text-right bg-gray-50/40">
                                    {activePlatformTab === 'gofood' ? (
                                      o.subsidiPlatform > 0 ? (
                                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                                          +{rp(o.subsidiPlatform)}
                                        </span>
                                      ) : isPromoMatch ? (
                                        <span className="text-gray-400 font-medium">Match</span>
                                      ) : (
                                        <span
                                          className={
                                            Math.abs(promoGap) > 50000
                                              ? 'text-amber-700 font-semibold'
                                              : 'text-gray-600 font-medium'
                                          }
                                        >
                                          {promoGap >= 0 ? '+' : ''}
                                          {rp(promoGap)}
                                        </span>
                                      )
                                    ) : activePlatformTab === 'tiktokgo' ? (
                                      o.subsidiPlatform > 0 ? (
                                        <span className="text-gray-800 font-semibold bg-gray-100 px-2 py-0.5 rounded-full">
                                          +{rp(o.subsidiPlatform)}
                                        </span>
                                      ) : isPromoMatch ? (
                                        <span className="text-gray-400 font-medium">Match</span>
                                      ) : (
                                        <span
                                          className={
                                            Math.abs(promoGap) > 50000
                                              ? 'text-amber-700 font-semibold'
                                              : 'text-gray-600 font-medium'
                                          }
                                        >
                                          {promoGap >= 0 ? '+' : ''}
                                          {rp(promoGap)}
                                        </span>
                                      )
                                    ) : activePlatformTab === 'all' ? (
                                      o.subsidiPlatform > 0 ? (
                                        <span
                                          className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full"
                                          title="Subsidi Gojek"
                                        >
                                          +{rp(o.subsidiPlatform)}
                                        </span>
                                      ) : isPromoMatch ? (
                                        <span className="text-gray-400 font-medium">Match</span>
                                      ) : (
                                        <span
                                          className={
                                            Math.abs(promoGap) > 50000
                                              ? 'text-amber-700 font-semibold'
                                              : 'text-gray-600 font-medium'
                                          }
                                        >
                                          {promoGap >= 0 ? '+' : ''}
                                          {rp(promoGap)}
                                        </span>
                                      )
                                    ) : isPromoMatch ? (
                                      <span className="text-gray-400 font-medium">Match</span>
                                    ) : (
                                      <span
                                        className={
                                          Math.abs(promoGap) > 50000
                                            ? 'text-amber-700 font-semibold'
                                            : 'text-gray-600 font-medium'
                                        }
                                      >
                                        {promoGap >= 0 ? '+' : ''}
                                        {rp(promoGap)}
                                      </span>
                                    )}
                                  </td>

                                  <td className="p-3 text-right text-red-700 bg-red-50/40 font-medium">
                                    -{rp(o.adminFee)}
                                  </td>
                                  <td className="p-3 text-right text-green-800 bg-green-50/50 font-bold">
                                    {rp(o.nettoCair)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Bottom Sync Bar */}
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
                <div className="text-xs text-gray-500">
                  Total siap disimpan: <b>{s.allDaily.reduce((sum, d) => sum + d.daily.length, 0)} baris rekap</b> dari{' '}
                  <b>{s.perPlatform.length} platform</b>
                </div>
                <button
                  onClick={handleSync}
                  disabled={loading}
                  className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-green-700 disabled:opacity-50 transition-all flex items-center gap-2 active:scale-95"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {loading ? 'Menyimpan...' : `Simpan & Sinkronkan ke Database`}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── TAB 2: RIWAYAT SETTLEMENT DI DATABASE ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-lg text-gray-800">Riwayat Settlement Tersimpan di Database</h2>
              <p className="text-xs text-gray-500">
                Data pada tabel <code>platform_settlements</code> yang aktif digunakan sebagai Single Source of Truth
                laporan POS.
              </p>
            </div>
            <button
              onClick={refreshStatus}
              disabled={statusLoading}
              className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
              Segarkan Data
            </button>
          </div>

          {uploadStatus && uploadStatus.recentSettlements.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                    <th className="p-3 border-b">Platform</th>
                    <th className="p-3 border-b">Tanggal</th>
                    <th className="p-3 border-b">Outlet</th>
                    <th className="p-3 border-b text-right">Omzet Kotor</th>
                    <th className="p-3 border-b text-right bg-amber-50">Diskon Toko</th>
                    <th className="p-3 border-b text-right bg-red-50">Komisi</th>
                    <th className="p-3 border-b text-right">Trx</th>
                    <th className="p-3 border-b">File Sumber</th>
                    <th className="p-3 border-b">Diimport Pada</th>
                    <th className="p-3 border-b text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {uploadStatus.recentSettlements.map((r) => {
                    const isGofood = r.platform === 'gofood';
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              isGofood
                                ? 'bg-red-100 text-red-700'
                                : r.platform === 'grabfood'
                                ? 'bg-green-100 text-green-700'
                                : r.platform === 'shopeefood'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {r.platform}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-gray-800">{formatDateIndo(r.tanggal)}</td>
                        <td className="p-3 font-medium text-gray-800">{r.outlet_name}</td>
                        <td className="p-3 text-right font-medium">{rp(r.omzet_kotor)}</td>
                        <td className="p-3 text-right text-amber-700 bg-amber-50/30">-{rp(r.promo_merchant)}</td>
                        <td className="p-3 text-right text-red-700 bg-red-50/30 font-medium">-{rp(r.commission)}</td>
                        <td className="p-3 text-right font-medium">{r.trx_count}</td>
                        <td className="p-3 text-gray-500 truncate max-w-[140px]" title={r.source_file}>
                          {r.source_file}
                        </td>
                        <td className="p-3 text-gray-400 text-[11px] whitespace-nowrap">
                          {r.imported_at ? new Date(r.imported_at).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() =>
                              handleDeleteSettlement(r.platform, r.tanggal, r.outlet_id, r.outlet_name)
                            }
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus data settlement ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600 font-semibold text-sm">Belum Ada Data Settlement di Database</p>
              <p className="text-xs text-gray-400 mt-1">
                Silakan beralih ke tab &quot;Upload Settlement&quot; untuk mengunggah laporan settlement GoBiz, Grab, atau
                Shopee.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
