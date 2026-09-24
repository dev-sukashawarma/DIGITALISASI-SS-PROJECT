/**
 * Helper waktu WIB (Asia/Jakarta).
 * Konversi waktu WIB untuk input datetime-local dan tampilan dashboard.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
export const WIB_LABEL = 'WIB'

/** ISO string (atau null) → nilai untuk <input type="datetime-local"> dalam WIB. */
export function toWibInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16)
}

/** Bentuk nilai <input type="datetime-local">: YYYY-MM-DDTHH:mm (detik opsional). */
const DATETIME_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/

/** Nilai <input type="datetime-local"> (dibaca sebagai WIB) → ISO UTC untuk DB. */
export function fromWibInputValue(value: string | null | undefined): string | null {
  if (!value) return null
  const match = DATETIME_LOCAL.exec(value.trim())
  if (!match) return null
  const parsed = Date.parse(`${match[1]}T${match[2]}${match[3] ?? ':00'}Z`)
  if (isNaN(parsed)) return null
  return new Date(parsed - WIB_OFFSET_MS).toISOString()
}

/** ISO string → teks WIB untuk ditampilkan, mis. "14 Agu 2026, 17.00 WIB". */
export function formatWib(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return '-'
  const text = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return `${text} ${WIB_LABEL}`
}

/** Waktu sekarang dalam format nilai <input type="datetime-local"> WIB. */
export function nowWibInputValue(): string {
  return toWibInputValue(new Date().toISOString())
}
