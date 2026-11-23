import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Elm327, hex } from '../obd/elm327';
import { Button } from './Button';
import { mono, ui } from './theme';

type Props = { elm: Elm327; deviceName: string; onDisconnect: () => void };

export function InfoScreen({ elm, deviceName, onDisconnect }: Props) {
  const [vin, setVin] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    elm.readVin().then(setVin, () => setVin(null));
  }, [elm]);

  const pids = [...elm.supportedPids].filter((p) => p % 0x20 !== 0).sort((a, b) => a - b);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>Машина</Text>
      <Row label="VIN" value={vin === undefined ? 'читаю…' : vin ?? 'машина не сообщает'} />
      <Row label="Протокол связи" value={elm.protocolName} />
      <Row label="Адаптер" value={`${deviceName} · ${elm.adapterVersion || '—'}`} />
      <Row label="Стандартных датчиков" value={String(pids.length)} />
      <View style={ui.card}>
        <Text style={ui.muted}>Поддерживаемые PID</Text>
        <Text style={[ui.text, { fontFamily: mono }]}>{pids.map(hex).join(' ') || '—'}</Text>
      </View>
      <Button title="Отключиться" secondary onPress={onDisconnect} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={ui.card}>
      <Text style={ui.muted}>{label}</Text>
      <Text style={ui.h2} selectable>
        {value}
      </Text>
    </View>
  );
}
