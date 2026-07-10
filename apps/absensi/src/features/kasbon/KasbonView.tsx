"use client";

import React, { useState } from "react";
import { useAuth } from "@suka/auth";
import { Banknote, Clock, CheckCircle2, XCircle, Plus, Info } from "lucide-react";
import { useKasbonHistory, useSubmitKasbon } from "./api";
import dayjs from "dayjs";
import { useToast } from "@/lib/feedback/toast";
import { Select } from "@/components/Select";
import { useRealtimeInvalidate } from "@/lib/realtime/useRealtimeInvalidate";

export function KasbonView() {
  const { outletStaff } = useAuth();
  const userId = outletStaff?.id;

  useRealtimeInvalidate({
    channelName: `absensi-kasbon-${userId ?? "none"}`,
    enabled: !!userId,
    subs: [
      { table: "cash_advances", filter: `staff_id=eq.${userId}`, queryKeys: [["kasbon", userId]] },
      { table: "cash_advance_installments", queryKeys: [["kasbon", userId]] },
    ],
  });

  const { data: history, isLoading: loadingHistory } = useKasbonHistory(userId);
  const submitKasbon = useSubmitKasbon();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [installmentMonths, setInstallmentMonths] = useState('1');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !installmentMonths || !reason) {
      toast.show("err", "Mohon lengkapi semua form");
      return;
    }
    
    const numAmount = parseInt(amount.replace(/\D/g, ''));
    const numMonths = parseInt(installmentMonths);

    if (numAmount <= 0) {
      toast.show("err", "Nominal kasbon harus lebih dari 0");
      return;
    }

    try {
      await submitKasbon.mutateAsync({
        staff_id: userId,
        amount: numAmount,
        installment_months: numMonths,
        reason,
        status_spv: outletStaff?.role === 'staff_pusat' ? 'not_required' : 'pending',
        status: 'pending',
      });
      toast.show("ok", "Pengajuan kasbon berhasil dikirim");
      setShowForm(false);
      // Reset form
      setAmount('');
      setInstallmentMonths('1');
      setReason('');
    } catch (err) {
      console.error("Submit Kasbon Error:", JSON.stringify(err));
      const errorMessage = (err as any)?.message || (err as any)?.details || "Unknown error";
      toast.show("err", `Terjadi kesalahan saat mengajukan kasbon: ${errorMessage}`);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val) {
      setAmount(formatRupiah(parseInt(val)).replace('Rp', '').trim());
    } else {
      setAmount('');
    }
  };

  const getStatusBadge = (spv: string, hr: string) => {
    if (hr === 'approved' && (spv === 'approved' || spv === 'not_required')) {
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
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Banknote className="text-emerald-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kasbon</h1>
            <p className="text-sm text-slate-500 mt-1">Ajukan dan pantau pinjaman kasbon Anda.</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-suka-orange hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={18} />
            Ajukan Kasbon
          </button>
        )}
      </div>

      {/* Form or List */}
      {showForm ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Form Pengajuan Kasbon</h3>
            <button onClick={() => setShowForm(false)} className="text-sm font-medium text-gray-500 hover:text-slate-800">Batal</button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nominal (Rp)</label>
                <input
                  type="text"
                  required
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Contoh: 500.000"
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Skema Cicilan (Bulan)</label>
                <Select
                  value={installmentMonths}
                  onChange={val => setInstallmentMonths(val)}
                  options={[
                    { label: "1 Bulan (Potong full gaji bulan depan)", value: "1" },
                    { label: "2 Bulan", value: "2" },
                    { label: "3 Bulan", value: "3" },
                    { label: "4 Bulan", value: "4" },
                    { label: "5 Bulan", value: "5" },
                    { label: "6 Bulan", value: "6" }
                  ]}
                  className="w-full"
                />
                {amount && (
                  <p className="mt-2 text-xs text-slate-500">
                    Estimasi cicilan: <span className="font-semibold">{formatRupiah(parseInt(amount.replace(/\D/g, '')) / parseInt(installmentMonths))} / bulan</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alasan Pengajuan</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="Jelaskan secara singkat tujuan kasbon..."
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
                disabled={submitKasbon.isPending}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                {submitKasbon.isPending ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-200 bg-gray-50">
            <h3 className="font-bold text-slate-800">Riwayat Pengajuan Kasbon</h3>
          </div>
          {loadingHistory ? (
            <div className="p-8 text-center text-gray-500">Memuat data...</div>
          ) : history && history.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {history.map((item) => (
                <div key={item.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(item.amount)}
                      </span>
                      {getStatusBadge(item.status_spv, item.status)}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{item.reason}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                      <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md">
                        Dicicil {item.installment_months} Bulan
                      </span>
                      <span>Diajukan: {dayjs(item.created_at).format('DD MMM YYYY')}</span>
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
              <p className="text-sm text-gray-400 mt-1">Pengajuan kasbon Anda akan tampil di sini.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
