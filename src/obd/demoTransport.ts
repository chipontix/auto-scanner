// A pretend car + adapter, so the app can be tried without a real car.
// It answers like an ELM327 connected to a CAN car (similar to a VW Polo).
import { Transport } from './transport';
import { hex } from './elm327';

const SUPPORTED = [0x01, 0x04, 0x05, 0x06, 0x07, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x11, 0x1f, 0x20, 0x21, 0x31, 0x33, 0x40, 0x42, 0x46];

function bitmask(base: number): string {
  const bytes = [0, 0, 0, 0];
  for (const pid of SUPPORTED) {
    const offset = pid - base - 1;
    if (offset >= 0 && offset < 32) bytes[offset >> 3] |= 0x80 >> (offset & 7);
  }
  return bytes.map(hex).join('');
}

export class DemoTransport implements Transport {
  private listener: ((chunk: string) => void) | null = null;
  private started = Date.now();

  onData(listener: (chunk: string) => void) {
    this.listener = listener;
  }

  async write(text: string) {
    const cmd = text.trim().toUpperCase();
    const reply = this.answer(cmd);
    // Reply in small pieces with a short delay, like Bluetooth does.
    setTimeout(() => {
      const full = reply + '\r\r>';
      for (let i = 0; i < full.length; i += 20) this.listener?.(full.slice(i, i + 20));
    }, 40);
  }

  async close() {}

  private answer(cmd: string): string {
    const t = (Date.now() - this.started) / 1000;
    const wave = (period: number) => (Math.sin((t * 2 * Math.PI) / period) + 1) / 2;
    const rpm = Math.round(800 + 2400 * wave(12));
    const speed = Math.round(Math.max(0, 90 * wave(12) - 10));

    if (cmd === 'ATZ') return 'ELM327 v1.5 (демо)';
    if (cmd === 'ATRV') return '14.1V';
    if (cmd === 'ATDPN') return 'A6';
    if (cmd.startsWith('AT')) return 'OK';

    const pidMatch = /^01([0-9A-F]{2})$/.exec(cmd);
    if (pidMatch) {
      const pid = parseInt(pidMatch[1], 16);
      if ([0x00, 0x20, 0x40].includes(pid)) return `41${pidMatch[1]}${bitmask(pid)}`;
      if (!SUPPORTED.includes(pid)) return 'NO DATA';
      const data: Record<number, number[]> = {
        0x01: [0x82, 0x07, 0xe5, 0x00],
        0x04: [Math.round(40 + 120 * wave(12))],
        0x05: [Math.round(40 + Math.min(90, t * 2))],
        0x06: [126],
        0x07: [131],
        0x0b: [Math.round(30 + 60 * wave(12))],
        0x0c: [((rpm * 4) >> 8) & 0xff, (rpm * 4) & 0xff],
        0x0d: [speed],
        0x0e: [Math.round((12 + 64) * 2)],
        0x0f: [40 + 18],
        0x11: [Math.round(30 + 150 * wave(12))],
        0x1f: [(Math.round(t) >> 8) & 0xff, Math.round(t) & 0xff],
        0x21: [0x00, 0x2a],
        0x31: [0x04, 0xd2],
        0x33: [92],
        0x42: [0x37, 0x14],
        0x46: [40 + 3],
      };
      return `41${pidMatch[1]}${(data[pid] ?? [0]).map(hex).join('')}`;
    }
    if (cmd === '03') return '430201710420';
    if (cmd === '07') return '4700';
    if (cmd === '0902') {
      const vin = 'DEMOVIN0000000001';
      const hexVin = '490201' + [...vin].map((c) => hex(c.charCodeAt(0))).join('');
      const frames = ['014'];
      for (let i = 0, n = 0; i < hexVin.length; i += 14, n++) frames.push(`${n.toString(16).toUpperCase()}:${hexVin.slice(i, i + 14)}`);
      return frames.join('\r');
    }
    return '?';
  }
}
