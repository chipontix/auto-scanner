import { Platform, StyleSheet } from 'react-native';

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const colors = {
  bg: '#0F1419',
  card: '#1A2129',
  border: '#2A333D',
  text: '#F2F5F7',
  muted: '#8B98A5',
  accent: '#3BA7FF',
  ok: '#3DD68C',
  warn: '#FFB020',
  bad: '#FF5C5C',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 17, fontWeight: '600' },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: colors.bad, fontSize: 15, lineHeight: 21 },
});
