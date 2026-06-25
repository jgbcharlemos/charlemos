import { TOPICS } from './prompts.js';
import { getConfig, saveConfig, VOICES, LEVELS } from './config.js';
import { createConversation } from './conversation.js';
import { createRecognizer } from './speech.js';
import { speak, stopSpeaking } from './tts.js';
import { createTimer, getSessionSlot, loadDayProgress, saveDayProgress } from './timer.js';
import { savePausedSession, loadPausedSession, clearPausedSession, submitReport } from './session.js';

const screens = {
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
    } catch {
      aiText.textContent = 'Uy, no pude conectarme. Revisa el internet e inténtalo de nuevo.';
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

document.getElementById('btn-change-topic').addEventListener('click', async () => {
  stopSpeaking();
  await endSession();
  show('topics');
  refreshWelcome();
});

document.getElementById('btn-keep-talking').addEventListener('click', () => show('chat'));
document.getElementById('btn-change-topic-completion').addEventListener('click', async () => {
  await endSession();
  show('topics');
  refreshWelcome();
});
document.getElementById('btn-bye').addEventListener('click', async () => {
  await endSession();
  refreshWelcome();
  show('welcome');
});

function handleUserSpeech(text) {
  if (!text) return;
  const trimmed = text.trim();
  // Si el reconocimiento capturó algo demasiado corto o ininteligible, señalárselo a Claude
  const isUnclear = trimmed.length < 2;
  const msgToSend = isUnclear ? '[NO_ENTENDÍ]' : trimmed;
  busy = true;
  micBtn.disabled = true;
  if (!isUnclear) setStatus(`Dijiste: "${trimmed}"`);
  conversation.send(msgToSend)
    .then(reply => sayAI(reply))
    .catch(() => { aiText.textContent = 'Perdón, no te escuché bien. ¿Me lo repites?'; })
    .finally(() => { busy = false; micBtn.disabled = false; setStatus(''); });
}

micBtn.addEventListener('click', () => {
  if (busy) return;
  if (!recognizer) {
    recognizer = createRecognizer({
      onResult: handleUserSpeech,
      onNoSpeech: () => { stopListeningUI(); handleUserSpeech('[NO_ENTENDÍ]'); },
      onError: () => { setStatus('No te escuché. Intenta otra vez.'); stopListeningUI(); },
      onEnd: stopListeningUI,
    });
  }
  if (!recognizer.supported) { setStatus('Este navegador no permite hablar. Usa Chrome.'); return; }
  startListeningUI();
  recognizer.start();
});

function startListeningUI() { micBtn.classList.add('mic--listening'); micLabel.textContent = 'Escuchando…'; setStatus(''); }
function stopListeningUI() { micBtn.classList.remove('mic--listening'); micLabel.textContent = 'Toca para hablar'; }

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
}
