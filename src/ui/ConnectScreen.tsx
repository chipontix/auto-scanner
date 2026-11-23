import { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { Device } from 'react-native-ble-plx';
import { looksLikeAdapter, requestBlePermissions, scanDevices } from '../ble/bleTransport';
import { isWebBluetoothAvailable } from '../ble/webBluetoothTransport';
import { Button } from './Button';
import { colors, ui } from './theme';

type Props = {
  onConnect: (deviceId: string, name: string) => Promise<void>;
  onConnectWeb: () => Promise<void>;
  onDemo: () => Promise<void>;
  error: string | null;
};

export function ConnectScreen({ onConnect, onConnectWeb, onDemo, error }: Props) {
  const isWeb = Platform.OS === 'web';
  const webBt = isWeb && isWebBluetoothAvailable();
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const startScan = async () => {
    setScanError(null);
    if (!(await requestBlePermissions())) {
      setScanError('Нужно разрешить приложению доступ к Bluetooth в настройках телефона.');
      return;
    }
    setDevices([]);
    setScanning(true);
    stopRef.current = scanDevices(
      (d) =>
        setDevices((list) => {
          if (list.some((x) => x.id === d.id)) return list;
          const next = [...list, d];
          return next.sort((a, b) => Number(looksLikeAdapter(b)) - Number(looksLikeAdapter(a)));
        }),
      (e) => {
        setScanError(`Bluetooth: ${e.message}. Проверьте, что Bluetooth включён.`);
        setScanning(false);
      },
    );
    setTimeout(() => {
      stopRef.current?.();
      setScanning(false);
    }, 12000);
  };

  const connect = async (d: Device) => {
    stopRef.current?.();
    setScanning(false);
    setBusyId(d.id);
    try {
      await onConnect(d.id, d.name ?? d.localName ?? 'Адаптер');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Text style={ui.title}>Подключение к машине</Text>
      <View style={ui.card}>
        <Text style={ui.text}>
          1. Вставьте адаптер в разъём OBD2 (под рулём, слева).{'\n'}
          2. Включите зажигание или заведите двигатель.{'\n'}
          3. Включите Bluetooth на телефоне. Подключать адаптер в настройках телефона не нужно.
        </Text>
      </View>

      {isWeb ? (
        webBt ? (
          <>
            <Button title="Выбрать адаптер" onPress={onConnectWeb} />
            <Text style={ui.muted}>Откроется список устройств. Выберите адаптер (у Vgate он называется IOS-Vlink или похоже).</Text>
          </>
        ) : (
          <View style={ui.card}>
            <Text style={[ui.h2, { color: colors.warn }]}>Этот браузер не умеет Bluetooth</Text>
            <Text style={ui.text}>
              На iPhone установите бесплатное приложение Bluefy из App Store и откройте эту ссылку в нём. На Android откройте ссылку в Chrome.
            </Text>
          </View>
        )
      ) : (
        <Button title={scanning ? 'Ищу адаптер…' : 'Найти адаптер'} onPress={startScan} busy={scanning && devices.length === 0} />
      )}

      {(scanError || error) && <Text style={ui.error}>{scanError ?? error}</Text>}

      <FlatList
        scrollEnabled={false}
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => connect(item)} disabled={busyId !== null} style={[ui.card, { flexDirection: 'row', alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <Text style={ui.h2}>{item.name ?? item.localName}</Text>
              <Text style={ui.muted}>{looksLikeAdapter(item) ? 'Похоже на OBD2-адаптер' : 'Другое устройство'}</Text>
            </View>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>{busyId === item.id ? 'Подключаю…' : 'Подключить'}</Text>
          </Pressable>
        )}
      />

      <View style={{ height: 8 }} />
      <Button title="Демо-режим (без машины)" secondary onPress={onDemo} />
      <Text style={ui.muted}>Демо показывает, как работает приложение, на выдуманных данных.</Text>
    </ScrollView>
  );
}
