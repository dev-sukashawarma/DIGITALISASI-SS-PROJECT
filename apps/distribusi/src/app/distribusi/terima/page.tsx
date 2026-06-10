import Link from 'next/link';

export default function TerimaListPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Penerimaan Barang</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Belum ada kiriman</p>
      </div>
    </div>
  );
}
