"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@suka/design-system";
import { Check, ChevronRight, Globe, Info, MapPinned, Search, Store, Users, X } from "lucide-react";
import { Select } from "@/components/Select";
import { useToast } from "@/lib/feedback/toast";
import { aturAksesAbsen, type InputAturAkses } from "./actions";

export type CrewAkses = {
  staff_id: string;
  nama: string;
  role: string;
  outlet_id: string | null;
  semua_outlet: boolean;
  /** Penempatan dari HR (staff_outlets) — hanya ditampilkan, tidak diubah di sini. */
  penempatan: string[];
  /** Izin tambahan dari HR/developer; memuat outlet utama sebagai baris "asal" bila ada tambahan. */
  akses: string[];
};

export type OutletPilihan = { id: string; name: string; type: string | null };

type Props = { crew: CrewAkses[]; outlets: OutletPilihan[] };

const TANPA_OUTLET = "__tanpa__";

/** Outlet tambahan yang benar-benar diberikan HR/developer (tanpa outlet utama & penempatan). */
function aksesTambahan(c: CrewAkses): string[] {
  return c.akses.filter((id) => id !== c.outlet_id && !c.penempatan.includes(id));
}

const labelPeran = (role: string) => role.replace(/_/g, " ");

function Chip({ children, nada }: { children: ReactNode; nada: "hijau" | "oranye" | "abu" }) {
  const kelas =
    nada === "hijau"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : nada === "oranye"
        ? "bg-orange-50 text-orange-800 border-orange-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${kelas}`}>
      {children}
    </span>
  );
}

/** Kerangka modal: panel dari bawah di HP, kartu di tengah pada layar lebar (portal ke body). */
function Modal({
  judul,
  subjudul,
  onTutup,
  children,
  kaki,
}: {
  judul: string;
  subjudul?: string;
  onTutup: () => void;
  children: ReactNode;
  kaki: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={judul}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onTutup(); }}
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh] overflow-hidden border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-slate-50/50">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">{judul}</h3>
            {subjudul && <p className="text-xs text-slate-500 truncate">{subjudul}</p>}
          </div>
          <button type="button" onClick={onTutup} aria-label="Tutup" className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-3">
          {kaki}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Daftar outlet bercentang dengan pencarian. `terkunci` = outlet yang selalu diizinkan
 * (outlet utama / penempatan HR): tampil tercentang, tidak bisa diubah, tidak dikirim.
 */
function DaftarOutlet({
  outlets,
  dipilih,
  onUbah,
  terkunci,
}: {
  outlets: OutletPilihan[];
  dipilih: Set<string>;
  onUbah: (id: string, centang: boolean) => void;
  terkunci?: Map<string, string>;
}) {
  const [cari, setCari] = useState("");
  const q = cari.trim().toLowerCase();
  const tampil = q ? outlets.filter((o) => o.name.toLowerCase().includes(q)) : outlets;
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari outlet..."
          aria-label="Cari outlet"
          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>
      <ul className="max-h-[42vh] overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {tampil.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-400">Outlet tidak ditemukan</li>}
        {tampil.map((o) => {
          const kunci = terkunci?.get(o.id);
          const centang = !!kunci || dipilih.has(o.id);
          return (
            <li key={o.id}>
              <label className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] ${kunci ? "bg-slate-50 cursor-not-allowed" : "cursor-pointer hover:bg-orange-50/40"}`}>
                <input
                  type="checkbox"
                  checked={centang}
                  disabled={!!kunci}
                  onChange={(e) => onUbah(o.id, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-orange-600"
                />
                <span className={`flex-1 min-w-0 truncate text-sm font-semibold ${kunci ? "text-slate-500" : "text-slate-800"}`}>{o.name}</span>
                {kunci && <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-200/70 rounded-full px-2 py-0.5">{kunci}</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AksesAbsenClient({ crew, outlets }: Props) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const namaOutlet = useMemo(() => new Map(outlets.map((o) => [o.id, o.name])), [outlets]);
  const idOutletAktif = useMemo(() => new Set(outlets.map((o) => o.id)), [outlets]);
  const nama = (id: string | null) => (id ? namaOutlet.get(id) ?? "Outlet nonaktif" : "—");

  // ── Filter ──
  const [cari, setCari] = useState("");
  const [filterOutlet, setFilterOutlet] = useState("");
  const [hanyaTambahan, setHanyaTambahan] = useState(false);

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return crew.filter((c) => {
      if (q && !c.nama.toLowerCase().includes(q)) return false;
      if (filterOutlet === TANPA_OUTLET ? c.outlet_id !== null : filterOutlet && c.outlet_id !== filterOutlet) return false;
      if (hanyaTambahan && !c.semua_outlet && aksesTambahan(c).length === 0) return false;
      return true;
    });
  }, [crew, cari, filterOutlet, hanyaTambahan]);

  const ringkasan = useMemo(() => ({
    total: crew.length,
    tambahan: crew.filter((c) => !c.semua_outlet && aksesTambahan(c).length > 0).length,
    semua: crew.filter((c) => c.semua_outlet).length,
  }), [crew]);

  // ── Pilihan massal ──
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  // Crew yang hilang dari daftar (nonaktif/berganti peran) ikut keluar dari pilihan.
  useEffect(() => {
    setDipilih((prev) => {
      const ada = new Set(crew.map((c) => c.staff_id));
      const sisa = new Set([...prev].filter((id) => ada.has(id)));
      return sisa.size === prev.size ? prev : sisa;
    });
  }, [crew]);
  const semuaHasilTerpilih = hasil.length > 0 && hasil.every((c) => dipilih.has(c.staff_id));
  const togglePilih = (id: string) =>
    setDipilih((prev) => {
      const baru = new Set(prev);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  const togglePilihSemua = () =>
    setDipilih((prev) => {
      const baru = new Set(prev);
      if (semuaHasilTerpilih) hasil.forEach((c) => baru.delete(c.staff_id));
      else hasil.forEach((c) => baru.add(c.staff_id));
      return baru;
    });

  // ── Editor satu crew ──
  const [editor, setEditor] = useState<{ crew: CrewAkses; semua: boolean; outlet: Set<string> } | null>(null);
  const bukaEditor = (c: CrewAkses) =>
    setEditor({ crew: c, semua: c.semua_outlet, outlet: new Set(aksesTambahan(c).filter((id) => idOutletAktif.has(id))) });

  const kunciEditor = useMemo(() => {
    const m = new Map<string, string>();
    if (!editor) return m;
    editor.crew.penempatan.forEach((id) => m.set(id, "Penempatan HR"));
    if (editor.crew.outlet_id) m.set(editor.crew.outlet_id, "Outlet utama");
    return m;
  }, [editor]);

  // ── Editor massal ──
  const [massal, setMassal] = useState<{ mode: "tambah" | "ganti"; semua: boolean | null; outlet: Set<string> } | null>(null);

  function kirim(input: InputAturAkses, pesanOk: (jumlah: number) => string, selesai: () => void) {
    startTransition(async () => {
      try {
        const res = await aturAksesAbsen(input);
        if (!res.ok) {
          toast.show("err", res.error);
          return;
        }
        toast.show("ok", pesanOk(res.jumlah));
        selesai();
      } catch (err: any) {
        toast.show("err", err?.message || "Gagal menyimpan akses absen");
      }
    });
  }

  const simpanEditor = () => {
    if (!editor) return;
    kirim(
      {
        staffIds: [editor.crew.staff_id],
        // Outlet utama & penempatan tidak dikirim: outlet utama selalu dipertahankan
        // server, penempatan dikelola HR lewat staff_outlets.
        outletIds: [...editor.outlet].filter((id) => !kunciEditor.has(id)),
        semuaOutlet: editor.semua,
        mode: "ganti",
      },
      () => `Akses absen ${editor.crew.nama} disimpan`,
      () => setEditor(null),
    );
  };

  const massalKosong = !!massal && massal.mode === "tambah" && massal.outlet.size === 0 && massal.semua === null;
  const simpanMassal = () => {
    if (!massal || massalKosong) return;
    kirim(
      { staffIds: [...dipilih], outletIds: [...massal.outlet], semuaOutlet: massal.semua, mode: massal.mode },
      (jumlah) => `Akses absen ${jumlah} crew diperbarui`,
      () => { setMassal(null); setDipilih(new Set()); },
    );
  };

  const opsiFilterOutlet = useMemo(() => [
    { label: "Semua outlet utama", value: "" },
    ...outlets.map((o) => ({ label: o.name, value: o.id })),
    { label: "Tanpa outlet utama", value: TANPA_OUTLET },
  ], [outlets]);

  return (
    <div className={`space-y-4 ${dipilih.size > 0 ? "pb-24" : ""}`}>
      {/* Penjelasan */}
      <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-xs leading-relaxed text-sky-900">
        <Info size={18} className="mt-0.5 shrink-0 text-sky-600" />
        <div className="space-y-1">
          <p>
            Crew selalu boleh absen di <strong>outlet utamanya</strong> dan outlet <strong>penempatan HR</strong>. Di sini
            Anda menambah outlet lain, atau mengizinkan absen di <strong>semua outlet</strong>.
          </p>
          <p className="text-sky-800/80">
            Peran pengawas (SPV, AM, RM, admin, HR, owner, developer) sudah otomatis boleh absen di outlet mana pun, jadi
            tidak muncul di daftar ini.
          </p>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Crew", nilai: ringkasan.total, ikon: <Users size={14} /> },
          { label: "Akses tambahan", nilai: ringkasan.tambahan, ikon: <Store size={14} /> },
          { label: "Semua outlet", nilai: ringkasan.semua, ikon: <Globe size={14} /> },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 truncate">
              {k.ikon} {k.label}
            </p>
            <p className="text-xl font-black text-slate-900 tabular-nums">{k.nilai}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama crew..."
            aria-label="Cari nama crew"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={filterOutlet}
            onChange={setFilterOutlet}
            options={opsiFilterOutlet}
            placeholder="Semua outlet utama"
            className="flex-1"
            searchable
          />
          <button
            type="button"
            onClick={() => setHanyaTambahan((v) => !v)}
            aria-pressed={hanyaTambahan}
            className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              hanyaTambahan ? "border-orange-500 bg-orange-50 text-orange-800" : "border-suka-gray-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {hanyaTambahan && <Check size={14} />} Punya akses tambahan
          </button>
        </div>
      </div>

      {/* Daftar crew */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer min-h-[32px]">
            <input
              type="checkbox"
              checked={semuaHasilTerpilih}
              onChange={togglePilihSemua}
              disabled={hasil.length === 0}
              className="h-4 w-4 accent-orange-600"
            />
            Pilih semua (hasil filter)
          </label>
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{hasil.length} crew</span>
        </div>

        {hasil.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400">
            {crew.length === 0 ? "Belum ada crew aktif." : "Tidak ada crew yang cocok dengan filter."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {hasil.map((c) => {
              const tambahan = aksesTambahan(c);
              const terpilih = dipilih.has(c.staff_id);
              return (
                <li key={c.staff_id} className={`flex items-stretch ${terpilih ? "bg-orange-50/50" : ""}`}>
                  <label className="flex items-center pl-4 pr-2 cursor-pointer" aria-label={`Pilih ${c.nama}`}>
                    <input
                      type="checkbox"
                      checked={terpilih}
                      onChange={() => togglePilih(c.staff_id)}
                      className="h-4 w-4 accent-orange-600"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => bukaEditor(c)}
                    className="flex flex-1 min-w-0 items-center gap-3 py-3 pr-3 text-left hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-sm font-extrabold text-slate-900">{c.nama}</span>
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold capitalize text-slate-600">
                          {labelPeran(c.role)}
                        </span>
                      </div>
                      <p className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                        <MapPinned size={12} className="shrink-0" /> {nama(c.outlet_id)}
                      </p>
                      {(c.semua_outlet || tambahan.length > 0 || c.penempatan.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {c.semua_outlet && (
                            <Chip nada="hijau"><Globe size={10} /> Semua outlet</Chip>
                          )}
                          {tambahan.map((id) => (
                            <Chip key={id} nada="oranye"><span className="truncate">{nama(id)}</span></Chip>
                          ))}
                          {c.penempatan.filter((id) => id !== c.outlet_id).map((id) => (
                            <Chip key={id} nada="abu"><span className="truncate">Penempatan HR: {nama(id)}</span></Chip>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-300" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Bilah aksi massal */}
      {dipilih.size > 0 && (
        <div className="fixed inset-x-0 z-30 px-4 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] lg:bottom-6 lg:left-64">
          <div className="mx-auto max-w-4xl flex items-center gap-2 rounded-2xl bg-slate-900 p-2 pl-4 text-white shadow-2xl">
            <span className="flex-1 min-w-0 truncate text-sm font-bold">{dipilih.size} crew dipilih</span>
            <button
              type="button"
              onClick={() => setDipilih(new Set())}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => setMassal({ mode: "tambah", semua: null, outlet: new Set() })}
              className="shrink-0 rounded-xl bg-orange-600 px-4 py-2 text-xs font-black hover:bg-orange-700"
            >
              Atur akses ({dipilih.size} crew)
            </button>
          </div>
        </div>
      )}

      {/* Modal editor satu crew */}
      {mounted && editor && (
        <Modal
          judul={`Akses Absen — ${editor.crew.nama}`}
          subjudul={`${labelPeran(editor.crew.role)} · Outlet utama: ${nama(editor.crew.outlet_id)}`}
          onTutup={() => !isPending && setEditor(null)}
          kaki={
            <>
              <button
                type="button"
                onClick={() => setEditor(null)}
                disabled={isPending}
                className="flex-1 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={simpanEditor}
                disabled={isPending}
                className="flex-1 py-3 text-xs font-black bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-600/20 transition-all disabled:opacity-50"
              >
                {isPending ? <Spinner className="w-4 h-4 text-white mx-auto" /> : "Simpan Akses"}
              </button>
            </>
          }
        >
          <div className={`flex items-center justify-between gap-4 rounded-2xl border-2 p-4 transition-all ${editor.semua ? "border-emerald-500 bg-emerald-50/60" : "border-slate-200 bg-slate-50"}`}>
            <div className="space-y-0.5">
              <p className="text-sm font-black text-slate-900">Boleh absen di semua outlet</p>
              <p className="text-[11px] text-slate-500 leading-snug">Crew bisa absen masuk & pulang di outlet aktif mana pun.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={editor.semua}
              aria-label="Boleh absen di semua outlet"
              onClick={() => setEditor({ ...editor, semua: !editor.semua })}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${editor.semua ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span className={`pointer-events-none m-1 inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ${editor.semua ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Outlet yang diizinkan</p>
            {editor.semua && (
              <p className="text-[11px] text-emerald-700 font-semibold">
                Izin semua outlet sedang aktif. Daftar di bawah tetap disimpan dan berlaku lagi bila izin itu dicabut.
              </p>
            )}
            <DaftarOutlet
              outlets={outlets}
              dipilih={editor.outlet}
              terkunci={kunciEditor}
              onUbah={(id, centang) => {
                const baru = new Set(editor.outlet);
                if (centang) baru.add(id); else baru.delete(id);
                setEditor({ ...editor, outlet: baru });
              }}
            />
          </div>
        </Modal>
      )}

      {/* Modal atur massal */}
      {mounted && massal && (
        <Modal
          judul={`Atur akses ${dipilih.size} crew`}
          subjudul="Outlet utama & penempatan HR tiap crew selalu tetap diizinkan"
          onTutup={() => !isPending && setMassal(null)}
          kaki={
            <>
              <button
                type="button"
                onClick={() => setMassal(null)}
                disabled={isPending}
                className="flex-1 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={simpanMassal}
                disabled={isPending || massalKosong}
                className="flex-1 py-3 text-xs font-black bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-600/20 transition-all disabled:opacity-50"
              >
                {isPending ? <Spinner className="w-4 h-4 text-white mx-auto" /> : `Terapkan ke ${dipilih.size} crew`}
              </button>
            </>
          }
        >
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">Cara menerapkan</legend>
            {([
              { nilai: "tambah", judul: "Tambahkan ke akses yang ada", ket: "Outlet yang dicentang ditambahkan; akses lama tetap." },
              { nilai: "ganti", judul: "Ganti semua akses tambahan", ket: "Akses tambahan tiap crew menjadi persis outlet yang dicentang. Tanpa centang = kembali ke default." },
            ] as const).map((m) => (
              <label
                key={m.nilai}
                className={`flex items-start gap-3 rounded-2xl border-2 p-3 cursor-pointer transition-all ${massal.mode === m.nilai ? "border-orange-500 bg-orange-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100/60"}`}
              >
                <input
                  type="radio"
                  name="mode-massal"
                  checked={massal.mode === m.nilai}
                  onChange={() => setMassal({ ...massal, mode: m.nilai })}
                  className="mt-0.5 h-4 w-4 accent-orange-600"
                />
                <span>
                  <span className="block text-sm font-black text-slate-900">{m.judul}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug">{m.ket}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Izin semua outlet</p>
            <div role="radiogroup" aria-label="Izin semua outlet" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {([
                { nilai: null, label: "Tidak diubah" },
                { nilai: true, label: "Izinkan" },
                { nilai: false, label: "Cabut" },
              ] as const).map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={massal.semua === o.nilai}
                  onClick={() => setMassal({ ...massal, semua: o.nilai })}
                  className={`rounded-lg py-2 text-xs font-bold transition-all ${
                    massal.semua === o.nilai
                      ? o.nilai === true
                        ? "bg-emerald-600 text-white shadow-sm"
                        : o.nilai === false
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Outlet</p>
              {massal.outlet.size > 0 && (
                <button
                  type="button"
                  onClick={() => setMassal({ ...massal, outlet: new Set() })}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                >
                  Kosongkan ({massal.outlet.size})
                </button>
              )}
            </div>
            <DaftarOutlet
              outlets={outlets}
              dipilih={massal.outlet}
              onUbah={(id, centang) => {
                const baru = new Set(massal.outlet);
                if (centang) baru.add(id); else baru.delete(id);
                setMassal({ ...massal, outlet: baru });
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
