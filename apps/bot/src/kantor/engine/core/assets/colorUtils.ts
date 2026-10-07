// Diporting dari pixel-agents-hq/pixel-agents @3537e140 (MIT, (c) 2026 Pablo De Lucca). Lihat public/kantor/assets/KREDIT.md.
/**
 * Pure color conversion utilities — no external dependencies.
 */

import { PNG_ALPHA_THRESHOLD } from './constants';

export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a < PNG_ALPHA_THRESHOLD) return '';
  const rgb =
    `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
  if (a >= 255) return rgb;
  return `${rgb}${a.toString(16).padStart(2, '0').toUpperCase()}`;
}
