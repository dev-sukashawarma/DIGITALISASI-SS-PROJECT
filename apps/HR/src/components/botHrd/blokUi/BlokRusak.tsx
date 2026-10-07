'use client'

export function BlokRusak({ mentah }: { mentah: string }) {
  return (
    <div className="w-full min-w-0 rounded-lg border border-dashed border-[#E8DCCB] bg-[#FDF9F3] p-2">
      <p className="mb-1 text-[10px] text-[#8a7a70]">Tampilan tidak bisa dibaca</p>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-[#6b5a50]">
        {mentah}
      </pre>
    </div>
  )
}
