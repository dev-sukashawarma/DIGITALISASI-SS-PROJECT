import { describe, it, expect, vi } from 'vitest'
import {
  formatGoogleSheetsPayload,
  sendOrderToGoogleSheets,
  triggerGoogleSheetsSyncIfActive
} from './google-sheets-webhook'
import { getGoogleSheetsConfig } from './google-sheets-config'

vi.mock('./google-sheets-config', () => ({
  getGoogleSheetsConfig: vi.fn()
}))

describe('google-sheets-webhook', () => {
  describe('formatGoogleSheetsPayload', () => {
    it('should format order, items, and outletName into a GoogleSheetsPayload object', () => {
      const order = {
        order_number: 1001,
        channel: 'POS',
        payment_method: 'QRIS',
        created_at: '2026-07-22T10:00:00.000Z'
      }

      const items = [
        {
          menu_item_name: 'Shawarma Chicken',
          quantity: 2,
          unit_price: 25000,
          subtotal: 50000
        },
        {
          menu_item_name: 'Ice Tea',
          quantity: 1,
          unit_price: 5000,
          subtotal: 5000
        }
      ]

      const outletName = 'Outlet Dipatiukur'

      const result = formatGoogleSheetsPayload(order, items, outletName)

      expect(result).toEqual({
        event: 'ORDER_COMPLETED',
        timestamp: '2026-07-22T10:00:00.000Z',
        order_number: '1001',
        outlet_name: 'Outlet Dipatiukur',
        channel: 'POS',
        payment_method: 'QRIS',
        items: [
          {
            menu_item_name: 'Shawarma Chicken',
            quantity: 2,
            unit_price: 25000,
            subtotal: 50000
          },
          {
            menu_item_name: 'Ice Tea',
            quantity: 1,
            unit_price: 5000,
            subtotal: 5000
          }
        ]
      })
    })

    it('should handle order_number as string and fallback defaults', () => {
      const order = {
        order_number: 'ORD-999'
      }

      const items = [
        {
          menu_item_name: 'Kebab Beef',
          quantity: 1,
          unit_price: 30000
        }
      ]

      const result = formatGoogleSheetsPayload(order, items, 'Outlet Dago')

      expect(result.order_number).toBe('ORD-999')
      expect(result.channel).toBe('POS')
      expect(result.payment_method).toBe('CASH')
      expect(result.items[0]).toEqual({
        menu_item_name: 'Kebab Beef',
        quantity: 1,
        unit_price: 30000,
        subtotal: 30000
      })
      expect(typeof result.timestamp).toBe('string')
    })
  })

  describe('sendOrderToGoogleSheets', () => {
    it('should send HTTP POST with application/json header and return true on response.ok', async () => {
      const webhookUrl = 'https://script.google.com/macros/s/test-webhook/exec'
      const order = {
        order_number: 'ORD-123',
        channel: 'GoFood',
        payment_method: 'E-Wallet'
      }
      const items = [
        {
          menu_item_name: 'Shawarma Beef',
          quantity: 1,
          unit_price: 35000,
          subtotal: 35000
        }
      ]
      const outletName = 'Outlet Dipatiukur'

      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success' })
      })

      const success = await sendOrderToGoogleSheets(
        webhookUrl,
        order,
        items,
        outletName,
        customFetch as any
      )

      expect(success).toBe(true)
      expect(customFetch).toHaveBeenCalledTimes(1)
      expect(customFetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: expect.any(String)
        })
      )

      const bodyObj = JSON.parse(customFetch.mock.calls[0][1].body)
      expect(bodyObj.event).toBe('ORDER_COMPLETED')
      expect(bodyObj.order_number).toBe('ORD-123')
      expect(bodyObj.outlet_name).toBe('Outlet Dipatiukur')
      expect(bodyObj.channel).toBe('GoFood')
      expect(bodyObj.payment_method).toBe('E-Wallet')
      expect(bodyObj.items).toHaveLength(1)
    })

    it('should return false if response.ok is false or fetch fails', async () => {
      const webhookUrl = 'https://script.google.com/macros/s/test-webhook/exec'
      const order = { order_number: 'ORD-456' }
      const items = []
      const outletName = 'Outlet Dago'

      const failingFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      const result1 = await sendOrderToGoogleSheets(
        webhookUrl,
        order,
        items,
        outletName,
        failingFetch as any
      )

      expect(result1).toBe(false)

      const networkErrorFetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result2 = await sendOrderToGoogleSheets(
        webhookUrl,
        order,
        items,
        outletName,
        networkErrorFetch as any
      )

      expect(result2).toBe(false)
    })
  })

  describe('triggerGoogleSheetsSyncIfActive', () => {
    it('should fire-and-forget sendOrderToGoogleSheets when config is enabled with url', async () => {
      const mockConfig = {
        enabled: true,
        url: 'https://script.google.com/macros/s/test-webhook/exec'
      }
      vi.mocked(getGoogleSheetsConfig).mockResolvedValue(mockConfig)

      const globalFetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', globalFetchMock)

      const mockSupabase = {}
      const order = { order_number: 'ORD-789' }
      const items = [{ menu_item_name: 'Shawarma', quantity: 1, unit_price: 20000 }]
      const outletName = 'Outlet Dipatiukur'

      triggerGoogleSheetsSyncIfActive(mockSupabase, order, items, outletName)

      expect(getGoogleSheetsConfig).toHaveBeenCalledWith(mockSupabase)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(globalFetchMock).toHaveBeenCalledWith(
        mockConfig.url,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        })
      )

      vi.unstubAllGlobals()
    })

    it('should not call sendOrderToGoogleSheets when config is disabled or url is missing', async () => {
      const mockConfig = {
        enabled: false,
        url: 'https://script.google.com/macros/s/test-webhook/exec'
      }
      vi.mocked(getGoogleSheetsConfig).mockResolvedValue(mockConfig)

      const globalFetchMock = vi.fn()
      vi.stubGlobal('fetch', globalFetchMock)

      triggerGoogleSheetsSyncIfActive({}, { order_number: 1 }, [], 'Outlet Test')

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(globalFetchMock).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })

    it('should handle errors in getGoogleSheetsConfig gracefully without crashing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(getGoogleSheetsConfig).mockRejectedValue(new Error('Config fetch failed'))

      triggerGoogleSheetsSyncIfActive({}, { order_number: 1 }, [], 'Outlet Test')

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Trigger Google Sheets Sync Error:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })
})

