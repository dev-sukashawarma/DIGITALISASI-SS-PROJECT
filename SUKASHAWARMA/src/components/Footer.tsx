

const footerLinks = {
  Menu: [
    { label: "Original Shawarma Ayam", href: "/menu" },
    { label: "Original Shawarma Sapi", href: "/menu" },
    { label: "Original Shawarma Mix", href: "/menu" },
    { label: "Suka Suka", href: "/menu" },
    { label: "Shawarmie", href: "/menu" },
    { label: "Minuman", href: "/menu" },
  ],
  Lokasi: [
    { label: "Bogor", href: "/locations" },
    { label: "Depok", href: "/locations" },
    { label: "Jakarta", href: "/locations" },
    { label: "Bekasi", href: "/locations" },
    { label: "Tangerang Selatan", href: "/locations" },
  ],
  Kemitraan: [
    { label: "Program Kemitraan", href: "/kemitraan" },
    { label: "Ajukan Kemitraan", href: "/kemitraan#ajukan" },
    { label: "FAQ Kemitraan", href: "/kemitraan#faq" },
  ],
  Pesan: [
    { label: "Pesan Sekarang", href: "https://order.sukashawarma.com/" },
    { label: "GoFood", href: "https://gofood.co.id" },
    { label: "GrabFood", href: "https://grab.com" },
    { label: "ShopeeFood", href: "https://shopee.co.id/food" },
  ],
};

const contactInfo = {
  website: { label: "sukashawarma.com", href: "https://sukashawarma.com" },
  alamat:
    "Jalan Bukit Nirwana Raya No. 3, Desa/Kelurahan Mulya Harja, Kec. Bogor Selatan, Kota Bogor, Provinsi Jawa Barat 16135",
  email: "ptsukashawarma@gmail.com",
  telepon: "0818-0454-1031",
};

export default function Footer() {
  return (
    <footer id="contact" className="bg-gradient-to-b from-[#FAF7F2] to-[#f0e9df] border-t border-black/[0.06]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">

        {/* Top — logo + tagline */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12 pb-12 border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
            <img
              src="/sslogonew.png"
              alt="Suka Shawarma"
              width={40}
              height={40}
              className="object-contain"
            />
            <div>
              <p className="font-bold text-[#6E1A10] text-base tracking-wide">
                Suka Shawarma
              </p>
              <p className="text-xs text-[#111111]/40 mt-0.5">
                PT Suka Profit Berkah
              </p>
            </div>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-12">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-[#111111] mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => {
                  const isExternal = link.href.startsWith("http");
                  return (
                    <li key={link.label}>
                      {isExternal ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#111111]/55 hover:text-[#6E1A10] transition-colors duration-200"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <a
                          href={link.href}
                          className="text-sm text-[#111111]/55 hover:text-[#6E1A10] transition-colors duration-200"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Kontak */}
          <div>
            <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-[#111111] mb-4">
              Kontak
            </h4>
            <ul className="space-y-2.5 text-sm text-[#111111]/55">
              <li>
                <a
                  href={contactInfo.website.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#6E1A10] transition-colors duration-200"
                >
                  {contactInfo.website.label}
                </a>
              </li>
              <li className="leading-relaxed">{contactInfo.alamat}</li>
              <li>
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="hover:text-[#6E1A10] transition-colors duration-200"
                >
                  {contactInfo.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:+62${contactInfo.telepon.replace(/\D/g, "").slice(1)}`}
                  className="hover:text-[#6E1A10] transition-colors duration-200"
                >
                  {contactInfo.telepon}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-black/[0.06]">
          <p className="text-xs text-[#111111]/40 text-center md:text-left">
            © {new Date().getFullYear()} Suka Shawarma. Seluruh hak dilindungi.
          </p>

        </div>
      </div>
    </footer>
  );
}
