
export default function KemitraanFooter() {
  return (
    <footer className="bg-[#111111] py-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center
                        justify-between gap-8 mb-8 pb-8 border-b border-white/10">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img
              src="/sslogonew.png"
              alt="SukaShawarma"
              width={40}
              height={40}
              className="object-contain"
            />
            <div>
              <p className="font-bold text-white text-base">SukaShawarma</p>
              <p className="text-white/40 text-xs mt-0.5">Tersertifikasi Halal MUI</p>
            </div>
          </div>

          {/* Social */}
          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/6282299325621"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/60 hover:text-white
                         text-sm transition-colors duration-200"
              aria-label="WhatsApp"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
              </svg>
              WhatsApp
            </a>
            <a
              href="https://instagram.com/sukashawarma"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/60 hover:text-white
                         text-sm transition-colors duration-200"
              aria-label="Instagram"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
              Instagram
            </a>
          </div>
        </div>

        <p className="text-white/30 text-xs text-center">
          © 2024–2026 SUKA Shawarma — Kemitraan F&amp;B Jabodetabek. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
