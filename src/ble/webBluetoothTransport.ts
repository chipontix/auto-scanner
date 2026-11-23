// Bluetooth LE link for the browser version (Web Bluetooth).
// On iPhone this works in the free Bluefy browser; on Android in Chrome.
import { Transport } from '../obd/transport';

// UART-style services used by OBD2 BLE adapters (Vgate iCar Pro uses FFF0).
const OBD_SERVICES: (number | string)[] = [0xfff0, 0xffe0, 0x18f0, 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];

// Minimal typings, so we do not need the DOM Bluetooth type package.
type Char = {
  properties: { notify: boolean; indicate: boolean; write: boolean; writeWithoutResponse: boolean };
  startNotifications(): Promise<Char>;
  addEventListener(type: 'characteristicvaluechanged', cb: (e: { target: { value: DataView } }) => void): void;
  writeValueWithResponse?(data: Uint8Array): Promise<void>;
  writeValueWithoutResponse?(data: Uint8Array): Promise<void>;
  writeValue(data: Uint8Array): Promise<void>;
};
type Service = { getCharacteristics(): Promise<Char[]> };
type Gatt = { connected: boolean; connect(): Promise<Gatt>; disconnect(): void; getPrimaryServices(): Promise<Service[]> };
type BtDevice = { name?: string; gatt?: Gatt; addEventListener(type: 'gattserverdisconnected', cb: () => void): void };

function bluetooth(): { requestDevice(opts: object): Promise<BtDevice> } | null {
  const nav = (globalThis as { navigator?: { bluetooth?: unknown } }).navigator;
  return (nav?.bluetooth as ReturnType<typeof bluetooth>) ?? null;
}

export function isWebBluetoothAvailable(): boolean {
  return bluetooth() !== null;
}

export class WebBluetoothTransport implements Transport {
  private listener: ((chunk: string) => void) | null = null;
  private writeChar!: Char;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  private constructor(private device: BtDevice) {}

  get name(): string {
    return this.device.name || 'Адаптер';
  }

  /** Opens the browser's own device chooser. Must be called from a button tap. */
  static async pickAndConnect(): Promise<WebBluetoothTransport> {
    const bt = bluetooth();
    if (!bt) throw new Error('Этот браузер не поддерживает Bluetooth. На iPhone откройте ссылку в приложении Bluefy.');
    const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: OBD_SERVICES });
    const t = new WebBluetoothTransport(device);
    await t.setup();
    return t;
  }

  private async setup() {
    const gatt = await this.device.gatt!.connect();
    const services = await gatt.getPrimaryServices();
    for (const service of services) {
      const chars = await service.getCharacteristics();
      const notify = chars.find((c) => c.properties.notify || c.properties.indicate);
      const write = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (notify && write) {
        this.writeChar = write;
        await notify.startNotifications();
        notify.addEventListener('characteristicvaluechanged', (e) => {
          this.listener?.(this.decoder.decode(e.target.value));
        });
        return;
      }
    }
    gatt.disconnect();
    throw new Error('Это устройство не похоже на OBD2-адаптер: не найден канал для передачи данных.');
  }

  onData(listener: (chunk: string) => void) {
    this.listener = listener;
  }

  onDisconnected(cb: () => void) {
    this.device.addEventListener('gattserverdisconnected', cb);
  }

  async write(text: string) {
    const bytes = this.encoder.encode(text);
    for (let i = 0; i < bytes.length; i += 20) {
      const part = bytes.slice(i, i + 20);
      const c = this.writeChar;
      if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) await c.writeValueWithoutResponse(part);
      else if (c.writeValueWithResponse) await c.writeValueWithResponse(part);
      else await c.writeValue(part);
    }
  }

  async close() {
    if (this.device.gatt?.connected) this.device.gatt.disconnect();
  }
}
