import fs from 'fs';
import path from 'path';

// Fitur sementara: gunakan local JSON untuk nyimpan token kalibrasi
const STORE_PATH = path.join(process.cwd(), 'calibration-tokens.json');

export type CalibrationStatus = 'pending' | 'submitted' | 'completed';

export interface CalibrationToken {
  token: string;
  outlet_id: string;
  status: CalibrationStatus;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  address: string | null;
  expires_at: number; // timestamp
}

export function getTokens(): Record<string, CalibrationToken> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading calibration store', e);
  }
  return {};
}

export function saveTokens(tokens: Record<string, CalibrationToken>) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing calibration store', e);
  }
}

export function createToken(outlet_id: string): string {
  const tokens = getTokens();
  // Invalidasi token lama untuk outlet ini
  for (const t of Object.values(tokens)) {
    if (t.outlet_id === outlet_id && t.status === 'pending') {
      delete tokens[t.token]; // Hapus token lama
    }
  }
  
  const token = crypto.randomUUID();
  tokens[token] = {
    token,
    outlet_id,
    status: 'pending',
    lat: null,
    lng: null,
    accuracy: null,
    address: null,
    expires_at: Date.now() + 24 * 60 * 60 * 1000 // 24 jam
  };
  
  saveTokens(tokens);
  return token;
}

export function getToken(token: string): CalibrationToken | null {
  const tokens = getTokens();
  const t = tokens[token];
  if (!t) return null;
  if (t.expires_at < Date.now()) {
    delete tokens[token];
    saveTokens(tokens);
    return null;
  }
  return t;
}

export function updateToken(token: string, data: Partial<CalibrationToken>) {
  const tokens = getTokens();
  if (tokens[token]) {
    tokens[token] = { ...tokens[token], ...data };
    saveTokens(tokens);
  }
}

export function getTokensForOutlet(outlet_id: string): CalibrationToken[] {
  const tokens = getTokens();
  const now = Date.now();
  return Object.values(tokens).filter(t => {
    if (t.outlet_id === outlet_id) {
      if (t.expires_at < now && t.status === 'pending') {
         return false; // exclude expired pending tokens
      }
      return true;
    }
    return false;
  }).sort((a, b) => b.expires_at - a.expires_at); // terbaru di atas
}

export function deleteToken(token: string) {
  const tokens = getTokens();
  if (tokens[token]) {
    delete tokens[token];
    saveTokens(tokens);
  }
}
