'use client'

import { useRef, useState } from 'react'

interface SignatureCanvasProps {
  onSignatureSaved: (signatureImage: string) => void
}

export function SignatureCanvas({ onSignatureSaved }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Konversi koordinat layar → koordinat buffer canvas (canvas di-stretch via w-full)
  const getPos = (canvas: HTMLCanvasElement, e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)

    const { x, y } = getPos(canvas, e)

    // Configure stroke for better rendering (thick, smooth line)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000'

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    e.preventDefault()
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(canvas, e)

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
    <div className="border-2 border-dashed border-suka-brown/20 rounded-xl p-4 bg-[#fff8f1]/30 space-y-3">
      <p className="text-xs font-bold text-suka-brown uppercase tracking-wider">Tanda Tangan Digital (Gambar pada area di bawah)</p>
      <canvas
        ref={canvasRef}
        width={300}
        height={100}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        onPointerCancel={stopDrawing}
        style={{ touchAction: 'none' }}
        className="border border-suka-brown/15 rounded-xl bg-white cursor-crosshair block w-full shadow-inner"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clearSignature}
          className="px-4 py-2 border border-suka-brown/15 text-suka-brown font-semibold text-xs rounded-xl bg-white hover:bg-suka-cream transition-all cursor-pointer"
        >
          Bersihkan
        </button>
        <button
          type="button"
          onClick={saveSignature}
          className="px-4 py-2 bg-suka-orange hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
        >
          Simpan Tanda Tangan
        </button>
      </div>
    </div>
  )
}
