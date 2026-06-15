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

/** Buang penomoran duplikat seperti "(2)", "(3)" dari nama/filename, lalu rapikan spasi */
function stripDuplicateSuffix(str: string): string {
  return str
    .replace(/\(\s*\d+\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalisasi nama untuk pencocokan: lowercase, tanpa tanda baca/angka duplikat, spasi tunggal */
function normalizeName(str: string): string {
  return stripDuplicateSuffix(str)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cocokkan nama produk dengan daftar harga berdasarkan exact match (tanpa spasi) atau overlap kata */
function matchPriceFromList(name: string, priceList: { name: string; price: number }[]): number | null {
  const target = normalizeName(name)
  if (!target) return null
  const targetNoSpace = target.replace(/ /g, '')
  const targetWords = new Set(target.split(' '))

  let best: { price: number; score: number } | null = null
  for (const entry of priceList) {
    const candidate = normalizeName(entry.name)
    if (!candidate) continue
    if (candidate === target || candidate.replace(/ /g, '') === targetNoSpace) return entry.price

    const candidateWords = new Set(candidate.split(' '))
    const intersection = [...targetWords].filter(w => candidateWords.has(w))
    const union = new Set([...targetWords, ...candidateWords])
    const score = intersection.length / union.size

    if (score >= 0.5 && (!best || score > best.score)) {
      best = { price: entry.price, score }
    }
  }
  return best?.price ?? null
}

interface GeminiAnalysis {
  pricelistItems: { name: string; price: number }[]
  productName: string
  productPrice: number
  productDescription: string
}

/** Delay helper to avoid Gemini rate limits */
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function analyzeImageWithGemini(
  base64: string,
  mimeType: string,
  filename: string
): Promise<GeminiAnalysis> {
  const fallbackName = capitalizeWords(
    stripDuplicateSuffix(
      filename
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\d{5,}/g, '')
    )
  )

  const fallback: GeminiAnalysis = {
    pricelistItems: [],
    productName: fallbackName || 'Produk Baru',
    productPrice: 0,
    productDescription: '',
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Kamu adalah asisten AI untuk sistem POS restoran. Analisis gambar ini dengan SANGAT TELITI dan isi SEMUA field berikut dalam satu respons JSON:

1. "pricelist_items": Array pasangan nama produk dan harga.
   - Jika gambar ini adalah daftar menu / papan harga / banner promosi yang menampilkan BANYAK (3 atau lebih) nama produk beserta harganya SEKALIGUS, ekstrak SEMUA pasangan nama-harga yang terbaca ke array ini. Nama dalam Title Case.
   - Jika gambar ini HANYA foto satu produk makanan/minuman (bukan daftar menu), kembalikan array kosong [].

2. "product_name": Nama SATU produk (Title Case) berdasarkan tulisan di gambar atau dari visual makanannya. Jika gambar adalah daftar menu/papan harga (bukan foto satu produk spesifik), boleh dikosongkan jadi "".

3. "product_price": Jika ada harga tertulis LANGSUNG pada foto produk tunggal tersebut, isi sesuai itu. Jika tidak ada harga tertulis pada foto produk, atau jika gambar adalah daftar menu, isi 0.

4. "product_description": Deskripsi singkat (1-2 kalimat) tentang produk. Kosongkan "" jika gambar adalah daftar menu.

Nama file: "${filename}" — gunakan sebagai petunjuk tambahan. ABAIKAN angka penomoran duplikat di nama file seperti "(2)", "(3)" — jangan masukkan ke product_name atau pricelist_items.

ATURAN HARGA:
- Jika tertulis "35K" atau "35k" maka harga = 35000
- Jika tertulis "Rp 35.000" maka harga = 35000
- Jika tertulis "35.000" maka harga = 35000
- Jika tertulis angka ribuan/puluhan ribu, itu adalah harga

PENTING: Respond HANYA dalam format JSON, tanpa markdown atau teks tambahan, persis seperti ini:
{"pricelist_items":[{"name":"Nama Produk","price":25000}],"product_name":"Nama Produk","product_price":0,"product_description":"Deskripsi singkat"}`,
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
          maxOutputTokens: 1500,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`Gemini API error for ${filename}:`, response.status, errText)
      return fallback
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
      const objMatch = text.match(/\{[\s\S]*\}/)
      if (objMatch) {
        jsonStr = objMatch[0]
      }
    }

    const parsed = JSON.parse(jsonStr) as {
      pricelist_items?: { name: string; price: number }[]
      product_name?: string
      product_price?: number
      product_description?: string
    }

    const pricelistItems = Array.isArray(parsed.pricelist_items)
      ? parsed.pricelist_items
          .filter(item => item && item.name)
          .map(item => ({
            name: capitalizeWords(stripDuplicateSuffix(item.name)),
            price: typeof item.price === 'number' ? item.price : 0,
          }))
      : []

    const productName = capitalizeWords(stripDuplicateSuffix(parsed.product_name || fallbackName || 'Produk Baru'))
    const productPrice = typeof parsed.product_price === 'number' ? parsed.product_price : 0

    return {
      pricelistItems,
      productName,
      productPrice,
      productDescription: parsed.product_description || '',
    }
  } catch (err) {
    console.error('Gemini analysis failed for', filename, err)
    return fallback
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
    const productEntries: {
      filename: string
      name: string
      price: number
      description: string
      mimeType: string
      base64: string
    }[] = []
    const priceList: { name: string; price: number }[] = []

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

      // 3+ name/price pairs found → treat this image as a menu/pricelist board
      const isPricelist = aiResult.pricelistItems.length >= 3
      if (isPricelist) {
        priceList.push(...aiResult.pricelistItems)
      } else {
        productEntries.push({
          filename: entry.filename,
          name: aiResult.productName,
          price: aiResult.productPrice,
          description: aiResult.productDescription,
          mimeType,
          base64,
        })
      }

      // Small delay between API calls to avoid rate limiting (except for last one)
      if (i < imageEntries.length - 1) {
        await delay(500)
      }
    }

    // Match product prices against the extracted pricelist (if any), then fall back to a default
    const results = productEntries.map(entry => {
      let price = entry.price
      if (price <= 10) {
        price = matchPriceFromList(entry.name, priceList) ?? 10000
      }
      return {
        filename: entry.filename,
        name: entry.name,
        price,
        description: entry.description,
        mimeType: entry.mimeType,
        imageBase64: `data:${entry.mimeType};base64,${entry.base64}`,
      }
    })

    console.log(`Successfully processed ${results.length} products (${priceList.length} pricelist entries found)`)

    return NextResponse.json({ products: results })
  } catch (err) {
    console.error('ZIP upload error:', err)
    return NextResponse.json(
      { error: 'Gagal memproses file ZIP. Pastikan file valid.' },
      { status: 500 }
    )
  }
}
