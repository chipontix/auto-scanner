// Bluetooth LE link to an OBD2 adapter (Vgate iCar Pro BLE 4.0 and similar).
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Characteristic, Device, Subscription } from 'react-native-ble-plx';
import { asciiToBase64, base64ToAscii } from '../obd/base64';
import { Transport } from '../obd/transport';

let manager: BleManager | null = null;
export function bleManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

/** Ask Android for Bluetooth permissions. iOS asks by itself on first use. */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(res).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

const LIKELY_ADAPTER = /obd|elm|vlink|v-link|vgate|icar|obdlink|scan|car|kiwi|veepeak/i;

export function looksLikeAdapter(device: Device): boolean {
  return LIKELY_ADAPTER.test(device.name ?? device.localName ?? '');
}

/** Scan for nearby BLE devices. Returns a function that stops the scan. */
export function scanDevices(onDevice: (d: Device) => void, onError: (e: Error) => void): () => void {
  const m = bleManager();
  m.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) onError(error);
    else if (device && (device.name || device.localName)) onDevice(device);
  });
  return () => {
    m.stopDeviceScan();
  };
}

// Known UART-style services used by cheap and branded OBD2 BLE adapters.
const PREFERRED_SERVICES = ['fff0', 'ffe0', '18f0', 'e7810a71'];

function shortUuid(uuid: string): string {
  const u = uuid.toLowerCase();
  return u.startsWith('0000') ? u.slice(4, 8) : u.slice(0, 8);
}

export class BleTransport implements Transport {
  private listener: ((chunk: string) => void) | null = null;
  private subscription: Subscription | null = null;
  private writeChar!: Characteristic;
  private withoutResponse = false;

  private constructor(private device: Device) {}

  static async connect(deviceId: string): Promise<BleTransport> {
    const m = bleManager();
    let device = await m.connectToDevice(deviceId, { timeout: 15000 });
    device = await device.discoverAllServicesAndCharacteristics();
    const t = new BleTransport(device);
    await t.findCharacteristics();
    return t;
  }

  private async findCharacteristics() {
    const services = await this.device.services();
    services.sort((a, b) => {
      const ia = PREFERRED_SERVICES.indexOf(shortUuid(a.uuid));
      const ib = PREFERRED_SERVICES.indexOf(shortUuid(b.uuid));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    for (const service of services) {
      const chars = await service.characteristics();
      const notify = chars.find((c) => c.isNotifiable || c.isIndicatable);
      const write = chars.find((c) => c.isWritableWithoutResponse || c.isWritableWithResponse);
      if (notify && write) {
        this.writeChar = write;
        this.withoutResponse = write.isWritableWithoutResponse;
        this.subscription = notify.monitor((error, c) => {
          if (!error && c?.value) this.listener?.(base64ToAscii(c.value));
        });
        return;
      }
    }
    throw new Error('Это устройство не похоже на OBD2-адаптер: не найден канал для передачи данных.');
  }

  onData(listener: (chunk: string) => void) {
    this.listener = listener;
  }

  async write(text: string) {
    // BLE packets are small: send 20 bytes at a time.
    for (let i = 0; i < text.length; i += 20) {
      const part = asciiToBase64(text.slice(i, i + 20));
      if (this.withoutResponse) await this.writeChar.writeWithoutResponse(part);
      else await this.writeChar.writeWithResponse(part);
    }
  }

  async close() {
    this.subscription?.remove();
    await this.device.cancelConnection().catch(() => undefined);
  }

  onDisconnected(cb: () => void): Subscription {
    return bleManager().onDeviceDisconnected(this.device.id, () => cb());
  }
}
