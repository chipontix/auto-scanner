// Talks to an ELM327-compatible adapter (Vgate iCar Pro and most OBD2 dongles).
import { Transport } from './transport';
import { parseDtcReply } from './dtc';
import { decodeSupportedPids, isErrorReply, mode01Data, responseMessages, ObdNoDataError } from './parse';
import { decodeMonitorStatus } from './pids';

export type LogEntry = { time: number; dir: 'out' | 'in' | 'info'; text: string };

const PROTOCOLS: Record<string, string> = {
  '1': 'SAE J1850 PWM',
  '2': 'SAE J1850 VPW',
  '3': 'ISO 9141-2 (K-line)',
  '4': 'ISO 14230-4 KWP (K-line, 5 baud)',
  '5': 'ISO 14230-4 KWP (K-line, быстрый)',
  '6': 'ISO 15765-4 CAN (11 бит, 500 кбит/с)',
  '7': 'ISO 15765-4 CAN (29 бит, 500 кбит/с)',
  '8': 'ISO 15765-4 CAN (11 бит, 250 кбит/с)',
  '9': 'ISO 15765-4 CAN (29 бит, 250 кбит/с)',
  A: 'SAE J1939 CAN',
};

export class Elm327 {
  private buffer = '';
  private pending: { resolve: (s: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private logListeners: ((e: LogEntry) => void)[] = [];

  adapterVersion = '';
  protocolNumber = '';
  supportedPids = new Set<number>();

  constructor(private transport: Transport) {
    transport.onData((chunk) => this.handleData(chunk));
  }

  get protocolName(): string {
    return PROTOCOLS[this.protocolNumber] ?? (this.protocolNumber ? `Протокол ${this.protocolNumber}` : 'не определён');
  }

  get isCan(): boolean {
    return ['6', '7', '8', '9', 'A'].includes(this.protocolNumber);
  }

  onLog(listener: (e: LogEntry) => void) {
    this.logListeners.push(listener);
  }

  private log(dir: LogEntry['dir'], text: string) {
    const entry = { time: Date.now(), dir, text };
    this.logListeners.forEach((l) => l(entry));
  }

  private handleData(chunk: string) {
    this.buffer += chunk;
    const end = this.buffer.indexOf('>');
    if (end >= 0 && this.pending) {
      const reply = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.resolve(reply);
    }
  }

  /** Send one command and wait for the ">" prompt. Commands run one at a time. */
  send(cmd: string, timeoutMs = 4000): Promise<string> {
    const run = () =>
      new Promise<string>((resolve, reject) => {
        this.buffer = '';
        const timer = setTimeout(() => {
          this.pending = null;
          this.log('info', `Нет ответа на ${cmd}`);
          reject(new Error(`Адаптер не ответил на ${cmd}`));
        }, timeoutMs);
        this.pending = {
          resolve: (s) => {
            this.log('in', s.replace(/[\r\n]+/g, ' ').trim());
            resolve(s);
          },
          reject,
          timer,
        };
        this.log('out', cmd);
        this.transport.write(cmd + '\r').catch((e) => {
          clearTimeout(timer);
          this.pending = null;
          reject(e);
        });
      });
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Reset the adapter, connect to the car and learn which sensors it has. */
  async initialize(): Promise<void> {
    const reset = await this.send('ATZ', 6000);
    this.adapterVersion = reset.replace(/[\r\n>]+/g, ' ').replace(/ATZ/i, '').trim();
    for (const cmd of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', 'ATSP0']) {
      await this.send(cmd);
    }
    // First real request makes the adapter search for the car's protocol. It can be slow.
    const first = await this.send('0100', 15000);
    if (isErrorReply(first)) {
      throw new Error(
        'Машина не ответила. Проверьте, что зажигание включено (или двигатель заведён), и адаптер плотно вставлен в разъём.',
      );
    }
    this.supportedPids = new Set(decodeSupportedPids(0x00, mode01Data(first, 0x00)));
    for (const base of [0x20, 0x40, 0x60]) {
      if (!this.supportedPids.has(base)) break;
      try {
        const data = mode01Data(await this.send(`01${hex(base)}`), base);
        decodeSupportedPids(base, data).forEach((p) => this.supportedPids.add(p));
      } catch {
        break;
      }
    }
    const dp = await this.send('ATDPN');
    this.protocolNumber = dp.replace(/[^0-9A-C]/gi, '').replace(/^A(?=[0-9A-C])/i, '').toUpperCase().slice(-1);
  }

  async readPid(pid: number): Promise<number[]> {
    return mode01Data(await this.send(`01${hex(pid)}`), pid);
  }

  async readStatus() {
    return decodeMonitorStatus(await this.readPid(0x01));
  }

  /** Battery voltage measured by the adapter itself. Works on every car. */
  async readAdapterVoltage(): Promise<number | null> {
    const reply = await this.send('ATRV');
    const m = /(\d+(?:\.\d+)?)\s*V/i.exec(reply);
    return m ? parseFloat(m[1]) : null;
  }

  async readDtcs(): Promise<{ stored: string[]; pending: string[] }> {
    const read = async (mode: string, responseMode: number) => {
      try {
        return parseDtcReply(await this.send(mode, 8000), responseMode, this.isCan);
      } catch (e) {
        if (e instanceof ObdNoDataError) return [];
        throw e;
      }
    };
    return { stored: await read('03', 0x43), pending: await read('07', 0x47) };
  }

  async readVin(): Promise<string | null> {
    try {
      const msgs = responseMessages(await this.send('0902', 8000));
      // CAN cars send the VIN in one long message; older cars in several short ones.
      let text = '';
      for (const msg of msgs) {
        if (msg[0] !== 0x49 || msg[1] !== 0x02) continue;
        const body = msg.slice(3); // skip mode, PID and the frame/count byte
        text += String.fromCharCode(...body.filter((b) => b >= 0x30 && b <= 0x5a));
        if (this.isCan && text.length >= 17) break;
      }
      if (text.length >= 17) return text.slice(-17);
    } catch {
      // Some cars do not report VIN over standard OBD2.
    }
    return null;
  }

  async close() {
    await this.transport.close();
  }
}

export function hex(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0');
}
