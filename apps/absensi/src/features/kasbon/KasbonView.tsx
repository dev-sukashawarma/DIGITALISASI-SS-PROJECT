"use client";

import React, { useState } from "react";
import { useAuth } from "@suka/auth";
import { Banknote, Clock, CheckCircle2, XCircle, Plus, Info } from "lucide-react";
import { useKasbonHistory, useSubmitKasbon, useBatalkanKasbon } from "./api";
import { TombolBatalkan } from "@/components/TombolBatalkan";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useToast } from "@/lib/feedback/toast";
import { Select } from "@/components/Select";
import { useRealtimeInvalidate } from "@suka/realtime";
import { CurrencyInput } from "@suka/design-system";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Garis warna di sisi kiri kartu riwayat — status terbaca sekilas tanpa membaca lencana. */
const aksenStatus = (spv: string, hr: string) =>
  hr === 'approved' ? 'border-l-emerald-500'
  : hr === 'rejected' || spv === 'rejected' ? 'border-l-rose-500'
  : 'border-l-amber-400';

export function KasbonView() {
  const { outletStaff } = useAuth();
  const userId = outletStaff?.id;

  useRealtimeInvalidate({
    channelName: `absensi-kasbon-${userId ?? "none"}`,
    enabled: !!userId,
    subs: [
      { table: "cash_advances", filter: `staff_id=eq.${userId}`, queryKeys: [["kasbon", userId]] },
    ],
  });

  const { data: history, isLoading: loadingHistory } = useKasbonHistory(userId);
  const submitKasbon = useSubmitKasbon();
  const batalkan = useBatalkanKasbon(userId);
  const toast = useToast();

  const handleBatalkan = async (id: string) => {
    // Galat dilempar ulang: TombolBatalkan menampilkannya di dalam lembar konfirmasi.
    // Toast tetap muncul untuk kasus HR baru saja memutuskan — kartu (dan lembarnya)
    // langsung hilang karena status berubah, jadi pesannya harus tetap terbaca.
    try {
      await batalkan.mutateAsync(id);
      toast.show("ok", "Pengajuan kasbon dibatalkan");
    } catch (err) {
      toast.show("err", (err as any)?.message || "Gagal membatalkan kasbon");
      throw err;
    }
  };

  const [showForm, setShowForm] = useState(false);
  
  // Form State — angka mentah (bukan teks berformat); '' = kolom kosong.
  const [amount, setAmount] = useState<number | ''>('');
  const [installmentMonths, setInstallmentMonths] = useState('1');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !installmentMonths || !reason) {
      toast.show("err", "Mohon lengkapi semua form");
      return;
    }
    
    const numAmount = amount;
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
                <label htmlFor="kasbon-nominal" className="block text-sm font-medium text-slate-700 mb-1">Nominal</label>
                {/* Tampil "Rp 500.000" saat diketik; state tetap angka, jadi yang dikirim tidak berubah. */}
                <CurrencyInput
                  id="kasbon-nominal"
                  required
                  value={amount}
                  onChange={(n) => setAmount(n > 0 ? n : '')}
                  placeholder="500.000"
                  className="py-2.5 bg-white border-gray-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                {amount !== '' && (
                  <p className="mt-2 text-xs text-slate-500">
                    Estimasi cicilan: <span className="font-semibold">{formatRupiah(amount / parseInt(installmentMonths))} / bulan</span>
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
            <div className="bg-slate-50/70 p-3 sm:p-5 space-y-4">
              {history.map((item) => (
                <article
                  key={item.id}
                  className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${aksenStatus(item.status_spv, item.status_hr)} shadow-sm p-4 sm:p-5`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 text-lg leading-tight">
                          {formatRupiah(item.amount)}
                        </p>
                        <p className="text-xs font-medium text-slate-400 mt-1">
                          Diajukan {dayjs(item.created_at).tz('Asia/Jakarta').format('DD MMM YYYY')}
                        </p>
                      </div>
                      <div className="shrink-0">{getStatusBadge(item.status_spv, item.status_hr)}</div>
                    </div>
                    <div className="mt-3">
                      <span className="inline-flex items-center bg-slate-100 text-slate-600 text-sm font-semibold px-3 py-1.5 rounded-xl">
                        Dicicil {item.installment_months} bulan
                      </span>
                    </div>
                    {item.reason && (
                      <div className="mt-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Alasan</p>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">{item.reason}</p>
                      </div>
                    )}
                    {item.status_hr === 'pending' && item.status_spv !== 'rejected' && (
                      <TombolBatalkan
                        jenis="kasbon"
                        judul={`Kasbon ${formatRupiah(item.amount)}`}
                        detail={`Dicicil ${item.installment_months} bulan · diajukan ${dayjs(item.created_at).tz('Asia/Jakarta').format('DD MMM YYYY')}`}
                        onConfirm={() => handleBatalkan(item.id)}
                      />
                    )}
                  </div>
                </article>
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
