import Link from 'next/link';

export default function SuratJalanListPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Surat Jalan</h1>
        <Link
          href="/distribusi/surat-jalan/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Buat Surat Jalan
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Belum ada Surat Jalan</p>
        <p className="text-sm text-gray-400 mt-2">0 draft · 0 sedang dikirim</p>
      </div>
    </div>
  );
}
