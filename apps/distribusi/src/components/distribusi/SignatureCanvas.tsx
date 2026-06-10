'use client'

import { useRef, useState } from 'react'

interface SignatureCanvasProps {
  onSignatureSaved: (signatureImage: string) => void
}

export function SignatureCanvas({ onSignatureSaved }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Configure stroke for better rendering (thick, smooth line)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000'

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx?.lineTo(x, y)
    ctx?.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Check if signature is empty (all blank pixels)
    const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height)
    if (imageData) {
      const data = imageData.data
      const hasContent = data.some((val, i) => i % 4 !== 3 && val !== 255) // Check for non-white pixels
      if (!hasContent) {
        alert('Tanda tangan tidak boleh kosong. Silakan gambar tanda tangan Anda.')
        return
      }
    }

    // Convert to PNG (lossless, no artifacts like JPEG compression)
    const signatureImage = canvas.toDataURL('image/png')
    const sizeKB = (signatureImage.length / 1024).toFixed(2)
    console.log(`Signature captured: ${sizeKB}KB`)
    onSignatureSaved(signatureImage)
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded p-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">Tanda Tangan Digital (Tanda tangan di area ini)</p>
      <canvas
        ref={canvasRef}
        width={300}
        height={100}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="border border-gray-300 rounded bg-white cursor-crosshair block w-full"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clearSignature}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Bersihkan
        </button>
        <button
          type="button"
          onClick={saveSignature}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Simpan Tanda Tangan
        </button>
      </div>
    </div>
  )
}
