'use client'

import { PackageCheck, ArrowRight } from 'lucide-react'
import { getCrossAppUrl } from '@/lib/navigation'

/**
 * Layar "Terima PO Bahan Supplier" DIPENSIUNKAN 16 September 2026.
 *
 * Alasannya bukan sekadar merapikan menu: layar itu TIDAK PERNAH menulis apa
 * pun. verifikasi_terima_po mencari baris item lewat `poi.id`, sementara
 * payload-nya hanya mengirim bahan_baku_id -- setiap item dilewati, lalu
 * fungsinya tetap mengembalikan success:true. Toast hijau, nol efek.
 * Dibuktikan langsung ke DB live dengan kontrol positif.
 *
 * Diperbaiki lalu dihidupkan? Tidak. Seluruh penerimaan PO 60 hari terakhir
 * (32 PO) dikerjakan SATU orang lewat app Stok, yang layarnya memang bekerja.
 * Menghidupkan pintu kedua untuk pekerjaan yang sama justru mengundang
 * penerimaan DOBEL -- persis kekeliruan yang ditemukan hari itu juga
 * (KULIT 32 dan TEPUNG). Satu pekerjaan, satu pintu.
 *
 * Halaman ini sengaja tidak dihapus: kalau ada yang menyimpan tautannya, lebih
 * baik ia mendarat di penunjuk arah daripada di layar rusak atau 404.
 */
export default function TerimaBahanPage() {
  return (
    <div className="max-w-md mx-auto px-5 py-16 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-suka-cream flex items-center justify-center text-suka-orange">
        <PackageCheck size={26} />
      </div>
      <h1 className="mt-5 text-lg font-extrabold text-suka-brown">
        Terima PO pindah ke aplikasi Stok
      </h1>
      <p className="mt-2 text-sm font-medium text-suka-gray-500 leading-relaxed">
        Pencatatan barang masuk dari supplier kini hanya lewat satu pintu, supaya
        satu kiriman tidak pernah tercatat dua kali.
      </p>
      <a
        href={getCrossAppUrl('/stok/penerimaan-po')}
        className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-suka-orange text-white text-xs font-extrabold uppercase tracking-wider shadow-md shadow-suka-orange/25 active:scale-95 transition-all"
      >
        Buka Penerimaan PO <ArrowRight size={15} />
      </a>
    </div>
  )
}
