"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@suka/auth";
import { CalendarDays, Clock, CheckCircle2, XCircle, Plus, Info } from "lucide-react";
import { useLeaveHistory, useLeaveBalance, useSubmitLeave, LeaveType } from "./api";
import { useLeaveNotifications } from "./useLeaveNotifications";
import dayjs from "dayjs";
import { useToast } from "@/lib/feedback/toast";

export function CutiView() {
  const { outletStaff } = useAuth();
  const userId = outletStaff?.id;
  const currentYear = new Date().getFullYear();

  const { data: balance, isLoading: loadingBalance } = useLeaveBalance(userId, currentYear);
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

  const availableQuota = balance ? (balance.total_quota - balance.used_quota) : 12; // fallback to 12 if no record yet

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) {
      toast.show("err", "Mohon lengkapi semua form");
      return;
    }
    if (dayjs(endDate).isBefore(dayjs(startDate))) {
      toast.show("err", "Tanggal selesai tidak boleh sebelum tanggal mulai");
      return;
    }

    const numDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;

    try {
      await submitLeave.mutateAsync({
        user_id: userId,
        type,
        start_date: startDate,
        end_date: endDate,
        days: numDays,
        reason,
        status_spv: outletStaff?.role === 'staff_pusat' ? 'not_required' : 'pending',
        status_hr: 'pending',
      });
      toast.show("ok", "Pengajuan cuti berhasil dikirim");
      setShowForm(false);
      // Reset form
      setStartDate('');
      setEndDate('');
      setReason('');
      setType('annual');
    } catch (err) {
      console.error("Submit Leave Error:", JSON.stringify(err));
      const errorMessage = err?.message || err?.details || "Unknown error";
      toast.show("err", `Terjadi kesalahan saat mengajukan cuti: ${errorMessage}`);
    }
  };

  const getStatusBadge = (spv: string, hr: string) => {
    if (hr === 'approved') {
      return <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1"><CheckCircle2 size={14}/> Disetujui</span>;
    }
    if (hr === 'rejected' || spv === 'rejected') {
      return <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1"><XCircle size={14}/> Ditolak</span>;
    }
    return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full flex items-center gap-1"><Clock size={14}/> Menunggu Persetujuan</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <CalendarDays className="text-blue-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cuti & Izin</h1>
            <p className="text-sm text-slate-500 mt-1">Kelola permohonan cuti Anda.</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-suka-orange hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={18} />
            Ajukan Cuti
          </button>
        )}
      </div>

      {/* Quota Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Total Kuota Tahunan</p>
          <p className="text-3xl font-bold text-slate-800">{balance?.total_quota ?? 12} <span className="text-base font-normal text-gray-400">hari</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Cuti Terpakai</p>
          <p className="text-3xl font-bold text-slate-800">{balance?.used_quota ?? 0} <span className="text-base font-normal text-gray-400">hari</span></p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-2xl border border-blue-200 shadow-sm">
          <p className="text-sm font-medium text-blue-700 mb-1">Sisa Kuota</p>
          <p className="text-3xl font-bold text-blue-900">{availableQuota} <span className="text-base font-normal text-blue-700/60">hari</span></p>
        </div>
      </div>

      {/* Form or List */}
      {showForm ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Form Pengajuan Cuti</h3>
            <button onClick={() => setShowForm(false)} className="text-sm font-medium text-gray-500 hover:text-slate-800">Batal</button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Cuti / Izin</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                >
                  <option value="annual">Cuti Tahunan</option>
                  <option value="sick">Sakit (dengan Surat Dokter)</option>
                  <option value="unpaid">Izin Tidak Dibayar (Unpaid Leave)</option>
                  <option value="maternity">Cuti Melahirkan</option>
                  <option value="other">Izin Lainnya</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alasan / Keterangan</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Jelaskan alasan cuti atau izin Anda secara singkat..."
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitLeave.isPending}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                {submitLeave.isPending ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-200 bg-gray-50">
            <h3 className="font-bold text-slate-800">Riwayat Pengajuan</h3>
          </div>
          {loadingHistory ? (
            <div className="p-8 text-center text-gray-500">Memuat data...</div>
          ) : history && history.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {history.map((item) => (
                <div key={item.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800 capitalize">
                        {item.type === 'annual' ? 'Cuti Tahunan' : item.type === 'sick' ? 'Sakit' : item.type === 'unpaid' ? 'Unpaid Leave' : item.type === 'maternity' ? 'Cuti Melahirkan' : 'Izin Lainnya'}
                      </span>
                      {getStatusBadge(item.status_spv, item.status_hr)}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{item.reason}</p>
                    {(item.status_hr === 'rejected' || item.status_spv === 'rejected') && item.rejection_note && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-xs font-semibold text-red-800 mb-1">Alasan Penolakan:</p>
                        <p className="text-sm text-red-700">{item.rejection_note}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                      <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md">
                        <CalendarDays size={14}/>
                        {dayjs(item.start_date).format('DD MMM YYYY')} - {dayjs(item.end_date).format('DD MMM YYYY')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                <Info className="text-gray-400" size={28} />
              </div>
              <p className="text-slate-600 font-medium">Belum ada riwayat pengajuan</p>
              <p className="text-sm text-gray-400 mt-1">Pengajuan cuti Anda akan tampil di sini.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
