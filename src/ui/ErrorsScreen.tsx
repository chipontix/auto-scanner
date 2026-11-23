import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Elm327 } from '../obd/elm327';
import { describeDtc } from '../obd/dtc';
import { Button } from './Button';
import { colors, ui } from './theme';

type Result = { milOn: boolean | null; stored: string[]; pending: string[] };

export function ErrorsScreen({ elm }: { elm: Elm327 }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      let milOn: boolean | null = null;
      try {
        milOn = (await elm.readStatus()).milOn;
      } catch {}
      const { stored, pending } = await elm.readDtcs();
      setResult({ milOn, stored, pending });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>Ошибки двигателя</Text>
      <Text style={ui.muted}>
        Здесь только стандартные ошибки OBD2 (двигатель и экология). Приложение их только читает и ничего не стирает.
      </Text>
      <Button title="Проверить ошибки" onPress={check} busy={busy} />
      {error && <Text style={ui.error}>{error}</Text>}

      {result && (
        <>
          {result.milOn != null && (
            <View style={ui.card}>
              <Text style={[ui.h2, { color: result.milOn ? colors.warn : colors.ok }]}>
                {result.milOn ? 'Check Engine горит' : 'Check Engine не горит'}
              </Text>
            </View>
          )}
          <Section title="Сохранённые ошибки" codes={result.stored} empty="Ошибок нет 👍" />
          <Section title="Ожидающие (появились недавно)" codes={result.pending} empty="Нет" />
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, codes, empty }: { title: string; codes: string[]; empty: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.h2}>{title}</Text>
      {codes.length === 0 ? (
        <Text style={ui.muted}>{empty}</Text>
      ) : (
        codes.map((c) => (
          <View key={c} style={ui.card}>
            <Text style={[ui.h2, { color: colors.warn }]}>{c}</Text>
            <Text style={ui.text}>{describeDtc(c)}</Text>
          </View>
        ))
      )}
    </View>
  );
}
