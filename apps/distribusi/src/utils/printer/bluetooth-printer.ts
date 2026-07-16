import { usePrinterStore, WebBluetoothDevice } from './printerStore';
import { EscPosEncoder } from './escpos-encoder';
import { loadImageRaster } from './escpos-image';
import { type QrLayout, DEFAULT_PRINT_LAYOUT } from '../printLayout';

// Standard UUIDs for Bluetooth Printers (SPP or custom GATT)
// Often thermal printers use this generic service UUID for data transfer:
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

// Some use these custom UUIDs (very common for Chinese thermal printers like PANDA PRJ-58D)
const CUSTOM_SERVICE_UUID_1 = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const CUSTOM_CHARACTERISTIC_UUID_1 = '49535343-8841-43f4-a8d4-ecbe34729bb3';
const CUSTOM_SERVICE_UUID_2 = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
const CUSTOM_CHARACTERISTIC_UUID_2 = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';

const SERVICES = [
  PRINTER_SERVICE_UUID,
  CUSTOM_SERVICE_UUID_1,
  CUSTOM_SERVICE_UUID_2,
  '000018f0-0000-1000-8000-00805f9b34fb' // commonly used generic 16-bit UUID
];

// @ts-ignore
async function connectToDevice(device: BluetoothDevice, store: any) {
  if (!device.gatt) throw new Error('Perangkat tidak mendukung GATT Bluetooth.');

  const server = await device.gatt.connect();
  let targetCharacteristic = null;

  for (const serviceUuid of SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid.toLowerCase());
      const characteristics = await service.getCharacteristics();
      // @ts-ignore
      targetCharacteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
      if (targetCharacteristic) break;
    } catch (err) {
      // Skip
    }
  }

  if (!targetCharacteristic) {
    throw new Error('Tidak menemukan layanan cetak pada printer ini. Pastikan ini adalah printer thermal yang kompatibel.');
  }

  store.setDevice(device as WebBluetoothDevice, targetCharacteristic);
  
  // Simpan ID agar bisa auto-connect nantinya
  if (device.id) {
    localStorage.setItem('saved_printer_id', device.id);
  }
  
  return true;
}

export async function connectBluetoothPrinter() {
  const store = usePrinterStore.getState();
  store.setConnecting(true);

  try {
    // @ts-ignore
    if (!navigator.bluetooth) {
      throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome versi terbaru.');
    }

    // @ts-ignore
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [CUSTOM_SERVICE_UUID_1] },
        { services: [CUSTOM_SERVICE_UUID_2] },
        { services: [PRINTER_SERVICE_UUID] },
        { namePrefix: 'PANDA' },
        { namePrefix: 'PRJ' },
        { namePrefix: 'Printer' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'MTP' }
      ],
      optionalServices: [CUSTOM_SERVICE_UUID_1, CUSTOM_SERVICE_UUID_2, PRINTER_SERVICE_UUID, '000018f0-0000-1000-8000-00805f9b34fb']
    });

    return await connectToDevice(device, store);
  } catch (error: any) {
    console.error('Koneksi Bluetooth gagal:', error);
    store.setError(error.message);
    return false;
  }
}

export async function autoConnectBluetoothPrinter() {
  const store = usePrinterStore.getState();
  
  try {
    const savedId = localStorage.getItem('saved_printer_id');
    if (!savedId) return false;

    // @ts-ignore - getDevices is a newer Web Bluetooth API feature
    if (navigator.bluetooth && navigator.bluetooth.getDevices) {
      store.setConnecting(true);
      // @ts-ignore
      const devices = await navigator.bluetooth.getDevices();
      const device = devices.find((d: any) => d.id === savedId);
      
      if (device) {
        return await connectToDevice(device, store);
      }
    }
  } catch (error: any) {
    console.warn('Auto-connect Bluetooth gagal, abaikan saja:', error);
  } finally {
    if (store.isConnecting) {
      store.setConnecting(false);
    }
  }
  return false;
}

export async function printQRViaBluetooth(
  docNumber: string,
  dataUrl: string,
  layout: QrLayout = DEFAULT_PRINT_LAYOUT.qr_surat_jalan,
  extra?: { tanggal?: string; tujuanOutlet?: string; verificationCode?: string }
) {
  const store = usePrinterStore.getState();
  if (!store.characteristic) {
    throw new Error('Printer belum terkoneksi');
  }

  const encoder = new EscPosEncoder();
  const width = layout.paperWidth === 80 ? 48 : 32;
  const bigText = (layout.fontSizePx ?? 0) >= 16;
  const boldText = layout.bold !== false;
  const footerText = layout.footerText || '';

  // --- BEGIN RECEIPT GENERATION ---
  encoder.initialize();

  encoder.alignCenter().bold(true);
  
  // Title
  if (layout.title) {
    encoder.size(false, bigText).line(layout.title).size(false, false).newline();
  }

  // Subtitle (docNumber)
  encoder.line(docNumber).newline();

  // Extra (Tanggal & Tujuan)
  encoder.size(false, false).bold(false);
  if (extra?.tujuanOutlet) {
    encoder.line(`Tujuan: ${extra.tujuanOutlet}`);
  }
  if (extra?.tanggal) {
    encoder.line(`Tgl: ${extra.tanggal}`);
  }
  encoder.newline();

  // QR Code Image
  try {
    // Usually a 58mm printer can handle max 384 dots.
    // 400px QR might be slightly large, but loadImageRaster will resize to maxDots
    const maxDots = layout.paperWidth === 80 ? 250 : 180; // Reasonable size for QR
    const raster = await loadImageRaster(dataUrl, maxDots);
    if (raster) {
      encoder.alignCenter().raster(raster.bytes, raster.widthBytes, raster.height).newline();
    }
  } catch (err) {
    console.warn('Failed to load QR image for bluetooth printing', err);
    encoder.line('[ ERROR LOAD QR ]').newline();
  }

  if (extra?.verificationCode) {
    encoder.alignCenter().bold(true).size(false, false).line(`KODE: ${extra.verificationCode}`).bold(false);
  }

  encoder.newline();
  
  // Footer
  if (footerText) {
    encoder.size(false, false).bold(boldText);
    encoder.alignCenter();
    for (const ln of footerText.split('\n')) {
      encoder.line(ln);
    }
    encoder.newline();
  }

  encoder.cut();
  // --- END RECEIPT GENERATION ---

  const payload = encoder.encode();
  
  // Safe chunking logic: send small chunks to prevent buffer overflow or split \r\n
  const maxChunkSize = 128; 
  try {
    for (let i = 0; i < payload.length; i += maxChunkSize) {
      const chunk = payload.slice(i, i + maxChunkSize);
      await store.characteristic.writeValue(chunk);
      // Increased delay to allow printer to process buffer properly
      await new Promise(r => setTimeout(r, 40)); 
    }
  } catch (err: any) {
    console.error('Print chunk failed:', err);
    throw new Error('Gagal mencetak: ' + err.message);
  }
}
