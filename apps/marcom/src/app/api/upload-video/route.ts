import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file video yang diunggah.' }, { status: 400 })
    }

    // Validasi tipe file
    const validMimeTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/avi']
    if (!validMimeTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Harap unggah file MP4, MOV, atau WebM.' },
        { status: 400 }
      )
    }

    // Batasi ukuran (misal 150MB untuk upload video)
    const MAX_SIZE_MB = 150
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Ukuran file melebihi batas maksimal ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos')
    await mkdir(uploadDir, { recursive: true })

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${Date.now()}-${cleanFileName}`
    const filePath = path.join(uploadDir, fileName)

    await writeFile(filePath, buffer)

    const publicUrl = `/uploads/videos/${fileName}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (error: any) {
    console.error('Error saat mengunggah video:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal menyimpan file video ke server.' },
      { status: 500 }
    )
  }
}
