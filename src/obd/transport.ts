// A transport moves raw text between the app and an ELM327-compatible adapter.
// The real one is Bluetooth LE; the demo one simulates a car for testing at home.
export interface Transport {
  write(text: string): Promise<void>;
  onData(listener: (chunk: string) => void): void;
  close(): Promise<void>;
}
