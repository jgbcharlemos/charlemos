# Plan: Charlemos — PWA de conversación para adulto mayor post-ACV

Goal: Construir una PWA instalable en Android donde "Dario" (80 años, recuperación post-ACV, habla atrofiada en mejora) escoge un tema y conversa por voz con una IA cálida que se adapta a su nivel de habla (alto/intermedio/bajo), estimulando habla y memoria sin lenguaje clínico.

Architecture:
- **Frontend 100% vanilla** (HTML + CSS + JS modular, sin frameworks). Una sola página `index.html` con 4 pantallas (bienvenida, temas, conversación, ajustes) que se muestran/ocultan por JS.
- **Backend = 2 funciones serverless en Vercel** (`/api/chat`, `/api/tts`) que actúan de proxy seguro a Anthropic y ElevenLabs. Las API keys NUNCA llegan al navegador.
- **Voz del usuario:** Web Speech API (`SpeechRecognition`) en el navegador (Chrome Android lo soporta).
- **Voz de la IA:** ElevenLabs TTS vía `/api/tts`, reproducida con `Audio` + blob URL.
- **Estado de conversación:** array de mensajes en memoria; system prompt construido por tema + nombre. Cierre suave tras 5-6 intercambios.
- **Configuración:** `localStorage` (nombre, voz, volumen).
- **PWA:** `manifest.json` + `service-worker.js` (cache-first del shell estático; las rutas `/api/*` siempre van a red).

Tech stack: HTML5, CSS3, JavaScript ES modules (navegador), Node.js 20 (funciones serverless Vercel, usando `fetch` global — sin SDK), Node test runner (`node:test`) para la lógica pura, Vercel para hosting.

Decisión de despliegue: **Vercel** (elegido por Dario; primera app → instrucciones para principiante absoluto).

---

## Convenciones de nombres (consistencia entre tareas)

- `buildSystemPrompt(name, topic, level)` → string (en `js/prompts.js`). `level` ∈ `{'alto','intermedio','bajo'}`.
- `TOPICS` → objeto `{ futbol, historia, noticias, familia, musica }` con `{ label, icon, key }` (en `js/prompts.js`).
- `LEVELS` → array `[{ key:'alto', label }, { key:'intermedio', label }, { key:'bajo', label }]` (en `js/config.js`).
- `getConfig()` / `saveConfig(partial)` → objeto `{ name, voiceId, volume, level }` (en `js/config.js`).
- `DEFAULT_CONFIG = { name: 'Dario', voiceId: '<VOZ_1>', volume: 1, level: 'alto' }`.
- `VOICES` → array de 3 `{ id, label }` (en `js/config.js`).
- `createConversation(name, topic, level)` (en `js/conversation.js`).
- `sendChat(messages, systemPrompt)` → `Promise<string>` (en `js/conversation.js`, llama a `/api/chat`).
- `speak(text, voiceId, volume)` → `Promise<void>` (en `js/tts.js`, llama a `/api/tts`).
- `createRecognizer({ onResult, onError, onEnd })` → `{ start, stop, supported }` (en `js/speech.js`).
- Funciones serverless exportan `export default async function handler(req, res)`.
- Modelo Anthropic: `claude-sonnet-4-6`. Endpoint: `https://api.anthropic.com/v1/messages`, header `anthropic-version: 2023-06-01`.

---

## File Map

Archivos a crear (todos nuevos; el repo está vacío):

```
Terapia_Habla/
├── index.html                      # Shell + las 4 pantallas
├── css/
│   └── styles.css                  # Diseño cálido, alto contraste, botones enormes
├── js/
│   ├── app.js                      # Controlador: navegación entre pantallas, wiring de eventos
│   ├── config.js                   # localStorage: nombre, voz, volumen + VOICES + DEFAULT_CONFIG
│   ├── prompts.js                  # TOPICS + buildSystemPrompt()
│   ├── conversation.js             # Estado de mensajes + sendChat() → /api/chat
│   ├── tts.js                      # speak() → /api/tts + reproducción de audio
│   └── speech.js                   # createRecognizer() Web Speech API (STT)
├── api/
│   ├── chat.js                     # Serverless: proxy seguro a Anthropic
│   └── tts.js                      # Serverless: proxy seguro a ElevenLabs
├── icons/
│   ├── icon-192.png                # Ícono PWA 192x192 (dos personas conversando)
│   ├── icon-512.png                # Ícono PWA 512x512
│   └── icon-maskable-512.png       # Ícono maskable (con padding de seguridad)
├── manifest.json                   # Manifiesto PWA
├── service-worker.js               # Cache del shell estático
├── vercel.json                     # Config de Vercel (rutas, runtime Node)
├── package.json                    # type:module, scripts de test, engines
├── .env.example                    # Plantilla de variables de entorno
├── .gitignore                      # Ignora node_modules, .env, .vercel
├── README.md                       # Despliegue Vercel + instalación Android (para principiante)
└── tests/
    ├── prompts.test.js             # Tests de buildSystemPrompt + TOPICS
    ├── config.test.js              # Tests de getConfig/saveConfig (con localStorage mock)
    ├── chat.api.test.js            # Test del handler /api/chat con fetch mockeado
    └── tts.api.test.js             # Test del handler /api/tts con fetch mockeado
```

Para que `js/config.js`, `js/prompts.js`, `api/chat.js` y `api/tts.js` sean testeables con `node:test`, se escriben como ES modules con `export`. El navegador los carga con `<script type="module">`.

---

## Tareas

### Task 1: Scaffolding del proyecto (package.json, .gitignore, .env.example)

**Files:** `package.json`, `.gitignore`, `.env.example`

**Steps:**

1. Crear `package.json`:
```json
{
  "name": "charlemos",
  "version": "1.0.0",
  "description": "PWA de conversacion calida para acompanamiento del habla",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  },
  "engines": {
    "node": ">=20"
  }
}
```

2. Crear `.gitignore`:
```
node_modules/
.env
.env.local
.vercel
.DS_Store
*.log
```

3. Crear `.env.example`:
```
# Copia este archivo como .env y rellena tus claves reales.
# En Vercel estas mismas variables se configuran en Settings -> Environment Variables.
ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui
ELEVENLABS_API_KEY=tu-clave-de-elevenlabs-aqui
ELEVENLABS_VOICE_ID=id-de-voz-por-defecto
```

4. Run: `node --version` → Expected: imprime `v20.x` o superior (confirma runtime). Si imprime menor, instalar Node 20.

5. Run: `npm test` → Expected (aún sin tests):
```
# tests 0
# pass 0
# fail 0
```

6. Commit: `chore: scaffolding del proyecto Charlemos (package.json, gitignore, env)`

---

### Task 2: Lógica de temas y system prompt (`js/prompts.js`) — TDD

**Files:** `tests/prompts.test.js`, `js/prompts.js`

**Steps:**

1. Write failing test — `tests/prompts.test.js`:
```js
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
```

2. Run: `npm test` → Expected: falla con `Cannot find module '../js/prompts.js'` (o todos los tests en rojo).

3. Implement — `js/prompts.js`:
```js
// Temas disponibles. icon = emoji mostrado en el boton grande.
export const TOPICS = {
  futbol:   { key: 'futbol',   label: 'Fútbol',   icon: '⚽' },
  historia: { key: 'historia', label: 'Historia', icon: '📖' },
  noticias: { key: 'noticias', label: 'Noticias', icon: '🌎' },
  familia:  { key: 'familia',  label: 'Familia',  icon: '👨‍👩‍👧' },
  musica:   { key: 'musica',   label: 'Música',   icon: '🎵' },
};

// Pista de enfoque por tema (lo que la IA debe sacar a relucir sutilmente).
const TOPIC_FOCUS = {
  futbol:   'Hablen de fútbol: equipos, jugadores favoritos, partidos memorables, la Selección Colombia. Si hay un torneo importante en curso (Mundial, Copa América), menciónalo con naturalidad.',
  historia: 'Hablen de historia y recuerdos del pasado: cómo era la vida antes, lugares, fechas, personajes que él admire.',
  noticias: 'Hablen de temas de actualidad de forma ligera y positiva: el clima, la ciudad, algún evento cultural. Evita política tensa o noticias angustiantes.',
  familia:  'Hablen de su familia: hijos, nietos, hermanos, recuerdos compartidos, nombres y anécdotas cariñosas.',
  musica:   'Hablen de música: canciones y artistas que él disfruta, boleros, vallenato, tangos, recuerdos asociados a una canción.',
};

const GENERAL_FOCUS = 'Conversen de forma libre y cálida sobre su día, sus recuerdos y las cosas que disfruta.';

// Adaptacion segun que tan afectada esta el habla. NUNCA se le revela al
// usuario; solo cambia el comportamiento interno de la IA. Cae a 'alto' (lo
// mas paciente y seguro) si llega un valor desconocido.
const LEVEL_GUIDANCE = {
  alto: [
    `Él habla con mucha dificultad y muy despacio, así que ten la MÁXIMA paciencia.`,
    `- Haz preguntas extremadamente simples y concretas, de las que se contestan con una o dos palabras (un nombre, un color, un "sí me gusta" + una palabra).`,
    `- Dale todo el tiempo del mundo. Si su respuesta es una sola palabra, celébrala como un logro enorme.`,
    `- Si no entiendes lo que dijo, jamás lo hagas notar: repite la misma idea con una pregunta aún más sencilla, ofreciéndole opciones ("¿te gusta más el café o el chocolate?").`,
    `- Usa frases muy cortas y claras, una idea por frase.`,
  ],
  intermedio: [
    `Él ya habla bastante mejor, aunque todavía con algo de esfuerzo.`,
    `- Haz preguntas sencillas que inviten a respuestas de tres o cuatro palabras.`,
    `- Anímalo con suavidad a dar un detalle más ("¿y de qué color era?", "¿quién más estaba?").`,
    `- Si se traba, baja la complejidad sin señalarlo y sigue con cariño.`,
  ],
  bajo: [
    `Él ya conversa muy bien y con fluidez.`,
    `- Conversa de forma normal y natural, como una charla cualquiera entre amigos.`,
    `- Haz preguntas abiertas e interesantes que lo inviten a contar historias completas.`,
    `- Mantén el ritmo ágil y entretenido, sin simplificar de más.`,
  ],
};

/**
 * Construye el system prompt interno para la conversacion.
 * @param {string} name  Nombre del usuario (ej. "Dario").
 * @param {string} topic Clave de TOPICS o cualquier valor (cae a charla general).
 * @param {string} level 'alto' | 'intermedio' | 'bajo' (cae a 'alto').
 * @returns {string}
 */
export function buildSystemPrompt(name, topic, level) {
  const safeName = (name && name.trim()) || 'Dario';
  const focus = TOPIC_FOCUS[topic] || GENERAL_FOCUS;
  const guidance = LEVEL_GUIDANCE[level] || LEVEL_GUIDANCE.alto;

  return [
    `Eres un amigo cercano y cálido conversando con Don ${safeName}, un señor mayor de ochenta años.`,
    `Él disfruta de una buena charla. Tu única misión es acompañarlo con una conversación natural, humana y entretenida, como lo haría un viejo amigo que lo aprecia.`,
    ``,
    `Reglas de tu forma de hablar:`,
    `- Habla siempre en español colombiano, con tono cálido, pausado y respetuoso.`,
    `- Haz UNA sola pregunta a la vez, nunca varias juntas.`,
    `- Nunca preguntes cosas de "sí o no": tus preguntas siempre deben invitar a que diga algo más.`,
    `- Invita con naturalidad a que mencione cosas concretas: nombres de personas o jugadores, lugares, fechas, canciones, emociones.`,
    `- Si su respuesta es muy corta, confusa o no encaja, NO se lo señales: simplemente vuelve a preguntar lo mismo de una forma más sencilla y cariñosa.`,
    `- Celebra cada respuesta con entusiasmo genuino y breve antes de seguir ("¡Qué bueno!", "¡Me encanta eso!").`,
    `- Mantén tus mensajes cortos: una celebración breve + una sola pregunta. Frases sencillas.`,
    `- Después de unos cinco o seis intercambios, cierra con calidez, agradécele la charla y propón seguir conversando otro día.`,
    ``,
    `Qué tanto debes simplificar hoy:`,
    ...guidance,
    ``,
    `Tema de hoy: ${focus}`,
    ``,
    `Prohibido absolutamente: nunca uses lenguaje clínico ni de salud; nunca digas las palabras "terapia", "ejercicio", "paciente" ni "recuperación", ni nada que suene a salud o a una clase con grados de exigencia. Él solo está disfrutando de una conversación con un amigo.`,
    ``,
    `Empieza tú la conversación con un saludo cálido y una primera pregunta abierta sobre el tema.`,
  ].join('\n');
}
```

4. Run: `npm test` → Expected:
```
# pass 11
# fail 0
```

5. Commit: `feat: temas, niveles de dificultad y system prompt (prompts.js) con tests`

---

### Task 3: Configuración en localStorage (`js/config.js`) — TDD

**Files:** `tests/config.test.js`, `js/config.js`

**Steps:**

1. Write failing test — `tests/config.test.js`:
```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock minimo de localStorage para entorno Node.
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
  assert.equal(getConfig().volume, 1); // se mantiene el default
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
```

2. Run: `npm test` → Expected: falla con `Cannot find module '../js/config.js'`.

3. Implement — `js/config.js`:
```js
// Las 3 voces ofrecidas. Reemplaza estos IDs por voces reales de tu cuenta
// de ElevenLabs (español latino). El primero es el valor por defecto.
// Estos IDs son voces multilingües publicas de ElevenLabs como punto de partida.
export const VOICES = [
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Voz masculina cálida' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Voz masculina serena' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Voz femenina suave' },
];

// Niveles de adaptacion del habla. Los gestiona el familiar desde Ajustes y se
// suben/bajan a medida que Dario mejora. 'bajo' = ya habla muy bien (la meta).
export const LEVELS = [
  { key: 'alto',        label: 'Apenas empezando (mucha ayuda)' },
  { key: 'intermedio',  label: 'Va mejorando' },
  { key: 'bajo',        label: 'Habla muy bien (charla normal)' },
];

export const DEFAULT_CONFIG = {
  name: 'Dario',
  voiceId: VOICES[0].id,
  volume: 1,
  level: 'alto',
};

const STORAGE_KEY = 'charlemos_config';

/** Lee la configuracion guardada, fusionada sobre los valores por defecto. */
export function getConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Guarda un cambio parcial de configuracion (merge sobre lo existente). */
export function saveConfig(partial) {
  const next = { ...getConfig(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
```

4. Run: `npm test` → Expected:
```
# pass 19
# fail 0
```

5. Commit: `feat: configuracion persistente, voces y niveles (config.js) con tests`

---

### Task 4: Función serverless `/api/chat` (proxy a Anthropic) — TDD

**Files:** `tests/chat.api.test.js`, `api/chat.js`

**Steps:**

1. Write failing test — `tests/chat.api.test.js`:
```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.js';

// Helpers para simular req/res de Vercel.
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
  await handler({ method: 'POST', body: { system: 'hola' } }, res);
  assert.equal(res.statusCode, 400);
});

test('reenvia a Anthropic y devuelve el texto de la respuesta', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Hola Rodrigo, ¿cómo amaneciste?' }] }),
    };
  };
  const res = makeRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'hola' }], system: 'eres un amigo' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, 'Hola Rodrigo, ¿cómo amaneciste?');
  // Verifica que la API key viajo en el header y el modelo es el correcto.
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].opts.headers['x-api-key'], 'sk-test');
  const sent = JSON.parse(calls[0].opts.body);
  assert.equal(sent.model, 'claude-sonnet-4-6');
  assert.equal(sent.system, 'eres un amigo');
});

test('devuelve 502 si Anthropic responde con error', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  const res = makeRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'hola' }], system: 's' },
  }, res);
  assert.equal(res.statusCode, 502);
});

test('devuelve 500 si falta la API key', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const res = makeRes();
  await handler({
    method: 'POST',
    body: { messages: [{ role: 'user', content: 'hola' }], system: 's' },
  }, res);
  assert.equal(res.statusCode, 500);
});
```

2. Run: `npm test` → Expected: falla con `Cannot find module '../api/chat.js'`.

3. Implement — `api/chat.js`:
```js
// Funcion serverless (Vercel). Proxy seguro hacia la API de Anthropic.
// La ANTHROPIC_API_KEY vive solo aqui, en el servidor; nunca llega al navegador.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en el servidor' });
  }

  const { messages, system } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Faltan messages' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: system || '',
        messages,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('Anthropic error', upstream.status, detail);
      return res.status(502).json({ error: 'Error al hablar con la IA' });
    }

    const data = await upstream.json();
    const reply = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('chat handler error', err);
    return res.status(502).json({ error: 'Error al hablar con la IA' });
  }
}
```

4. Run: `npm test` → Expected:
```
# pass 24
# fail 0
```

5. Commit: `feat: funcion serverless /api/chat proxy a Anthropic con tests`

---

### Task 5: Función serverless `/api/tts` (proxy a ElevenLabs) — TDD

**Files:** `tests/tts.api.test.js`, `api/tts.js`

**Steps:**

1. Write failing test — `tests/tts.api.test.js`:
```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/tts.js';

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
  process.env.ELEVENLABS_VOICE_ID = 'voz-default';
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

test('llama a ElevenLabs con la voz indicada y devuelve audio', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const res = makeRes();
  await handler({ method: 'POST', body: { text: 'Hola Rodrigo', voiceId: 'voz-elegida' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'audio/mpeg');
  assert.ok(calls[0].url.includes('voz-elegida'));
  assert.equal(calls[0].opts.headers['xi-api-key'], 'el-test');
});

test('usa la voz por defecto del entorno si no se envia voiceId', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };
  const res = makeRes();
  await handler({ method: 'POST', body: { text: 'Hola' } }, res);
  assert.ok(calls[0].includes('voz-default'));
});

test('devuelve 502 si ElevenLabs falla', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'no auth' });
  const res = makeRes();
  await handler({ method: 'POST', body: { text: 'Hola' } }, res);
  assert.equal(res.statusCode, 502);
});
```

2. Run: `npm test` → Expected: falla con `Cannot find module '../api/tts.js'`.

3. Implement — `api/tts.js`:
```js
// Funcion serverless (Vercel). Proxy seguro hacia ElevenLabs (text-to-speech).
// Devuelve audio/mpeg crudo que el navegador reproduce.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta ELEVENLABS_API_KEY en el servidor' });
  }

  const { text, voiceId } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Falta text' });
  }

  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID;
  if (!voice) {
    return res.status(500).json({ error: 'Falta ELEVENLABS_VOICE_ID en el servidor' });
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'xi-api-key': apiKey,
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('ElevenLabs error', upstream.status, detail);
      return res.status(502).json({ error: 'Error al generar la voz' });
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audio);
  } catch (err) {
    console.error('tts handler error', err);
    return res.status(502).json({ error: 'Error al generar la voz' });
  }
}
```

4. Run: `npm test` → Expected:
```
# pass 29
# fail 0
```

5. Commit: `feat: funcion serverless /api/tts proxy a ElevenLabs con tests`

---

### Task 6: Captura de voz del usuario (`js/speech.js`)

**Files:** `js/speech.js`

> Nota: la Web Speech API solo existe en el navegador, no en Node, por eso no lleva test automatizado; se verifica manualmente en la Task 12.

**Steps:**

1. Implement — `js/speech.js`:
```js
// Envuelve la Web Speech API (reconocimiento de voz) en español.
// Chrome para Android la soporta. Devuelve un objeto con start/stop/supported.
export function createRecognizer({ onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    return { supported: false, start() {}, stop() {} };
  }

  const recognition = new SR();
  recognition.lang = 'es-CO';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    onResult?.(transcript);
  };
  recognition.onerror = (event) => onError?.(event.error);
  recognition.onend = () => onEnd?.();

  return {
    supported: true,
    start() {
      try { recognition.start(); } catch { /* ya estaba activo */ }
    },
    stop() {
      try { recognition.stop(); } catch { /* ignore */ }
    },
  };
}
```

2. Verify (revisión manual de sintaxis): Run: `node --check js/speech.js` → Expected: sin salida (sintaxis válida; los `window.*` no se evalúan).

3. Commit: `feat: captura de voz del usuario con Web Speech API (speech.js)`

---

### Task 7: Reproducción de voz de la IA (`js/tts.js`)

**Files:** `js/tts.js`

**Steps:**

1. Implement — `js/tts.js`:
```js
// Pide el audio a /api/tts y lo reproduce. Devuelve una promesa que se
// resuelve cuando termina de hablar (o si el navegador bloquea el audio).
let currentAudio = null;

export async function speak(text, voiceId, volume = 1) {
  stopSpeaking();
  if (!text || !text.trim()) return;

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });
  if (!res.ok) throw new Error('No se pudo generar la voz');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;
    audio.volume = Math.max(0, Math.min(1, volume));
    const cleanup = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.play().catch(cleanup); // si el navegador bloquea autoplay, resolvemos igual
  });
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
```

2. Verify: Run: `node --check js/tts.js` → Expected: sin salida.

3. Commit: `feat: reproduccion de voz de la IA via /api/tts (tts.js)`

---

### Task 8: Estado de conversación (`js/conversation.js`)

**Files:** `js/conversation.js`

**Steps:**

1. Implement — `js/conversation.js`:
```js
import { buildSystemPrompt } from './prompts.js';

// Maneja el hilo de mensajes de una conversacion sobre un tema.
export function createConversation(name, topic, level) {
  const system = buildSystemPrompt(name, topic, level);
  const messages = []; // historial role/content para la API
  let exchanges = 0;   // cuantas veces ha respondido el usuario

  async function request() {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, system }),
    });
    if (!res.ok) throw new Error('No se pudo obtener respuesta');
    const data = await res.json();
    const reply = (data.reply || '').trim();
    messages.push({ role: 'assistant', content: reply });
    return reply;
  }

  return {
    // Primer turno: la IA saluda y hace la primera pregunta.
    async start() {
      messages.push({ role: 'user', content: '(El usuario abrió la conversación. Salúdalo y haz tu primera pregunta.)' });
      return request();
    },
    // El usuario responde por voz; devolvemos la siguiente frase de la IA.
    async send(userText) {
      messages.push({ role: 'user', content: userText });
      exchanges += 1;
      return request();
    },
    // Tras 5-6 intercambios sugerimos cerrar (el system prompt ya lo refuerza).
    shouldWrapUp() {
      return exchanges >= 5;
    },
  };
}
```

2. Verify: Run: `node --check js/conversation.js` → Expected: sin salida.

3. Commit: `feat: estado e hilo de conversacion (conversation.js)`

---

### Task 9: Estructura HTML de las 4 pantallas (`index.html`)

**Files:** `index.html`

**Steps:**

1. Implement — `index.html`:
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#E8633A" />
  <title>Charlemos</title>
  <link rel="manifest" href="manifest.json" />
  <link rel="apple-touch-icon" href="icons/icon-192.png" />
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <main id="app">

    <!-- Pantalla 1: Bienvenida -->
    <section class="screen screen--active" id="screen-welcome">
      <div class="welcome">
        <div class="welcome__icon">🗣️</div>
        <h1 class="welcome__title">¡Hola, <span id="welcome-name">Dario</span>!</h1>
        <p class="welcome__subtitle">Me alegra verte. ¿Conversamos un ratico?</p>
        <button class="btn btn--big" id="btn-start">¿De qué quieres hablar hoy?</button>
        <button class="btn btn--ghost" id="btn-settings">⚙️ Ajustes</button>
      </div>
    </section>

    <!-- Pantalla 2: Seleccion de tema -->
    <section class="screen" id="screen-topics">
      <h2 class="screen__title">¿De qué hablamos?</h2>
      <div class="topics" id="topics-grid"><!-- botones generados por JS --></div>
      <button class="btn btn--surprise" id="btn-surprise">🎲 Sorpréndeme</button>
      <button class="btn btn--ghost" id="btn-back-welcome">← Volver</button>
    </section>

    <!-- Pantalla 3: Conversacion -->
    <section class="screen" id="screen-chat">
      <div class="chat__bubble" id="ai-text" aria-live="polite">…</div>
      <div class="chat__status" id="chat-status"></div>
      <button class="mic" id="btn-mic" aria-label="Hablar">
        <span class="mic__icon">🎤</span>
        <span class="mic__label" id="mic-label">Toca para hablar</span>
      </button>
      <button class="btn btn--ghost" id="btn-change-topic">↺ Cambiar tema</button>
    </section>

    <!-- Pantalla 4: Ajustes -->
    <section class="screen" id="screen-settings">
      <h2 class="screen__title">Ajustes</h2>
      <label class="field">
        <span class="field__label">Nombre</span>
        <input class="field__input" id="input-name" type="text" autocomplete="off" />
      </label>
      <label class="field">
        <span class="field__label">Voz</span>
        <select class="field__input" id="select-voice"></select>
      </label>
      <label class="field">
        <span class="field__label">¿Cómo va hablando?</span>
        <select class="field__input" id="select-level"></select>
      </label>
      <label class="field">
        <span class="field__label">Volumen</span>
        <input class="field__input" id="input-volume" type="range" min="0" max="1" step="0.1" />
      </label>
      <button class="btn btn--big" id="btn-save-settings">Guardar</button>
      <button class="btn btn--ghost" id="btn-back-settings">← Volver</button>
    </section>

  </main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

2. Verify: abrir el archivo en el navegador (se hará en Task 12); por ahora confirmar que existe. Run: `node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');if(!h.includes('screen-chat')||!h.includes('js/app.js'))throw new Error('html incompleto');console.log('html ok')"` → Expected: `html ok`.

3. Commit: `feat: estructura HTML de las 4 pantallas (index.html)`

---

### Task 10: Estilos cálidos y accesibles (`css/styles.css`)

**Files:** `css/styles.css`

**Steps:**

1. Implement — `css/styles.css`:
```css
:root {
  --bg: #FFF6EE;
  --surface: #FFFFFF;
  --primary: #E8633A;     /* naranja cálido */
  --primary-dark: #C44E2A;
  --accent: #F2A65A;
  --text: #2B2320;
  --text-soft: #6B5E55;
  --ok: #4C9A5B;
  --shadow: 0 4px 16px rgba(0,0,0,0.12);
  font-size: 22px;        /* base minima exigida */
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  -webkit-tap-highlight-color: transparent;
}

#app { min-height: 100vh; }

.screen {
  display: none;
  min-height: 100vh;
  padding: 1.5rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom));
  flex-direction: column;
  gap: 1.25rem;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.screen--active { display: flex; }

.screen__title { font-size: 1.6rem; color: var(--primary-dark); }

/* Botones */
.btn {
  font-size: 1.2rem;
  font-weight: 700;
  border: none;
  border-radius: 1rem;
  padding: 1.1rem 1.4rem;
  width: 100%;
  max-width: 460px;
  cursor: pointer;
  box-shadow: var(--shadow);
}
.btn--big {
  background: var(--primary);
  color: #fff;
  font-size: 1.4rem;
  padding: 1.5rem 1.4rem;
  min-height: 88px;
}
.btn--big:active { background: var(--primary-dark); }
.btn--surprise { background: var(--accent); color: var(--text); }
.btn--ghost {
  background: transparent;
  color: var(--text-soft);
  box-shadow: none;
  font-weight: 600;
}

/* Bienvenida */
.welcome { display: flex; flex-direction: column; gap: 1.25rem; align-items: center; max-width: 460px; }
.welcome__icon { font-size: 4rem; }
.welcome__title { font-size: 2rem; }
.welcome__subtitle { font-size: 1.2rem; color: var(--text-soft); }

/* Temas */
.topics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: 100%;
  max-width: 460px;
}
.topic-btn {
  background: var(--surface);
  border: 3px solid transparent;
  border-radius: 1.25rem;
  padding: 1.5rem 0.5rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  min-height: 130px;
  justify-content: center;
}
.topic-btn:active { border-color: var(--primary); }
.topic-btn__icon { font-size: 2.6rem; }

/* Conversacion */
.chat__bubble {
  background: var(--surface);
  border-radius: 1.25rem;
  padding: 1.5rem;
  font-size: 1.5rem;
  line-height: 1.45;
  box-shadow: var(--shadow);
  width: 100%;
  max-width: 560px;
  min-height: 30vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat__status { font-size: 1.1rem; color: var(--text-soft); min-height: 1.5rem; }

.mic {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: none;
  background: var(--primary);
  color: #fff;
  cursor: pointer;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
.mic:active { background: var(--primary-dark); }
.mic--listening { background: var(--ok); animation: pulse 1.2s infinite; }
.mic__icon { font-size: 4rem; }
.mic__label { font-size: 1rem; font-weight: 700; }
.mic:disabled { opacity: 0.5; }

@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(76,154,91,0.6); }
  100% { box-shadow: 0 0 0 28px rgba(76,154,91,0); }
}

/* Campos de ajustes */
.field { width: 100%; max-width: 460px; text-align: left; display: flex; flex-direction: column; gap: 0.4rem; }
.field__label { font-weight: 700; font-size: 1.1rem; }
.field__input {
  font-size: 1.2rem;
  padding: 0.9rem 1rem;
  border: 2px solid var(--accent);
  border-radius: 0.75rem;
  background: #fff;
  width: 100%;
}
input[type="range"].field__input { padding: 0.5rem 0; }
```

2. Verify: Run: `node -e "const fs=require('fs');if(!fs.readFileSync('css/styles.css','utf8').includes('--primary'))throw new Error('css incompleto');console.log('css ok')"` → Expected: `css ok`.

3. Commit: `feat: estilos calidos, alto contraste y botones grandes (styles.css)`

---

### Task 11: Controlador principal (`js/app.js`)

**Files:** `js/app.js`

**Steps:**

1. Implement — `js/app.js`:
```js
import { TOPICS } from './prompts.js';
import { getConfig, saveConfig, VOICES, LEVELS } from './config.js';
import { createConversation } from './conversation.js';
import { createRecognizer } from './speech.js';
import { speak, stopSpeaking } from './tts.js';

const screens = {
  welcome: document.getElementById('screen-welcome'),
  topics: document.getElementById('screen-topics'),
  chat: document.getElementById('screen-chat'),
  settings: document.getElementById('screen-settings'),
};

function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove('screen--active'));
  screens[name].classList.add('screen--active');
}

// --- Pantalla 1: bienvenida ---
function refreshWelcome() {
  document.getElementById('welcome-name').textContent = getConfig().name;
}
document.getElementById('btn-start').addEventListener('click', () => show('topics'));
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('btn-back-welcome').addEventListener('click', () => show('welcome'));

// --- Pantalla 2: temas ---
const grid = document.getElementById('topics-grid');
for (const t of Object.values(TOPICS)) {
  const b = document.createElement('button');
  b.className = 'topic-btn';
  b.innerHTML = `<span class="topic-btn__icon">${t.icon}</span><span>${t.label}</span>`;
  b.addEventListener('click', () => startChat(t.key));
  grid.appendChild(b);
}
document.getElementById('btn-surprise').addEventListener('click', () => {
  const keys = Object.keys(TOPICS);
  startChat(keys[Math.floor(Math.random() * keys.length)]);
});
document.getElementById('btn-change-topic').addEventListener('click', () => {
  stopSpeaking();
  show('topics');
});

// --- Pantalla 3: conversacion ---
const aiText = document.getElementById('ai-text');
const statusEl = document.getElementById('chat-status');
const micBtn = document.getElementById('btn-mic');
const micLabel = document.getElementById('mic-label');

let conversation = null;
let recognizer = null;
let busy = false;

function setStatus(msg) { statusEl.textContent = msg || ''; }

async function sayAI(text) {
  aiText.textContent = text;
  const cfg = getConfig();
  try {
    await speak(text, cfg.voiceId, cfg.volume);
  } catch {
    setStatus('(No se pudo reproducir la voz, pero puedes leerlo)');
  }
}

async function startChat(topicKey) {
  show('chat');
  aiText.textContent = '…';
  setStatus('');
  busy = true;
  micBtn.disabled = true;
  const cfg0 = getConfig();
  conversation = createConversation(cfg0.name, topicKey, cfg0.level);
  try {
    const first = await conversation.start();
    await sayAI(first);
  } catch {
    aiText.textContent = 'Uy, no pude conectarme. Revisa el internet e inténtalo de nuevo.';
  } finally {
    busy = false;
    micBtn.disabled = false;
  }
}

function handleUserSpeech(text) {
  if (!text) return;
  busy = true;
  micBtn.disabled = true;
  setStatus(`Dijiste: "${text}"`);
  conversation.send(text)
    .then((reply) => sayAI(reply))
    .catch(() => { aiText.textContent = 'Perdón, no te escuché bien. ¿Me lo repites?'; })
    .finally(() => { busy = false; micBtn.disabled = false; });
}

micBtn.addEventListener('click', () => {
  if (busy) return;
  if (!recognizer) {
    recognizer = createRecognizer({
      onResult: handleUserSpeech,
      onError: () => { setStatus('No te escuché. Intenta otra vez.'); stopListeningUI(); },
      onEnd: stopListeningUI,
    });
  }
  if (!recognizer.supported) {
    setStatus('Este navegador no permite hablar. Usa Chrome.');
    return;
  }
  startListeningUI();
  recognizer.start();
});

function startListeningUI() {
  micBtn.classList.add('mic--listening');
  micLabel.textContent = 'Escuchando…';
  setStatus('');
}
function stopListeningUI() {
  micBtn.classList.remove('mic--listening');
  micLabel.textContent = 'Toca para hablar';
}

// --- Pantalla 4: ajustes ---
function openSettings() {
  const cfg = getConfig();
  document.getElementById('input-name').value = cfg.name;
  const sel = document.getElementById('select-voice');
  sel.innerHTML = '';
  for (const v of VOICES) {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.label;
    if (v.id === cfg.voiceId) opt.selected = true;
    sel.appendChild(opt);
  }
  const lvl = document.getElementById('select-level');
  lvl.innerHTML = '';
  for (const l of LEVELS) {
    const opt = document.createElement('option');
    opt.value = l.key;
    opt.textContent = l.label;
    if (l.key === cfg.level) opt.selected = true;
    lvl.appendChild(opt);
  }
  document.getElementById('input-volume').value = cfg.volume;
  show('settings');
}
document.getElementById('btn-save-settings').addEventListener('click', () => {
  saveConfig({
    name: document.getElementById('input-name').value.trim() || 'Dario',
    voiceId: document.getElementById('select-voice').value,
    level: document.getElementById('select-level').value,
    volume: parseFloat(document.getElementById('input-volume').value),
  });
  refreshWelcome();
  show('welcome');
});
document.getElementById('btn-back-settings').addEventListener('click', () => show('welcome'));

// --- Arranque ---
refreshWelcome();
show('welcome');

// Registrar service worker (PWA).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
```

2. Verify: Run: `node --check js/app.js` → Expected: sin salida (sintaxis válida).

3. Commit: `feat: controlador principal y navegacion entre pantallas (app.js)`

---

### Task 12: Verificación funcional en el navegador (manual)

**Files:** ninguno (verificación). Requiere las keys en `.env` y `vercel dev`.

**Steps:**

1. Crear `.env` real copiando `.env.example` y rellenando `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
2. Run: `npx vercel dev` → Expected: levanta servidor local en `http://localhost:3000` sirviendo el estático y las funciones `/api/chat` y `/api/tts`.
3. En Chrome de escritorio abrir `http://localhost:3000`. Verificar:
   - La bienvenida muestra "¡Hola, Dario!".
   - "¿De qué quieres hablar hoy?" lleva a los 5 temas + "Sorpréndeme".
   - Al elegir un tema, la IA saluda con texto grande Y se escucha la voz.
   - El botón de micrófono pide permiso, escucha y la IA responde con una sola pregunta.
   - "Cambiar tema" vuelve a la pantalla de temas.
   - Ajustes guarda nombre/voz/volumen/nivel y el saludo cambia.
   - Cambiar el nivel a "alto" vs "bajo" cambia visiblemente la complejidad de las preguntas de la IA (en alto, preguntas muy simples de 1-2 palabras; en bajo, charla normal).
4. Verificar en consola del navegador (F12) que NO aparezcan las API keys en ninguna petición (solo se ven `/api/chat` y `/api/tts`).
5. Commit (si hubo ajustes): `test: verificacion funcional manual en navegador`

---

### Task 13: Manifiesto PWA, service worker e íconos

**Files:** `manifest.json`, `service-worker.js`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`

**Steps:**

1. Implement — `manifest.json`:
```json
{
  "name": "Charlemos",
  "short_name": "Charlemos",
  "description": "Una conversacion calida cada dia",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FFF6EE",
  "theme_color": "#E8633A",
  "lang": "es",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

2. Implement — `service-worker.js`:
```js
// Cache simple del shell estatico. Las rutas /api/* NUNCA se cachean.
const CACHE = 'charlemos-v1';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/prompts.js',
  './js/config.js',
  './js/conversation.js',
  './js/speech.js',
  './js/tts.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return; // siempre a red
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

3. Generar los 3 íconos PNG (dos personas conversando, fondo naranja `#E8633A`). Crear primero un SVG fuente y rasterizarlo:
   - Crear `icons/source.svg` con dos siluetas/burbujas de diálogo sobre fondo cálido.
   - Run (si hay ImageMagick): `magick -background none icons/source.svg -resize 192x192 icons/icon-192.png && magick -background none icons/source.svg -resize 512x512 icons/icon-512.png` → Expected: genera los PNG.
   - Para el maskable, usar el mismo SVG con padding ~20% y exportar 512x512 a `icons/icon-maskable-512.png`.
   - **Si no hay ImageMagick:** generar los PNG con un pequeño script Node usando `sharp` (`npm i -D sharp` y `sharp('icons/source.svg').resize(192).png().toFile(...)`), o pedirle a Dario que suba 3 PNG. El plan no debe quedar bloqueado: documentar la opción elegida.

4. Verify: Run: `node -e "['icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','manifest.json','service-worker.js'].forEach(f=>{if(!require('fs').existsSync(f))throw new Error('falta '+f)});console.log('pwa assets ok')"` → Expected: `pwa assets ok`.

5. Commit: `feat: manifiesto PWA, service worker e iconos`

---

### Task 14: Configuración de Vercel (`vercel.json`)

**Files:** `vercel.json`

**Steps:**

1. Implement — `vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/*.js": { "runtime": "@vercel/node@5" }
  },
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    }
  ]
}
```

> Nota: en Vercel las funciones en `/api/*.js` se detectan automáticamente; este archivo solo fija el runtime de Node y evita que el service worker quede cacheado de forma agresiva.

2. Verify: Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));console.log('vercel.json valido')"` → Expected: `vercel.json valido`.

3. Commit: `chore: configuracion de despliegue en Vercel (vercel.json)`

---

### Task 15: README con instrucciones para principiante (`README.md`)

**Files:** `README.md`

**Steps:**

1. Implement — `README.md` con secciones:
   - **Qué es Charlemos** (1 párrafo).
   - **Obtener las 3 llaves** paso a paso:
     - Anthropic: console.anthropic.com → API Keys → Create Key → copiar.
     - ElevenLabs: elevenlabs.io → perfil → API Key → copiar. Voices → elegir voz español latino → copiar Voice ID.
   - **Subir a Vercel (sin saber nada antes):**
     1. Crear cuenta gratis en github.com y subir esta carpeta a un repositorio (o usar `npx vercel` desde la carpeta).
     2. Crear cuenta gratis en vercel.com con "Continuar con GitHub".
     3. "Add New Project" → importar el repositorio.
     4. En **Environment Variables** pegar `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
     5. "Deploy". Esperar el enlace `https://charlemos-xxxx.vercel.app`.
   - **Instalar en el celular Android de Dario:**
     1. Abrir ese enlace en **Chrome** del celular.
     2. Menú ⋮ → "Agregar a la pantalla de inicio" / "Instalar app".
     3. Confirmar. Aparece el ícono "Charlemos" en el inicio.
     4. La primera vez, al tocar el micrófono, **permitir el uso del micrófono**.
   - **Prueba rápida** y **solución de problemas** (sin voz → revisar keys en Vercel; no escucha → permisos de micrófono y usar Chrome).

   Contenido completo:
```markdown
# Charlemos 🗣️

Una PWA sencilla para conversar por voz, en español, con una compañía cálida.
Pensada para usarse a diario desde el celular.

## 1. Consigue tus 3 llaves (API keys)

Necesitas tres datos. Guárdalos en un lugar seguro.

**Anthropic (la conversación):**
1. Entra a https://console.anthropic.com y crea una cuenta.
2. Ve a *API Keys* → *Create Key* → copia la clave (empieza con `sk-ant-...`).

**ElevenLabs (la voz):**
1. Entra a https://elevenlabs.io y crea una cuenta.
2. En tu perfil copia tu *API Key*.
3. En *Voices* elige una voz en español latino y copia su *Voice ID*.

## 2. Súbela a internet con Vercel (gratis)

1. Crea una cuenta en https://vercel.com con "Continue with GitHub".
2. Sube esta carpeta a un repositorio de GitHub
   (o, desde la carpeta, ejecuta `npx vercel` y sigue las preguntas).
3. En Vercel: *Add New → Project* e importa el repositorio.
4. Antes de desplegar, abre *Environment Variables* y agrega:
   - `ANTHROPIC_API_KEY` = tu clave de Anthropic
   - `ELEVENLABS_API_KEY` = tu clave de ElevenLabs
   - `ELEVENLABS_VOICE_ID` = el Voice ID que copiaste
5. Pulsa *Deploy*. En un minuto tendrás un enlace como
   `https://charlemos-xxxx.vercel.app`.

## 3. Instálala en el celular Android

1. Abre ese enlace en **Google Chrome** del celular.
2. Toca el menú ⋮ (arriba a la derecha).
3. Elige **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**.
4. Confirma. Aparecerá el ícono **Charlemos** en la pantalla de inicio.
5. La primera vez que toques el micrófono, pulsa **Permitir** para el micrófono.

## 4. Cómo se usa

1. Abre Charlemos. Saluda por el nombre configurado.
2. Toca **"¿De qué quieres hablar hoy?"** y elige un tema.
3. Escucha y lee lo que dice. Toca el **micrófono** y responde hablando.
4. Para cambiar de tema, usa **"Cambiar tema"**.
5. Para cambiar el nombre, la voz o el volumen, entra a **Ajustes**.

## Problemas frecuentes

- **No se escucha la voz:** revisa que las 3 variables estén bien escritas en
  Vercel (Settings → Environment Variables) y vuelve a desplegar.
- **El micrófono no escucha:** usa Chrome y concede el permiso de micrófono.
  La captura de voz necesita conexión a internet.
- **Dice que no se pudo conectar:** revisa el internet del celular.

## Desarrollo local

```bash
npm install        # solo si agregas dependencias
npm test           # corre las pruebas
npx vercel dev     # levanta la app en http://localhost:3000
```
```

2. Verify: Run: `node -e "if(!require('fs').readFileSync('README.md','utf8').includes('Environment Variables'))throw new Error('readme incompleto');console.log('readme ok')"` → Expected: `readme ok`.

3. Commit: `docs: README con despliegue en Vercel e instalacion en Android`

---

### Task 16: Verificación final completa

**Files:** ninguno (verificación de cierre).

**Steps:**

1. Run: `npm test` → Expected:
```
# pass 29
# fail 0
```
2. Run: `for f in js/*.js api/*.js; do node --check "$f"; done` (o equivalente PowerShell) → Expected: sin errores de sintaxis en ningún archivo.
3. Re-desplegar en Vercel (push a la rama) y repetir la prueba de la Task 12 sobre el dominio real `https://...vercel.app` desde un celular Android: instalar, elegir tema, conversar por voz, cambiar tema, ajustes.
4. Confirmar checklist contra la spec original:
   - [ ] 4 pantallas (bienvenida, temas, conversación, ajustes) ✓
   - [ ] Nombre por defecto "Dario", app "Charlemos" ✓
   - [ ] Niveles de habla (alto/intermedio/bajo) en Ajustes y adaptación real del system prompt ✓
   - [ ] 5 temas + Sorpréndeme ✓
   - [ ] Texto ≥ 22px, alto contraste, botones enormes, colores cálidos ✓
   - [ ] STT (Web Speech) + TTS (ElevenLabs) + IA (claude-sonnet-4-6) ✓
   - [ ] System prompt: una pregunta a la vez, sin lenguaje clínico, cierre a 5-6 turnos ✓
   - [ ] API keys NO expuestas (proxy serverless) ✓
   - [ ] PWA instalable (manifest + service worker + íconos) ✓
   - [ ] Ajustes: nombre, 3 voces, volumen ✓
5. Commit final: `chore: verificacion final Charlemos lista para produccion`

---

## Self-Review (antes de ejecutar)

- ✅ Cada requisito de la spec mapea a una tarea (ver checklist Task 16).
- ✅ Sin lenguaje placeholder: todo el código está completo.
- ✅ Nombres consistentes entre tareas (sección "Convenciones de nombres").
- ✅ Cada tarea tiene paso de verificación.
- ✅ Las piezas con lógica pura (prompts, config, ambas funciones serverless) siguen TDD estricto; las piezas que dependen del navegador (speech, tts, app, UI) se verifican con `node --check` + prueba manual, porque la Web Speech API y el DOM no existen en Node.
- ✅ Seguridad: API keys solo en funciones serverless; el cliente nunca las ve.
- ⚠️ Punto a confirmar durante la ejecución: los 3 `voiceId` en `config.js` son IDs de voces públicas de ElevenLabs como punto de partida; Dario debe reemplazarlos por voces de su cuenta si quiere otras. El default real lo fija `ELEVENLABS_VOICE_ID`.
