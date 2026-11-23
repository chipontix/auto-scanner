// Minimal ASCII <-> base64 helpers. BLE libraries pass bytes as base64 strings.
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function asciiToBase64(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 3) {
    const a = text.charCodeAt(i) & 0xff;
    const b = i + 1 < text.length ? text.charCodeAt(i + 1) & 0xff : NaN;
    const c = i + 2 < text.length ? text.charCodeAt(i + 2) & 0xff : NaN;
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63];
    out += Number.isNaN(b) ? '=' : CHARS[(n >> 6) & 63];
    out += Number.isNaN(c) ? '=' : CHARS[n & 63];
  }
  return out;
}

export function base64ToAscii(b64: string): string {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (CHARS.indexOf(clean[i]) << 18) |
      (CHARS.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? CHARS.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? CHARS.indexOf(clean[i + 3]) : 0);
    out += String.fromCharCode((n >> 16) & 0xff);
    if (i + 2 < clean.length) out += String.fromCharCode((n >> 8) & 0xff);
    if (i + 3 < clean.length) out += String.fromCharCode(n & 0xff);
  }
  return out;
}
