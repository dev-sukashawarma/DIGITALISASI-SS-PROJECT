export interface GoogleSheetsConfig {
  url: string
  enabled: boolean
}

/**
 * Fetches Google Sheets sync settings from global_settings table.
 */
export async function getGoogleSheetsConfig(
  supabase: any
): Promise<GoogleSheetsConfig> {
  const defaultConfig: GoogleSheetsConfig = {
    url: '',
    enabled: false
  }

  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('key, value')
      .in('key', ['google_sheets_webhook_url', 'google_sheets_sync_enabled'])

    if (error || !data || !Array.isArray(data)) {
      return defaultConfig
    }

    let url = ''
    let enabled = false

    for (const row of data) {
      if (row.key === 'google_sheets_webhook_url') {
        url = typeof row.value === 'string' ? row.value : (row.value ? String(row.value) : '')
      } else if (row.key === 'google_sheets_sync_enabled') {
        enabled = row.value === 'true' || row.value === true
      }
    }

    return { url, enabled }
  } catch {
    return defaultConfig
  }
}

/**
 * Saves Google Sheets sync settings to global_settings table using upsert.
 */
export async function saveGoogleSheetsConfig(
  supabase: any,
  config: GoogleSheetsConfig
): Promise<{ error: any }> {
  try {
    const rows = [
      { key: 'google_sheets_webhook_url', value: config.url },
      { key: 'google_sheets_sync_enabled', value: String(config.enabled) }
    ]

    const { error } = await supabase
      .from('global_settings')
      .upsert(rows, { onConflict: 'key' })

    return { error: error ?? null }
  } catch (err) {
    return { error: err }
  }
}
