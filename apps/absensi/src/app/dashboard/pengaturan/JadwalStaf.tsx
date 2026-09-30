"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@suka/design-system";
import { Clock, Moon, Pencil, Plus, RotateCw, Search, Trash2, UserRoundCog, Users, X } from "lucide-react";
import { Select } from "@/components/Select";
import { useToast } from "@/lib/feedback/toast";
import { createClient } from "@/lib/supabase";
import {
  keJadwalStaf,
  keKandidatJadwal,
  kelompokPerOutlet,
  validasiJadwalStaf,
  NAMA_JADWAL_MAKS,
  type JadwalStaf as Jadwal,
  type KandidatJadwal,
} from "@/lib/attendance/jadwalStaf";
import { hapusJadwalStaf, simpanJadwalStaf, type HasilJadwalStaf } from "./actions";

type OutletPilihan = { id: string; name: string; is_active: boolean };

type Draf = {
  /** null = aturan baru. */
  id: string | null;
  outletId: string;
  nama: string;
  jamMasuk: string;
  jamKeluar: string;
  dipilih: Set<string>;
};

/** Status kandidat per outlet; disimpan per outlet agar ganti-ganti outlet tidak memuat ulang. */
type Kandidat = { status: "memuat" } | { status: "galat"; pesan: string } | { status: "siap"; daftar: KandidatJadwal[] };

const CHIP_MAKS = 8;
const keMenit = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const lewatTengahMalam = (masuk: string, keluar: string) => !!masuk && !!keluar && keMenit(keluar) < keMenit(masuk);
const labelPeran = (role: string) => role.replace(/_/g, " ");

/**
 * Jadwal Khusus Staf: aturan bernama per outlet (mis. "Masuk Sore" 15:00–23:00) berisi
 * daftar staf. Staf anggota absen memakai jam aturan setiap hari dan tidak memilih
 * shift; toleransi & radius tetap milik outlet. Satu staf paling banyak satu aturan per
 * outlet. Semua baca/tulis lewat RPC atas nama user (tabelnya tertutup RLS).
 */
export function JadwalStafPanel({ initialJadwal, outlets }: { initialJadwal: Jadwal[]; outlets: OutletPilihan[] }) {
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [daftar, setDaftar] = useState<Jadwal[]>(initialJadwal);
  const [cari, setCari] = useState("");
  const [draf, setDraf] = useState<Draf | null>(null);
  const [kandidat, setKandidat] = useState<Map<string, Kandidat>>(new Map());
  const [cariStaf, setCariStaf] = useState("");

  const muatDaftar = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_jadwal_staf");
    if (!error && Array.isArray(data)) setDaftar(data.map(keJadwalStaf));
  }, [supabase]);

  /** Kandidat staf satu outlet — satu RPC, di-cache per outlet sampai ada simpan/hapus. */
  const kandidatRef = useRef(kandidat);
  useEffect(() => { kandidatRef.current = kandidat; }, [kandidat]);
  const sedangDimuat = useRef(new Set<string>());
  const muatKandidat = useCallback(async (outletId: string, paksa = false) => {
    if (!outletId || sedangDimuat.current.has(outletId)) return;
    // Sudah termuat → jangan panggil RPC lagi (kecuali muat ulang manual).
    const ada = kandidatRef.current.get(outletId);
    if (!paksa && ada?.status === "siap") return;
    sedangDimuat.current.add(outletId);
    setKandidat((prev) => new Map(prev).set(outletId, { status: "memuat" }));
    let hasil: Kandidat;
    try {
      const { data, error } = await supabase.rpc("kandidat_jadwal_staf", { p_outlet_id: outletId });
      hasil = error || !Array.isArray(data)
        ? { status: "galat", pesan: error?.message || "Gagal memuat daftar staf." }
        : { status: "siap", daftar: data.map(keKandidatJadwal) };
    } catch (err: any) {
      hasil = { status: "galat", pesan: err?.message || "Gagal memuat daftar staf." };
    } finally {
      sedangDimuat.current.delete(outletId);
    }
    setKandidat((prev) => new Map(prev).set(outletId, hasil));
  }, [supabase]);

  const hasilCari = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return daftar;
    return daftar.filter((j) =>
      j.outlet_name.toLowerCase().includes(q) ||
      j.nama.toLowerCase().includes(q) ||
      j.anggota.some((a) => a.nama.toLowerCase().includes(q)),
    );
  }, [daftar, cari]);
  const grup = useMemo(() => kelompokPerOutlet(hasilCari), [hasilCari]);
  const totalStaf = useMemo(() => daftar.reduce((n, j) => n + j.anggota.length, 0), [daftar]);

  const opsiOutlet = useMemo(
    () => outlets.map((o) => ({ label: o.is_active ? o.name : `${o.name} (nonaktif)`, value: o.id })),
    [outlets],
  );

  function bukaTambah() {
    setCariStaf("");
    setDraf({ id: null, outletId: "", nama: "", jamMasuk: "15:00", jamKeluar: "23:00", dipilih: new Set() });
  }

  function bukaEdit(j: Jadwal) {
    setCariStaf("");
    setDraf({
      id: j.id,
      outletId: j.outlet_id,
      nama: j.nama,
      jamMasuk: j.jam_masuk,
      jamKeluar: j.jam_keluar,
      dipilih: new Set(j.anggota.map((a) => a.staff_id)),
    });
    void muatKandidat(j.outlet_id);
  }

  function pilihOutlet(outletId: string) {
    if (!draf || draf.id) return; // outlet aturan tidak bisa diganti saat edit
    setDraf({ ...draf, outletId, dipilih: new Set() });
    void muatKandidat(outletId);
  }

  function terapkanHasil(hasil: HasilJadwalStaf, pesanOk: string, selesai?: () => void) {
    if (!hasil.success) {
      toast.show("err", hasil.error);
      return;
    }
    if (hasil.daftar) setDaftar(hasil.daftar);
    else void muatDaftar();
    // Keanggotaan berubah → status "sudah di aturan X" di outlet mana pun bisa basi.
    setKandidat(new Map());
    toast.show("ok", pesanOk);
    selesai?.();
  }

  function simpan() {
    if (!draf) return;
    const input = {
      id: draf.id,
      outletId: draf.outletId,
      nama: draf.nama.trim(),
      jamMasuk: draf.jamMasuk,
      jamKeluar: draf.jamKeluar,
      staffIds: [...draf.dipilih],
    };
    const salah = validasiJadwalStaf(input);
    if (salah) {
      toast.show("err", salah);
      return;
    }
    startTransition(async () => {
      try {
        terapkanHasil(
          await simpanJadwalStaf(input),
          draf.id ? `Aturan "${input.nama}" diperbarui.` : `Aturan "${input.nama}" ditambahkan.`,
          () => setDraf(null),
        );
      } catch (err: any) {
        toast.show("err", err?.message || "Gagal menyimpan jadwal khusus staf");
      }
    });
  }

  function hapus(j: Jadwal) {
    if (!confirm(`Hapus aturan "${j.nama}" di ${j.outlet_name}? ${j.anggota.length} staf kembali memakai jadwal outlet.`)) return;
    startTransition(async () => {
      try {
        terapkanHasil(await hapusJadwalStaf(j.id), `Aturan "${j.nama}" dihapus.`);
      } catch (err: any) {
        toast.show("err", err?.message || "Gagal menghapus jadwal khusus staf");
      }
    });
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <UserRoundCog size={20} className="text-orange-600" /> Jadwal Khusus Staf
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
              {daftar.length} Aturan · {totalStaf} Staf
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Staf tertentu di satu outlet memakai jam sendiri setiap hari (mis. masuk sore) tanpa memilih shift.
            Toleransi telat &amp; radius tetap mengikuti outlet; staf lain tidak terpengaruh.
          </p>
        </div>
        <button
          type="button"
          onClick={bukaTambah}
          disabled={isPending}
          className="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md shadow-orange-600/15 transition-all disabled:opacity-50"
        >
          <Plus size={14} /> Tambah Aturan
        </button>
      </div>

      {daftar.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="search"
            placeholder="Cari outlet, nama aturan, atau staf..."
            aria-label="Cari jadwal khusus staf"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>
      )}

      {grup.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
          <p className="text-xs text-slate-400 font-medium">
            {cari ? "Tidak ada aturan yang cocok dengan kata kunci tersebut." : "Belum ada jadwal khusus staf. Semua staf memakai jadwal outlet / aturan pusat."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {grup.map((g) => (
            <section key={g.outlet_id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 truncate">{g.outlet_name || "Outlet Tidak Dikenal"}</h3>
              {g.jadwal.map((j) => {
                const lebih = j.anggota.length - CHIP_MAKS;
                return (
                  <div key={j.id} className="rounded-xl bg-white border border-slate-200/80 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-500 truncate">{j.nama}</p>
                        <p className="text-base font-black text-slate-900 tabular-nums leading-tight">
                          {j.jam_masuk} – {j.jam_keluar}
                          {lewatTengahMalam(j.jam_masuk, j.jam_keluar) && (
                            <Moon size={13} className="inline ml-1.5 -mt-0.5 text-indigo-600" aria-label="Pulang lewat tengah malam" />
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="mr-1 inline-flex items-center gap-1 rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-extrabold text-orange-800 border border-orange-200">
                          <Users size={10} /> {j.anggota.length} staf
                        </span>
                        <button
                          type="button"
                          onClick={() => bukaEdit(j)}
                          disabled={isPending}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                          title="Edit aturan"
                          aria-label={`Edit aturan ${j.nama}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => hapus(j)}
                          disabled={isPending}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Hapus aturan"
                          aria-label={`Hapus aturan ${j.nama}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {j.anggota.slice(0, CHIP_MAKS).map((a) => (
                        <span
                          key={a.staff_id}
                          className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            a.status === "active" ? "bg-orange-50 text-orange-800 border-orange-200" : "bg-slate-100 text-slate-500 border-slate-200 line-through"
                          }`}
                          title={a.status === "active" ? labelPeran(a.role) : "Staf nonaktif"}
                        >
                          <span className="truncate">{a.nama}</span>
                        </span>
                      ))}
                      {lebih > 0 && (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          +{lebih} lainnya
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {mounted && draf && (
        <ModalJadwal
          draf={draf}
          setDraf={setDraf}
          opsiOutlet={opsiOutlet}
          namaOutlet={outlets.find((o) => o.id === draf.outletId)?.name ?? daftar.find((j) => j.outlet_id === draf.outletId)?.outlet_name ?? "Outlet"}
          kandidat={draf.outletId ? kandidat.get(draf.outletId) : undefined}
          anggotaAwal={draf.id ? daftar.find((j) => j.id === draf.id)?.anggota ?? [] : []}
          cariStaf={cariStaf}
          setCariStaf={setCariStaf}
          onPilihOutlet={pilihOutlet}
          onMuatUlang={() => void muatKandidat(draf.outletId, true)}
          onSimpan={simpan}
          onTutup={() => !isPending && setDraf(null)}
          isPending={isPending}
        />
      )}
    </div>
  );
}

type BarisStaf = { staff_id: string; nama: string; role: string; bentrok: string | null; nonaktif: boolean };

function ModalJadwal({
  draf,
  setDraf,
  opsiOutlet,
  namaOutlet,
  kandidat,
  anggotaAwal,
  cariStaf,
  setCariStaf,
  onPilihOutlet,
  onMuatUlang,
  onSimpan,
  onTutup,
  isPending,
}: {
  draf: Draf;
  setDraf: (d: Draf) => void;
  opsiOutlet: { label: string; value: string }[];
  namaOutlet: string;
  kandidat: Kandidat | undefined;
  anggotaAwal: Jadwal["anggota"];
  cariStaf: string;
  setCariStaf: (v: string) => void;
  onPilihOutlet: (id: string) => void;
  onMuatUlang: () => void;
  onSimpan: () => void;
  onTutup: () => void;
  isPending: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Kandidat dari RPC + anggota lama yang tidak lagi terdaftar sebagai kandidat (mis. nonaktif)
  // supaya tetap terlihat dan bisa dilepas.
  const baris = useMemo<BarisStaf[]>(() => {
    if (kandidat?.status !== "siap") return [];
    const hasil: BarisStaf[] = kandidat.daftar.map((k) => ({
      staff_id: k.staff_id,
      nama: k.nama,
      role: k.role,
      bentrok: k.jadwal_id && k.jadwal_id !== draf.id ? k.jadwal_nama || "aturan lain" : null,
      nonaktif: false,
    }));
    const ada = new Set(hasil.map((b) => b.staff_id));
    for (const a of anggotaAwal) {
      if (!ada.has(a.staff_id)) hasil.push({ staff_id: a.staff_id, nama: a.nama, role: a.role, bentrok: null, nonaktif: a.status !== "active" });
    }
    return hasil;
  }, [kandidat, anggotaAwal, draf.id]);

  const q = cariStaf.trim().toLowerCase();
  const tampil = q ? baris.filter((b) => b.nama.toLowerCase().includes(q)) : baris;
  const bisaDipilih = tampil.filter((b) => !b.bentrok);
  const semuaTerpilih = bisaDipilih.length > 0 && bisaDipilih.every((b) => draf.dipilih.has(b.staff_id));

  const ubahPilih = (id: string, centang: boolean) => {
    const baru = new Set(draf.dipilih);
    if (centang) baru.add(id); else baru.delete(id);
    setDraf({ ...draf, dipilih: baru });
  };
  const togglePilihSemua = () => {
    const baru = new Set(draf.dipilih);
    bisaDipilih.forEach((b) => (semuaTerpilih ? baru.delete(b.staff_id) : baru.add(b.staff_id)));
    setDraf({ ...draf, dipilih: baru });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={draf.id ? "Edit Jadwal Khusus Staf" : "Tambah Jadwal Khusus Staf"}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onTutup(); }}
    >
      <div className="w-full max-w-lg animate-in slide-in-from-bottom-8 rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh] overflow-hidden border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900 truncate">
              {draf.id ? "Edit Jadwal Khusus Staf" : "Tambah Jadwal Khusus Staf"}
            </h3>
            <p className="text-xs text-slate-500">Jam kerja sendiri untuk staf terpilih, berlaku setiap hari</p>
          </div>
          <button type="button" onClick={onTutup} aria-label="Tutup" className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 block">Outlet</label>
            {draf.id ? (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm text-slate-900 font-bold">
                {namaOutlet}
                <span className="block text-[11px] font-medium text-slate-500">Outlet aturan tidak bisa diganti — buat aturan baru untuk outlet lain.</span>
              </div>
            ) : (
              <Select
                value={draf.outletId}
                onChange={onPilihOutlet}
                options={opsiOutlet}
                placeholder="-- Pilih Outlet --"
                className="w-full"
                searchable
              />
            )}
          </div>

          <div>
            <label htmlFor="jadwal-staf-nama" className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 block">Nama Aturan</label>
            <input
              id="jadwal-staf-nama"
              type="text"
              value={draf.nama}
              maxLength={NAMA_JADWAL_MAKS}
              onChange={(e) => setDraf({ ...draf, nama: e.target.value })}
              placeholder="mis. Masuk Sore"
              className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:font-medium placeholder:text-slate-400 outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-orange-500" />
                Jam Kerja
              </label>
              <span className="text-[11px] text-slate-500 font-medium">Format 24 Jam (WIB)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-slate-200 p-3.5 bg-slate-50/70 focus-within:border-orange-500 focus-within:bg-white transition-all">
                <label htmlFor="jadwal-staf-masuk" className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Jam Masuk
                </label>
                <input
                  id="jadwal-staf-masuk"
                  type="time" required
                  value={draf.jamMasuk}
                  onChange={(e) => setDraf({ ...draf, jamMasuk: e.target.value })}
                  className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-900 outline-none"
                />
              </div>
              <div className="rounded-2xl border-2 border-slate-200 p-3.5 bg-slate-50/70 focus-within:border-orange-500 focus-within:bg-white transition-all">
                <label htmlFor="jadwal-staf-pulang" className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-rose-700 uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Jam Pulang
                </label>
                <input
                  id="jadwal-staf-pulang"
                  type="time" required
                  value={draf.jamKeluar}
                  onChange={(e) => setDraf({ ...draf, jamKeluar: e.target.value })}
                  className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-900 outline-none"
                />
              </div>
            </div>
            {lewatTengahMalam(draf.jamMasuk, draf.jamKeluar) && (
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
                <Moon size={12} /> Pulang lewat tengah malam (hari berikutnya)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Staf</p>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{draf.dipilih.size} dipilih</span>
            </div>

            {!draf.outletId ? (
              <p className="rounded-2xl border-2 border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                Pilih outlet dulu untuk menampilkan daftar staf.
              </p>
            ) : !kandidat || kandidat.status === "memuat" ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-6 text-xs text-slate-500">
                <Spinner size={16} /> Memuat daftar staf…
              </div>
            ) : kandidat.status === "galat" ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-4 text-center space-y-2">
                <p className="text-xs font-semibold text-rose-700">{kandidat.pesan}</p>
                <button type="button" onClick={onMuatUlang} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100">
                  <RotateCw size={12} /> Coba lagi
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="search"
                    value={cariStaf}
                    onChange={(e) => setCariStaf(e.target.value)}
                    placeholder="Cari nama staf..."
                    aria-label="Cari nama staf"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <label className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60 text-xs font-bold text-slate-700 cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={semuaTerpilih}
                      onChange={togglePilihSemua}
                      disabled={bisaDipilih.length === 0}
                      className="h-4 w-4 accent-orange-600"
                    />
                    Pilih semua (hasil pencarian)
                  </label>
                  <ul className="max-h-[36vh] overflow-y-auto divide-y divide-slate-100">
                    {tampil.length === 0 && (
                      <li className="px-3 py-6 text-center text-xs text-slate-400">
                        {baris.length === 0 ? "Belum ada staf aktif di outlet ini." : "Staf tidak ditemukan"}
                      </li>
                    )}
                    {tampil.map((b) => {
                      const terkunci = !!b.bentrok;
                      return (
                        <li key={b.staff_id}>
                          <label className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] ${terkunci ? "bg-slate-50 cursor-not-allowed" : "cursor-pointer hover:bg-orange-50/40"}`}>
                            <input
                              type="checkbox"
                              checked={!terkunci && draf.dipilih.has(b.staff_id)}
                              disabled={terkunci}
                              onChange={(e) => ubahPilih(b.staff_id, e.target.checked)}
                              className="h-4 w-4 shrink-0 accent-orange-600"
                            />
                            <span className={`flex-1 min-w-0 truncate text-sm font-semibold ${terkunci || b.nonaktif ? "text-slate-500" : "text-slate-800"}`}>
                              {b.nama}
                              {b.bentrok && <span className="ml-1 text-[11px] font-medium text-slate-500">(sudah di: {b.bentrok})</span>}
                              {b.nonaktif && <span className="ml-1 text-[11px] font-medium text-slate-500">(nonaktif)</span>}
                            </span>
                            {b.role && (
                              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold capitalize text-slate-600">
                                {labelPeran(b.role)}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Satu staf hanya bisa masuk satu aturan per outlet. Staf yang sudah di aturan lain dikunci — lepas dulu dari aturan itu.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4">
          <button
            type="button"
            className="flex-1 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all"
            onClick={onTutup}
            disabled={isPending}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSimpan}
            disabled={isPending || !draf.outletId || draf.dipilih.size === 0 || !draf.nama.trim()}
            className="flex-1 py-3 text-xs font-black bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-600/20 transition-all disabled:opacity-50"
          >
            {isPending ? <Spinner className="w-4 h-4 text-white mx-auto" /> : "Simpan Aturan"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
