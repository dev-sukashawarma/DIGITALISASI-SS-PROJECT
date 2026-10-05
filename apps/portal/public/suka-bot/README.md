Aset avatar SUKA Bot — HASIL OLAHAN SKRIP, jangan diedit tangan.

- `<klip>.webm`: WebM VP9 transparan, 24 fps (Chrome/Edge/Firefox/Android).
- `<klip>.anim.webp`: WebP beranimasi transparan, 12 fps (iPhone/iPad & Safari).
- `<klip>.webp`: gambar diam transparan (mode tanpa animasi, hemat data, gagal putar).

Klip: diam & berpikir (berulang), rekap, bingung, sapa (sekali putar).

Mengolah ulang (dari root repo, video mentah dari Drive tim disalin ke
docs/aset/suka-bot/ dulu):

    python scripts/suka-bot/olah_klip.py

Skrip juga menulis `src/components/sukaBot/avatar/klip.gen.ts` (URL bersidik + RASIO).
Membuat klip baru: docs/aset/suka-bot/PANDUAN-KLIP-ANIMASI.md.
