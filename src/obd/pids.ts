// Standard OBD2 (SAE J1979) mode 01 sensors. These work on any car brand
// that has OBD2, as long as the car reports the PID as supported.

export interface PidDef {
  pid: number;
  name: string;
  unit: string;
  decimals: number;
  decode: (d: number[]) => number;
}

const A = (d: number[]) => d[0];
const AB = (d: number[]) => d[0] * 256 + d[1];

export const LIVE_PIDS: PidDef[] = [
  { pid: 0x0c, name: 'Обороты двигателя', unit: 'об/мин', decimals: 0, decode: (d) => AB(d) / 4 },
  { pid: 0x0d, name: 'Скорость', unit: 'км/ч', decimals: 0, decode: A },
  { pid: 0x05, name: 'Температура двигателя', unit: '°C', decimals: 0, decode: (d) => A(d) - 40 },
  { pid: 0x04, name: 'Нагрузка двигателя', unit: '%', decimals: 0, decode: (d) => (A(d) * 100) / 255 },
  { pid: 0x11, name: 'Положение дросселя', unit: '%', decimals: 0, decode: (d) => (A(d) * 100) / 255 },
  { pid: 0x0f, name: 'Температура воздуха на впуске', unit: '°C', decimals: 0, decode: (d) => A(d) - 40 },
  { pid: 0x0b, name: 'Давление во впуске', unit: 'кПа', decimals: 0, decode: A },
  { pid: 0x10, name: 'Расход воздуха', unit: 'г/с', decimals: 1, decode: (d) => AB(d) / 100 },
  { pid: 0x0e, name: 'Угол опережения зажигания', unit: '°', decimals: 1, decode: (d) => A(d) / 2 - 64 },
  { pid: 0x06, name: 'Коррекция топлива (краткоср.)', unit: '%', decimals: 1, decode: (d) => ((A(d) - 128) * 100) / 128 },
  { pid: 0x07, name: 'Коррекция топлива (долгоср.)', unit: '%', decimals: 1, decode: (d) => ((A(d) - 128) * 100) / 128 },
  { pid: 0x2f, name: 'Уровень топлива', unit: '%', decimals: 0, decode: (d) => (A(d) * 100) / 255 },
  { pid: 0x42, name: 'Напряжение (от блока)', unit: 'В', decimals: 1, decode: (d) => AB(d) / 1000 },
  { pid: 0x46, name: 'Температура снаружи', unit: '°C', decimals: 0, decode: (d) => A(d) - 40 },
  { pid: 0x5c, name: 'Температура масла', unit: '°C', decimals: 0, decode: (d) => A(d) - 40 },
  { pid: 0x33, name: 'Атмосферное давление', unit: 'кПа', decimals: 0, decode: A },
  { pid: 0x1f, name: 'Время с запуска двигателя', unit: 'с', decimals: 0, decode: AB },
  { pid: 0x21, name: 'Пробег с горящим Check Engine', unit: 'км', decimals: 0, decode: AB },
  { pid: 0x31, name: 'Пробег после сброса ошибок', unit: 'км', decimals: 0, decode: AB },
];

/** PID 01: is the Check Engine lamp on, and how many stored codes. */
export function decodeMonitorStatus(d: number[]): { milOn: boolean; dtcCount: number } {
  return { milOn: (d[0] & 0x80) !== 0, dtcCount: d[0] & 0x7f };
}

export function formatValue(def: PidDef, value: number): string {
  return value.toFixed(def.decimals);
}
