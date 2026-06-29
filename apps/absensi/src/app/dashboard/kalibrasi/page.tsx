"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@suka/auth";
import { createClient } from "@/lib/supabase";
import { Copy, MapPin, CheckCircle, RefreshCw, XCircle, Navigation, Trash2 } from "lucide-react";

export default function KalibrasiDashboard() {
  const { outletStaff } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<any>(null);
  const [deletingSaved, setDeletingSaved] = useState(false);

  const fetchSubmissionsAndStatus = async () => {
    setLoading(true);
    try {
      // 1. Fetch global submissions
      const res = await fetch(`/api/kalibrasi-lokasi/list`);
      const json = await res.json();
      if (json.ok) {
        setSubmissions(json.data);
      }
      
      // 2. Fetch current outlet status for deleting test coordinates
      if (outletStaff?.outlet_id) {
        const { data: { session } } = await supabase.auth.getSession();
        const resStat = await fetch(`/api/kalibrasi/status?outlet_id=${outletStaff.outlet_id}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        const jsonStat = await resStat.json();
        if (jsonStat.ok) {
          setSavedData(jsonStat.saved);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissionsAndStatus();
    const interval = setInterval(fetchSubmissionsAndStatus, 5000); // auto-refresh every 5s
    return () => clearInterval(interval);
  }, [outletStaff]);

  const approveLocation = async (id: string) => {
    setProcessingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/kalibrasi-lokasi/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ submission_id: id })
      });
      const json = await res.json();
      if (json.ok) {
        alert("✅ Lokasi outlet berhasil diperbarui secara permanen!");
        fetchSubmissionsAndStatus();
      } else {
        alert("Gagal menyetujui lokasi: " + json.error);
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menyetujui.");
    } finally {
      setProcessingId(null);
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm("Hapus data kiriman ini?")) return;
    setProcessingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/kalibrasi-lokasi/delete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ submission_id: id })
      });
      const json = await res.json();
      if (json.ok) {
        fetchSubmissionsAndStatus();
      } else {
        alert("Gagal menghapus: " + json.error);
      }
    } catch (e) {
      alert("Terjadi kesalahan.");
    } finally {
      setProcessingId(null);
    }
  };

  const deleteSavedLocation = async () => {
    if (!outletStaff?.outlet_id) return;
    if (!confirm("Apakah Anda yakin ingin menghapus koordinat permanen outlet ini dari database?")) return;
    
    setDeletingSaved(true);
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
        fetchSubmissionsAndStatus();
      } else {
        alert("Gagal menghapus koordinat: " + json.error);
      }
    } catch (e) {
      alert("Terjadi kesalahan saat menghapus.");
    } finally {
      setDeletingSaved(false);
    }
  };

  const getPublicLink = () => {
    return `${window.location.origin}/kalibrasi-lokasi`;
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-ink">Kalibrasi Lokasi Outlet</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gunakan link global di bawah ini untuk semua kru. Sistem akan otomatis mendeteksi outlet mana yang sedang dikalibrasi.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
          <Navigation size={32} />
        </div>
        <h3 className="font-bold text-lg text-suka-ink">Link Kalibrasi Global</h3>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Bagikan link ini ke grup kru. Mereka hanya perlu membuka link ini saat berada di outlet untuk mengirimkan koordinat.
        </p>
        
        <div className="flex items-center gap-2 max-w-md mx-auto mt-4">
          <input 
            readOnly 
            value={getPublicLink()} 
            className="flex-1 bg-gray-50 border border-gray-200 text-sm rounded-lg p-2.5 outline-none text-gray-600"
          />
          <button 
            onClick={() => {
              navigator.clipboard.writeText(getPublicLink());
              alert("Link disalin!");
            }}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
          >
            <Copy size={20} />
          </button>
        </div>
      </div>

      {savedData?.lat && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-bold text-lg text-suka-ink">Lokasi Outlet Anda Saat Ini di Database</h3>
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
            disabled={deletingSaved}
            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {deletingSaved ? "Menghapus..." : "Hapus Koordinat Test Anda"}
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-suka-ink">Data Masuk Menunggu Persetujuan</h3>
          {loading && <RefreshCw size={20} className="animate-spin text-gray-400" />}
        </div>
        
        {submissions.length === 0 && !loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
            Belum ada kru yang mengirimkan koordinat saat ini.
          </div>
        )}

        {submissions.map((sub) => (
          <div key={sub.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded">
                  Terdeteksi Outlet:
                </span>
                <span className="font-bold text-gray-900">{sub.matched_outlet_name}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                <MapPin size={16} className="inline mr-1 text-gray-400" />
                {sub.address}
              </p>
              <div className="text-xs text-gray-500 font-mono mt-1">
                Lat: {sub.lat}, Lng: {sub.lng} | Jarak dr DB: {sub.distance_meters}m
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Dikirim: {new Date(sub.submitted_at).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto">
              <button
                onClick={() => approveLocation(sub.id)}
                disabled={processingId === sub.id}
                className="flex-1 py-2 px-4 bg-suka-ink hover:bg-black text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle size={16} />
                Simpan & Replace
              </button>
              <button
                onClick={() => deleteSubmission(sub.id)}
                disabled={processingId === sub.id}
                className="flex-1 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Abaikan
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
