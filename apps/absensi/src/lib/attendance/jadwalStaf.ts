/**
 * Jadwal khusus STAF di outlet (aturan bernama, mis. "Masuk Sore" 15:00–23:00, berisi
 * daftar staf) untuk layar Pengaturan. Data hanya lewat RPC — tabelnya tertutup RLS:
 * `list_jadwal_staf`, `kandidat_jadwal_staf`, `simpan_jadwal_staf`, `hapus_jadwal_staf`.
 * Validasi di sini hanya cermin cepat; sumber kebenarannya RPC simpan_jadwal_staf.
 * Modul biasa (bukan "use client") agar bisa dipakai server component, action, dan klien.
 */

export type AnggotaJadwal = { staff_id: string; nama: string; role: string; status: string };

export type JadwalStaf = {
  id: string;
  outlet_id: string;
  outlet_name: string;
  nama: string;
  jam_masuk: string; // "HH:MM"
  jam_keluar: string; // "HH:MM"
  anggota: AnggotaJadwal[];
  updated_at: string | null;
};

/** Staf yang bisa dipilih untuk aturan di satu outlet; `jadwal_id` terisi = sudah di aturan. */
export type KandidatJadwal = {
  staff_id: string;
  nama: string;
  role: string;
  jadwal_id: string | null;
  jadwal_nama: string | null;
};

export const NAMA_JADWAL_MAKS = 60;
export const ANGGOTA_JADWAL_MAKS = 300;

const teks = (v: unknown) => (typeof v === "string" ? v : "");
const hhmm = (v: unknown) => teks(v).slice(0, 5);

/** Normalisasi satu baris RPC list_jadwal_staf. */
export function keJadwalStaf(row: any): JadwalStaf {
  const anggota = Array.isArray(row?.anggota) ? row.anggota : [];
  return {
    id: String(row?.id ?? ""),
    outlet_id: String(row?.outlet_id ?? ""),
    outlet_name: teks(row?.outlet_name),
    nama: teks(row?.nama),
    jam_masuk: hhmm(row?.jam_masuk),
    jam_keluar: hhmm(row?.jam_keluar),
    anggota: anggota
      .filter((a: any) => a && typeof a.staff_id === "string")
      .map((a: any) => ({ staff_id: a.staff_id, nama: teks(a.nama), role: teks(a.role), status: teks(a.status) })),
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}

/** Normalisasi satu baris RPC kandidat_jadwal_staf. */
export function keKandidatJadwal(row: any): KandidatJadwal {
  return {
    staff_id: String(row?.staff_id ?? ""),
    nama: teks(row?.nama),
    role: teks(row?.role),
    jadwal_id: typeof row?.jadwal_id === "string" ? row.jadwal_id : null,
    jadwal_nama: typeof row?.jadwal_nama === "string" ? row.jadwal_nama : null,
  };
}

/** Kelompokkan aturan per outlet (urutan dari RPC dipertahankan: nama outlet, jam masuk). */
export function kelompokPerOutlet(daftar: JadwalStaf[]): { outlet_id: string; outlet_name: string; jadwal: JadwalStaf[] }[] {
  const grup = new Map<string, { outlet_id: string; outlet_name: string; jadwal: JadwalStaf[] }>();
  for (const j of daftar) {
    const g = grup.get(j.outlet_id);
    if (g) g.jadwal.push(j);
    else grup.set(j.outlet_id, { outlet_id: j.outlet_id, outlet_name: j.outlet_name, jadwal: [j] });
  }
  return [...grup.values()];
}

const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Pesan galat pertama untuk isian aturan, atau null bila layak dikirim. */
export function validasiJadwalStaf(input: {
  outletId: string;
  nama: string;
  jamMasuk: string;
  jamKeluar: string;
  staffIds: string[];
}): string | null {
  if (!input.outletId) return "Pilih outlet terlebih dahulu.";
  const nama = input.nama.trim();
  if (!nama) return "Nama aturan wajib diisi.";
  if (nama.length > NAMA_JADWAL_MAKS) return `Nama aturan maksimal ${NAMA_JADWAL_MAKS} karakter.`;
  if (!POLA_JAM.test(input.jamMasuk) || !POLA_JAM.test(input.jamKeluar)) return "Format jam harus HH:MM.";
  if (input.jamMasuk === input.jamKeluar) return "Jam masuk dan jam pulang tidak boleh sama.";
  if (input.staffIds.length === 0) return "Pilih minimal satu staf.";
  if (input.staffIds.length > ANGGOTA_JADWAL_MAKS) return `Maksimal ${ANGGOTA_JADWAL_MAKS} staf per aturan.`;
  return null;
}
