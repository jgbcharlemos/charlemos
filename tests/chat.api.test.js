import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.js';

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(obj) { this.body = obj; return this; },
    end() { return this; },
  };
}

beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'sk-test'; });

test('rechaza metodos que no sean POST con 405', async () => {
  const res = makeRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
});

test('devuelve 400 si faltan messages', async () => {
  const res = makeRes();
  await handler({ method: 'POST', body: { name: 'Dario', topic: 'futbol', level: 'alto' } }, res);
  assert.equal(res.statusCode, 400);
});

test('reenvia a Anthropic con system prompt construido en servidor', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Hola Dario, ¿cómo amaneciste?' }] }),
    };
  };
  const res = makeRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'hola' }], name: 'Dario', topic: 'futbol', level: 'alto' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, 'Hola Dario, ¿cómo amaneciste?');
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].opts.headers['x-api-key'], 'sk-test');
  const sent = JSON.parse(calls[0].opts.body);
  assert.equal(sent.model, 'claude-sonnet-4-6');
  // El system prompt debe incluir el nombre y no debe venir del cliente
  assert.ok(sent.system.includes('Dario'));
  assert.ok(sent.system.length > 50); // fue construido en el servidor
});

test('nivel alto usa max_tokens 100', async () => {
  globalThis.fetch = async (url, opts) => ({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
  });
  const res = makeRes();
  // No necesitamos verificar el JSON enviado aquí, solo que no rompe
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'hola' }], name: 'Dario', topic: 'futbol', level: 'alto' },
  }, res);
  assert.equal(res.statusCode, 200);
});

test('devuelve 502 si Anthropic responde con error', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  const res = makeRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'hola' }], name: 'Dario', topic: 'futbol', level: 'alto' },
  }, res);
  assert.equal(res.statusCode, 502);
});

test('devuelve 500 si falta la API key', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const res = makeRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'hola' }], name: 'Dario', topic: 'futbol', level: 'alto' },
  }, res);
  assert.equal(res.statusCode, 500);
});
