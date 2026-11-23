import { ScrollView, Share, Text, View } from 'react-native';
import type { LogEntry } from '../obd/elm327';
import { Button } from './Button';
import { colors, mono, ui } from './theme';

function formatLog(entries: LogEntry[]): string {
  return entries
    .map((e) => {
      const t = new Date(e.time).toISOString().slice(11, 23);
      const arrow = e.dir === 'out' ? '→' : e.dir === 'in' ? '←' : '·';
      return `${t} ${arrow} ${e.text}`;
    })
    .join('\n');
}

export function LogScreen({ entries }: { entries: LogEntry[] }) {
  const last = entries.slice(-300);
  return (
    <View style={ui.screen}>
      <View style={[ui.content, { paddingBottom: 0 }]}>
        <Text style={ui.title}>Журнал</Text>
        <Text style={ui.muted}>Все команды адаптеру и его ответы. Если что-то не работает, отправьте журнал разработчику.</Text>
        <Button title="Поделиться журналом" onPress={() => Share.share({ message: formatLog(entries) })} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text selectable style={{ color: colors.muted, fontFamily: mono, fontSize: 12 }}>
          {formatLog(last) || 'Пока пусто'}
        </Text>
      </ScrollView>
    </View>
  );
}
