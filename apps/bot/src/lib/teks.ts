// Render Markdown minimal (tebal + baris) sebagai DATA — tanpa HTML mentah (anti-XSS).
export function pecahTeks(isi: string): { tebal: boolean; teks: string }[][] {
  return isi.split('\n').map((baris) =>
    baris.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((s) =>
      s.startsWith('**') && s.endsWith('**') && s.length > 4 ? { tebal: true, teks: s.slice(2, -2) } : { tebal: false, teks: s },
    ),
  )
}
