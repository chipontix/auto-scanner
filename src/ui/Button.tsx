import { ActivityIndicator, Pressable, Text } from 'react-native';
import { ui } from './theme';

type Props = { title: string; onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean };

export function Button({ title, onPress, secondary, busy, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [ui.button, secondary && ui.buttonSecondary, (pressed || disabled) && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={ui.buttonText}>{title}</Text>}
    </Pressable>
  );
}
