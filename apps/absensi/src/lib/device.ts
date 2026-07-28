import { UAParser } from 'ua-parser-js'

export function getDeviceInfo(userAgent: string) {
  const parser = new UAParser(userAgent)
  const osResult = parser.getOS()
  const deviceResult = parser.getDevice()

  const os = osResult.name ? `${osResult.name} ${osResult.version || ''}`.trim() : 'Unknown OS'
  
  // Use vendor/model if available, fallback to browser for desktops
  let device = 'Unknown Device'
  if (deviceResult.vendor || deviceResult.model) {
    device = `${deviceResult.vendor || ''} ${deviceResult.model || ''}`.trim()
  } else if (osResult.name === 'Mac OS' || osResult.name === 'Windows' || osResult.name === 'Linux') {
    // For desktop, it usually doesn't have a specific mobile device model, so let's just say PC/Laptop 
    device = 'PC/Laptop'
  }

  return { os, device }
}
