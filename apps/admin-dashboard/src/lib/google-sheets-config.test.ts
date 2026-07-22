import { describe, it, expect, vi } from 'vitest'
import {
  getGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  type GoogleSheetsConfig
} from './google-sheets-config'

describe('google-sheets-config', () => {
  describe('getGoogleSheetsConfig', () => {
    it('should fetch and parse webhook url and sync enabled status from global_settings', async () => {
      const mockData = [
        { key: 'google_sheets_webhook_url', value: 'https://script.google.com/macros/s/test/exec' },
        { key: 'google_sheets_sync_enabled', value: 'true' }
      ]

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockData, error: null })
          })
        })
      }

      const config = await getGoogleSheetsConfig(mockSupabase as any)

      expect(mockSupabase.from).toHaveBeenCalledWith('global_settings')
      expect(config).toEqual({
        url: 'https://script.google.com/macros/s/test/exec',
        enabled: true
      })
    })

    it('should return default config if settings do not exist in database', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      }

      const config = await getGoogleSheetsConfig(mockSupabase as any)

      expect(config).toEqual({
        url: '',
        enabled: false
      })
    })

    it('should handle boolean false or string false correctly for sync enabled', async () => {
      const mockData = [
        { key: 'google_sheets_webhook_url', value: 'https://script.google.com/macros/s/test/exec' },
        { key: 'google_sheets_sync_enabled', value: 'false' }
      ]

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockData, error: null })
          })
        })
      }

      const config = await getGoogleSheetsConfig(mockSupabase as any)

      expect(config.enabled).toBe(false)
    })

    it('should return default config on database query error', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
          })
        })
      }

      const config = await getGoogleSheetsConfig(mockSupabase as any)

      expect(config).toEqual({
        url: '',
        enabled: false
      })
    })
  })

  describe('saveGoogleSheetsConfig', () => {
    it('should upsert google_sheets_webhook_url and google_sheets_sync_enabled to global_settings', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: mockUpsert
        })
      }

      const config: GoogleSheetsConfig = {
        url: 'https://script.google.com/macros/s/new-url/exec',
        enabled: true
      }

      const result = await saveGoogleSheetsConfig(mockSupabase as any, config)

      expect(mockSupabase.from).toHaveBeenCalledWith('global_settings')
      expect(mockUpsert).toHaveBeenCalledWith(
        [
          { key: 'google_sheets_webhook_url', value: 'https://script.google.com/macros/s/new-url/exec' },
          { key: 'google_sheets_sync_enabled', value: 'true' }
        ],
        expect.anything()
      )
      expect(result).toEqual({ error: null })
    })

    it('should return error if upsert fails', async () => {
      const dbError = new Error('Failed to upsert')
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: dbError })
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: mockUpsert
        })
      }

      const config: GoogleSheetsConfig = {
        url: 'https://script.google.com/macros/s/new-url/exec',
        enabled: false
      }

      const result = await saveGoogleSheetsConfig(mockSupabase as any, config)

      expect(result).toEqual({ error: dbError })
    })
  })
})
