import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

// Allow large ZIP uploads
export const maxDuration = 120 // 2 minutes timeout for AI processing

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
const MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50 MB

function getMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }
  return map[ext ?? ''] ?? null
}

/** Capitalize setiap kata: "chicken shawarma" → "Chicken Shawarma" */
function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

interface GeminiProduct {
  name: string
  price: number
  description: string
}

/** Delay helper to avoid Gemini rate limits */
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function analyzeImageWithGemini(
  base64: string,
  mimeType: string,
  filename: string
): Promise<GeminiProduct> {
  const fallbackName = capitalizeWords(
    filename
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\d{5,}/g, '')
      .trim()
  )

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Kamu adalah asisten AI untuk sistem POS restoran. Analisis gambar makanan/minuman ini dengan SANGAT TELITI.

TUGAS UTAMA:
1. BACA HARGA yang tertera/tertulis di dalam gambar. Cari angka yang menunjukkan harga (bisa ada tulisan "Rp", "IDR", "K", atau angka ribuan/puluhan ribu). HARGA HARUS DIBACA DARI GAMBAR. Ini adalah prioritas utama.
2. Tentukan NAMA PRODUK yang tertulis di gambar atau dari visual makanannya. Nama harus dalam format Title Case (huruf kapital di awal setiap kata).
3. Buat DESKRIPSI singkat (1-2 kalimat) tentang produk ini.

Nama file: "${filename}" — gunakan sebagai petunjuk tambahan.

ATURAN HARGA:
- Jika di gambar tertulis "35K" atau "35k" maka price = 35000
- Jika di gambar tertulis "Rp 35.000" maka price = 35000
- Jika di gambar tertulis "35.000" maka price = 35000
- Jika di gambar tertulis angka ribuan/puluhan ribu, itu adalah harga
- JANGAN pernah return harga 0, 1, atau 2. Estimasi minimal 5000 jika tidak ada harga tertulis.

PENTING: Respond HANYA dalam format JSON, tanpa markdown atau teks tambahan:
{"name": "Nama Produk", "price": 25000, "description": "Deskripsi singkat"}`,
              },
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`Gemini API error for ${filename}:`, response.status, errText)
      return { name: fallbackName || 'Produk Baru', price: 10000, description: '' }
    }

    const data = await response.json()
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

    console.log(`Gemini response for ${filename}:`, text)

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    // Also try to find JSON object pattern directly
    if (!jsonStr.startsWith('{')) {
      const objMatch = text.match(/\{[\s\S]*?\}/)
      if (objMatch) {
        jsonStr = objMatch[0]
      }
    }

    const parsed = JSON.parse(jsonStr) as GeminiProduct
    
    // Capitalize the product name
    const productName = capitalizeWords(parsed.name || fallbackName || 'Produk Baru')
    
    // Ensure price is reasonable
    let price = typeof parsed.price === 'number' ? parsed.price : 0
    if (price <= 10) price = 10000 // Fallback if AI returns tiny number

    return {
      name: productName,
      price,
      description: parsed.description || '',
    }
  } catch (err) {
    console.error('Gemini analysis failed for', filename, err)
    return { name: fallbackName || 'Produk Baru', price: 10000, description: '' }
  }
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY belum dikonfigurasi di .env.local' },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('zipFile') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'File ZIP tidak ditemukan' },
        { status: 400 }
      )
    }

    if (file.size > MAX_ZIP_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file ZIP maksimal 50 MB' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Collect all image files from the ZIP
    const imageEntries: { filename: string; file: JSZip.JSZipObject }[] = []

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return
      // Skip macOS resource fork files and hidden files
      if (relativePath.includes('__MACOSX')) return
      if (relativePath.split('/').pop()?.startsWith('.')) return
      
      const mime = getMimeType(relativePath)
      if (mime && ALLOWED_TYPES.includes(mime)) {
        imageEntries.push({
          filename: relativePath.split('/').pop() ?? relativePath,
          file: zipEntry,
        })
      }
    })

    console.log(`Found ${imageEntries.length} images in ZIP:`, imageEntries.map(e => e.filename))

    if (imageEntries.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada gambar yang ditemukan di dalam ZIP (JPG, PNG, WebP)' },
        { status: 400 }
      )
    }

    if (imageEntries.length > 30) {
      return NextResponse.json(
        { error: 'Maksimal 30 gambar per ZIP file' },
        { status: 400 }
      )
    }

    // Process each image with Gemini AI — with delay to avoid rate limits
    const results = []

    for (let i = 0; i < imageEntries.length; i++) {
      const entry = imageEntries[i]
      console.log(`Processing image ${i + 1}/${imageEntries.length}: ${entry.filename}`)
      
      const buffer = await entry.file.async('arraybuffer')
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = getMimeType(entry.filename) ?? 'image/jpeg'

      const aiResult = await analyzeImageWithGemini(
        base64,
        mimeType,
        entry.filename
      )

      console.log(`AI result for ${entry.filename}:`, aiResult)

      results.push({
        filename: entry.filename,
        name: aiResult.name,
        price: aiResult.price,
        description: aiResult.description,
        mimeType,
        imageBase64: `data:${mimeType};base64,${base64}`,
      })

      // Small delay between API calls to avoid rate limiting (except for last one)
      if (i < imageEntries.length - 1) {
        await delay(500)
      }
    }

    console.log(`Successfully processed ${results.length} products`)

    return NextResponse.json({ products: results })
  } catch (err) {
    console.error('ZIP upload error:', err)
    return NextResponse.json(
      { error: 'Gagal memproses file ZIP. Pastikan file valid.' },
      { status: 500 }
    )
  }
}
