/** Constants shared by the fixtures: an invented workspace, a fixed "now", and image URLs. */
export const WORKSPACE = '9001';
export const T0 = Date.UTC(2026, 10, 2, 3, 0, 0);
export const HOUR = 3_600_000;

export const IMAGE_URL = 'https://t9001.p.clickup-attachments.com/t9001/mockup-1.png';
export const IMAGE_URL_2 = 'https://t9001.p.clickup-attachments.com/t9001/mockup-2.png';

/** The smallest valid PNG header plus padding: enough for type sniffing. */
export function pngBytes(seed = 1): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, seed, seed, seed, seed]);
}
