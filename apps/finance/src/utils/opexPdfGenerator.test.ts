import { describe, expect, it } from 'vitest'
import { fitImageDimensions, isPdfUrl, parseReceiptUrls } from './opexPdfGenerator'

describe('opexPdfGenerator helpers', () => {
  describe('parseReceiptUrls', () => {
    it('returns empty array for null, undefined, or blank string', () => {
      expect(parseReceiptUrls(null)).toEqual([])
      expect(parseReceiptUrls(undefined)).toEqual([])
      expect(parseReceiptUrls('   ')).toEqual([])
    })

    it('returns single URL in an array', () => {
      expect(parseReceiptUrls('https://example.com/nota.jpg')).toEqual([
        'https://example.com/nota.jpg'
      ])
    })

    it('parses JSON array of receipt URLs and filters invalid/empty entries', () => {
      const raw = JSON.stringify([
        'https://example.com/nota1.jpg',
        '',
        null,
        'https://example.com/nota2.png'
      ])
      expect(parseReceiptUrls(raw)).toEqual([
        'https://example.com/nota1.jpg',
        'https://example.com/nota2.png'
      ])
    })

    it('falls back to raw string when value starts with [ but is invalid JSON', () => {
      expect(parseReceiptUrls('[not-json')).toEqual(['[not-json'])
    })
  })

  describe('isPdfUrl', () => {
    it('detects PDF URLs with or without query strings', () => {
      expect(isPdfUrl('https://cdn.example.com/receipt.pdf')).toBe(true)
      expect(isPdfUrl('https://cdn.example.com/RECEIPT.PDF?token=123#page=1')).toBe(true)
      expect(isPdfUrl('https://cdn.example.com/receipt.jpg')).toBe(false)
    })
  })

  describe('fitImageDimensions', () => {
    it('scales landscape image proportionally within bounding box', () => {
      expect(fitImageDimensions(1600, 800, 80, 80)).toEqual({ width: 80, height: 40 })
    })

    it('scales portrait image proportionally within bounding box', () => {
      expect(fitImageDimensions(600, 1200, 80, 80)).toEqual({ width: 40, height: 80 })
    })

    it('handles non-positive dimensions safely', () => {
      expect(fitImageDimensions(0, 100, 80, 80)).toEqual({ width: 80, height: 80 })
    })
  })
})
