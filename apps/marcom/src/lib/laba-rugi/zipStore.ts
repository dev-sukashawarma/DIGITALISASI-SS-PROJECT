/**
 * Pembuat arsip ZIP ringan tanpa dependensi eksternal (metode STORE / 0).
 * Kompatibel penuh dengan Windows Explorer, macOS Archive Utility, dan unzip.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear())
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((Math.floor(d.getSeconds() / 2)) & 0x1f)
  const date =
    (((year - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f)
  return { time, date }
}

export async function createZipArchiveBlob(
  files: { filename: string; content: Blob | string }[],
  onProgress?: (pct: number, msg: string) => void,
): Promise<Blob> {
  const encoder = new TextEncoder()
  const now = dosDateTime(new Date())
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const nameBytes = encoder.encode(f.filename)
    const dataBytes =
      typeof f.content === 'string'
        ? encoder.encode(f.content)
        : new Uint8Array(await f.content.arrayBuffer())
    const crc = crc32(dataBytes)

    // Local file header (30 bytes + filename)
    const lh = new Uint8Array(30 + nameBytes.length)
    const lhv = new DataView(lh.buffer)
    lhv.setUint32(0, 0x04034b50, true)
    lhv.setUint16(4, 20, true)
    lhv.setUint16(6, 0x0800, true) // UTF-8 flag
    lhv.setUint16(8, 0, true) // Store (uncompressed)
    lhv.setUint16(10, now.time, true)
    lhv.setUint16(12, now.date, true)
    lhv.setUint32(14, crc, true)
    lhv.setUint32(18, dataBytes.length, true)
    lhv.setUint32(22, dataBytes.length, true)
    lhv.setUint16(26, nameBytes.length, true)
    lhv.setUint16(28, 0, true)
    lh.set(nameBytes, 30)

    localParts.push(lh, dataBytes)

    // Central directory header (46 bytes + filename)
    const ch = new Uint8Array(46 + nameBytes.length)
    const chv = new DataView(ch.buffer)
    chv.setUint32(0, 0x02014b50, true)
    chv.setUint16(4, 20, true)
    chv.setUint16(6, 20, true)
    chv.setUint16(8, 0x0800, true)
    chv.setUint16(10, 0, true)
    chv.setUint16(12, now.time, true)
    chv.setUint16(14, now.date, true)
    chv.setUint32(16, crc, true)
    chv.setUint32(20, dataBytes.length, true)
    chv.setUint32(24, dataBytes.length, true)
    chv.setUint16(28, nameBytes.length, true)
    chv.setUint16(30, 0, true)
    chv.setUint16(32, 0, true)
    chv.setUint16(34, 0, true)
    chv.setUint16(36, 0, true)
    chv.setUint32(38, 0, true)
    chv.setUint32(42, offset, true)
    ch.set(nameBytes, 46)

    centralParts.push(ch)
    offset += lh.length + dataBytes.length

    if (onProgress && files.length > 0) {
      const pct = Math.round(((i + 1) / files.length) * 100)
      onProgress(pct, `Menyusun berkas ZIP (${pct}%)...`)
    }
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  const parts = [...localParts, ...centralParts, eocd].map(
    (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
  )
  return new Blob(parts, { type: 'application/zip' })
}
