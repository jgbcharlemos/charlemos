import { TOPICS } from './prompts.js';
import { getConfig, saveConfig, VOICES, LEVELS, VERSION } from './config.js';
import { createConversation } from './conversation.js';
import { createRecognizer } from './speech.js';
import { speak, stopSpeaking } from './tts.js';
import { createTimer, getSessionSlot, loadDayProgress, saveDayProgress } from './timer.js';
import { savePausedSession, loadPausedSession, clearPausedSession, submitReport } from './session.js';

const screens = {
  pin: document.getElementById('screen-pin'),
  welcome: document.getElementById('screen-welcome'),
  topics: document.getElementById('screen-topics'),
  chat: document.getElementById('screen-chat'),
  completion: document.getElementById('screen-completion'),
  settings: document.getElementById('screen-settings'),
};

function show(name) {
  Object.values(screens).forEach(s => s.classList.remove('screen--active'));
  screens[name].classList.add('screen--active');
}

const timerFill = document.getElementById('timer-fill');
const timerElapsed = document.getElementById('timer-elapsed');
function updateTimerUI({ pct, mins }) {
  timerFill.style.width = pct + '%';
  timerElapsed.textContent = mins + ' min';
}

function refreshSessionTags() {
  const progress = loadDayProgress();
  const tagAm = document.getElementById('tag-am');
  const tagPm = document.getElementById('tag-pm');
  tagAm.classList.toggle('tag--done', progress.am >= 15 * 60 * 1000);
  tagAm.classList.toggle('tag--pending', progress.am < 15 * 60 * 1000);
  tagPm.classList.toggle('tag--done', progress.pm >= 15 * 60 * 1000);
  tagPm.classList.toggle('tag--pending', progress.pm < 15 * 60 * 1000);
}

function refreshResumeBanner() {
  const paused = loadPausedSession();
  const banner = document.getElementById('resume-banner');
  const btnResume = document.getElementById('btn-resume');
  if (paused) {
    const t = TOPICS[paused.topicKey];
    document.getElementById('resume-topic-label').textContent =
      `${t ? t.icon + ' ' + t.label : paused.topicKey} · ${Math.round(paused.elapsedMs / 60000)} min guardados`;
    banner.style.display = 'block';
    btnResume.style.display = 'block';
  } else {
    banner.style.display = 'none';
    btnResume.style.display = 'none';
  }
}

function refreshWelcome() {
  document.getElementById('welcome-name').textContent = getConfig().name;
  refreshSessionTags();
  refreshResumeBanner();
}

const aiText = document.getElementById('ai-text');
const statusEl = document.getElementById('chat-status');
const micBtn = document.getElementById('btn-mic');
const micLabel = document.getElementById('mic-label');

let conversation = null;
let recognizer = null;
let busy = false;
let timer = null;
let currentSlot = 'am';
let currentTopicKey = null;

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

function onGoalReached() {
  const slot = currentSlot;
  const progress = loadDayProgress();
  progress[slot] = Math.max(progress[slot] || 0, 15 * 60 * 1000);
  saveDayProgress(progress);

  const cfg = getConfig();
  const name = cfg.name || 'Dario';
  const slotLabel = slot === 'am' ? 'la mañana' : 'la tarde';

  document.getElementById('completion-title').textContent = `¡Listo, Don ${name}!`;
  document.getElementById('completion-subtitle').textContent =
    `Ya cumplió su charla de ${slotLabel}. Estuvo muy bien.`;

  const p2 = loadDayProgress();
  document.getElementById('sessions-summary').innerHTML = `
    <div class="session-row">
      <span>☀️ Sesión mañana</span>
      ${p2.am >= 15*60*1000 ? '<span class="session-row__check">✓</span>' : '<span class="session-row__pending">–</span>'}
    </div>
    <div class="session-row">
      <span>🌙 Sesión tarde</span>
      ${p2.pm >= 15*60*1000 ? '<span class="session-row__check">✓</span>' : '<span class="session-row__pending">–</span>'}
    </div>
  `;

  show('completion');
}

async function startChat(topicKey, resume = false) {
  show('chat');
  aiText.textContent = '…';
  setStatus('');
  busy = true;
  micBtn.disabled = true;
  currentSlot = getSessionSlot();
  currentTopicKey = topicKey;

  const chatTag = document.getElementById('chat-session-tag');
  chatTag.textContent = currentSlot === 'am' ? '☀️ Mañana' : '🌙 Tarde';
  chatTag.className = `tag tag--${currentSlot}`;

  const t = TOPICS[topicKey];
  document.getElementById('chat-topic-label').textContent = t ? t.icon + ' ' + t.label : topicKey;

  const cfg = getConfig();
  let initialMessages = [];
  let savedElapsed = 0;

  if (resume) {
    const paused = loadPausedSession();
    if (paused) {
      initialMessages = paused.messages;
      savedElapsed = paused.elapsedMs || 0;
    }
  }

  conversation = createConversation(cfg.name, topicKey, cfg.level, initialMessages);

  timer = createTimer({ onTick: updateTimerUI, onGoalReached });

  if (resume && savedElapsed > 0) {
    timer.resume(savedElapsed);
    busy = false;
    micBtn.disabled = false;
    aiText.textContent = '¡Bienvenido de vuelta, Don ' + (cfg.name || 'Dario') + '! ¿Continuamos donde estábamos?';
  } else {
    timer.start();
    try {
      const first = await conversation.start();
      await sayAI(first);
    } catch (err) {
      if (err.code === 403) {
        localStorage.removeItem('charlemos_activated');
        show('pin');
        pinError.textContent = 'El acceso fue revocado. Ingresa el PIN de nuevo.';
      } else {
        aiText.textContent = 'Uy, no pude conectarme. Revisa el internet e inténtalo de nuevo.';
      }
    }
  }

  busy = false;
  micBtn.disabled = false;
}

async function endSession() {
  if (!conversation || !timer) return;
  const elapsed = timer.stop();
  const slot = currentSlot;
  const progress = loadDayProgress();
  progress[slot] = (progress[slot] || 0) + elapsed;
  saveDayProgress(progress);
  clearPausedSession();

  const cfg = getConfig();
  await submitReport({
    messages: conversation.getMessages(),
    topicKey: currentTopicKey,
    name: cfg.name,
    level: cfg.level,
    durationMs: elapsed,
    slot,
  });

  timer = null;
  conversation = null;
}

// ── PIN / activación ──────────────────────────────────────────────
function getOrCreateDeviceId() {
  let id = localStorage.getItem('charlemos_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('charlemos_device_id', id);
  }
  return id;
}

async function tryActivate(pin) {
  const deviceId = getOrCreateDeviceId();
  const res = await fetch('/api/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin, deviceId }),
  });
  return res;
}

function isActivated() {
  return localStorage.getItem('charlemos_activated') === '1';
}

const pinInput = document.getElementById('pin-input');
const pinError = document.getElementById('pin-error');
const btnPin   = document.getElementById('btn-pin');

async function handlePin() {
  const pin = pinInput.value.trim();
  if (!pin) return;
  btnPin.disabled = true;
  btnPin.textContent = 'Verificando…';
  pinError.textContent = '';
  try {
    const res = await tryActivate(pin);
    if (res.ok) {
      localStorage.setItem('charlemos_activated', '1');
      show('welcome');
    } else {
      const data = await res.json().catch(() => ({}));
      pinError.textContent = data.error || 'PIN incorrecto.';
      pinInput.value = '';
    }
  } catch {
    pinError.textContent = 'Error de conexión. Intenta de nuevo.';
  } finally {
    btnPin.disabled = false;
    btnPin.textContent = 'Entrar';
  }
}

btnPin.addEventListener('click', handlePin);
pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') handlePin(); });

// Al cargar: decidir qué pantalla mostrar
if (isActivated()) {
  getOrCreateDeviceId();
  show('welcome');
} else {
  show('pin');
}
// ────────────────────────────────────────────────────────────────

document.getElementById('btn-start').addEventListener('click', () => show('topics'));
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('btn-resume').addEventListener('click', () => {
  const paused = loadPausedSession();
  if (paused) startChat(paused.topicKey, true);
});

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
document.getElementById('btn-back-welcome').addEventListener('click', () => show('welcome'));

document.getElementById('btn-pause').addEventListener('click', async () => {
  autoListen = false;
  if (!conversation || !timer) return;
  const elapsed = timer.pause();
  savePausedSession({
    messages: conversation.getMessages(),
    topicKey: currentTopicKey,
    topicLabel: TOPICS[currentTopicKey]?.label || currentTopicKey,
    name: getConfig().name,
    level: getConfig().level,
    elapsedMs: elapsed,
    slot: currentSlot,
  });
  stopSpeaking();
  refreshWelcome();
  show('welcome');
});

document.getElementById('btn-change-topic').addEventListener('click', () => {
  autoListen = false;
  stopSpeaking();
  show('topics');
  refreshWelcome();
  endSession(); // en segundo plano
});

document.getElementById('btn-keep-talking').addEventListener('click', () => show('chat'));
document.getElementById('btn-change-topic-completion').addEventListener('click', () => {
  show('topics');
  refreshWelcome();
  endSession();
});
document.getElementById('btn-bye').addEventListener('click', () => {
  refreshWelcome();
  show('welcome');
  endSession();
});

let autoListen = false; // micrófono continuo activo

function ensureRecognizer() {
  if (recognizer) return;
  recognizer = createRecognizer({
    onResult: handleUserSpeech,
    onNoSpeech: () => {
      stopListeningUI();
      handleUserSpeech('[NO_ENTENDÍ]');
    },
    onError: () => {
      setStatus('');
      stopListeningUI();
      if (autoListen && !busy) setTimeout(startListening, 800);
    },
    onEnd: () => {
      stopListeningUI();
    },
  });
}

function startListening() {
  ensureRecognizer();
  if (!recognizer.supported) { setStatus('Usa Chrome para hablar.'); return; }
  if (busy) return;
  startListeningUI();
  recognizer.start();
}

function handleUserSpeech(text) {
  if (!text) return;
  const trimmed = text.trim();
  const isUnclear = trimmed.length < 2;
  const msgToSend = isUnclear ? '[NO_ENTENDÍ]' : trimmed;
  busy = true;
  micBtn.disabled = true;
  if (!isUnclear) setStatus(`Dijiste: "${trimmed}"`);
  conversation.send(msgToSend)
    .then(reply => sayAI(reply))
    .catch(() => { aiText.textContent = 'Perdón, no te escuché bien. ¿Me lo repites?'; })
    .finally(() => {
      busy = false;
      micBtn.disabled = false;
      setStatus('');
      if (autoListen) setTimeout(startListening, 400);
    });
}

micBtn.addEventListener('click', () => {
  if (busy) return;
  ensureRecognizer();
  if (!recognizer.supported) { setStatus('Usa Chrome para hablar.'); return; }
  if (autoListen) {
    // segundo toque: desactiva el modo continuo
    autoListen = false;
    stopListeningUI();
    micLabel.textContent = 'Toca para hablar';
    recognizer.stop();
  } else {
    autoListen = true;
    startListening();
  }
});

function startListeningUI() { micBtn.classList.add('mic--listening'); micLabel.textContent = 'Escuchando…'; setStatus(''); }
function stopListeningUI() { micBtn.classList.remove('mic--listening'); if (!autoListen) micLabel.textContent = 'Toca para hablar'; }

function openSettings() {
  const cfg = getConfig();
  document.getElementById('input-name').value = cfg.name;
  const sel = document.getElementById('select-voice');
  sel.innerHTML = '';
  for (const v of VOICES) {
    const opt = document.createElement('option');
    opt.value = v.id; opt.textContent = v.label;
    if (v.id === cfg.voiceId) opt.selected = true;
    sel.appendChild(opt);
  }
  const lvl = document.getElementById('select-level');
  lvl.innerHTML = '';
  for (const l of LEVELS) {
    const opt = document.createElement('option');
    opt.value = l.key; opt.textContent = l.label;
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

// Mostrar versión
document.getElementById('version-label').textContent = `v${VERSION}`;

// Service worker: registro + detección de actualizaciones
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('service-worker.js');

      const showUpdateBanner = () => {
        document.getElementById('update-banner').style.display = 'flex';
      };

      if (reg.waiting) showUpdateBanner();

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      document.getElementById('btn-update').addEventListener('click', () => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
      });

    } catch { /* ignorar */ }
  });
}
