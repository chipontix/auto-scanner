import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BleTransport } from './src/ble/bleTransport';
import { WebBluetoothTransport } from './src/ble/webBluetoothTransport';
import { DemoTransport } from './src/obd/demoTransport';
import { Elm327, LogEntry } from './src/obd/elm327';
import { Transport } from './src/obd/transport';
import { ConnectScreen } from './src/ui/ConnectScreen';
import { ErrorsScreen } from './src/ui/ErrorsScreen';
import { InfoScreen } from './src/ui/InfoScreen';
import { LiveScreen } from './src/ui/LiveScreen';
import { LogScreen } from './src/ui/LogScreen';
import { colors, ui } from './src/ui/theme';

type Tab = 'live' | 'errors' | 'info' | 'log';
const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: 'Датчики' },
  { key: 'errors', label: 'Ошибки' },
  { key: 'info', label: 'Машина' },
  { key: 'log', label: 'Журнал' },
];

export default function App() {
  const [elm, setElm] = useState<Elm327 | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [tab, setTab] = useState<Tab>('live');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<LogEntry[]>([]);
  const manualDisconnect = useRef(false);

  const start = useCallback(async (transport: Transport, name: string) => {
    const client = new Elm327(transport);
    logRef.current = [];
    client.onLog((e) => {
      logRef.current = [...logRef.current.slice(-2000), e];
      setLog(logRef.current);
    });
    setStatus('Связываюсь с машиной…');
    try {
      await client.initialize();
      setDeviceName(name);
      setTab('live');
      setElm(client);
    } catch (e) {
      await client.close();
      setError((e as Error).message);
    } finally {
      setStatus(null);
    }
  }, []);

  const connectBle = async (deviceId: string, name: string) => {
    setError(null);
    setStatus('Подключаюсь к адаптеру…');
    try {
      const transport = await BleTransport.connect(deviceId);
      manualDisconnect.current = false;
      transport.onDisconnected(() => {
        if (manualDisconnect.current) return;
        setElm(null);
        setError('Связь с адаптером потеряна.');
      });
      await start(transport, name);
    } catch (e) {
      setStatus(null);
      setError(`Не удалось подключиться: ${(e as Error).message}`);
    }
  };

  const connectWeb = async () => {
    setError(null);
    let transport: WebBluetoothTransport;
    try {
      transport = await WebBluetoothTransport.pickAndConnect();
    } catch (e) {
      const err = e as Error;
      // The person closed the device chooser without picking anything.
      if (err.name !== 'NotFoundError') setError(`Не удалось подключиться: ${err.message}`);
      return;
    }
    manualDisconnect.current = false;
    transport.onDisconnected(() => {
      if (manualDisconnect.current) return;
      setElm(null);
      setError('Связь с адаптером потеряна.');
    });
    await start(transport, transport.name);
  };

  const disconnect = async () => {
    manualDisconnect.current = true;
    const current = elm;
    setElm(null);
    await current?.close();
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        {status ? (
          <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[ui.text, { textAlign: 'center' }]}>{status}</Text>
            <Text style={[ui.muted, { textAlign: 'center' }]}>В первый раз это может занять до 15 секунд.</Text>
          </View>
        ) : !elm ? (
          <ConnectScreen
            error={error}
            onConnect={connectBle}
            onConnectWeb={connectWeb}
            onDemo={() => {
              setError(null);
              return start(new DemoTransport(), 'Демо');
            }}
          />
        ) : (
          <>
            <View style={{ flex: 1 }}>
              {tab === 'live' && <LiveScreen elm={elm} active />}
              {tab === 'errors' && <ErrorsScreen elm={elm} />}
              {tab === 'info' && <InfoScreen elm={elm} deviceName={deviceName} onDisconnect={disconnect} />}
              {tab === 'log' && <LogScreen entries={log} />}
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
              {TABS.map((t) => (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: tab === t.key ? colors.accent : colors.muted, fontWeight: tab === t.key ? '700' : '500' }}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
