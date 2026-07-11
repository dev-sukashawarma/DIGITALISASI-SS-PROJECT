import Link from 'next/link'

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold text-suka-brown">Suka Finance — Treasury</h1>
      <p className="mt-2 text-suka-gray-500">
        Fondasi P1 aktif. Modul disbursement (gaji, supplier, rekonsiliasi kas) menyusul di P2–P4.
      </p>
      
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-suka-brown mb-4">Quick Links</h2>
        <div className="flex gap-4">
          <Link 
            href="/leader"
            className="px-4 py-2 bg-suka-orange text-white rounded-md hover:bg-orange-600 transition-colors font-medium inline-block"
          >
            Masuk ke Leader Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
