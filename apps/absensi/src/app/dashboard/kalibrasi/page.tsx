"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@suka/auth";
import { createClient } from "@/lib/supabase";
import { Copy, MapPin, CheckCircle, RefreshCw, XCircle } from "lucide-react";

export default function KalibrasiDashboard() {
  const { outletStaff } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [activeData, setActiveData] = useState<any>(null);
  const [savedData, setSavedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchStatus = async () => {
    if (!outletStaff?.outlet_id) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/kalibrasi/status?outlet_id=${outletStaff.outlet_id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const json = await res.json();
      if (json.ok) {
        setActiveData(json.data);
        setSavedData(json.saved);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [outletStaff]);

  const generateLink = async () => {
    if (!outletStaff?.outlet_id) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/kalibrasi/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ outlet_id: outletStaff.outlet_id })
      });
      const json = await res.json();
      if (json.ok) {
        fetchStatus();
      } else {
        alert("Gagal membuat link: " + json.error);
      }
    } catch (e) {
      alert("Terjadi kesalahan.");
    } finally {
      setGenerating(false);
    }
  };

  const approveLocation = async () => {
    if (!activeData?.token) return;
    setApproving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/kalibrasi/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ token: activeData.token })
      });
      const json = await res.json();
      if (json.ok) {
        alert("✅ Lokasi outlet berhasil diperbarui secara permanen!");
        fetchStatus();
      } else {
        alert("Gagal menyetujui lokasi: " + json.error);
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menyetujui.");
    } finally {
      setApproving(false);
    }
  };

  const deleteSavedLocation = async () => {
    if (!outletStaff?.outlet_id) return;
    if (!confirm("Apakah Anda yakin ingin menghapus koordinat permanen outlet ini dari database?")) return;
    
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/kalibrasi/delete-saved`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ outlet_id: outletStaff.outlet_id })
      });
      const json = await res.json();
      if (json.ok) {
        alert("✅ Koordinat berhasil dihapus!");
        fetchStatus();
      } else {
        alert("Gagal menghapus koordinat: " + json.error);
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menghapus.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteLocation = async () => {
    if (!activeData?.token) return;
    if (!confirm("Apakah Anda yakin ingin membatalkan dan menghapus link ini?")) return;
    
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/kalibrasi/delete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ token: activeData.token })
      });
      const json = await res.json();
      if (json.ok) {
        setActiveData(null);
      } else {
        alert("Gagal menghapus link: " + json.error);
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menghapus.");
    } finally {
      setDeleting(false);
    }
  };

  const getPublicLink = (token: string) => {
    return `${window.location.origin}/kalibrasi/${token}`;
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Memuat status kalibrasi...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-ink">Kalibrasi Lokasi Outlet</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gunakan fitur ini untuk merekam koordinat GPS yang sangat presisi dengan meminta kru yang berada di outlet membuka link khusus.
        </p>
      </div>

      {!activeData ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
              <MapPin size={32} />
            </div>
            <h3 className="font-bold text-lg text-suka-ink">Belum Ada Link Aktif</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Buat link kalibrasi publik untuk outlet Anda. Link ini berlaku 24 jam dan hanya bisa digunakan sekali untuk merekam lokasi.
            </p>
            <button 
              onClick={generateLink}
              disabled={generating}
              className="mt-4 px-6 py-2.5 bg-suka-orange hover:bg-orange-600 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {generating ? "Membuat Link..." : "Buat Link Kalibrasi Baru"}
            </button>
          </div>

          {savedData?.lat ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h3 className="font-bold text-lg text-suka-ink">Lokasi Saat Ini di Database</h3>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div>
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Koordinat (Lat, Lng)</span>
                  <p className="font-mono text-sm">{savedData.lat}, {savedData.lng}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Alamat Lengkap</span>
                  <p className="font-medium text-gray-800">{savedData.address || "-"}</p>
                </div>
              </div>
              <button 
                onClick={deleteSavedLocation}
                disabled={deleting}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Hapus Koordinat di Database
              </button>
            </div>
          ) : null}
        </div>
      ) : activeData.status === 'pending' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
            <RefreshCw size={32} className="animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-suka-ink">Menunggu Kru Mengirim Lokasi</h3>
            <p className="text-gray-500 text-sm mt-1">
              Bagikan link di bawah ini kepada kru yang saat ini sedang berada tepat di outlet.
            </p>
          </div>
          
          <div className="flex items-center gap-2 max-w-md mx-auto">
            <input 
              readOnly 
              value={getPublicLink(activeData.token)} 
              className="flex-1 bg-gray-50 border border-gray-200 text-sm rounded-lg p-2.5 outline-none text-gray-600"
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(getPublicLink(activeData.token));
                alert("Link disalin!");
              }}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
            >
              <Copy size={20} />
            </button>
          </div>
          
          <div className="flex justify-center gap-4 mt-4">
            <button 
              onClick={fetchStatus}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Refresh Status
            </button>
            <button 
              onClick={deleteLocation}
              disabled={deleting}
              className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
            >
              Batalkan & Hapus Link
            </button>
          </div>
        </div>
      ) : activeData.status === 'submitted' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-500/20 p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-suka-ink">Lokasi Telah Direkam!</h3>
              <p className="text-gray-500 text-sm">
                Kru telah mengirimkan titik lokasi. Silakan verifikasi alamat yang terdeteksi sebelum menyimpannya ke database.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <div>
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Akurasi GPS</span>
              <p className="font-medium">
                {activeData.accuracy ? `${activeData.accuracy.toFixed(1)} meter` : "Tidak diketahui"}
              </p>
              {activeData.accuracy && activeData.accuracy > 50 && (
                <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                  <XCircle size={14}/> Akurasi buruk! Sebaiknya ulangi kalibrasi di luar ruangan.
                </p>
              )}
            </div>
            <div>
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Koordinat (Lat, Lng)</span>
              <p className="font-mono text-sm">{activeData.lat}, {activeData.lng}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Alamat Terdeteksi (Server-side)</span>
              <p className="font-medium text-gray-800">{activeData.address || "Menunggu hasil..."}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button 
              onClick={approveLocation}
              disabled={approving}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {approving ? "Menyimpan..." : "Verifikasi & Simpan ke Database"}
            </button>
            <button 
              onClick={deleteLocation}
              disabled={deleting}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-red-600 font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Batalkan & Hapus Data
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
