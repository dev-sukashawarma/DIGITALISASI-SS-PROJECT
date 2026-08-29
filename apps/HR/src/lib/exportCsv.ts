export function exportCsv<T extends Record<string, any>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  filename: string
) {
  if (!rows || !rows.length) return

  const headerRow = columns.map((c) => `"${c.label}"`).join(',')
  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key]
        if (val === null || val === undefined) return '""'
        return `"${String(val).replace(/"/g, '""')}"`
      })
      .join(',')
  )

  const csvContent = [headerRow, ...dataRows].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
