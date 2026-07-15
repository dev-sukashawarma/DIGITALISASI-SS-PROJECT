import { printerStore, WebBluetoothDevice } from './printerStore'

const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
const CUSTOM_SERVICE_UUID_1 = '49535343-fe7d-4ae5-8fa9-9fafd205e455'
const CUSTOM_SERVICE_UUID_2 = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'

const SERVICES = [PRINTER_SERVICE_UUID, CUSTOM_SERVICE_UUID_1, CUSTOM_SERVICE_UUID_2]
const SAVED_ID_KEY = 'admin_saved_printer_id'

async function connectToDevice(device: any): Promise<boolean> {
  if (!device.gatt) throw new Error('Perangkat tidak mendukung GATT Bluetooth.')

  const server = await device.gatt.connect()
  let targetCharacteristic: any = null

  for (const serviceUuid of SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid.toLowerCase())
      const characteristics = await service.getCharacteristics()
      targetCharacteristic = characteristics.find(
        (c: any) => c.properties.write || c.properties.writeWithoutResponse,
      )
      if (targetCharacteristic) break
    } catch {
      // service tidak ada di device ini, lanjut
    }
  }

  if (!targetCharacteristic) {
    throw new Error(
      'Tidak menemukan layanan cetak pada printer ini. Pastikan ini printer thermal yang kompatibel.',
    )
  }

  printerStore.setDevice(device as WebBluetoothDevice, targetCharacteristic)
  if (device.id) localStorage.setItem(SAVED_ID_KEY, device.id)
  return true
}

export async function connectBluetoothPrinter(): Promise<boolean> {
  printerStore.setConnecting(true)
  try {
    if (!(navigator as any).bluetooth) {
      throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge terbaru.')
    }
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: [CUSTOM_SERVICE_UUID_1] },
        { services: [CUSTOM_SERVICE_UUID_2] },
        { services: [PRINTER_SERVICE_UUID] },
        { namePrefix: 'PANDA' },
        { namePrefix: 'PRJ' },
        { namePrefix: 'Printer' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'MTP' },
      ],
      optionalServices: [CUSTOM_SERVICE_UUID_1, CUSTOM_SERVICE_UUID_2, PRINTER_SERVICE_UUID],
    })
    return await connectToDevice(device)
  } catch (error: any) {
    printerStore.setError(error?.message ?? 'Koneksi gagal')
    return false
  }
}

export async function autoConnectBluetoothPrinter(): Promise<boolean> {
  try {
    const savedId = localStorage.getItem(SAVED_ID_KEY)
    if (!savedId) return false
    const bt = (navigator as any).bluetooth
    if (bt && bt.getDevices) {
      printerStore.setConnecting(true)
      const devices = await bt.getDevices()
      const device = devices.find((d: any) => d.id === savedId)
      if (device) return await connectToDevice(device)
    }
  } catch {
    // abaikan; auto-connect best-effort
  } finally {
    if (printerStore.getState().isConnecting) printerStore.setConnecting(false)
  }
  return false
}

export function disconnectBluetoothPrinter(): void {
  printerStore.disconnect()
}

/** Kirim payload ESC/POS ke printer terhubung (chunk 256 byte). */
export async function printBytes(payload: Uint8Array): Promise<void> {
  const { characteristic } = printerStore.getState()
  if (!characteristic) throw new Error('Printer belum terkoneksi')

  const maxChunkSize = 256
  for (let i = 0; i < payload.length; i += maxChunkSize) {
    const chunk = payload.slice(i, i + maxChunkSize)
    await characteristic.writeValue(chunk)
    await new Promise((r) => setTimeout(r, 20))
  }
}

/**
 * Fallback cetak lewat hidden iframe + window.print() saat printer Bluetooth
 * tidak terhubung. `html` adalah dokumen struk lengkap.
 */
export function printHtmlFallback(html: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve()
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const cleanup = () => setTimeout(() => iframe.parentNode?.removeChild(iframe), 500)
    const doc = iframe.contentWindow?.document
    const win = iframe.contentWindow
    if (!doc || !win) {
      cleanup()
      return resolve()
    }
    doc.open()
    doc.write(html)
    doc.close()

    setTimeout(() => {
      try {
        win.focus()
        win.print()
      } finally {
        cleanup()
        resolve()
      }
    }, 300)
  })
}
