/**
 * Public VAPID Key for Web Push Notification.
 * Safe to be included in the client bundle.
 */
export const VAPID_PUBLIC_KEY = 'BMLoQBbriWY03kgcC8yF4XO7W_K9RdmN0Lbgl1Vu1OWe_NGyvWrnAFA-2xwsfjNPpFv0WGB-dYxfgKWKftehlTI'

// Helper function to convert the base64 URL-safe string to a Uint8Array
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
