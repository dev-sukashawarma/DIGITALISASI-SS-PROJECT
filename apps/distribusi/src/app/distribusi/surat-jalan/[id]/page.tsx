import Link from 'next/link';

export default function SuratJalanDetailPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/distribusi/surat-jalan" className="text-blue-600 hover:underline">
          ← Kembali
        </Link>
        <h1 className="text-3xl font-bold">Detail Surat Jalan</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Memuat...</p>
      </div>
    </div>
  );
}
