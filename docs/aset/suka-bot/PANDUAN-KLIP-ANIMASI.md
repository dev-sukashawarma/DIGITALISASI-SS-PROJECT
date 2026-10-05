# Panduan Klip Animasi SUKA Bot

Bahan untuk tim yang membuat klip video avatar SUKA Bot memakai alat AI
image-to-video (Kling, Veo, Runway, atau sejenisnya). Gambar sumber:
`chefss.jpeg` di folder ini.

Klip yang sudah jadi taruh di folder ini juga, dengan **nama berkas persis**
seperti di tabel. Pemotongan, pembuangan latar hijau, dan pengecilan ukuran
dikerjakan developer. Tim cukup menyerahkan video mentahnya.

---

## 1. Aturan yang berlaku untuk SEMUA klip

Aturan ini yang membuat klip bisa disambung mulus satu sama lain di aplikasi.
Kalau satu dilanggar, perpindahan antar pose akan terlihat "loncat".

| # | Aturan | Kenapa |
|---|---|---|
| 1 | **Frame awal DAN frame akhir = `chefss.jpeg`.** Di Kling/Runway isi kolom *start frame* dan *end frame* dengan gambar yang sama. Kalau alatnya hanya punya *start frame*, tetap tulis di prompt bahwa dia kembali ke pose awal. | Semua klip mulai dan selesai di pose yang sama, jadi bisa diulang tanpa sambungan dan bisa berganti pose kapan saja. |
| 2 | **Kamera diam.** Tanpa zoom, geser, atau goyang. | Avatar dipotong sebatas dada. Kalau kamera bergerak, wajahnya keluar potongan. |
| 3 | **Latar hijau polos tetap sama** dari awal sampai akhir, tanpa bayangan baru, tanpa benda lain. | Latar hijau dibuang otomatis. Bayangan atau benda tambahan ikut jadi belang. |
| 4 | **Karakter tetap di tengah dan seukuran aslinya.** Tidak berjalan, tidak mendekat ke kamera. | Sama dengan nomor 2. |
| 5 | **Wajah, janggut, topi, dan celemek harus sama persis** dengan gambar sumber. | Konsistensi karakter antar klip. |
| 6 | **Durasi 5 detik** (khusus `diam.mp4` **10 detik** bila alatnya bisa), resolusi minimal 720p (1080p lebih baik), **tanpa audio, tanpa teks, tanpa watermark.** Kalau pilihan durasi alat tidak pas (Veo ±8 detik), pilih yang lebih panjang: kelebihan bisa dipotong, kekurangan tidak bisa ditambah. | `diam` diputar paling lama, jadi pengulangan 5 detik cepat terasa. Paket gratis biasanya menambah watermark yang tidak bisa dibuang, jadi pakai akun berbayar atau unduh versi tanpa watermark. |
| 7 | **Gerakan pelan dan jelas.** Hindari gerakan cepat atau tangan keluar bingkai. | Di layar avatar hanya sebesar 56 px. Gerakan kecil yang cepat tidak akan terbaca, gerakan besar yang pelan terbaca. |

**Kalimat penutup** yang ditempel di akhir SETIAP prompt:

```
Static locked-off camera, no zoom, no pan. Solid flat chroma-key green background that stays identical for the whole clip, no new shadows. The character stays centered at the same size and returns exactly to the starting pose in the final frame for a seamless loop. Keep the same face, beard, chef hat and brown apron as the reference image. Pixar-style 3D animation, smooth natural motion, no text, no audio.
```

**Negative prompt** (kalau alatnya punya kolom ini, misalnya Kling):

```
camera movement, zoom, pan, shaky camera, background change, extra objects, extra people, extra fingers, deformed hands, face change, text, watermark, logo, fast motion, motion blur, hat falling off
```

---

## 2. Daftar klip

| # | Nama berkas | Dipakai saat | Wajib? |
|---|---|---|---|
| 1 | `diam.mp4` | Avatar menunggu di pojok portal (diputar paling lama, **10 detik**) | **Wajib** |
| 2 | `berpikir.mp4` | SUKA Bot sedang memproses pertanyaan | **Wajib** |
| 3 | `rekap.mp4` | Ada rekap penjualan baru yang belum dibuka | **Wajib** |
| 4 | `bingung.mp4` | Terjadi galat / pertanyaan tidak bisa dijawab | **Wajib** |
| 5 | `sapa.mp4` | Avatar diklik (diputar sekali, lalu kembali ke `diam`) | Opsional |
| 6 | `bicara.mp4` | Jawaban sedang tampil (tahap berikutnya) | Nanti |

Buat klip 1–4 dulu. Klip 5 boleh menyusul. Klip 6 untuk tahap "berbicara",
belum dipakai sekarang.

---

## 3. Prompt per klip

Tempel prompt, lalu tambahkan **kalimat penutup** dari bagian 1.

### 1. `diam.mp4` — bernapas santai

Klip ini diputar terus-menerus, jadi gerakannya harus paling halus dan tidak
membosankan.

```
A friendly chubby chef with a dark beard stands relaxed, breathing slowly and calmly, chest and belly rising gently. He blinks naturally twice, keeps a warm soft smile, and sways very slightly from side to side. His hands stay loosely in front of his apron with tiny relaxed finger movements.
```

### 2. `berpikir.mp4` — mengelus janggut

Diputar berulang selama menunggu jawaban AI (bisa beberapa detik), jadi harus
enak diulang.

```
A friendly chubby chef with a dark beard is thinking. He slowly raises his right hand and strokes his beard thoughtfully, eyes glancing up and to the side, head tilting slightly, eyebrows raised as if saying "hmm". Then he lowers his hand back to the starting position.
```

### 3. `rekap.mp4` — menyapa senang

Tanda ada rekap baru. Harus terlihat ceria dan mengundang untuk diklik.

```
A friendly chubby chef with a dark beard is excited to share good news. He gives a big cheerful smile, raises his right hand and waves happily at the viewer two times, with a small happy bounce. Then he lowers his hand back to the starting position.
```

### 4. `bingung.mp4` — garuk kepala

Untuk galat atau pertanyaan yang tidak bisa dijawab. Kesannya "maaf, bingung",
bukan marah atau sedih.

```
A friendly chubby chef with a dark beard looks confused and a little sheepish. He scratches the side of his head near his ear with his right hand (the chef hat stays firmly on), tilts his head, raises one eyebrow, and gives a small apologetic shrug with an awkward smile. Then he returns to the starting position.
```

### 5. `sapa.mp4` — diklik (opsional)

Diputar SEKALI saat avatar diklik, jadi tidak perlu enak diulang, tapi tetap
harus kembali ke pose awal.

```
A friendly chubby chef with a dark beard is pleasantly surprised, eyebrows going up for a moment, then he gives a warm smile and a confident thumbs up with his right hand and a small nod. Then he lowers his hand back to the starting position.
```

### 6. `bicara.mp4` — berbicara (nanti)

Untuk tahap berikutnya. Diputar berulang selama jawaban tampil.

```
A friendly chubby chef with a dark beard is talking to the viewer in a friendly explaining manner, mouth moving naturally as if speaking, small expressive hand gestures in front of his apron, occasional nod and blink. Then he returns to the starting position.
```

---

## 4. Langkah di Google Flow (Veo)

Hasil percobaan pertama (5 Okt 2026): Flow mengabaikan "kembali ke pose awal"
kalau hanya diberi satu gambar. Klip yang **diputar berulang** (`diam`,
`berpikir`, nanti `bicara`) wajib dibuat dengan mode dua frame:

1. Di kotak prompt bawah, pilih mode **Frames to Video** (di sebagian versi
   bernama *"Video frame by frame"*).
2. Isi kotak **frame awal DAN frame akhir** dengan `chefss.jpeg` (klik **+** →
   **Upload**).
3. Tempel prompt klip + kalimat penutup dari bagian 1.
4. Durasi: `diam` 8 detik, `berpikir` 6–8 detik.
5. Kalau hasilnya nyaris tidak bergerak (Veo kadang "malas" bila frame awal dan
   akhir sama), pertegas gerakan di prompt, misalnya
   *"clearly visible breathing and two natural blinks"*.

Klip yang **main sekali** (`rekap`, `bingung`, `sapa`) tidak perlu mode ini:
aplikasi memutarnya sekali lalu kembali ke `diam` dengan pelarutan singkat.
Hasil percobaan pertama untuk ketiganya sudah dipakai.

---

## 5. Cek sebelum diserahkan

Untuk tiap klip, putar dan periksa:

- [ ] Frame pertama dan terakhir terlihat sama dengan `chefss.jpeg`
      (putar berulang, sambungannya tidak boleh terasa loncat)
- [ ] Kamera tidak bergerak sama sekali
- [ ] Latar hijau polos sampai akhir, tanpa bayangan atau benda baru
- [ ] Wajah, janggut, topi, celemek tidak berubah
- [ ] Tangan tidak cacat (jumlah jari wajar) dan tidak keluar bingkai
- [ ] Tanpa watermark, tanpa teks
- [ ] Nama berkas persis seperti tabel

Kalau satu klip gagal, ulangi generate klip itu saja. AI video jarang berhasil
di percobaan pertama, wajar butuh 2–4 kali coba per klip.
