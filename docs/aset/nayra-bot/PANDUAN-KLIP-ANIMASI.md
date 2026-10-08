# Panduan Klip Animasi Nayra MARCOM Bot (Google Flow)

Bahan dan panduan untuk membuat klip video animasi karakter **Nayra** menggunakan AI video generator (**Google Flow / Veo / Kling / Runway**).

Gambar acuan sumber sudah disiapkan di folder ini:
👉 `docs/aset/nayra-bot/nayra_ref_green.jpeg` (atau `.png`)

Video mentah hasil dari Google Flow cukup disimpan di folder ini dengan nama berkas persis seperti di tabel. Pemotongan, penghapusan latar hijau (chroma-key), dan konversi ke `.webm` + `.anim.webp` transparan akan diproses secara otomatis oleh skrip developer.

---

## 1. Aturan Wajib untuk Google Flow

| # | Aturan | Alasan |
|---|---|---|
| 1 | **Frame Awal & Frame Akhir = `nayra_ref_green.jpeg`** | Jika menggunakan mode *Frames to Video*, set frame awal dan frame akhir dengan gambar yang sama. Jika mode *Image to Video* biasa, pastikan prompt meminta kembali ke pose awal. Ini penting agar transisi antar pose tidak melompat. |
| 2 | **Kamera Terkunci (Locked-off Camera)** | Tanpa zoom in/out, tanpa pan, tanpa rotasi/guncangan kamera. |
| 3 | **Latar Hijau Polos (Chroma-Key Green)** | Latar hijau harus solid, flat, dan tetap sama sepanjang klip tanpa bayangan hitam baru di dinding. |
| 4 | **Posisi & Proporsi Karakter Tetap** | Nayra tetap berdiri di posisi tengah dengan ukuran yang sama (tidak melangkah maju atau mundur). |
| 5 | **Durasi Klip** | Durasi 5 detik (khusus `diam.mp4` disarankan 8–10 detik jika didukung). 24 fps, resolusi 720p / 1080p portrait (9:16). Tanpa audio, tanpa teks, tanpa watermark. |

---

## 2. Kalimat Penutup (Wajib Ditempel di Akhir Setiap Prompt)

Tempelkan teks berikut di baris terakhir setiap prompt Anda:

```text
Static locked-off camera, no zoom, no pan, no tilt. Solid flat chroma-key green screen background (#00B140) that stays completely identical and uniform across all frames, no new dark shadows. The character stays centered at the exact same size and smoothly returns to the starting pose in the final frame for a seamless loop. Keep the exact same face, dark hijab, glowing orange-purple futuristic headset with mic, stylish modern marketing jacket, and Pixar-style 3D aesthetic as the reference image. Smooth natural motion, no text, no watermark, no audio.
```

**Negative Prompt (jika kolom tersedia di Google Flow/tool):**
```text
camera movement, zoom, pan, tilt, shaky camera, background change, complex background, extra objects, deformed hands, extra fingers, missing headset, changing clothes, face morphing, text, watermark, fast motion, motion blur
```

---

## 3. Daftar Prompt per Pose

### 1. `diam.mp4` — Pose Menunggu / Bernapas Santai (Looping)
> **Dipakai saat:** Avatar santai menunggu di pojok dashboard MARCOM (klip paling sering diputar).

**Prompt:**
```text
A friendly cheerful young woman in a modern black hijab and glowing futuristic headset stands relaxed, breathing slowly and calmly, her chest gently rising and falling. She blinks naturally twice, maintains a warm welcoming smile, and sways very slightly from side to side in a subtle idle rhythm. Her hands stay relaxed in front at waist level with gentle, natural finger movements.

Static locked-off camera, no zoom, no pan, no tilt. Solid flat chroma-key green screen background (#00B140) that stays completely identical and uniform across all frames, no new dark shadows. The character stays centered at the exact same size and smoothly returns to the starting pose in the final frame for a seamless loop. Keep the exact same face, dark hijab, glowing orange-purple futuristic headset with mic, stylish modern marketing jacket, and Pixar-style 3D aesthetic as the reference image. Smooth natural motion, no text, no watermark, no audio.
```

---

### 2. `berpikir.mp4` — Pose Analisis / Berpikir (Looping / Hold)
> **Dipakai saat:** Nayra sedang menganalisis video konten, brainstorming hook, atau memproses jawaban AI.

**Prompt:**
```text
A friendly young woman in a modern black hijab and glowing futuristic headset is deeply thinking and analyzing marketing data. She gently tilts her head to one side with an attentive curious expression, her eyes glancing up thoughtfully as if reviewing creative ideas in her mind. She brings her right index finger to lightly tap near her chin, nodding slightly with a thoughtful 'aha' expression, before lowering her hand smoothly back to her relaxed starting position.

Static locked-off camera, no zoom, no pan, no tilt. Solid flat chroma-key green screen background (#00B140) that stays completely identical and uniform across all frames, no new dark shadows. The character stays centered at the exact same size and smoothly returns to the starting pose in the final frame for a seamless loop. Keep the exact same face, dark hijab, glowing orange-purple futuristic headset with mic, stylish modern marketing jacket, and Pixar-style 3D aesthetic as the reference image. Smooth natural motion, no text, no watermark, no audio.
```

---

### 3. `sapa.mp4` — Pose Menyapa / Reaksi Klik (Diputar Sekali)
> **Dipakai saat:** Avatar diklik oleh user atau saat pesan obrolan baru saja terkirim.

**Prompt:**
```text
A friendly young woman in a modern black hijab and glowing futuristic headset is delighted to greet the user. She gives a bright cheerful smile, raises her right hand and waves enthusiastically at the viewer two times with an energetic cute bounce. Her eyes sparkle with enthusiasm, and she gives a quick friendly thumbs-up before lowering her hand smoothly back to the relaxed starting position.

Static locked-off camera, no zoom, no pan, no tilt. Solid flat chroma-key green screen background (#00B140) that stays completely identical and uniform across all frames, no new dark shadows. The character stays centered at the exact same size and smoothly returns to the starting pose in the final frame for a seamless loop. Keep the exact same face, dark hijab, glowing orange-purple futuristic headset with mic, stylish modern marketing jacket, and Pixar-style 3D aesthetic as the reference image. Smooth natural motion, no text, no watermark, no audio.
```

---

### 4. `ide.mp4` — Pose Eureka / Ide Konten Viral (Diputar Sekali)
> **Dipakai saat:** Menemukan hook viral atau merekomendasikan ide campaign baru.

**Prompt:**
```text
A friendly young woman in a modern black hijab and glowing futuristic headset experiences a sudden brilliant creative breakthrough. Her eyes widen in excitement with a happy gasp, she raises her right index finger up in a classic 'eureka! I have a great idea!' gesture, nodding with confidence and a proud smile, before gracefully returning her hands to the relaxed starting position.

Static locked-off camera, no zoom, no pan, no tilt. Solid flat chroma-key green screen background (#00B140) that stays completely identical and uniform across all frames, no new dark shadows. The character stays centered at the exact same size and smoothly returns to the starting pose in the final frame for a seamless loop. Keep the exact same face, dark hijab, glowing orange-purple futuristic headset with mic, stylish modern marketing jacket, and Pixar-style 3D aesthetic as the reference image. Smooth natural motion, no text, no watermark, no audio.
```

---

### 5. `bingung.mp4` — Pose Bingung / Maaf (Diputar Sekali)
> **Dipakai saat:** Terjadi kegagalan jaringan atau query tidak dapat diproses.

**Prompt:**
```text
A friendly young woman in a modern black hijab and glowing futuristic headset looks slightly confused and apologetic. She tilts her head with an inquisitive expression, raises one eyebrow playfully, gives a small cute apologetic shoulder shrug with her palms gently turned outwards and a sheepish smile, before relaxing back into the neutral starting pose.

Static locked-off camera, no zoom, no pan, no tilt. Solid flat chroma-key green screen background (#00B140) that stays completely identical and uniform across all frames, no new dark shadows. The character stays centered at the exact same size and smoothly returns to the starting pose in the final frame for a seamless loop. Keep the exact same face, dark hijab, glowing orange-purple futuristic headset with mic, stylish modern marketing jacket, and Pixar-style 3D aesthetic as the reference image. Smooth natural motion, no text, no watermark, no audio.
```

---

## 4. Alur Selanjutnya Setelah Video Selesai di Google Flow
1. Simpan video `.mp4` hasil generate ke folder ini (`docs/aset/nayra-bot/`).
2. Jalankan perintah otomatisasi:
   ```bash
   python scripts/nayra-bot/olah_klip.py
   ```
3. Skrip akan memotong, menghapus latar hijau, dan langsung menempatkan video transparan `.webm` dan `.anim.webp` ke folder `apps/marcom/public/nayra/`!
