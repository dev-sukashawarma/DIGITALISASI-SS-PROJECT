"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { menuItems, CATEGORY_LABELS, CATEGORY_ORDER, type MenuCategory, type MenuItem } from "@/data/menu";

declare const gtag: (...args: unknown[]) => void;

const WA_NUMBER = "6282299325621";
const MIN_PCS = 50;
const DRINK_CATEGORY: MenuCategory = "minuman";
const DISCOUNT_RATE = 0.15;

// Grid halaman utama hanya menu shawarma — minuman dipilih di keranjang saat Paket B
const GRID_CATEGORIES: MenuCategory[] = CATEGORY_ORDER.filter(
  (c) => c !== "best-seller" && c !== DRINK_CATEGORY
);
const drinkItems = menuItems.filter((i) => i.category === DRINK_CATEGORY);

const formatIDR = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

function priceInfo(items: MenuItem[], qty: Record<string, number>) {
  let subtotal = 0;
  let hasMissing = false;
  for (const item of items) {
    const q = qty[item.id] ?? 0;
    if (q <= 0) continue;
    if (item.price == null) {
      hasMissing = true;
      continue;
    }
    subtotal += item.price * q;
  }
  return { subtotal, hasMissing };
}

const IconCart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

function QtyControl({
  id,
  name,
  count,
  onChange,
  size = "md",
  max = Infinity,
}: {
  id: string;
  name: string;
  count: number;
  onChange: (id: string, next: number) => void;
  size?: "sm" | "md";
  max?: number;
}) {
  const btnDim = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const inputW = size === "sm" ? "w-10" : "w-12";
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => onChange(id, Math.max(0, count - 1))}
        aria-label={`Kurangi ${name}`}
        disabled={count === 0}
        className={`${btnDim} rounded-full border border-black/[0.12] text-[#111111]/60 flex items-center justify-center hover:bg-black/[0.04] disabled:opacity-30 transition-colors shrink-0`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={String(count)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(id, digits === "" ? 0 : Math.max(0, parseInt(digits, 10)));
        }}
        aria-label={`Jumlah ${name}`}
        className={`${inputW} text-center font-bold text-sm text-[#111111] bg-transparent border border-transparent hover:border-black/[0.12] focus:border-[#FE7108] focus:outline-none rounded-md py-1`}
      />
      <button
        type="button"
        onClick={() => onChange(id, count + 1)}
        aria-label={`Tambah ${name}`}
        disabled={count >= max}
        className={`${btnDim} rounded-full bg-[#FE7108] text-white flex items-center justify-center hover:bg-[#e56507] disabled:opacity-30 transition-colors shrink-0`}
      >
        +
      </button>
    </div>
  );
}

export default function PaketOrderExperience() {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [paket, setPaket] = useState<"A" | "B" | null>(null);

  const setQtyExact = (id: string, next: number) => {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, next) }));
  };

  // Minuman wajib mengikuti total shawarma (1:1) — jumlah antar rasa dibatasi
  // supaya totalnya tidak pernah melebihi jumlah shawarma yang dipesan.
  const setDrinkQty = (id: string, next: number) => {
    setQty((prev) => {
      const otherTotal = drinkItems
        .filter((d) => d.id !== id)
        .reduce((sum, d) => sum + (prev[d.id] ?? 0), 0);
      const shawarma = menuItems
        .filter((i) => i.category !== DRINK_CATEGORY)
        .reduce((sum, i) => sum + (prev[i.id] ?? 0), 0);
      const capped = Math.min(Math.max(0, next), Math.max(0, shawarma - otherTotal));
      return { ...prev, [id]: capped };
    });
  };

  const shawarmaTotal = useMemo(
    () =>
      menuItems
        .filter((i) => i.category !== DRINK_CATEGORY)
        .reduce((sum, i) => sum + (qty[i.id] ?? 0), 0),
    [qty]
  );
  const drinkTotal = useMemo(
    () => drinkItems.reduce((sum, i) => sum + (qty[i.id] ?? 0), 0),
    [qty]
  );
  const cartCount = shawarmaTotal + drinkTotal;

  // Bar keranjang full-width menempel di bawah — kasih ruang biar tidak menutupi footer
  useEffect(() => {
    document.body.style.paddingBottom = cartCount > 0 && !cartOpen ? "72px" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [cartCount, cartOpen]);

  // Kalau total shawarma berkurang, potong kelebihan minuman supaya tidak pernah melebihi
  useEffect(() => {
    if (drinkTotal > shawarmaTotal) {
      let remaining = shawarmaTotal;
      setQty((prev) => {
        const next = { ...prev };
        for (const d of drinkItems) {
          const current = next[d.id] ?? 0;
          const take = Math.min(current, remaining);
          next[d.id] = take;
          remaining -= take;
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shawarmaTotal]);
  const selectedShawarma = useMemo(
    () => menuItems.filter((i) => i.category !== DRINK_CATEGORY && (qty[i.id] ?? 0) > 0),
    [qty]
  );

  const shawarmaPrice = useMemo(() => priceInfo(selectedShawarma, qty), [selectedShawarma, qty]);
  const drinkPrice = useMemo(() => priceInfo(drinkItems, qty), [qty]);
  const includeDrinks = paket === "B";
  const grandSubtotal = shawarmaPrice.subtotal + (includeDrinks ? drinkPrice.subtotal : 0);
  const hasMissingPrice = shawarmaPrice.hasMissing || (includeDrinks && drinkPrice.hasMissing);
  const qualifiesForDiscount = shawarmaTotal >= MIN_PCS;
  const grandAfterDiscount = qualifiesForDiscount ? grandSubtotal * (1 - DISCOUNT_RATE) : grandSubtotal;

  const buildMessage = () => {
    const lines = [
      `Halo Suka Shawarma, saya mau pesan Paket Acara.`,
      ``,
      `Menu:`,
      ...selectedShawarma.map((i) => `- ${i.name} x${qty[i.id]}`),
    ];
    if (paket === "B" && drinkTotal > 0) {
      const selectedDrinks = drinkItems.filter((i) => (qty[i.id] ?? 0) > 0);
      lines.push(``, `Minuman:`, ...selectedDrinks.map((i) => `- ${i.name} x${qty[i.id]}`));
    }
    lines.push(
      ``,
      `Total Shawarma: ${shawarmaTotal} pcs`,
      `Paket: ${paket === "A" ? "A (Shawarma saja)" : `B (Total Minuman: ${drinkTotal} pcs)`}`
    );
    if (!hasMissingPrice && grandSubtotal > 0) {
      lines.push(
        qualifiesForDiscount
          ? `Estimasi Total (setelah diskon 15%): ${formatIDR(grandAfterDiscount)}`
          : `Estimasi Total: ${formatIDR(grandSubtotal)}`
      );
    }
    lines.push(``, `Mohon info ketersediaan tanggal dan konfirmasi total harga. Terima kasih.`);
    return lines.join("\n");
  };

  const handleSend = () => {
    if (typeof gtag !== "undefined") {
      gtag("event", "conversion", {
        send_to: "AW-11522229721/18NOCPO46eYcENmLnfYq",
        value: 1.0,
        currency: "IDR",
      });
    }
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {/* ─── Menu grid ─────────────────────────────────────────────── */}
      <section id="menu-paket" className="py-14 lg:py-24 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-3">
              Bebas Pilih Menu
            </p>
            <h2 className="font-bold text-3xl md:text-4xl tracking-tight text-[#111111] mb-4">
              Susun Pesanan Kamu
            </h2>
            <p className="text-[#111111]/60 max-w-lg mx-auto mb-4">
              Atur jumlah tiap menu sesuka hati, mau 10, 20, atau lebih juga bebas. Pesan 50 pcs shawarma ke atas otomatis dapat diskon 15%.
            </p>
            <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[#111111]/45">
              <span><span className="font-semibold text-[#111111]/70">Paket A</span> tanpa minuman</span>
              <span className="text-[#111111]/25">•</span>
              <span><span className="font-semibold text-[#111111]/70">Paket B</span> dengan minuman</span>
              <span className="text-[#111111]/25">•</span>
              <span>pilih minuman di keranjang saat checkout</span>
            </p>
          </div>

          {GRID_CATEGORIES.map((cat) => {
            const items = menuItems.filter((i) => i.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="mb-14 last:mb-0">
                <h3 className="font-bold text-xl text-[#111111] mb-5">{CATEGORY_LABELS[cat]}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
                  {items.map((item) => {
                    const count = qty[item.id] ?? 0;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-layered-sm border border-black/[0.05]"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-[#FAF7F2]">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          {item.isBestSeller && (
                            <div className="absolute top-2.5 left-2.5 bg-[#FFC500] text-[#111111] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
                              Best Seller
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col flex-1 p-3.5">
                          <h4 className="font-bold text-[#111111] text-xs tracking-wide uppercase leading-snug mb-1">
                            {item.name}
                          </h4>
                          <p className="text-xs text-[#111111]/45 mb-3">
                            {item.price ? formatIDR(item.price) : "Harga menyusul"}
                          </p>
                          <div className="mt-auto flex items-center justify-between">
                            <QtyControl id={item.id} name={item.name} count={count} onChange={setQtyExact} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Floating cart button ──────────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && !cartOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={() => setCartOpen(true)}
            aria-label={`Buka keranjang, ${cartCount} pcs dipilih`}
            className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between
                       px-5 sm:px-8 py-4
                       bg-[#6E1A10] text-white shadow-[0_-4px_24px_rgba(0,0,0,0.18)]
                       hover:bg-[#5a1509] transition-colors duration-150"
          >
            <div className="flex items-center gap-3">
              <IconCart />
              <span className="w-px h-6 bg-white/25" />
              <span className="min-w-[24px] h-6 px-1.5 flex items-center justify-center
                                rounded-full bg-[#FE7108] text-white text-xs font-bold leading-none">
                {cartCount}
              </span>
            </div>
            <IconChevronRight />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Cart / checkout modal ─────────────────────────────────── */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/50"
              onClick={() => setCartOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-[#111111]">Keranjang Pesanan</h3>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  aria-label="Tutup keranjang"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#111111]/50 hover:bg-black/[0.05] transition-colors"
                >
                  <IconClose />
                </button>
              </div>

              {selectedShawarma.length === 0 ? (
                <p className="text-sm text-[#111111]/50 text-center py-10">Belum ada menu dipilih.</p>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-xs font-semibold tracking-widest uppercase text-[#111111]/40 mb-2">Menu</p>
                    <div className="space-y-3 max-h-44 overflow-y-auto pr-1">
                      {selectedShawarma.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="text-[#111111] truncate">{item.name}</p>
                            <p className="text-xs text-[#111111]/40">
                              {item.price ? formatIDR(item.price) : "Harga menyusul"}
                            </p>
                          </div>
                          <QtyControl id={item.id} name={item.name} count={qty[item.id] ?? 0} onChange={setQtyExact} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between font-semibold text-[#111111] border-t border-black/[0.08] pt-3 mb-5 text-sm">
                    <span>Total Shawarma</span>
                    <span>{shawarmaTotal} pcs</span>
                  </div>

                  {shawarmaTotal < MIN_PCS && (
                    <p className="text-xs text-[#FE7108] text-center mb-3 font-medium">
                      Tambah {MIN_PCS - shawarmaTotal} pcs lagi buat dapat diskon 15%
                    </p>
                  )}
                  <>
                      <p className="text-sm font-semibold text-[#111111] mb-3">Pilih Paket</p>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {(["A", "B"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPaket(p)}
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold border text-left transition-colors duration-150 ${
                              paket === p
                                ? "bg-[#6E1A10] border-[#6E1A10] text-white"
                                : "bg-white border-black/[0.1] text-[#111111]/70 hover:border-black/20"
                            }`}
                          >
                            <span className="block">Paket {p}</span>
                            <span className={`block text-xs font-normal mt-1 ${paket === p ? "text-white/70" : "text-[#111111]/45"}`}>
                              {p === "A" ? "Tanpa minuman" : "Dengan minuman"}
                            </span>
                          </button>
                        ))}
                      </div>

                      {paket === "B" && (
                        <div className="mt-4 mb-2 rounded-xl bg-[#FAF7F2] p-4">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-[#111111]">Pilih Minuman</p>
                            <span className={`text-xs font-semibold ${drinkTotal === shawarmaTotal ? "text-emerald-600" : "text-red-600"}`}>
                              {drinkTotal} / {shawarmaTotal} pcs
                            </span>
                          </div>
                          <p className="text-xs text-[#111111]/45 mb-3">
                            Wajib total {shawarmaTotal} pcs (1:1 dengan shawarma), bebas campur rasa.
                          </p>
                          <div className="space-y-3">
                            {drinkItems.map((item) => {
                              const otherTotal = drinkTotal - (qty[item.id] ?? 0);
                              const remaining = Math.max(0, shawarmaTotal - otherTotal);
                              return (
                                <div key={item.id} className="flex items-center gap-3 text-sm">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-12 h-12 rounded-lg object-cover shrink-0 bg-white"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[#111111] truncate">{item.name}</p>
                                    <p className="text-xs text-[#111111]/40">
                                      {item.price ? formatIDR(item.price) : "Harga menyusul"}
                                    </p>
                                  </div>
                                  <QtyControl
                                    id={item.id}
                                    name={item.name}
                                    count={qty[item.id] ?? 0}
                                    onChange={setDrinkQty}
                                    max={remaining + (qty[item.id] ?? 0)}
                                    size="sm"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          {drinkTotal !== shawarmaTotal && (
                            <p className="text-xs text-red-600 mt-3 font-medium">
                              Wajib pilih tepat {shawarmaTotal} pcs minuman (saat ini {drinkTotal}, kurang {shawarmaTotal - drinkTotal}).
                            </p>
                          )}
                        </div>
                      )}
                      {paket === "A" && drinkTotal > 0 && (
                        <p className="text-xs text-amber-600 mb-2">
                          Minuman tidak berlaku untuk Paket A dan akan diabaikan.
                        </p>
                      )}

                      {paket && (
                        <div className="border-t border-black/[0.08] pt-3 mt-4 mb-5 text-sm">
                          {!hasMissingPrice && grandSubtotal > 0 ? (
                            qualifiesForDiscount ? (
                              <>
                                <div className="flex justify-between text-[#111111]/60">
                                  <span>Subtotal</span>
                                  <span>{formatIDR(grandSubtotal)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-[#111111] mt-1">
                                  <span>Setelah diskon 15%</span>
                                  <span>{formatIDR(grandAfterDiscount)}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex justify-between font-bold text-[#111111]">
                                <span>Total</span>
                                <span>{formatIDR(grandSubtotal)}</span>
                              </div>
                            )
                          ) : (
                            <p className="text-xs text-[#111111]/40">
                              Harga sebagian menu belum tersedia, total final dikonfirmasi tim kami.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mb-5 rounded-xl bg-[#FAF7F2] border border-black/[0.06] p-4">
                        <p className="text-sm font-semibold text-[#111111] mb-3">Ketentuan Pemesanan</p>
                        <div className="space-y-3 text-xs text-[#111111]/65 leading-relaxed">
                          <div>
                            <p className="font-semibold text-[#111111] mb-1">Pembayaran</p>
                            <p>Pesan H-3: DP 50% di awal, lunas H-1. Pesan H-1: langsung lunas. Order diterima 13.00–20.00 WIB.</p>
                          </div>
                          <div>
                            <p className="font-semibold text-[#111111] mb-1">Pembatalan</p>
                            <p>Batal H-2: DP dipotong 25%. Batal H-1: DP hangus. Tanggal acara tidak bisa diubah setelah dikonfirmasi.</p>
                          </div>
                          <div>
                            <p className="font-semibold text-[#111111] mb-1">Ongkir</p>
                            <p>5–10 km: Rp 50.000 · 10–15 km: Rp 100.000 · 15–20 km: Rp 150.000. Lebih dari 20 km hubungi kami langsung.</p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!paket || (paket === "B" && drinkTotal !== shawarmaTotal)}
                        onClick={handleSend}
                        className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full
                                   bg-[#25D366] text-white font-semibold text-sm min-h-[48px]
                                   hover:bg-[#1ebe5d] transition-colors duration-200
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L0 24l6.335-1.502A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.792 9.792 0 0 1-5.002-1.373l-.359-.213-3.72.882.939-3.618-.234-.372A9.792 9.792 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z" />
                        </svg>
                        Kirim Pesanan via WhatsApp
                      </button>
                      {!paket ? (
                        <p className="text-xs text-red-600 mt-2 text-center">Pilih Paket A atau B dulu.</p>
                      ) : paket === "B" && drinkTotal !== shawarmaTotal ? (
                        <p className="text-xs text-red-600 mt-2 text-center">
                          Lengkapi minuman jadi {shawarmaTotal} pcs dulu.
                        </p>
                      ) : null}
                      <p className="text-center text-xs text-[#111111]/40 mt-3">
                        Harga di atas belum termasuk ongkir, lihat Ketentuan Pemesanan.
                      </p>
                    </>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
