'use client'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'

const SYSTEMS = [
  { code: 'absensi', name: 'Sistem Absensi', desc: 'Panduan Karyawan & Kiosk Face Recognition' },
  { code: 'pos', name: 'Sistem POS (Kasir)', desc: 'Panduan Kasir, Transaksi, dan Void' },
  { code: 'stok', name: 'Sistem Stok & Opname', desc: 'Panduan Manajemen Bahan Baku & PO' },
  { code: 'distribusi', name: 'Sistem Distribusi', desc: 'Panduan Surat Jalan dan Pengiriman Barang' },
]

export default function PanduanIndexPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-extrabold text-suka-ink">Panduan Sistem</h2>
        <p className="text-sm text-gray-500">Pilih modul di bawah ini untuk melihat atau mengedit konten panduan pengguna.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {SYSTEMS.map((sys) => (
          <Link
            key={sys.code}
            href={`/dashboard/panduan/${sys.code}`}
            className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-suka-gray-100 shadow-sm hover:shadow-md hover:border-suka-orange/30 transition-all group"
          >
            <div className="p-3 rounded-xl bg-suka-orange/10 text-suka-orange group-hover:bg-suka-orange group-hover:text-white transition-colors">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="font-bold text-suka-ink">{sys.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{sys.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
