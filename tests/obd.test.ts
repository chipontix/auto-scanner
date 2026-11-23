import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asciiToBase64, base64ToAscii } from '../src/obd/base64';
import { decodeSupportedPids, mode01Data, responseMessages, isErrorReply } from '../src/obd/parse';
import { decodeDtc, parseDtcReply, describeDtc } from '../src/obd/dtc';
import { LIVE_PIDS } from '../src/obd/pids';
import { Elm327 } from '../src/obd/elm327';
import { DemoTransport } from '../src/obd/demoTransport';

test('base64 round trip', () => {
  for (const s of ['ATZ\r', '010C\r', 'a', 'ab', '0902\r']) {
    assert.equal(base64ToAscii(asciiToBase64(s)), s);
    assert.equal(asciiToBase64(s), Buffer.from(s).toString('base64'));
  }
});

test('mode 01 single frame, spaced and unspaced', () => {
  assert.deepEqual(mode01Data('410C1AF8\r\r', 0x0c), [0x1a, 0xf8]);
  assert.deepEqual(mode01Data('SEARCHING...\r41 0C 1A F8\r\r', 0x0c), [0x1a, 0xf8]);
  const rpm = LIVE_PIDS.find((p) => p.pid === 0x0c)!;
  assert.equal(rpm.decode([0x1a, 0xf8]), 1726);
});

test('NO DATA is an error', () => {
  assert.ok(isErrorReply('NO DATA\r\r'));
  assert.throws(() => mode01Data('NO DATA', 0x0c));
  assert.ok(!isErrorReply('410D32'));
});

test('supported PID bitmask', () => {
  // BE 3F A8 13 is a typical reply
  const pids = decodeSupportedPids(0, [0xbe, 0x3f, 0xa8, 0x13]);
  assert.ok(pids.includes(0x01) && pids.includes(0x0c) && pids.includes(0x20));
  assert.ok(!pids.includes(0x02));
});

test('DTC decoding', () => {
  assert.equal(decodeDtc(0x01, 0x71), 'P0171');
  assert.equal(decodeDtc(0xc1, 0x00), 'U0100');
  assert.equal(decodeDtc(0x41, 0x23), 'C0123');
  assert.equal(decodeDtc(0x0, 0x0), null);
  assert.deepEqual(parseDtcReply('430201710420', 0x43, true), ['P0171', 'P0420']);
  assert.deepEqual(parseDtcReply('43017104200000', 0x43, false).slice(0, 2), ['P0171', 'P0420']);
  assert.deepEqual(parseDtcReply('4300', 0x43, true), []);
  assert.match(describeDtc('P0171'), /Бедная/);
  assert.match(describeDtc('P1234'), /производителя/);
});

test('multi-frame CAN reply', () => {
  const raw = '014\r0:49020144454D4F\r1:56494E30303030\r2:303030303031\r\r';
  const msgs = responseMessages(raw);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].length, 20);
});

test('full session against the demo car', async () => {
  const elm = new Elm327(new DemoTransport());
  await elm.initialize();
  assert.equal(elm.protocolNumber, '6');
  assert.ok(elm.isCan);
  assert.ok(elm.supportedPids.has(0x0c) && elm.supportedPids.has(0x42));
  const speed = await elm.readPid(0x0d);
  assert.equal(speed.length, 1);
  assert.deepEqual(await elm.readDtcs(), { stored: ['P0171', 'P0420'], pending: [] });
  assert.equal(await elm.readVin(), 'DEMOVIN0000000001');
  assert.equal(await elm.readAdapterVoltage(), 14.1);
  assert.deepEqual(await elm.readStatus(), { milOn: true, dtcCount: 2 });
});
