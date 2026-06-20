import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { deriveStatus } from './deriveStatus.ts'

Deno.test('reachable, db ok, fast response -> up', () => {
  assertEquals(deriveStatus({ reachable: true, dbStatus: 'ok', responseTimeMs: 120 }), 'up')
})

Deno.test('reachable, db error -> degraded', () => {
  assertEquals(deriveStatus({ reachable: true, dbStatus: 'error', responseTimeMs: 120 }), 'degraded')
})

Deno.test('reachable, db ok, very slow response -> degraded', () => {
  assertEquals(deriveStatus({ reachable: true, dbStatus: 'ok', responseTimeMs: 3500 }), 'degraded')
})

Deno.test('not reachable -> down regardless of db/responseTime', () => {
  assertEquals(deriveStatus({ reachable: false, dbStatus: null, responseTimeMs: null }), 'down')
})

Deno.test('reachable, no db check applicable (owner-dashboard-like), fast -> up', () => {
  assertEquals(deriveStatus({ reachable: true, dbStatus: null, responseTimeMs: 80 }), 'up')
})
