import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { getConfig, saveConfig, DEFAULT_CONFIG, VOICES, LEVELS } = await import('../js/config.js');

beforeEach(() => store.clear());

test('DEFAULT_CONFIG usa Dario, volumen 1 y nivel alto', () => {
  assert.equal(DEFAULT_CONFIG.name, 'Dario');
  assert.equal(DEFAULT_CONFIG.volume, 1);
  assert.equal(DEFAULT_CONFIG.level, 'alto');
  assert.ok(DEFAULT_CONFIG.voiceId.length > 0);
});

test('VOICES ofrece exactamente 3 voces con id y label', () => {
  assert.equal(VOICES.length, 3);
  for (const v of VOICES) {
    assert.ok(v.id.length > 0);
    assert.ok(v.label.length > 0);
  }
});

test('LEVELS ofrece alto, intermedio y bajo con label', () => {
  assert.deepEqual(LEVELS.map((l) => l.key), ['alto', 'intermedio', 'bajo']);
  for (const l of LEVELS) assert.ok(l.label.length > 0);
});

test('saveConfig guarda el nivel', () => {
  saveConfig({ level: 'intermedio' });
  assert.equal(getConfig().level, 'intermedio');
});

test('getConfig sin datos devuelve los valores por defecto', () => {
  assert.deepEqual(getConfig(), DEFAULT_CONFIG);
});

test('saveConfig hace merge parcial y persiste', () => {
  saveConfig({ name: 'Don Pedro' });
  assert.equal(getConfig().name, 'Don Pedro');
  assert.equal(getConfig().volume, 1);
});

test('saveConfig guarda volumen y voz', () => {
  saveConfig({ volume: 0.5, voiceId: VOICES[1].id });
  assert.equal(getConfig().volume, 0.5);
  assert.equal(getConfig().voiceId, VOICES[1].id);
});

test('getConfig tolera JSON corrupto y cae al default', () => {
  localStorage.setItem('charlemos_config', '{no es json');
  assert.deepEqual(getConfig(), DEFAULT_CONFIG);
});
