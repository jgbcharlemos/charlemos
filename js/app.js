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

function refreshWelcome() {
  document.getElementById('welcome-name').textContent = getConfig().name;
}
document.getElementById('btn-start').addEventListener('click', () => show('topics'));
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('btn-back-welcome').addEventListener('click', () => show('welcome'));

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

refreshWelcome();
show('welcome');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
