/**
 * Menggeser area scroll supaya sebuah elemen (mis. kotak kamera absen) berada di
 * tengah bagian layar yang BENAR-BENAR terlihat: di bawah header, di atas bottom nav,
 * dan di dalam visual viewport (toolbar Safari iOS ikut memotong layar).
 * `scrollIntoView({ block: "center" })` tidak tahu soal bottom nav yang `fixed`, jadi
 * hasilnya meleset setinggi nav.
 */

export type Rentang = { top: number; bottom: number };

/** Jarak (px) yang tak perlu dikoreksi — mencegah layar bergeser-geser untuk selisih kecil. */
export const TOLERANSI_TENGAH_PX = 24;
/** Ruang di atas elemen bila elemen lebih tinggi dari area terlihat. */
const RUANG_ATAS_PX = 8;

/**
 * Selisih scroll (px, positif = gulir ke bawah) agar `el` berada di tengah `view`.
 * Elemen yang lebih tinggi dari area terlihat diratakan ke atas, supaya bagian
 * atasnya (wajah) tidak terpotong. 0 bila posisinya sudah cukup tengah.
 */
export function hitungGeserTengah(el: Rentang, view: Rentang, toleransi = TOLERANSI_TENGAH_PX): number {
  const tinggiEl = el.bottom - el.top;
  const tinggiView = view.bottom - view.top;
  if (tinggiView <= 0) return 0;

  const geser = tinggiEl > tinggiView
    ? el.top - (view.top + RUANG_ATAS_PX)
    : (el.top + el.bottom) / 2 - (view.top + view.bottom) / 2;

  return Math.abs(geser) <= toleransi ? 0 : Math.round(geser);
}

function cariIndukScroll(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === "auto" || overflowY === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Area yang terlihat user: irisan induk scroll, visual viewport, dan di atas bottom nav. */
function areaTerlihat(induk: HTMLElement | null): Rentang {
  const vv = window.visualViewport;
  let top = vv ? vv.offsetTop : 0;
  let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;

  if (induk) {
    const r = induk.getBoundingClientRect();
    top = Math.max(top, r.top);
    bottom = Math.min(bottom, r.bottom);
  }

  // Bottom nav mobile menandai dirinya dengan data-bottom-nav (lihat dashboard/layout).
  const nav = document.querySelector<HTMLElement>("[data-bottom-nav]");
  // getClientRects, bukan offsetParent: elemen `position: fixed` selalu ber-offsetParent null.
  // Kosong = nav tersembunyi (display:none di desktop, lg:hidden).
  if (nav && nav.getClientRects().length > 0) {
    const r = nav.getBoundingClientRect();
    if (r.height > 0 && r.top < bottom) bottom = Math.max(top, r.top);
  }
  return { top, bottom };
}

/** Pusatkan `el` di layar. Mengembalikan true bila layar benar-benar digeser. */
export function pusatkanDiLayar(el: HTMLElement): boolean {
  const induk = cariIndukScroll(el);
  const r = el.getBoundingClientRect();
  const geser = hitungGeserTengah({ top: r.top, bottom: r.bottom }, areaTerlihat(induk));
  if (geser === 0) return false;

  const halus = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const opsi: ScrollToOptions = { top: geser, behavior: halus ? "smooth" : "auto" };
  if (induk) induk.scrollBy(opsi);
  else window.scrollBy(opsi);
  return true;
}
