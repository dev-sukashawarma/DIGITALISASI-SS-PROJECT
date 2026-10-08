'use server'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

const NAYRA_SYSTEM_PROMPT = `
Kamu adalah "NAYRA", Marketing & Communication Bot resmi untuk brand F&B "Suka Shawarma".
Karaktermu:
- Peran: Creative Campaign Specialist, Brand Communicator, Engagement Booster, dan Customer-Focused Storyteller.
- Penampilan: Gadis robotik cerdas berhijab ungu & oranye, memakai jaket stylish Suka Shawarma, headphone oranye menyala, dan memegang tablet hologram analitik.
- Karakter & Gaya Bicara: Ceria, ramah, energik, solutif, suportif, dan sangat paham dunia marketing kuliner kekinian (TikTok, Instagram Reels, Foodies, Food Vlogger, Street Food Viral). Sering menyapa dengan hangat ("Halo Kak!", "Siap, Nayra bantu ya! ✨", "Wah ide bagus banget tuh! 🌯").
- Pengetahuan:
  - Menu Suka Shawarma: Shawarma daging sapi/ayam panggang otentik rempah timur tengah, saus garlic toum khas, keju mozzarella meleleh, french fries gurih, minuman segar.
  - Marketing: Hook 3 detik pertama, visual food appeal, copywriting caption & hashtag viral, strategi promo bundling/diskon, kalender konten, dan audit video.

Berikan jawaban yang ringkas, terstruktur, kreatif, dan langsung bisa dieksekusi oleh tim marketing atau pengguna. Gunakan bullet points dan emoji yang relevan.
`

export async function askNayraAction(messages: ChatMessage[]): Promise<{
  success: boolean
  reply?: string
  error?: string
}> {
  try {
    const nineRouterBaseUrl = process.env.NINE_ROUTER_BASE_URL || 'https://api.openai.com/v1'
    const nineRouterApiKey = process.env.NINE_ROUTER_API_KEY
    const nineRouterModel = process.env.NINE_ROUTER_MODEL || 'gemini-2.0-flash'

    if (nineRouterApiKey && nineRouterApiKey.trim() !== '') {
      try {
        const formattedMessages = [
          { role: 'system', content: NAYRA_SYSTEM_PROMPT },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ]

        const response = await fetch(`${nineRouterBaseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${nineRouterApiKey}`,
          },
          body: JSON.stringify({
            model: nineRouterModel,
            messages: formattedMessages,
            temperature: 0.7,
            max_tokens: 800,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const reply = data.choices?.[0]?.message?.content
          if (reply) {
            return { success: true, reply: reply.trim() }
          }
        } else {
          const err = await response.text()
          console.warn('9router error in askNayraAction:', response.status, err)
        }
      } catch (callErr) {
        console.error('Panggilan 9router gagal di askNayraAction:', callErr)
      }
    }

    // Fallback cerdas persona Nayra jika tanpa API key (hanya memeriksa pesan dari user)
    const userMessages = messages.filter((m) => m.role === 'user')
    const lastUserMsg = userMessages[userMessages.length - 1]?.content.toLowerCase() || ''

    if (!lastUserMsg) {
      return {
        success: true,
        reply: 'Halo Kak! Ada yang bisa Nayra bantu seputar ide konten, hook video, atau promo hari ini? ✨',
      }
    }

    let fallbackReply = ''

    if (lastUserMsg.includes('hook') || lastUserMsg.includes('awal') || lastUserMsg.includes('intro')) {
      fallbackReply = `Halo Kak! Nayra punya 3 rekomendasi hook 3 detik pertama yang terbukti scroll-stopping untuk video kuliner Suka Shawarma:

1. **Visual Slice & Drizzle Hook**:
   *"Jangan tonton ini kalau lagi laper... Daging shawarma juicy berlimpah saus toum!"* 
   *(Tampilkan close-up pisau memotong tumpukan daging shawarma berputar dengan uap panas)*.

2. **Price Shock Hook**:
   *"Makan shawarma porsi sultan sepuas ini cuma 25 ribu?! Emang boleh seenak ini?"*
   *(Tampilkan perbandingan ukuran shawarma jumbo dengan tangan)*.

3. **Curiosity & ASMR Hook**:
   *"Kalian tim yang suka kulit shawarma garing atau daging yang super juicy?"*
   *(Suara crunch gigitan pertama + keju molor)*.

Kira-kira mana yang paling cocok dengan draf video Kakak kali ini? ✨`
    } else if (lastUserMsg.includes('ide') || lastUserMsg.includes('konten') || lastUserMsg.includes('tiktok')) {
      fallbackReply = `Wah, pas banget! Ini 3 pilar ide konten mingguan dari Nayra untuk akun official & region Suka Shawarma:

🌯 **1. Edukasi / Behind The Scene (High Share & Save)**:
- *"Rahasia di balik saus garlic toum Suka Shawarma yang creamy dan gak bikin eneg!"*
- Ajak penonton lihat proses marinasi rempah daging selama 12 jam.

🔥 **2. Tren / Relatable Street Food**:
- *"POV: Temen lo bilang 'aku gak laper kok' pas diajak ke Suka Shawarma..."* (lalu shawarma-nya ludes).
- Format cepat, musik yang lagi trending di TikTok, dan akhiri dengan ekspresi puas.

🎯 **3. Promo & Activation**:
- Promo Bundling Hemat Berdua: Shawarma Regular + French Fries + Es Lemon Tea.
- Tekankan Call to Action (CTA): *"Langsung serbu outlet terdekat atau cek GrabFood/GoFood!"*

Mau Nayra bantu buatkan caption dan hashtag-nya juga? 🚀`
    } else if (lastUserMsg.includes('caption') || lastUserMsg.includes('hashtag')) {
      fallbackReply = `Ini draf caption dan hashtag viral rekomendasi Nayra, Kak!

**Draf Caption:**
*"Definisi bahagia sederhana: aroma daging rempah yang baru dipotong, dibungkus roti pita hangat, plus lelehan saus garlic toum yang lumer di mulut! 🤤🌯*

*Daripada cuma ngiler liat layarnya, mending langsung meluncur ke outlet @sukashawarma terdekat sekarang juga. Tag temen kamu yang wajib ditraktir hari ini! 👇"*

**Hashtag Pilihan:**
#SukaShawarma #ShawarmaJuicy #KulinerViral #MakananEnak #StreetFoodLovers #FoodiesIndonesia #KulinerJakarta #KulinerSurabaya

Tinggal copy-paste ya Kak! ✨`
    } else {
      fallbackReply = `Halo Kak! Nayra siap bantu semua kebutuhan marketing dan komunikasi Suka Shawarma! 🌯✨

Nayra bisa bantu untuk:
- 💡 **Brainstorming ide konten viral** TikTok & Instagram Reels
- 🎯 **Merancang hook 3 detik** yang bikin penonton berhenti scroll
- 📝 **Membuat copywriting caption & hashtag** yang persuasif
- 🔍 **Mengevaluasi draf video promo** sebelum dipublikasikan
- 📊 **Konsultasi performa & matriks promosi** outlet

Ada yang bisa Nayra bantu eksplorasi sekarang? Silakan ketik pertanyaan Kakak ya!`
    }

    return { success: true, reply: fallbackReply }
  } catch (error: any) {
    console.error('Error in askNayraAction:', error)
    return {
      success: false,
      error: error?.message || 'Maaf, Nayra sedang mengalami kendala jaringan. Coba lagi sebentar ya!',
    }
  }
}
