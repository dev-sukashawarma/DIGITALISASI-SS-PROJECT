/**
 * Export an array of objects to a CSV file and trigger download.
 *
 * @param rows     Array of flat objects to export
 * @param columns  Column definitions: { key, label }
 * @param filename Filename for the downloaded CSV (without extension)
 */
export function exportCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
) {
  if (rows.length === 0) return

  const escape = (val: unknown): string => {
    const str = val == null ? '' : String(val)
    // Wrap in quotes if the value contains comma, newline, or double-quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const header = columns.map((c) => c.label).join(',')
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(','))
    .join('\n')

  const csv = `${header}\n${body}`
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()

  URL.revokeObjectURL(url)
}
