// Helpers that turn raw ELM327 text into data bytes.

const ERROR_MARKERS = [
  'NO DATA',
  'UNABLE TO CONNECT',
  'CAN ERROR',
  'BUS ERROR',
  'BUS BUSY',
  'FB ERROR',
  'DATA ERROR',
  'STOPPED',
  'ERROR',
  '?',
];

export class ObdNoDataError extends Error {}

/** Split an adapter reply into clean lines, dropping echo, prompts and status text. */
export function cleanLines(raw: string): string[] {
  return raw
    .replace(/>/g, '')
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^SEARCHING/i.test(l) && !/^BUS INIT/i.test(l));
}

/** True when the reply is an error such as NO DATA rather than real data. */
export function isErrorReply(raw: string): boolean {
  const lines = cleanLines(raw);
  if (lines.length === 0) return true;
  return lines.every((l) => ERROR_MARKERS.some((m) => l.toUpperCase().includes(m)));
}

/**
 * Turn the reply to an OBD request into one byte array per ECU message.
 * Handles single-frame lines ("410C1AF8"), spaced lines ("41 0C 1A F8")
 * and ELM327 multi-frame CAN replies ("014" + "0:4902...", "1:...").
 */
export function responseMessages(raw: string): number[][] {
  if (isErrorReply(raw)) throw new ObdNoDataError(cleanLines(raw).join(' ') || 'NO DATA');
  const lines = cleanLines(raw).map((l) => l.replace(/\s+/g, '').toUpperCase());

  const messages: number[][] = [];
  let multi: { length: number; hex: string } | null = null;

  for (const line of lines) {
    // Multi-frame header: total byte count, e.g. "014" (3 hex digits only).
    if (/^[0-9A-F]{3}$/.test(line)) {
      if (multi) messages.push(hexToBytes(multi.hex).slice(0, multi.length));
      multi = { length: parseInt(line, 16), hex: '' };
      continue;
    }
    const frame = /^([0-9A-F]):([0-9A-F]+)$/.exec(line);
    if (frame && multi) {
      multi.hex += frame[2];
      continue;
    }
    if (/^[0-9A-F]+$/.test(line) && line.length % 2 === 0) {
      messages.push(hexToBytes(line));
    }
  }
  if (multi) messages.push(hexToBytes(multi.hex).slice(0, multi.length));
  return messages;
}

export function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/** Data bytes (after mode and PID) of the first ECU that answered a mode 01 request. */
export function mode01Data(raw: string, pid: number): number[] {
  for (const msg of responseMessages(raw)) {
    if (msg[0] === 0x41 && msg[1] === pid) return msg.slice(2);
  }
  throw new ObdNoDataError('NO DATA');
}

/** Decode the bitmask reply to PID 00/20/40/... into the list of supported PIDs. */
export function decodeSupportedPids(base: number, data: number[]): number[] {
  const pids: number[] = [];
  for (let byte = 0; byte < 4; byte++) {
    for (let bit = 0; bit < 8; bit++) {
      if ((data[byte] ?? 0) & (0x80 >> bit)) pids.push(base + byte * 8 + bit + 1);
    }
  }
  return pids;
}
