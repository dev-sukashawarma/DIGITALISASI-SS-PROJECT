# Suka Shawarma "Playful" Design System

Dokumen ini berisi panduan teknis dan referensi gaya untuk menerapkan tema **"Playful"** (seperti yang digunakan di SukaFinance) ke halaman-halaman lain di ekosistem Suka Shawarma.

---

## 1. Filosofi Desain & Skill Referensi

Desain ini menggabungkan kesan profesional dari sistem finansial dengan elemen yang lebih hidup (*playful*), interaktif, dan modern. Untuk hasil yang maksimal, agen AI harus mengaktifkan/merujuk pada **Skills** berikut saat melakukan rombakan:

1. **`apple-design`**: Untuk penggunaan efek tembus pandang (*translucency* / `backdrop-blur-xl`), kedalaman tata letak (*shadows*), serta animasi fisika pegas (*spring animations*).
2. **`emil-design-eng`**: Untuk memoles *micro-animations*, efek *hover*, dan transisi antar-elemen yang mulus (seperti tombol yang mengecil saat ditekan dengan `active:scale-95`).
3. **`ui-styling`**: Untuk fondasi utilitas Tailwind CSS, tata letak *grid/flex*, palet warna spesifik Suka Shawarma, serta tipografi *rounded* dan *display*.

---

## 2. Palet Warna (Suka Colors)

Gunakan utilitas warna Tailwind yang sudah ada di repositori:
- **Primary / Dark**: `bg-suka-ink`, `text-suka-ink` (untuk *sidebar* utama dan judul kontras).
- **Brand Brown**: `bg-suka-brown`, `text-suka-brown` (untuk judul halaman, aksi utama, teks dominan).
- **Brand Orange**: `bg-suka-orange`, `text-suka-orange` (untuk aksen, *badge*, ikon penanda).
- **Background / Cream**: `bg-[#FDF9F3]`, `bg-suka-cream` (sebagai warna dasar *body* aplikasi).

---

## 3. Tipografi

Aplikasi menggunakan perpaduan antara font sans-serif untuk pembacaan dan font *display* untuk judul yang menonjol.

**Page Headers (Judul Halaman Utama):**
```tsx
<div>
  <p className="text-suka-orange font-bold uppercase tracking-wider text-sm mb-1">
    Sub-judul / Konteks
  </p>
  <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide flex items-center gap-3">
    <Icon className="w-10 h-10 text-suka-orange" />
    Judul Halaman
  </h1>
  <p className="text-suka-ink/60 mt-2 font-medium">
    Deskripsi singkat atau panduan halaman.
  </p>
</div>
```

**Tabel Data:**
- **Header Tabel**: `text-left text-sm font-semibold text-suka-gray-500 bg-suka-cream/20 border-b border-suka-brown/5`.
- **Isi Tabel**: `text-sm font-medium text-suka-ink` (hindari penggunaan `font-black` atau teks terlalu kecil seperti `text-[10px]` untuk konten tabel biasa agar tidak terlihat padat/kaku).

---

## 4. Struktur Tata Letak (Layouts & Cards)

Hindari garis keras dan sudut tajam. Gunakan lengkungan yang besar (`rounded-3xl`) dan efek kaca (*glassmorphism*).

**Main Wrapper (Latar Belakang):**
```tsx
<div className="bg-[#FDF9F3] min-h-screen">...</div>
```

**Floating Section Cards (Kartu Konten / Tabel):**
Digunakan sebagai wadah kontainer daftar, formulir, atau detail data.
```tsx
<div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden p-6">
  {/* Konten... */}
</div>
```

**Badges / Status Pills (Ringan & Modern):**
```tsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 font-medium text-xs rounded-lg border border-emerald-200/80">
  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Disetujui
</span>
```

---

## 5. Animasi (Framer Motion)

Semua halaman baru harus menerapkan *Framer Motion* untuk memberikan kesan *playful* yang halus.

**Staggered List (Muncul Beruntun untuk Baris Tabel / Grid):**
Bungkus elemen induk dengan `motion.div` atau `motion.tbody`:
```tsx
<motion.tbody
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.05 } },
    hidden: {},
  }}
>
  {/* Children harus berupa motion component */}
</motion.tbody>
```

**Item Muncul (*Spring Reveal*):**
Gunakan varian ini pada anak (baris/kartu):
```tsx
<motion.tr
  variants={{
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  }}
  className="hover:bg-orange-50/30 transition-colors group"
>
  {/* Sel Tabel */}
</motion.tr>
```

**Micro-interactions:**
- **Tombol / Aksi**: Selalu gunakan kombinasi `hover:scale-105`, `active:scale-95`, dan `transition-all`.
- **Ikon pada Teks / Sel**: Tambahkan `group-hover:text-suka-orange group-hover:scale-105 transition-transform origin-left`.
