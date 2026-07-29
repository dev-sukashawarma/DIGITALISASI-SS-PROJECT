"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@suka/auth";
import { 
  CalendarDays, Clock, CheckCircle2, XCircle, Plus, Info, 
  UploadCloud, FileImage, X, Activity, CheckSquare, Calendar, 
  ChevronRight, AlertCircle
} from "lucide-react";
import { useLeaveHistory, useLeaveBalance, useSubmitLeave, LeaveType } from "./api";
import { useLeaveNotifications } from "./useLeaveNotifications";
import dayjs from "dayjs";
import { useToast } from "@/lib/feedback/toast";
import { Select } from "@/components/Select";

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
  const toast = useToast();
  const { markAsRead } = useLeaveNotifications();

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [type, setType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const availableQuota = balance ? (balance.total_quota - balance.used_quota) : 12; // fallback to 12 if no record yet

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) {
      toast.show("err", "Mohon lengkapi semua form");
      return;
    }
    if (type === 'sick' && !file) {
      toast.show("err", "Mohon lampirkan surat dokter");
      return;
    }
    if (dayjs(endDate).isBefore(dayjs(startDate))) {
      toast.show("err", "Tanggal selesai tidak boleh sebelum tanggal mulai");
      return;
    }

    const numDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;

    try {
      await submitLeave.mutateAsync({
        staff_id: userId,
        leave_type: type,
        start_date: startDate,
        end_date: endDate,
        days: numDays,
        reason,
        status_spv: outletStaff?.role === 'staff_pusat' ? 'not_required' : 'pending',
        status: 'pending',
        file: type === 'sick' ? file : null,
      });
      toast.show("ok", "Pengajuan cuti berhasil dikirim");
      setShowForm(false);
      // Reset form
      setStartDate('');
      setEndDate('');
      setReason('');
      setType('annual');
      setFile(null);
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
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-suka-orange to-orange-500 hover:from-orange-600 hover:to-orange-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5"
          >
            <Plus size={20} strokeWidth={2.5} />
            Ajukan Cuti
          </button>
        )}
      </div>

      {/* Quota Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-slate-50 rounded-full transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
              <Calendar className="text-slate-600" size={20} strokeWidth={2.5}/>
            </div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Total Kuota Tahunan</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-4xl font-extrabold text-slate-800">{balance?.total_quota ?? 12}</p>
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
            <p className="text-sm font-semibold text-slate-500 mb-1">Cuti Terpakai</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-4xl font-extrabold text-slate-800">{balance?.used_quota ?? 0}</p>
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
              <p className="text-5xl font-black">{availableQuota}</p>
              <span className="text-base font-semibold text-blue-200">hari</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {showForm ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="px-5 sm:px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Form Pengajuan Cuti</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Isi detail permohonan cuti atau izin Anda di bawah ini</p>
            </div>
            <button 
              onClick={() => setShowForm(false)} 
              className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-8">
            <div className="space-y-6 max-w-3xl">
              
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Jenis Cuti / Izin <span className="text-rose-500">*</span></label>
                <Select
                  value={type}
                  onChange={val => setType(val as LeaveType)}
                  options={[
                    { label: "Cuti Tahunan", value: "annual" },
                    { label: "Sakit (dengan Surat Dokter)", value: "sick" },
                    { label: "Izin Tidak Dibayar (Unpaid Leave)", value: "unpaid" },
                    { label: "Cuti Melahirkan", value: "maternity" },
                    { label: "Izin Lainnya", value: "other" }
                  ]}
                  className="w-full"
                />
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
                        required
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Tanggal Mulai <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Tanggal Selesai <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
              
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

            <div className="pt-6 mt-8 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-2xl transition-all shadow-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitLeave.isPending}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                {submitLeave.isPending ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </form>
        </div>
      ) : (
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
                        {dayjs(item.start_date).format('DD MMM YYYY')} 
                        <ChevronRight size={14} className="text-slate-400" /> 
                        {dayjs(item.end_date).format('DD MMM YYYY')}
                        <span className="ml-1 text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded-md shadow-sm">
                          {dayjs(item.end_date).diff(dayjs(item.start_date), 'day') + 1} Hari
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
      )}
    </div>
  );
}
