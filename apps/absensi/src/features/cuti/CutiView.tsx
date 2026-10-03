"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@suka/auth";
import {
  CalendarDays, Clock, CheckCircle2, XCircle, Plus, Info,
  UploadCloud, FileImage, X, Activity, CheckSquare, Hourglass,
  ChevronRight, AlertCircle, Minus, AlertTriangle
} from "lucide-react";
import { useLeaveHistory, useLeaveBalance, useSubmitLeave, useBatalkanCuti, LeaveType } from "./api";
import { TombolBatalkan } from "@/components/TombolBatalkan";
import { useLeaveNotifications } from "./useLeaveNotifications";
import { useToast } from "@/lib/feedback/toast";
import { BottomSheet } from "@/components/BottomSheet";
import {
  hitungRentang, pengajuanBentrok, cutiTerpakaiTahun, hariMenunggu, hariIniLokal, tambahHari, maksHari,
  formatHariTgl, formatHariTglTahun, formatNamaHari, formatBulan, tanggalKe, type RentangCuti,
} from "./rentangCuti";

const convertToWebP = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const newFile = new File([blob], newName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(newFile);
          } else {
            resolve(file);
          }
        }, 'image/webp', 0.8);
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export function CutiView() {
  const { outletStaff } = useAuth();
  const userId = outletStaff?.id;
  const currentYear = new Date().getFullYear();

  const { data: balance } = useLeaveBalance(userId, currentYear);
  const { data: history, isLoading: loadingHistory } = useLeaveHistory(userId);
  const submitLeave = useSubmitLeave();
  const batalkan = useBatalkanCuti(userId);
  const toast = useToast();
  const { markAsRead } = useLeaveNotifications();

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [type, setType] = useState<LeaveType>('annual');
  // null = belum disentuh: ikut jenis cuti (sakit biasanya mulai hari ini, cuti terencana
  // mulai besok). Begitu dipilih manual, pilihan user tidak ditimpa lagi.
  const [mulaiPilihan, setMulaiPilihan] = useState<string | null>(null);
  const [hari, setHari] = useState(1);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const hariIni = useMemo(() => hariIniLokal(), [showForm]);
  const mulai = mulaiPilihan ?? (type === 'sick' ? hariIni : tambahHari(hariIni, 1));
  const maks = maksHari(type);
  const jumlahHari = Math.min(hari, maks);
  // Pratinjau, cek bentrok, dan ringkasan kuota dihitung dari data yang sudah ada di
  // layar — nol query tambahan setiap kali user mengubah tanggal atau jumlah hari.
  const rentang = useMemo(() => hitungRentang(mulai, jumlahHari), [mulai, jumlahHari]);
  const bentrok = useMemo(() => pengajuanBentrok(rentang, history ?? []), [rentang, history]);
  const terpakai = useMemo(() => cutiTerpakaiTahun(history ?? [], currentYear), [history, currentYear]);
  const menunggu = useMemo(() => hariMenunggu(history ?? []), [history]);

  const resetForm = () => {
    setMulaiPilihan(null);
    setHari(1);
    setReason('');
    setType('annual');
    setFile(null);
  };

  const handleBatalkan = async (id: string) => {
    // Galat dilempar ulang: TombolBatalkan menampilkannya di dalam lembar konfirmasi.
    // Toast tetap muncul untuk kasus HR baru saja memutuskan — kartu (dan lembarnya)
    // langsung hilang karena status berubah, jadi pesannya harus tetap terbaca.
    try {
      await batalkan.mutateAsync(id);
      toast.show("ok", "Pengajuan cuti dibatalkan");
    } catch (err) {
      toast.show("err", (err as any)?.message || "Gagal membatalkan cuti");
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.show("err", "Mohon isi alasan pengajuan");
      return;
    }
    if (type === 'sick' && !file) {
      toast.show("err", "Mohon lampirkan surat dokter");
      return;
    }
    if (bentrok) {
      toast.show("err", "Tanggalnya bertabrakan dengan pengajuan lain");
      return;
    }

    try {
      await submitLeave.mutateAsync({
        staff_id: userId,
        leave_type: type,
        start_date: rentang.mulai,
        end_date: rentang.selesai,
        days: rentang.hari,
        reason,
        status_spv: outletStaff?.role === 'staff_pusat' ? 'not_required' : 'pending',
        status: 'pending',
        file: type === 'sick' ? file : null,
      });
      toast.show("ok", "Pengajuan cuti berhasil dikirim");
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error("Submit Leave Error:", JSON.stringify(err));
      const errorMessage = (err as any)?.message || (err as any)?.details || "Unknown error";
      toast.show("err", `Terjadi kesalahan saat mengajukan cuti: ${errorMessage}`);
    }
  };

  const getStatusBadge = (spv: string, hr: string) => {
    if (hr === 'approved') {
      return (
        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm border border-emerald-100/50">
          <CheckCircle2 size={14} className="text-emerald-500"/> Disetujui
        </span>
      );
    }
    if (hr === 'rejected' || spv === 'rejected') {
      return (
        <span className="px-3 py-1.5 bg-rose-50 text-rose-600 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm border border-rose-100/50">
          <XCircle size={14} className="text-rose-500"/> Ditolak
        </span>
      );
    }
    return (
      <span className="px-3 py-1.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm border border-amber-100/50">
        <Clock size={14} className="text-amber-500"/> Menunggu Persetujuan
      </span>
    );
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'annual': return 'Cuti Tahunan';
      case 'sick': return 'Sakit';
      case 'unpaid': return 'Unpaid Leave';
      case 'maternity': return 'Cuti Melahirkan';
      default: return 'Izin Lainnya';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-5xl mx-auto">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <CalendarDays size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Cuti & Izin</h1>
              <p className="text-slate-500 font-medium mt-1">Kelola permohonan cuti dan riwayat izin Anda</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-suka-orange to-orange-500 hover:from-orange-600 hover:to-orange-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5"
        >
          <Plus size={20} strokeWidth={2.5} />
          Ajukan Cuti
        </button>
      </div>

      {/* Quota Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-slate-50 rounded-full transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
              <Hourglass className="text-amber-600" size={20} strokeWidth={2.5}/>
            </div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Menunggu Persetujuan</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-4xl font-extrabold text-slate-800">{menunggu}</p>
              <span className="text-sm font-semibold text-slate-400">hari</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-50/50 rounded-full transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mb-4">
              <Activity className="text-rose-600" size={20} strokeWidth={2.5}/>
            </div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Terpakai {currentYear}</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-4xl font-extrabold text-slate-800">{terpakai}</p>
              <span className="text-sm font-semibold text-slate-400">hari</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 rounded-3xl shadow-xl shadow-blue-500/20 relative overflow-hidden group text-white">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl transition-transform group-hover:scale-150" />
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/50 rounded-tl-full blur-xl" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4 backdrop-blur-sm border border-white/10">
              <CheckSquare className="text-white" size={20} strokeWidth={2.5}/>
            </div>
            <p className="text-sm font-medium text-blue-100 mb-1">Sisa Kuota Tersedia</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-5xl font-black">{balance?.sisa_quota ?? "–"}</p>
              <span className="text-base font-semibold text-blue-200">hari</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <BottomSheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Ajukan Cuti"
        footer={
          <div className="space-y-2">
            {type === 'sick' && !file && (
              <p className="text-xs font-medium text-slate-500 text-center">Lampirkan surat dokter untuk mengajukan sakit.</p>
            )}
            <button
              type="submit"
              form="form-pengajuan-cuti"
              disabled={submitLeave.isPending || !!bentrok}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[15px] font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25"
            >
              {submitLeave.isPending ? "Mengirim..." : "Ajukan"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="w-full h-11 text-[15px] font-bold text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors"
            >
              Batal
            </button>
          </div>
        }
      >
          <form id="form-pengajuan-cuti" onSubmit={handleSubmit} className="pt-1">
            <div className="space-y-6">

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Jenis Cuti / Izin <span className="text-rose-500">*</span></label>
                <PilihJenis value={type} onPilih={setType} />
              </div>

              {type === 'sick' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-bold text-slate-700">Bukti / Surat Sakit <span className="text-rose-500">*</span></label>
                  {!file ? (
                    <label className="flex flex-col items-center justify-center w-full h-40 px-4 transition-all bg-slate-50/50 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                        <div className="p-4 mb-4 bg-white shadow-sm rounded-full group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                          <UploadCloud className="w-8 h-8 text-blue-500" strokeWidth={2} />
                        </div>
                        <p className="mb-1 text-sm text-slate-500"><span className="font-bold text-blue-600">Klik untuk upload</span> atau drag and drop</p>
                        <p className="text-xs font-medium text-slate-400 mt-1">Mendukung format PNG, JPG, PDF (Max. 5MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const selectedFile = e.target.files?.[0];
                          if (selectedFile) {
                            const webpFile = await convertToWebP(selectedFile);
                            setFile(webpFile);
                          } else {
                            setFile(null);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between w-full p-4 sm:p-5 bg-blue-50/50 border border-blue-100 rounded-2xl animate-in zoom-in-95 duration-200">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-white shadow-sm rounded-xl border border-blue-50">
                          <FileImage className="w-7 h-7 text-blue-600" strokeWidth={2} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 truncate max-w-[200px] sm:max-w-[400px]">
                            {file.name}
                          </span>
                          <span className="text-xs text-slate-500 mt-1 font-semibold">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 bg-white shadow-sm border border-slate-100 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-all duration-200"
                        title="Hapus file"
                      >
                        <X size={18} strokeWidth={2.5}/>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Mulai</label>
                <PilihMulai hariIni={hariIni} mulai={mulai} onPilih={setMulaiPilihan} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Berapa hari?</label>
                <PengaturHari hari={jumlahHari} maks={maks} onUbah={setHari} />
              </div>

              <PratinjauRentang
                rentang={rentang}
                tahunIni={currentYear}
                sisaKuota={balance?.sisa_quota ?? null}
                bentrok={bentrok}
              />
              
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Alasan / Keterangan <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all resize-none"
                  placeholder="Tuliskan alasan lengkap mengenai permohonan cuti/izin Anda..."
                />
              </div>
            </div>
          </form>
      </BottomSheet>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="px-5 sm:px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Riwayat Pengajuan</h3>
            {history && history.length > 0 && (
              <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                {history.length} Data
              </span>
            )}
          </div>
          
          {loadingHistory ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-semibold text-sm animate-pulse">Memuat riwayat...</p>
              </div>
            </div>
          ) : history && history.length > 0 ? (
            <div className="divide-y divide-slate-50 flex-1">
              {history.map((item) => (
                <div key={item.id} className="p-5 sm:px-8 sm:py-6 hover:bg-slate-50/50 transition-colors group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="font-extrabold text-slate-800 text-lg">
                          {getTypeLabel(item.leave_type)}
                        </span>
                        {getStatusBadge(item.status_spv, item.status)}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500 mb-4 bg-slate-100 w-fit px-3 py-1.5 rounded-xl">
                        <CalendarDays size={16} className="text-slate-400"/>
                        {formatHariTglTahun(item.start_date)}
                        {item.end_date !== item.start_date && (
                          <>
                            <ChevronRight size={14} className="text-slate-400" />
                            {formatHariTglTahun(item.end_date)}
                          </>
                        )}
                        <span className="ml-1 text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded-md shadow-sm">
                          {item.days} Hari
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">"{item.reason}"</p>
                      </div>

                      {(item.status === 'rejected' || item.status_spv === 'rejected') && item.rejection_note && (
                        <div className="mt-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 shadow-sm">
                          <AlertCircle className="text-rose-500 mt-0.5 flex-shrink-0" size={18} />
                          <div>
                            <p className="text-xs font-extrabold text-rose-800 mb-1 uppercase tracking-wider">Alasan Penolakan</p>
                            <p className="text-sm font-semibold text-rose-700">{item.rejection_note}</p>
                          </div>
                        </div>
                      )}

                      {item.status === 'pending' && item.status_spv !== 'rejected' && (
                        <TombolBatalkan
                          jenis="cuti"
                          judul={`${getTypeLabel(item.leave_type)} · ${item.days} hari`}
                          detail={item.end_date !== item.start_date
                            ? `${formatHariTglTahun(item.start_date)} – ${formatHariTglTahun(item.end_date)}`
                            : formatHariTglTahun(item.start_date)}
                          onConfirm={() => handleBatalkan(item.id)}
                        />
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50/30">
              <div className="w-24 h-24 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-6">
                <Info className="text-slate-300" size={40} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Belum Ada Pengajuan</h3>
              <p className="text-slate-500 font-medium text-center max-w-md">
                Anda belum pernah mengajukan cuti atau izin. Semua riwayat pengajuan akan tercatat dan ditampilkan di sini.
              </p>
              <button 
                onClick={() => setShowForm(true)}
                className="mt-8 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                Ajukan Cuti Sekarang
              </button>
            </div>
          )}
        </div>
    </div>
  );
}

const JENIS_CUTI: { label: string; value: LeaveType }[] = [
  { label: "Cuti Tahunan", value: "annual" },
  { label: "Sakit", value: "sick" },
  { label: "Tidak Dibayar", value: "unpaid" },
  { label: "Melahirkan", value: "maternity" },
  { label: "Izin Lainnya", value: "other" },
];

/** Pilihan jenis sekali ketuk, gaya segmen seperti di app native. */
function PilihJenis({ value, onPilih }: { value: LeaveType; onPilih: (v: LeaveType) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl" role="radiogroup" aria-label="Jenis cuti">
      {JENIS_CUTI.map((j) => {
        const aktif = value === j.value;
        return (
          <button
            key={j.value}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => onPilih(j.value)}
            className={`min-w-0 px-2 py-2.5 rounded-xl text-sm font-bold truncate transition-all ${
              aktif ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-100" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {j.label}
          </button>
        );
      })}
    </div>
  );
}

/** Hari ini / Besok / Lusa sekali ketuk; opsi keempat membuka kalender bawaan browser
 *  dan menampilkan tanggal pilihan bila bukan salah satu dari tiga itu. */
function PilihMulai({ hariIni, mulai, onPilih }: { hariIni: string; mulai: string; onPilih: (iso: string) => void }) {
  const kalender = useRef<HTMLInputElement>(null);
  const cepat = [
    { label: "Hari ini", tgl: hariIni },
    { label: "Besok", tgl: tambahHari(hariIni, 1) },
    { label: "Lusa", tgl: tambahHari(hariIni, 2) },
  ];
  const lainnya = !cepat.some((c) => c.tgl === mulai);
  const kelas = (aktif: boolean) =>
    `flex-1 min-w-0 px-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
      aktif ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-100" : "text-slate-500 hover:text-slate-800"
    }`;

  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl" role="radiogroup" aria-label="Tanggal mulai">
      {cepat.map((c) => (
        <button key={c.label} type="button" role="radio" aria-checked={mulai === c.tgl} onClick={() => onPilih(c.tgl)} className={kelas(mulai === c.tgl)}>
          {c.label}
        </button>
      ))}
      <div className="relative flex-[1.2] min-w-0 flex">
        <button
          type="button"
          role="radio"
          aria-checked={lainnya}
          onClick={() => {
            const el = kalender.current;
            if (!el) return;
            // showPicker belum ada di browser lama — fokus membuka picker di sebagian besar ponsel.
            try { el.showPicker(); } catch { el.focus(); }
          }}
          className={`${kelas(lainnya)} flex items-center justify-center gap-1.5`}
        >
          <CalendarDays size={15} className="shrink-0" />
          <span className="truncate">{lainnya ? formatHariTgl(mulai) : "Lainnya"}</span>
        </button>
        <input
          ref={kalender}
          type="date"
          value={mulai}
          onChange={(e) => e.target.value && onPilih(e.target.value)}
          tabIndex={-1}
          aria-hidden
          className="absolute inset-0 w-full opacity-0 pointer-events-none"
        />
      </div>
    </div>
  );
}

const PINTASAN_HARI = [1, 2, 3, 5, 7];

/** Stepper −/+ untuk penyesuaian halus, plus pintasan jumlah hari yang paling sering. */
function PengaturHari({ hari, maks, onUbah }: { hari: number; maks: number; onUbah: (n: number) => void }) {
  const tombol =
    "w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-blue-600 transition-all hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
        <button type="button" className={tombol} onClick={() => onUbah(Math.max(1, hari - 1))} disabled={hari <= 1} aria-label="Kurangi hari">
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <div className="flex-1 flex items-baseline justify-center gap-1.5" aria-live="polite">
          <span key={hari} className="text-3xl font-extrabold text-slate-900 tabular-nums animate-in fade-in zoom-in-90 duration-150">
            {hari}
          </span>
          <span className="text-sm font-semibold text-slate-400">hari</span>
        </div>
        <button type="button" className={tombol} onClick={() => onUbah(Math.min(maks, hari + 1))} disabled={hari >= maks} aria-label="Tambah hari">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {PINTASAN_HARI.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onUbah(n)}
            className={`py-2 rounded-xl text-xs font-bold border transition-all ${
              hari === n ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
            }`}
          >
            {n} hari
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pratinjau yang ikut berubah seketika: rentang tanggal, tanggal masuk kembali, deretan
 *  hari yang dipakai, dampaknya ke sisa kuota, dan peringatan bila bertabrakan. */
function PratinjauRentang({
  rentang,
  tahunIni,
  sisaKuota,
  bentrok,
}: {
  rentang: RentangCuti;
  tahunIni: number;
  sisaKuota: number | null;
  bentrok: { leave_type: string; start_date: string; end_date: string } | null;
}) {
  const bahaya = !!bentrok;
  const fmtSelesai = rentang.selesai.startsWith(`${tahunIni}-`) ? formatHariTgl : formatHariTglTahun;
  const sisaSetelah = sisaKuota === null ? null : sisaKuota - rentang.hari;

  return (
    <div className={`rounded-2xl p-4 sm:p-5 border transition-colors ${bahaya ? "bg-rose-50/60 border-rose-100" : "bg-blue-50/50 border-blue-100"}`}>
      <p className="text-base sm:text-lg font-extrabold text-slate-900">
        {rentang.hari === 1
          ? formatHariTglTahun(rentang.mulai)
          : `${formatHariTgl(rentang.mulai)}  –  ${fmtSelesai(rentang.selesai)}`}
      </p>
      <p className="text-sm font-medium text-slate-500 mt-0.5">Masuk kembali {formatHariTgl(rentang.masukKembali)}</p>

      <div className="flex gap-1.5 overflow-x-auto mt-4 pb-1 -mx-1 px-1">
        {rentang.tanggal.map((tgl) => (
          <div key={tgl} className="shrink-0 w-12 py-1.5 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col items-center animate-in fade-in duration-200">
            <span className="text-[11px] font-semibold text-slate-400">{formatNamaHari(tgl)}</span>
            <span className={`text-base font-extrabold ${bahaya ? "text-rose-600" : "text-blue-700"}`}>{tanggalKe(tgl)}</span>
            <span className="text-[11px] font-semibold text-slate-400">{formatBulan(tgl)}</span>
          </div>
        ))}
      </div>

      {sisaSetelah !== null && (
        <p className={`text-sm font-semibold mt-3 ${sisaSetelah >= 0 ? "text-slate-500" : "text-amber-700"}`}>
          {sisaSetelah >= 0
            ? `Sisa kuota ${sisaKuota} hari → ${sisaSetelah} hari bila disetujui`
            : `Melebihi sisa kuota (${sisaKuota} hari) — keputusan ada di HR.`}
        </p>
      )}

      {bentrok && (
        <div className="mt-3 flex items-start gap-2 text-sm font-semibold text-rose-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Bertabrakan dengan pengajuan {formatHariTglTahun(bentrok.start_date)} – {formatHariTglTahun(bentrok.end_date)}.
            Geser tanggal mulai atau kurangi hari.
          </span>
        </div>
      )}
    </div>
  );
}
