import type { BoardState, BoardSummary } from '@suka/hr-rumus'

export interface OutletAbsensi { id: string; name: string; type: string }
export interface StafPapan { id: string; nama: string; state: BoardState; menitTelat: number | null; jam: string | null }
export interface PapanOutlet { outlet: OutletAbsensi; ringkas: BoardSummary; staf: StafPapan[] }
export interface RekapStafBaris { staffId: string; hariHadir: number; telat: number; telatToleransi: number; menitTelat: number }
export interface StafOutlet { id: string; nama: string }
export interface CutiBaris { nama: string; outletId: string | null; jenis: string; mulai: string; selesai: string; hari: number; status: 'pending' | 'approved' | 'rejected' }
export interface KasbonOutlet { outletId: string; menungguJumlah: number; menungguNominal: number; aktifJumlah: number; aktifSisa: number }
export interface CeklistOutlet { outlet: OutletAbsensi; laporan: null | { namaAm: string; nilai: 'baik' | 'perhatian' | 'buruk' | null; jumlahTemuan: number; ditinjau: boolean } }
export interface KonteksAbsensi {
  hariIni: string
  sekarang: Date
  outlets(): Promise<OutletAbsensi[]>
  papan(tanggal: string): Promise<PapanOutlet[]>
  stafPerOutlet(): Promise<Map<string, StafOutlet[]>>
  rekapStaf(dari: string, sampai: string): Promise<RekapStafBaris[]>
  cuti(): Promise<CutiBaris[]>
  kasbon(): Promise<KasbonOutlet[]>
  ceklist(tanggal: string): Promise<CeklistOutlet[]>
}
