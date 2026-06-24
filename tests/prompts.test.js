import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS, buildSystemPrompt } from '../js/prompts.js';

test('TOPICS tiene los 5 temas con label, icon y key', () => {
  const keys = Object.keys(TOPICS);
  assert.deepEqual(keys.sort(), ['familia', 'futbol', 'historia', 'musica', 'noticias']);
  for (const k of keys) {
    assert.equal(TOPICS[k].key, k);
    assert.ok(TOPICS[k].label.length > 0);
    assert.ok(TOPICS[k].icon.length > 0);
  }
});

test('buildSystemPrompt incluye el nombre del usuario', () => {
  const p = buildSystemPrompt('Dario', 'futbol', 'alto');
  assert.ok(p.includes('Dario'));
});

test('buildSystemPrompt incluye el tema legible', () => {
  const p = buildSystemPrompt('Dario', 'musica', 'alto');
  assert.ok(p.toLowerCase().includes('musica') || p.toLowerCase().includes('música'));
});

test('buildSystemPrompt nunca menciona terminos clinicos', () => {
  const p = buildSystemPrompt('Dario', 'noticias', 'alto').toLowerCase();
  for (const prohibido of ['terapia', 'acv', 'recuperación', 'recuperacion', 'ejercicio', 'paciente', 'cognitiv', 'nivel', 'dificultad']) {
    assert.ok(!p.includes(prohibido), `no debe contener: ${prohibido}`);
  }
});

test('buildSystemPrompt exige una sola pregunta a la vez', () => {
  const p = buildSystemPrompt('Dario', 'futbol', 'alto').toLowerCase();
  assert.ok(p.includes('una sola pregunta') || p.includes('una pregunta a la vez'));
});

test('nivel ALTO pide maxima paciencia y respuestas de una o dos palabras', () => {
  const p = buildSystemPrompt('Dario', 'futbol', 'alto').toLowerCase();
  assert.ok(p.includes('una o dos palabras'));
  assert.ok(p.includes('paciencia') || p.includes('paciente') || p.includes('despacio'));
});

test('nivel INTERMEDIO pide frases cortas de tres o cuatro palabras', () => {
  const p = buildSystemPrompt('Dario', 'futbol', 'intermedio').toLowerCase();
  assert.ok(p.includes('tres o cuatro palabras'));
});

test('nivel BAJO conversa de forma normal y fluida', () => {
  const p = buildSystemPrompt('Dario', 'futbol', 'bajo').toLowerCase();
  assert.ok(p.includes('normal') || p.includes('fluida') || p.includes('fluidez'));
});

test('nivel desconocido cae a ALTO (el mas seguro)', () => {
  const p = buildSystemPrompt('Dario', 'futbol', 'xxx').toLowerCase();
  assert.ok(p.includes('una o dos palabras'));
});

test('buildSystemPrompt con tema invalido usa charla general sin romper', () => {
  const p = buildSystemPrompt('Dario', 'inexistente', 'alto');
  assert.ok(p.includes('Dario'));
});
