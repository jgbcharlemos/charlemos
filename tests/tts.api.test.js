import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/tts.js';
import { VOICES } from '../js/config.js';

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(obj) { this.body = obj; return this; },
    send(buf) { this.body = buf; return this; },
    end(buf) { if (buf) this.body = buf; return this; },
  };
}

beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = 'el-test';
});

test('rechaza no-POST con 405', async () => {
  const res = makeRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
});

test('devuelve 400 si falta text', async () => {
  const res = makeRes();
  await handler({ method: 'POST', body: {} }, res);
  assert.equal(res.statusCode, 400);
});

test('llama a ElevenLabs con la voz de la lista blanca y devuelve audio', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const res = makeRes();
  await handler({ method: 'POST', body: { text: 'Hola Dario', voiceId: VOICES[1].id } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'audio/mpeg');
  assert.ok(calls[0].url.includes(VOICES[1].id));
  assert.equal(calls[0].opts.headers['xi-api-key'], 'el-test');
});

test('un voiceId no permitido cae a VOICES[0] (lista blanca)', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };
  const res = makeRes();
  await handler({ method: 'POST', body: { text: 'Hola', voiceId: 'id-arbitrario-malicioso' } }, res);
  assert.ok(calls[0].includes(VOICES[0].id));
  assert.ok(!calls[0].includes('id-arbitrario-malicioso'));
});

test('sin voiceId usa VOICES[0] por defecto', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };
  const res = makeRes();
  await handler({ method: 'POST', body: { text: 'Hola' } }, res);
  assert.ok(calls[0].includes(VOICES[0].id));
});

test('devuelve 502 si ElevenLabs falla', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'no auth' });
  const res = makeRes();
  await handler({ method: 'POST', body: { text: 'Hola' } }, res);
  assert.equal(res.statusCode, 502);
});
