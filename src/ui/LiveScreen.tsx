import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Elm327 } from '../obd/elm327';
import { LIVE_PIDS, formatValue } from '../obd/pids';
import { colors, ui } from './theme';

type Props = { elm: Elm327; active: boolean };

export function LiveScreen({ elm, active }: Props) {
  const pids = useMemo(() => LIVE_PIDS.filter((p) => elm.supportedPids.has(p.pid)), [elm]);
  const [values, setValues] = useState<Record<number, number>>({});
  const [voltage, setVoltage] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    (async () => {
      // Read every supported sensor in turn, again and again, while this tab is open.
      while (!stopped) {
        for (const def of pids) {
          if (stopped) return;
          try {
            const v = def.decode(await elm.readPid(def.pid));
            setValues((old) => ({ ...old, [def.pid]: v }));
          } catch {
            // Skip a sensor that did not answer this time.
          }
        }
        try {
          setVoltage(await elm.readAdapterVoltage());
        } catch {}
        if (pids.length === 0) await new Promise((r) => setTimeout(r, 1000));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [elm, pids, active]);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>Датчики</Text>
      <Text style={ui.muted}>Машина отдаёт {pids.length} из {LIVE_PIDS.length} стандартных датчиков.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile name="Аккумулятор (адаптер)" value={voltage != null ? voltage.toFixed(1) : '—'} unit="В" />
        {pids.map((def) => (
          <Tile key={def.pid} name={def.name} value={values[def.pid] != null ? formatValue(def, values[def.pid]) : '—'} unit={def.unit} />
        ))}
      </View>
    </ScrollView>
  );
}

function Tile({ name, value, unit }: { name: string; value: string; unit: string }) {
  return (
    <View style={[ui.card, { width: '48%', flexGrow: 1, minHeight: 96, justifyContent: 'space-between' }]}>
      <Text style={ui.muted} numberOfLines={2}>
        {name}
      </Text>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {value} <Text style={{ fontSize: 15, color: colors.muted, fontWeight: '400' }}>{unit}</Text>
      </Text>
    </View>
  );
}
